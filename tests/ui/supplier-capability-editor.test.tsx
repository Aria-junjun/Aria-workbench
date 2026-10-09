import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("supplier capability editor UI contract", () => {
  it("exposes capability editing from the supplier detail page", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/[supplierId]/page.tsx"), "utf8");
    const editor = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/supplier-capability-editor.tsx"), "utf8");

    expect(page).toContain("SupplierCapabilityEditor");
    expect(page).toContain("supplierCapabilities");
    expect(page).toContain("维护能力");
    expect(editor).toContain("供应商能力");
    expect(editor).toContain("保存能力");
    expect(editor).toContain("saveSupplierCapabilities");
    expect(editor).toContain("标记失效");
    expect(editor).toContain("productFamilyKeys");
    expect(editor).toContain("product-family-picker");
    expect(editor).toContain("aria-expanded");
  });

  it("keeps capability maintenance in detail rather than the supplier directory", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/page.tsx"), "utf8");

    expect(page).toContain("供应商档案");
    expect(page).toContain("管理总览");
    expect(page).not.toContain("SupplierCapabilityEditor");
  });
});
