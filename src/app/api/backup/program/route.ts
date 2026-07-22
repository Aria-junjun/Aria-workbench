import { NextResponse } from "next/server";
import { createProgramBackupArchive } from "@/features/workbench/program-backup";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { businessData?: unknown; productDrafts?: unknown };
    if (typeof body.businessData !== "string" || body.businessData.length > 20_000_000) {
      return NextResponse.json({ error: "业务数据格式不正确或文件过大。" }, { status: 400 });
    }
    if (typeof body.productDrafts !== "string" || body.productDrafts.length > 20_000_000) {
      return NextResponse.json({ error: "产品草稿格式不正确或文件过大。" }, { status: 400 });
    }
    const archive = createProgramBackupArchive(process.cwd(), body.businessData, body.productDrafts);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(archive.buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`个人商业工作台完整备份-${date}.zip`)}`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Program backup failed", error);
    return NextResponse.json({ error: "完整程序备份生成失败。" }, { status: 500 });
  }
}
