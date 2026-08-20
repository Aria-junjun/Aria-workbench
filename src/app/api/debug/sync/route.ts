import { NextResponse } from "next/server";
import { createServiceClient } from "@/features/workbench/supabase";
import { normalizeWorkbenchData } from "@/features/workbench/local-store";
import { requireWorkbenchSession } from "@/features/auth/guard";

export async function GET(request: Request) {
  const authError = await requireWorkbenchSession(request);
  if (authError) return authError;
  const debug: Record<string, unknown> = {};

  try {
    // 1. 测试 Supabase 连接
    const { data, error } = await createServiceClient()
      .from("workbench_data")
      .select("data")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    debug.supabaseQuery = {
      hasData: !!data,
      hasError: !!error,
      errorMessage: error?.message,
      errorCode: error?.code,
    };

    if (data?.data) {
      const d = data.data as Record<string, unknown[]>;
      const products = (d.products || []) as Array<Record<string, unknown>>;

      // 原始数据
      debug.rawProducts = {
        count: products.length,
        items: products.map(p => ({
          name: p.name,
          specsCount: Array.isArray(p.specifications) ? p.specifications.length : 0,
          quotesCount: Array.isArray(p.procurementQuotes) ? p.procurementQuotes.length : 0,
        })),
      };

      // 规范化后的数据
      try {
        const normalized = normalizeWorkbenchData(data.data as Parameters<typeof normalizeWorkbenchData>[0]);
        debug.normalizedProducts = {
          count: normalized.products.length,
          items: normalized.products.map(p => ({
            name: p.name,
            specsCount: p.specifications.length,
            quotesCount: p.procurementQuotes.length,
            specNames: p.specifications.map(s => s.name),
            decisionSummary: p.decision?.summary || "无",
          })),
        };
      } catch (normErr) {
        debug.normalizeError = normErr instanceof Error ? { message: normErr.message, stack: normErr.stack } : String(normErr);
      }
    }
  } catch (e) {
    debug.exception = e instanceof Error ? { message: e.message, stack: e.stack } : String(e);
  }

  debug.env = {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  return NextResponse.json(debug);
}
