import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/products/file/route";
import { extractProductResearchFileText } from "@/features/workbench/file-text";

const { extractRawText, fromBuffer } = vi.hoisted(() => ({ extractRawText: vi.fn(), fromBuffer: vi.fn() }));

vi.mock("mammoth", () => ({ extractRawText }));
vi.mock("yauzl", () => ({ fromBuffer }));

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + 64 * 1024;
const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 5_000_000;

type ZipEntryFixture = {
  fileName: string;
  chunks?: Buffer[];
};

function mockDocxEntries(entries: ZipEntryFixture[]) {
  fromBuffer.mockImplementation((_buffer, options, callback) => {
    expect(options).toMatchObject({ lazyEntries: true });

    const zip = new EventEmitter() as EventEmitter & {
      close: ReturnType<typeof vi.fn>;
      openReadStream: ReturnType<typeof vi.fn>;
      readEntry: ReturnType<typeof vi.fn>;
    };
    let index = 0;
    zip.close = vi.fn();
    zip.openReadStream = vi.fn((entry: ZipEntryFixture, done: (error: Error | null, stream: Readable) => void) => {
      done(null, Readable.from(entry.chunks ?? []));
    });
    zip.readEntry = vi.fn(() => {
      const entry = entries[index++];
      queueMicrotask(() => zip.emit(entry ? "entry" : "end", entry));
    });

    callback(null, zip);
  });
}

function createRequest(formData: FormData | { get: (name: string) => FormDataEntryValue | null }, contentLength = "100") {
  return {
    headers: new Headers({ "content-length": contentLength }),
    formData: vi.fn().mockResolvedValue(formData)
  } as unknown as Request;
}

describe("extractProductResearchFileText", () => {
  beforeEach(() => {
    extractRawText.mockReset();
    fromBuffer.mockReset();
  });

  it("reads UTF-8 Markdown files", async () => {
    await expect(
      extractProductResearchFileText({
        fileName: "research.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# Product research\n\nKey finding", "utf8")
      })
    ).resolves.toBe("# Product research\n\nKey finding");
  });

  it("reads UTF-8 text files", async () => {
    await expect(
      extractProductResearchFileText({
        fileName: "research.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Product research notes", "utf8")
      })
    ).resolves.toBe("Product research notes");
  });

  it("extracts raw text from Word documents", async () => {
    extractRawText.mockResolvedValue({ value: "Word research notes" });
    mockDocxEntries([{ fileName: "word/document.xml", chunks: [Buffer.from("Word document")] }]);
    const buffer = Buffer.from("docx");

    await expect(
      extractProductResearchFileText({
        fileName: "research.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer
      })
    ).resolves.toBe("Word research notes");

    expect(extractRawText).toHaveBeenCalledWith({ buffer });
  });

  it("rejects files without readable text", async () => {
    await expect(
      extractProductResearchFileText({
        fileName: "empty.txt",
        buffer: Buffer.from(" \n\t ", "utf8")
      })
    ).rejects.toThrow("文件中没有可读取的文字");
  });

  it("rejects files larger than 10 MB", async () => {
    await expect(
      extractProductResearchFileText({
        fileName: "large.md",
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1, "a")
      })
    ).rejects.toThrow("文件大小不能超过 10MB");
  });

  it("rejects unsupported file extensions", async () => {
    await expect(
      extractProductResearchFileText({
        fileName: "research.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("pdf")
      })
    ).rejects.toThrow("当前支持 Markdown、TXT 和 Word 文档");
  });

  it("rejects Word documents with too many ZIP entries before extraction", async () => {
    mockDocxEntries(Array.from({ length: 501 }, () => ({ fileName: "word/document.xml" })));

    await expect(
      extractProductResearchFileText({ fileName: "entries.docx", buffer: Buffer.from("docx") })
    ).rejects.toThrow("Word 文档包含过多文件");
    expect(extractRawText).not.toHaveBeenCalled();
  });

  it("rejects Word documents that expand beyond the uncompressed size limit", async () => {
    mockDocxEntries([{
      fileName: "word/document.xml",
      chunks: [Buffer.alloc(MAX_DOCX_UNCOMPRESSED_BYTES), Buffer.from("x")]
    }]);

    await expect(
      extractProductResearchFileText({ fileName: "expanded.docx", buffer: Buffer.from("docx") })
    ).rejects.toThrow("Word 文档解压后的内容过大");
    expect(extractRawText).not.toHaveBeenCalled();
  });

  it("rejects extracted text longer than the output limit", async () => {
    extractRawText.mockResolvedValue({ value: "a".repeat(MAX_EXTRACTED_TEXT_CHARS + 1) });
    mockDocxEntries([{ fileName: "word/document.xml", chunks: [Buffer.from("Word document")] }]);

    await expect(
      extractProductResearchFileText({ fileName: "long-output.docx", buffer: Buffer.from("docx") })
    ).rejects.toThrow("文件中的文字过长");
  });

  it("accepts Markdown text longer than the DOCX output limit when the file is within 10 MB", async () => {
    const text = "a".repeat(MAX_EXTRACTED_TEXT_CHARS + 1);

    await expect(
      extractProductResearchFileText({ fileName: "large.md", buffer: Buffer.from(text) })
    ).resolves.toBe(text);
  });
});

