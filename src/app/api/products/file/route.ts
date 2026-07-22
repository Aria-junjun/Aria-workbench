import { NextResponse } from "next/server";
import {
  extractProductResearchFileText,
  MAX_PRODUCT_RESEARCH_FILE_BYTES,
  ProductFileTextError
} from "@/features/workbench/file-text";

const MAX_MULTIPART_BYTES = MAX_PRODUCT_RESEARCH_FILE_BYTES + 64 * 1024;

export async function POST(request: Request) {
  const contentLengthError = getContentLengthError(request);
  if (contentLengthError) {
    return NextResponse.json({ error: contentLengthError }, { status: 400 });
  }

  let file: FormDataEntryValue | null;
  try {
    const formData = await request.formData();
    file = formData.get("file");
  } catch {
    return NextResponse.json({ error: "请求体格式无效。" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择一个文件。" }, { status: 400 });
  }

  if (file.size > MAX_PRODUCT_RESEARCH_FILE_BYTES) {
    return NextResponse.json({ error: "文件大小不能超过 10MB。" }, { status: 400 });
  }

  try {
    const text = await extractProductResearchFileText({
      fileName: file.name,
      mimeType: file.type,
      buffer: Buffer.from(await file.arrayBuffer())
    });

    return NextResponse.json({ fileName: file.name, text });
  } catch (error) {
    const message = error instanceof ProductFileTextError ? error.message : "文件读取失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function getContentLengthError(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength || !/^[1-9]\d*$/.test(contentLength)) {
    return "请求体大小无效。";
  }

  const bytes = BigInt(contentLength);
  return bytes > BigInt(MAX_MULTIPART_BYTES) ? "请求体大小超过允许范围。" : null;
}
