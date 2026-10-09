import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("supplier archive directory boundary", () => {
  it("does not mix period performance dashboards into the archive", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/page.tsx"), "utf8");
    expect(source).toContain("供应商名录");
    expect(source).toContain("实际业务归属");
    expect(source).not.toContain("SUPPLIER_PAGE_SIZE");
    expect(source).not.toContain("selectedMonth");
    expect(source).not.toContain("supplierDecisionRows");
  });
});
