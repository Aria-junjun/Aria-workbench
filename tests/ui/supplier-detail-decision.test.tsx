import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("supplier detail decision loop UI contract", () => {
  it("shows evidence and persisted decision actions", () => {
    const source = fs.readFileSync(path.join(root, "src/app/suppliers/[supplierId]/page.tsx"), "utf8");

    expect(source).toContain("供应商决策闭环");
    expect(source).toContain("本周期实际入仓");
    expect(source).toContain("产品质量信号");
    expect(source).toContain("记录决策");
    expect(source).toContain("completeSupplierDecisionRecord");
    expect(source).toContain("supplierDecisionRecords");
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
