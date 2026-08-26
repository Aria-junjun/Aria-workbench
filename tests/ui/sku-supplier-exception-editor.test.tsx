import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SKU supplier exception editor", () => {
  it("provides a small, auditable exception entry", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/sku-supplier-exception-editor.tsx"), "utf8");

    expect(source).toContain("设置 SKU 例外");
    expect(source).toContain("生效月份");
    expect(source).toContain("变更原因");
    expect(source).toContain("关系依据");
    expect(source).toContain("saveSkuSupplierAssignments");
  });
});
