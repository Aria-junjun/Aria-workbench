import { describe, expect, it } from "vitest";
import { hasPendingLocalWrite } from "@/features/workbench/sync-guard";

describe("sync guard", () => {
  it("recognizes a persisted local write marker", () => {
    expect(hasPendingLocalWrite(String(Date.now()))).toBe(true);
    expect(hasPendingLocalWrite(null)).toBe(false);
    expect(hasPendingLocalWrite("invalid")).toBe(false);
  });
});
