import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("data sync loader", () => {
  it("does not block page interaction while cloud sync is pending", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/data-sync-loader.tsx"), "utf8");
    expect(source).toContain("pointer-events-none");
  });
});
