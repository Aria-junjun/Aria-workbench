import type { ParsedProductResearch } from "./product-research-parser";
import { saveProductKnowledge } from "./local-store";
import { normalizeProductKnowledge, type ProductKnowledgeV2 } from "./product-knowledge";

const productImportStorageKey = "personal-commercial-workbench-product-imports";
type ProductImportDrafts = Record<string, ParsedProductResearch>;

export { saveProductKnowledge };

export function exportProductImportDrafts(): string {
  return JSON.stringify(loadProductImportDrafts(), null, 2);
}

export function saveProductImportDraft(parsed: ParsedProductResearch): string {
  const draftId = crypto.randomUUID();
  const drafts = loadProductImportDrafts();
  drafts[draftId] = parsed;
  saveProductImportDrafts(drafts);
  return draftId;
}

export function loadProductImportDraft(id: string): ParsedProductResearch | undefined {
  const draft = loadProductImportDrafts()[id];
  if (!draft) return undefined;

  const normalizedIssues = normalizeProductResearchIssues(draft.issues);
  const issues = normalizedIssues.issues;
  return {
    ...draft,
    product: normalizeProductKnowledge({
      ...draft.product,
      rawDocument: withProductResearchIssueEvidence(draft.product?.rawDocument, normalizedIssues.unknownIssues),
      importIssues: [
        ...(Array.isArray(draft.product?.importIssues) ? draft.product.importIssues : []),
        ...issues.map((issue) => ({ field: issue.section, message: issue.message, severity: issue.severity }))
      ]
    }),
    issues
  };
}

export function updateProductImportDraft(id: string, product: ProductKnowledgeV2): void {
  const drafts = loadProductImportDrafts();
  const draft = loadProductImportDraft(id);
  if (!draft) return;

  drafts[id] = { ...draft, product: normalizeProductKnowledge(product) };
  saveProductImportDrafts(drafts);
}

export function deleteProductImportDraft(id: string): void {
  const drafts = loadProductImportDrafts();
  if (!(id in drafts)) return;

  delete drafts[id];
  saveProductImportDrafts(drafts);
}

function loadProductImportDrafts(): ProductImportDrafts {
  if (typeof window === "undefined") return {};
  const stored = window.localStorage.getItem(productImportStorageKey);
  if (!stored) return {};

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as ProductImportDrafts;
  } catch {
    return {};
  }
}

function saveProductImportDrafts(drafts: ProductImportDrafts): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(productImportStorageKey, JSON.stringify(drafts));
}

function normalizeProductResearchIssues(issues: ParsedProductResearch["issues"]): {
  issues: ParsedProductResearch["issues"];
  unknownIssues: unknown[];
} {
  if (!Array.isArray(issues)) return { issues: [], unknownIssues: [] };
  const unknownIssues: unknown[] = [];
  return {
    issues: issues.map((issue) => {
      const severity = (issue as { severity?: unknown }).severity;
      if (severity !== "error" && severity !== "blocking" && severity !== "warning" && severity !== "conflict") {
        unknownIssues.push(issue);
      }
      return {
        ...issue,
        severity: severity === "error"
          ? "blocking"
          : severity === "blocking" || severity === "warning" || severity === "conflict"
            ? severity
            : "warning"
      } as ParsedProductResearch["issues"][number];
    }),
    unknownIssues
  };
}

function withProductResearchIssueEvidence(
  rawDocument: ProductKnowledgeV2["rawDocument"],
  unknownIssues: unknown[]
): ProductKnowledgeV2["rawDocument"] {
  if (unknownIssues.length === 0) return rawDocument;

  const rawData = rawDocument && typeof rawDocument.rawData === "object" && rawDocument.rawData !== null && !Array.isArray(rawDocument.rawData)
    ? rawDocument.rawData as Record<string, unknown>
    : {};
  const existingIssues = Array.isArray(rawData.productResearchIssues)
    ? rawData.productResearchIssues
    : rawData.productResearchIssues === undefined
      ? []
      : [rawData.productResearchIssues];
  const productResearchIssues = mergeUniqueIssueEvidence(existingIssues, unknownIssues);
  const mergedRawData = {
    ...(rawDocument?.rawData === undefined || rawDocument?.rawData === null || (typeof rawDocument.rawData === "object" && !Array.isArray(rawDocument.rawData))
      ? rawData
      : { documentRawData: rawDocument.rawData }),
    productResearchIssues
  };

  return rawDocument ? { ...rawDocument, rawData: mergedRawData } : { rawData: mergedRawData };
}

function mergeUniqueIssueEvidence(existing: unknown[], incoming: unknown[]): unknown[] {
  const result = [...existing];
  const seen = new Set(existing.map(issueEvidenceKey));
  incoming.forEach((issue) => {
    const key = issueEvidenceKey(issue);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(issue);
  });
  return result;
}

function issueEvidenceKey(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : serialized;
  } catch {
    return String(value);
  }
}
