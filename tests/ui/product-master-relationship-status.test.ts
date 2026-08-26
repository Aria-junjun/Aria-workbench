import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("product master relationship status UI contract", () => {
  it("shows actual supplier relationship status in family and SKU views", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/product-master/page.tsx"), "utf8");

    expect(source).toContain("实际供应关系");
    expect(source).toContain("formatSkuRelationshipStatus");
    expect(source).toContain("供应关系依据");
    expect(source).toContain("productSupplierAssignments");
    expect(source).toContain("SKU例外");
    expect(source).toContain("待确认");
    expect(source).toContain("当前主供");
    expect(source).toContain("维护供应关系");
    expect(source).toContain("supplierRelationshipSource");
  });

  it("keeps offer matching separate from supplier selection", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/offers/[offerId]/page.tsx"), "utf8");

    expect(source).toContain("规格匹配不等于主供关系");
  });
});