describe("POST /api/products/file", () => {
  it("returns the uploaded file name and extracted text", async () => {
    const formData = new FormData();
    formData.append("file", new File(["# Research\nProduct notes"], "research.md", { type: "text/markdown" }));

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      fileName: "research.md",
      text: "# Research\nProduct notes"
    });
  });

  it("returns a 400 error when no file is supplied", async () => {
    const response = await POST(createRequest(new FormData()));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "请选择一个文件。" });
  });

  it("returns a 400 error for invalid multipart bodies", async () => {
    const request = {
      headers: new Headers({ "content-length": "100" }),
      formData: vi.fn().mockRejectedValue(new Error("invalid multipart"))
    } as unknown as Request;
    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "请求体格式无效。" });
  });

  it("returns a 400 error when parsed multipart data cannot read the file field", async () => {
    const response = await POST({
      headers: new Headers({ "content-length": "100" }),
      formData: vi.fn().mockResolvedValue({
        get: vi.fn().mockImplementation(() => {
          throw new Error("invalid form data");
        })
      })
    } as unknown as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "请求体格式无效。" });
  });

  it("rejects oversized Content-Length before parsing multipart data", async () => {
    const formData = vi.fn();
    const response = await POST({
      headers: new Headers({ "content-length": String(MAX_MULTIPART_BYTES + 1) }),
      formData
    } as unknown as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "请求体大小超过允许范围。" });
    expect(formData).not.toHaveBeenCalled();
  });

  it("rejects missing Content-Length before parsing multipart data", async () => {
    const formData = vi.fn();
    const response = await POST({ headers: new Headers(), formData } as unknown as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "请求体大小无效。" });
    expect(formData).not.toHaveBeenCalled();
  });

  it("rejects invalid Content-Length before parsing multipart data", async () => {
    const formData = vi.fn();
    const response = await POST({
      headers: new Headers({ "content-length": "10.5" }),
      formData
    } as unknown as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "请求体大小无效。" });
    expect(formData).not.toHaveBeenCalled();
  });

  it("rejects oversized files before reading their content", async () => {
    const file = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "large.md", { type: "text/markdown" });
    const arrayBuffer = vi.fn();
    Object.defineProperty(file, "arrayBuffer", { value: arrayBuffer });
    const formData = { get: vi.fn().mockReturnValue(file) } as unknown as FormData;

    const response = await POST({
      headers: new Headers({ "content-length": "100" }),
      formData: vi.fn().mockResolvedValue(formData)
    } as unknown as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "文件大小不能超过 10MB。" });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("returns a 400 error for unsupported files", async () => {
    const formData = new FormData();
    formData.append("file", new File(["pdf"], "research.pdf", { type: "application/pdf" }));

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "当前支持 Markdown、TXT 和 Word 文档。" });
  });
});
