import * as XLSX from "xlsx";
import * as mammoth from "mammoth";
import * as yauzl from "yauzl";

export type FileTextInput = {
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
};

const textExtensions = [".txt", ".csv", ".tsv", ".md"];
const excelExtensions = [".xlsx", ".xls"];
const productResearchExtensions = [".md", ".txt", ".docx"];
export const MAX_PRODUCT_RESEARCH_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DOCX_ENTRIES = 500;
const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 5_000_000;

export class ProductFileTextError extends Error {}

export function extractWorkbenchFileText(input: FileTextInput) {
  const extension = getExtension(input.fileName);
  if (textExtensions.includes(extension)) {
    return input.buffer.toString("utf8").trim();
  }

  if (excelExtensions.includes(extension)) {
    return extractWorkbookText(input.fileName, input.buffer);
  }

  throw new Error("暂不支持这个文件类型。当前支持 .xlsx、.xls、.csv、.txt。");
}

export async function extractProductResearchFileText(input: FileTextInput): Promise<string> {
  const extension = getExtension(input.fileName);
  if (!productResearchExtensions.includes(extension)) {
    throw new ProductFileTextError("当前支持 Markdown、TXT 和 Word 文档。");
  }

  if (input.buffer.length > MAX_PRODUCT_RESEARCH_FILE_BYTES) {
    throw new ProductFileTextError("文件大小不能超过 10MB。");
  }

  const text = extension === ".docx"
    ? await extractDocxText(input.buffer)
    : input.buffer.toString("utf8");
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new ProductFileTextError("文件中没有可读取的文字。");
  }

  return normalizedText;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  await preflightDocx(buffer);

  try {
    const result = await mammoth.extractRawText({ buffer });
    if (typeof result.value !== "string") {
      throw new Error("missing raw text");
    }
    if (result.value.length > MAX_EXTRACTED_TEXT_CHARS) {
      throw new ProductFileTextError("文件中的文字过长。");
    }
    return result.value;
  } catch (error) {
    if (error instanceof ProductFileTextError) throw error;
    throw new ProductFileTextError("Word 文档读取失败。");
  }
}

async function preflightDocx(buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) {
        reject(new ProductFileTextError("Word 文档格式无效。"));
        return;
      }

      let entryCount = 0;
      let totalUncompressedBytes = 0;
      let settled = false;

      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        zip.close();
        reject(new ProductFileTextError(message));
      };
      const readNextEntry = () => {
        if (!settled) zip.readEntry();
      };

      zip.on("error", () => fail("Word 文档格式无效。"));
      zip.on("entry", (entry) => {
        entryCount += 1;
        if (entryCount > MAX_DOCX_ENTRIES) {
          fail("Word 文档包含过多文件。");
          return;
        }

        if (entry.fileName.endsWith("/")) {
          readNextEntry();
          return;
        }

        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            fail("Word 文档读取失败。");
            return;
          }

          stream.on("data", (chunk: Buffer) => {
            totalUncompressedBytes += chunk.length;
            if (totalUncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
              stream.destroy();
              fail("Word 文档解压后的内容过大。");
            }
          });
          stream.on("error", () => fail("Word 文档读取失败。"));
          stream.on("end", readNextEntry);
        });
      });
      zip.on("end", () => {
        if (settled) return;
        settled = true;
        zip.close();
        resolve();
      });

      readNextEntry();
    });
  });
}

function extractWorkbookText(fileName: string, buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetTexts = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date | null>>(sheet, {
      header: 1,
      blankrows: false,
      defval: ""
    });
    const body = rows
      .map((row) => row.map(formatCell).join("\t").replace(/\t+$/g, ""))
      .filter(Boolean)
      .join("\n");

    return `【工作表】${sheetName}\n${body}`;
  }).filter((text) => text.trim().length > 0);

  return [`【文件】${fileName}`, ...sheetTexts].join("\n\n").trim();
}

function formatCell(value: string | number | boolean | Date | null) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").trim();
}

function getExtension(fileName: string) {
  const normalized = fileName.toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex >= 0 ? normalized.slice(dotIndex) : "";
}
