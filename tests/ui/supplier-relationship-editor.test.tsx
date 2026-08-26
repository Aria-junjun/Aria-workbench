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
    expect(source).toContain("供应关系将随页面右上角");
    expect(source).not.toContain(">批量保存供应关系</button>");
    expect(source).not.toContain("关系保存入口");
    expect(source).toContain("关系范围选择器");
    expect(source).toContain("<details");
    expect(source).toContain("SupplierRelationshipEditorHandle");
    expect(source).toContain("forwardRef");
    expect(source).toContain("editable");
    expect(source).toContain("selectedFamilyKeys");
    expect(source).toContain("selectedFamilyKeys.map");
    expect(source).toContain("请填写变更原因和关系依据");
    expect(source).toContain("saved: false");
    expect(source).toContain("relationshipDirty");
    expect(source).toContain("if (!relationshipDirty)");
  });
});
