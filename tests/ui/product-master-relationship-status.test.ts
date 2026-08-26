import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("product master relationship status UI contract", () => {
  it("shows actual supplier relationship status in family and SKU views", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/product-master/page.tsx"), "utf8");

    expect(source).toContain("当前供应商");
    expect(source).toContain("formatSkuRelationshipStatus");
    expect(source).toContain("供应关系依据");
    expect(source).toContain("productSupplierAssignments");
    expect(source).toContain("待确认");
    expect(source).toContain("supplierRelationshipSource");
  });

  it("routes supplier maintenance to the current supplier and keeps the family view decision-oriented", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/product-master/page.tsx"), "utf8");

    expect(source).toContain("#supplier-relationship");
    expect(source).toContain("确认当前供应商");
    expect(source).toContain("异常 SKU");
    expect(source).not.toContain("主供 {plan.primarySuppliers.length} · 备供");
    expect(source).not.toContain("实际供应关系：已确认 {assignedCount}");
  });

  it("provides a stable anchor for the supplier relationship section", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/supplier-relationship-editor.tsx"), "utf8");

    expect(source).toContain('id="supplier-relationship"');
  });

  it("keeps offer matching separate from supplier selection", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/offers/[offerId]/page.tsx"), "utf8");

    expect(source).toContain("规格匹配不等于主供关系");
  });
});
