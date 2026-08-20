import { NextResponse } from "next/server";
import { requireWorkbenchSession } from "@/features/auth/guard";
import { DraftExtractionSchema } from "@/features/workbench/schemas";
import { getMvpUserId } from "@/features/workbench/mvp-user";
import { confirmDraft } from "@/features/workbench/repository";
import { hasSupabaseConfig } from "@/features/workbench/supabase";

export async function POST(request: Request, context: { params: Promise<{ draftId: string }> }) {
  const authError = await requireWorkbenchSession(request);
  if (authError) return authError;
  const extraction = DraftExtractionSchema.parse(await request.json());
  const { draftId } = await context.params;

  if (!hasSupabaseConfig()) {
    return NextResponse.json({
      storage: "local",
      skipped: true
    });
  }

  const result = await confirmDraft({
    userId: getMvpUserId(),
    draftId,
    extraction
  });

  return NextResponse.json({
    storage: "cloud",
    ...result
  });
}
