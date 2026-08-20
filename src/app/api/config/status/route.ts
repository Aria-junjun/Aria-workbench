import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/features/workbench/supabase";
import { requireWorkbenchSession } from "@/features/auth/guard";

export async function GET(request: Request) {
  const authError = await requireWorkbenchSession(request);
  if (authError) return authError;
  return NextResponse.json({
    aiExtractionEnabled: Boolean(process.env.OPENAI_API_KEY),
    cloudPersistenceEnabled: hasSupabaseConfig()
  });
}
