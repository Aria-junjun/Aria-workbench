import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("supplier detail archive boundary", () => {
  it("keeps product/date/batch evidence with supplier quality records, not a duplicate decision dashboard", () => {
    const source = fs.readFileSync(path.join(root, "src/app/suppliers/[supplierId]/page.tsx"), "utf8");

    expect(source).toContain("关联产品");
    expect(source).toContain("发生日期");
    expect(source).toContain("检验 / 入库批次数量");
    expect(source).toContain("证据 / 处理说明");
    expect(source).toContain("异常占比");
    expect(source).not.toContain("overview={<SupplierDecisionLoop");
    expect(source).toContain("质量、交付与服务原始记录");
  });

  it("preserves supplier relation maintenance actions", () => {
    const source = fs.readFileSync(path.join(root, "src/app/suppliers/[supplierId]/page.tsx"), "utf8");
    expect(source).toContain("relationshipEditorRef");
    expect(source).toContain('{settingsPanel === "relationship" ? <SupplierRelationshipEditor');
    expect(source).toContain(">保存</button>");
    expect(source).toContain("relationshipSaveResult");
    expect(source).toContain("供应关系保存失败");
    expect(source).toContain("setEditing(true)");
  });

  it("keeps maintenance actions in the header and removes chat quick evaluation from the page", () => {
    const source = fs.readFileSync(path.join(root, "src/app/suppliers/[supplierId]/page.tsx"), "utf8");

    expect(source).toContain("维护供应关系");
    expect(source).toContain("settingsPanel");
    expect(source).not.toContain("showChatEval");
    expect(source).not.toContain("聊天快速评估面板");
  });
});
