import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "workbench_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  sub: string;
  exp: number;
};

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export async function createSessionToken(
  secret: string,
  subject: string,
  now = Math.floor(Date.now() / 1000)
): Promise<string> {
  if (!secret) {
    throw new Error("session secret is required");
  }

  const payload: SessionPayload = {
    sub: subject,
    exp: now + SESSION_TTL_SECONDS
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  if (!secret || !token) return false;

  const [encodedPayload, providedSignature, ...extra] = token.split(".");
  if (!encodedPayload || !providedSignature || extra.length > 0) return false;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return false;
  }

  if (!payload || typeof payload.sub !== "string" || typeof payload.exp !== "number" || payload.exp <= now) {
    return false;
  }

  const expectedSignature = Buffer.from(sign(encodedPayload, secret), "utf8");
  const actualSignature = Buffer.from(providedSignature, "utf8");
  if (expectedSignature.length !== actualSignature.length) return false;

  return timingSafeEqual(expectedSignature, actualSignature);
}

export function getSessionSecret(): string {
  const secret = process.env.WORKBENCH_SESSION_SECRET;
  if (!secret) {
    throw new Error("WORKBENCH_SESSION_SECRET is not configured");
  }
  return secret;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  };
}
