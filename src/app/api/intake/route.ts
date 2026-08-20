import { NextResponse } from "next/server";
import { requireWorkbenchSession } from "@/features/auth/guard";
import { z } from "zod";
import { extractWorkbenchDraft } from "@/features/workbench/ai-extraction";
import { getMvpUserId } from "@/features/workbench/mvp-user";
import { createIntakeDraft } from "@/features/workbench/repository";
import { hasSupabaseConfig } from "@/features/workbench/supabase";
import { randomId } from "@/lib/random-id";

const IntakeRequestSchema = z.object({
  mode: z.enum(["screenshot", "chat", "summary"]),
  rawText: z.string().default(""),
  sourceUrl: z.string().url().optional(),
  images: z
    .array(
      z.object({
        dataUrl: z.string().min(1),
        mimeType: z.string().min(1)
      })
    )
    .default([])
}).refine((value) => value.rawText.trim().length > 0 || value.images.length > 0, {
  message: "rawText or images is required"
});

export async function POST(request: Request) {
  const authError = await requireWorkbenchSession(request);
  if (authError) return authError;
  const body = IntakeRequestSchema.parse(await request.json());
  const extraction = await extractWorkbenchDraft(body);
  const draft = hasSupabaseConfig()
    ? await createIntakeDraft({
        userId: getMvpUserId(),
        mode: body.mode,
        rawText: body.rawText,
        sourceUrl: body.sourceUrl,
        extraction
      })
    : { id: randomId() };

  return NextResponse.json({
    draftId: draft.id,
    storage: hasSupabaseConfig() ? "cloud" : "local",
    extraction
  });
}
