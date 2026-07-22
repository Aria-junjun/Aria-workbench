import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/features/workbench/supabase";

export async function GET() {
  return NextResponse.json({
    aiExtractionEnabled: Boolean(process.env.OPENAI_API_KEY),
    cloudPersistenceEnabled: hasSupabaseConfig()
  });
}
