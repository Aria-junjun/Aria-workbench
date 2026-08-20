import { describe, expect, it } from "vitest";
import { requireWorkbenchSession } from "@/features/auth/guard";
import { createSessionToken } from "@/features/auth/session";

describe("workbench API session guard", () => {
  it("returns 401 when the request has no session cookie", async () => {
    process.env.WORKBENCH_SESSION_SECRET = "test-session-secret";

    const response = await requireWorkbenchSession(new Request("http://localhost/api/data"));

    expect(response?.status).toBe(401);
  });

  it("allows a request with a valid session cookie", async () => {
    const secret = "test-session-secret";
    process.env.WORKBENCH_SESSION_SECRET = secret;
    const token = await createSessionToken(secret, "workbench");

    const response = await requireWorkbenchSession(new Request("http://localhost/api/data", {
      headers: { cookie: `workbench_session=${token}` }
    }));

    expect(response).toBeNull();
  });
});
