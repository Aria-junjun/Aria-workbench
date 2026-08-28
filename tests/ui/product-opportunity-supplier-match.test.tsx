import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("product opportunity supplier capability match UI contract", () => {
  it("shows capability matches without creating a supplier relationship automatically", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/products/[productId]/page.tsx"), "utf8");

    expect(source).toContain("ProductOpportunitySupplierMatches");
    expect(source).toContain("findSupplierCapabilityMatches");
    expect(source).toContain("新品打样候选");
    expect(source).toContain("needs_review");
    expect(source).not.toContain("saveProductSupplierAssignments");
  });
});
