import { NextResponse } from "next/server";
import { extractWorkbenchDraft } from "@/features/workbench/ai-extraction";
import { extractWorkbenchFileText } from "@/features/workbench/file-text";
import { getMvpUserId } from "@/features/workbench/mvp-user";
import { createIntakeDraft } from "@/features/workbench/repository";
import { hasSupabaseConfig } from "@/features/workbench/supabase";
import { randomId } from "@/lib/random-id";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择一个文件。" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = extractWorkbenchFileText({
      fileName: file.name,
      mimeType: file.type,
      buffer
    });

    const extraction = await extractWorkbenchDraft({
      mode: "summary",
      rawText: extractedText
    });

    const draft = hasSupabaseConfig()
      ? await createIntakeDraft({
          userId: getMvpUserId(),
          mode: "summary",
          rawText: extractedText,
          extraction
        })
      : { id: randomId() };

    return NextResponse.json({
      draftId: draft.id,
      storage: hasSupabaseConfig() ? "cloud" : "local",
      extraction,
      extractedText
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "文件读取失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
