import { NextRequest, NextResponse } from "next/server";
import { requireWorkbenchSession } from "@/features/auth/guard";
import { mergeLifecycleRecords, type LifecycleRecord } from '@/features/workbench/supplier-lifecycle';

// 服务端代理：转发 Supabase 请求，绕开浏览器网络限制（CORS/ERR_TIMED_OUT）
// 仅处理 workbench_data 表的简单读写场景（select / upsert）

export const runtime = "nodejs";

const TABLE = "workbench_data";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured");
  return { apiBase: `${url}/rest/v1`, key };
}

async function callSupabase(path: string, init: RequestInit) {
  const { apiBase, key } = getSupabaseConfig();
  const headers = new Headers(init.headers);
  // 服务端统一添加鉴权（若有 service_role 则优先使用）
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  headers.set("Prefer", "return=representation,resolution=merge-duplicates");

  const url = `${apiBase}${path}`;
  let res: Response | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      res = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout?.(30_000),
        cache: "no-store"
      });
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  if (!res) throw lastError instanceof Error ? lastError : new Error(String(lastError));

  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // 非 JSON（例如空响应或错误文本）保持原样
  }

  return new NextResponse(
    JSON.stringify({ ok: res.ok, status: res.status, data }),
    {
      status: res.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" }
    }
  );
}

// GET /api/supabase-proxy?action=latest  →  最新一条数据
// GET /api/supabase-proxy?action=count  →  记录总数
export async function GET(req: NextRequest) {
  const authError = await requireWorkbenchSession(req);
  if (authError) return authError;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "latest";

  try {
    if (action === "count") {
      return callSupabase(
        `/${TABLE}?select=id`,
        {
          method: "GET",
          headers: {
            // HEAD 模式只返回 count
            Prefer: "return=representation"
          }
        }
      );
    }

    // latest（默认）: 按 updated_at 倒序取第一条
    return callSupabase(
      `/${TABLE}?select=id%2Cupdated_at%2Cdata&order=updated_at.desc&limit=1`,
      { method: "GET" }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, status: 502, data: { error: "proxy_failed", message } },
      { status: 502 }
    );
  }
}

// POST /api/supabase-proxy
// body:
//   { action: "upsert", expectedUpdatedAt: <latest revision>, data: <full workbench data> }
export async function POST(req: NextRequest) {
  const authError = await requireWorkbenchSession(req);
  if (authError) return authError;
  let body: { action?: string; data?: unknown; expectedUpdatedAt?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, status: 400, data: { error: "invalid_json" } },
      { status: 400 }
    );
  }

  const action = body.action ?? "upsert";

  if (action !== 'upsert' || typeof body.expectedUpdatedAt !== 'string' || !body.expectedUpdatedAt) {
    return NextResponse.json({ ok: false, data: { error: 'revision_required' } }, { status: 409 });
  }

  try {
    getSupabaseConfig();
    if (action === "upsert") {
      const { apiBase, key } = getSupabaseConfig();
      // 简化逻辑：先查是否已有记录，有则更新第一条，无则插入
      const latest = await fetch(
        `${apiBase}/${TABLE}?select=id,data,updated_at&order=updated_at.desc&limit=1`,
        {
          method: "GET",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Prefer: "return=representation"
          }
        }
      );
      const latestText = await latest.text();
      if (!latest.ok) throw new Error('Cannot read current snapshot before saving');
      let latestJson: Array<{ id: string; updated_at?: string; data?: { supplierLifecycleRecords?: LifecycleRecord[] } }> = [];
      try {
        latestJson = JSON.parse(latestText);
      } catch {
        throw new Error('Invalid current snapshot response');
      }

      if (!Array.isArray(latestJson)) throw new Error('Invalid current snapshot response');
      if (latestJson.length > 0) {
        if (latestJson[0].updated_at !== body.expectedUpdatedAt) {
          return NextResponse.json({ ok: false, data: { error: 'snapshot_changed' } }, { status: 409 });
        }
        const id = latestJson[0].id;
        const incoming = body.data && typeof body.data === 'object' ? body.data as Record<string, unknown> : {};
        const remote = latestJson[0].data?.supplierLifecycleRecords ?? [];
        const mergedData = { ...incoming, supplierLifecycleRecords: mergeLifecycleRecords(remote, Array.isArray(incoming.supplierLifecycleRecords) ? incoming.supplierLifecycleRecords as LifecycleRecord[] : []) };
        const revisionGuard = `&updated_at=eq.${encodeURIComponent(body.expectedUpdatedAt)}`;
        const response = await callSupabase(
          `/${TABLE}?id=eq.${encodeURIComponent(id)}${revisionGuard}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              data: mergedData,
              updated_at: new Date().toISOString()
            })
          }
        );
        if (response.ok) {
          const result = await response.clone().json();
          if (Array.isArray(result.data) && result.data.length === 0) return NextResponse.json({ ok: false, data: { error: 'snapshot_changed', message: '数据已被其他操作更新，本地内容仍保留，请重试同步。' } }, { status: 409 });
        }
        return response;
      }

      return NextResponse.json({ ok: false, data: { error: 'snapshot_missing' } }, { status: 409 });
    }

    return NextResponse.json(
      { ok: false, status: 400, data: { error: "unknown_action", action } },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, status: 502, data: { error: "proxy_failed", message } },
      { status: 502 }
    );
  }
}
