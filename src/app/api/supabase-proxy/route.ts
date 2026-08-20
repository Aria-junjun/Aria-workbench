import { NextRequest, NextResponse } from "next/server";
import { requireWorkbenchSession } from "@/features/auth/guard";

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
  const res = await fetch(url, {
    ...init,
    headers,
    // 30 秒超时
    signal: AbortSignal.timeout?.(30_000),
    // 服务端不走 HTTP/2 保持连接，避免偶发超时
    cache: "no-store"
  });

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
      `/${TABLE}?select=data&order=updated_at.desc&limit=1`,
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
//   { action: "upsert", data: <full workbench data> }
//   { action: "insert", data: <full workbench data> }
//   { action: "update", id: <string>, data: <partial> }
export async function POST(req: NextRequest) {
  const authError = await requireWorkbenchSession(req);
  if (authError) return authError;
  let body: { action?: string; data?: unknown; id?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, status: 400, data: { error: "invalid_json" } },
      { status: 400 }
    );
  }

  const action = body.action ?? "upsert";

  try {
    getSupabaseConfig();
    if (action === "upsert") {
      const { apiBase, key } = getSupabaseConfig();
      // 简化逻辑：先查是否已有记录，有则更新第一条，无则插入
      const latest = await fetch(
        `${apiBase}/${TABLE}?select=id&order=updated_at.desc&limit=1`,
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
      let latestJson: Array<{ id: string }> = [];
      try {
        latestJson = JSON.parse(latestText);
      } catch {
        latestJson = [];
      }

      if (Array.isArray(latestJson) && latestJson.length > 0) {
        const id = latestJson[0].id;
        return callSupabase(
          `/${TABLE}?id=eq.${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              data: body.data,
              updated_at: new Date().toISOString()
            })
          }
        );
      }

      return callSupabase(
        `/${TABLE}`,
        {
          method: "POST",
          body: JSON.stringify({ data: body.data })
        }
      );
    }

    if (action === "insert") {
      return callSupabase(
        `/${TABLE}`,
        {
          method: "POST",
          body: JSON.stringify({ data: body.data })
        }
      );
    }

    if (action === "update" && body.id) {
      return callSupabase(
        `/${TABLE}?id=eq.${encodeURIComponent(body.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            data: body.data,
            updated_at: new Date().toISOString()
          })
        }
      );
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
