import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken
} from "@/features/auth/session";
import { POST as login } from "@/app/api/auth/login/route";

describe("workbench server session", () => {
  const secret = "test-session-secret";
  const now = 1_750_000_000;

  it("creates a token that verifies for the same secret and subject", async () => {
    const token = await createSessionToken(secret, "workbench", now);

    expect(SESSION_COOKIE_NAME).toBe("workbench_session");
    expect(await verifySessionToken(token, secret, now + 10)).toBe(true);
  });

  it("rejects a token whose payload or signature was changed", async () => {
    const token = await createSessionToken(secret, "workbench", now);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(await verifySessionToken(tampered, secret, now + 10)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const token = await createSessionToken(secret, "workbench", now);

    expect(await verifySessionToken(token, secret, now + SESSION_TTL_SECONDS + 1)).toBe(false);
  });

  it("requires a non-empty signing secret", async () => {
    await expect(createSessionToken("", "workbench", now)).rejects.toThrow("session secret");
    await expect(verifySessionToken("invalid", "", now)).resolves.toBe(false);
  });

  it("rejects a wrong password without setting a session cookie", async () => {
    process.env.WORKBENCH_PASSWORD = "correct-password";
    process.env.WORKBENCH_SESSION_SECRET = secret;

    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "wrong-password" }),
      headers: { "content-type": "application/json" }
    }));

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sets an HttpOnly session cookie after a correct password", async () => {
    process.env.WORKBENCH_PASSWORD = "correct-password";
    process.env.WORKBENCH_SESSION_SECRET = secret;

    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "correct-password" }),
      headers: { "content-type": "application/json" }
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("workbench_session=");
    expect(response.headers.get("set-cookie")?.toLowerCase()).toContain("httponly");
  });
});
