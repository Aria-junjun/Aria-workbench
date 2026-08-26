import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("supplier relationship editor", () => {
  it("offers auditable product-family supplier relationship actions", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/supplier-relationship-editor.tsx"), "utf8");

    expect(source).toContain("设为主供");
    expect(source).toContain("设为备供");
    expect(source).toContain("关系范围");
    expect(source).toContain("生效月份");
    expect(source).toContain("变更原因");
    expect(source).toContain("关系依据");
  });
});
