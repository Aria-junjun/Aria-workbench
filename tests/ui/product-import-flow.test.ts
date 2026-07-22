import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const importPagePath = "src/app/products/import/page.tsx";
const reviewPagePath = "src/app/products/review/[draftId]/page.tsx";
const productsPagePath = "src/app/products/page.tsx";

describe("product research import page", () => {
  it("uses one document input for paste, upload, parse, and review routing", () => {
    const source = readFileSync(importPagePath, "utf8");

    expect(source).toContain("navigator.clipboard.writeText(PRODUCT_RESEARCH_PROMPT)");
    expect(source).toContain('accept=".md,.txt,.docx"');
    expect(source).toContain("setRawText(data.text)");
    expect(source).toContain("parseProductResearchMarkdown(rawText");
    expect(source).toContain("saveProductImportDraft(parsed)");
    expect(source).toContain("router.push(`/products/review/${draftId}`)");
    expect(source).toContain("请先粘贴或上传产品调研文档。");
    expect(source.match(/<textarea/g)).toHaveLength(1);
  });

  it("reviews source and structured fields before saving, deleting the draft, and routing", () => {
    const source = readFileSync(reviewPagePath, "utf8");

    expect(source).toContain("loadProductImportDraft(draftId)");
    expect(source).toContain("updateProductImportDraft(draftId, product)");
    expect(source).toContain("<ProductKnowledgeEditor");
    expect(source).toContain("rawDocument?.content");
    expect(source).toContain("hasBlockingIssues");
    expect(source).toContain("disabled={isSaving || hasBlockingIssues}");
    expect(source).toContain("saveProductKnowledge(product)");
    expect(source).toContain("deleteProductImportDraft(draftId)");
    expect(source).toContain("router.push(`/products/${saved.id}`)");

    const saveIndex = source.indexOf("saveProductKnowledge(product)");
    const deleteIndex = source.indexOf("deleteProductImportDraft(draftId)");
    const routeIndex = source.indexOf("router.push(`/products/${saved.id}`)");
    expect(saveIndex).toBeLessThan(deleteIndex);
    expect(deleteIndex).toBeLessThan(routeIndex);
  });

  it("uses the dedicated import route for both product-library entry points", () => {
    const source = readFileSync(productsPagePath, "utf8");

    expect(source.match(/href="\/products\/import"/g)).toHaveLength(1);
    expect(source).toContain('actionHref="/products/import"');
    expect(source).toContain("导入产品调研");
    expect(source).not.toContain('actionHref="/intake"');
  });
});
