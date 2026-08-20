import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  getSessionSecret,
  verifySessionToken
} from "@/features/auth/session";

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

export async function requireWorkbenchSession(request: Request): Promise<NextResponse | null> {
  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token || !(await verifySessionToken(token, secret))) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  return null;
}
