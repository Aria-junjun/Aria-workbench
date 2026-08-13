import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { randomId } from "@/lib/random-id";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/heic",
  "image/heif",
  "image/x-icon"
]);

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "heic",
  "heif",
  "ico"
]);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function getStorageDir() {
  const dir = path.resolve(process.cwd(), "public", "uploads", "avatars");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function detectExtension(filename: string, mimeType: string): string | null {
  // 1. from mime type
  const fromMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/x-icon": "ico"
  };
  if (fromMime[mimeType]) return fromMime[mimeType];

  // 2. from file extension
  const ext = path.extname(filename).replace(/^\./, "").toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return null;
}

export async function GET() {
  try {
    const dir = getStorageDir();
    const files = fs.readdirSync(dir).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ALLOWED_EXTENSIONS.has(ext.replace(/^\./, ""));
    }).sort((a, b) => {
      try {
        const aStat = fs.statSync(path.join(dir, a));
        const bStat = fs.statSync(path.join(dir, b));
        return bStat.mtimeMs - aStat.mtimeMs;
      } catch {
        return 0;
      }
    });

    const latest = files.length > 0 ? `/uploads/avatars/${files[0]}` : null;
    return NextResponse.json({ url: latest });
  } catch {
    return NextResponse.json({ url: null });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("avatar");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择要上传的头像图片。" }, { status: 400 });
    }

    const filename = (file as File & { name?: string }).name || "avatar";
    const mimeType = file.type || "";
    const ext = detectExtension(filename, mimeType);

    if (!ext) {
      return NextResponse.json(
        { error: `不支持的图片格式（${mimeType || "未知类型"}），仅支持 JPG、PNG、WebP、GIF、BMP、HEIC。` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "图片文件为空，请重新选择。" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      const mb = (file.size / 1024 / 1024).toFixed(2);
      return NextResponse.json(
        { error: `图片太大（${mb}MB），请选择 5MB 以内的图片。` },
        { status: 400 }
      );
    }

    const dir = getStorageDir();

    // 删除旧头像
    const oldFiles = fs.readdirSync(dir).filter((f) => {
      const fx = path.extname(f).replace(/^\./, "").toLowerCase();
      return ALLOWED_EXTENSIONS.has(fx);
    });
    for (const old of oldFiles) {
      try {
        fs.unlinkSync(path.join(dir, old));
      } catch {
        // ignore
      }
    }

    const filenameOut = `avatar-${randomId()}.${ext}`;
    const filePath = path.join(dir, filenameOut);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/avatars/${filenameOut}?t=${Date.now()}`;
    return NextResponse.json({ url: publicUrl });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "头像上传失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const dir = getStorageDir();
    const files = fs.readdirSync(dir).filter((f) => {
      const ext = path.extname(f).replace(/^\./, "").toLowerCase();
      return ALLOWED_EXTENSIONS.has(ext);
    });
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch {
        // ignore
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
