import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getSessionCookieOptions,
  getSessionSecret
} from "@/features/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const configuredPassword = process.env.WORKBENCH_PASSWORD;
  if (!configuredPassword) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  if (typeof body.password !== "string" || body.password !== configuredPassword) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  const token = await createSessionToken(secret, "workbench");
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    ...getSessionCookieOptions()
  });
  return response;
}
