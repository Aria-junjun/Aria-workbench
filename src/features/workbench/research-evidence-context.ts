import type { EvidenceReferenceModule } from "./evidence-references";
import type { LocalWorkbenchData } from "./local-store";

const moduleLabels: Record<EvidenceReferenceModule, string> = {
  "industry-insight": "行业洞察",
  "demand-exploration": "需求探索",
  "competitor-analysis": "竞品分析",
  "product-decomposition": "产品拆解",
};

/**
 * Only references explicitly confirmed on the destination project are allowed
 * into a later GPT task. Native fields that were merely confirmed for their
 * own project are intentionally excluded until the user creates a reference.
 */
export function buildReferencedEvidenceContext(data: LocalWorkbenchData, targetModule: EvidenceReferenceModule, targetProjectId: string): string {
  const references = (data.evidenceReferences ?? []).filter((reference) =>
    reference.targetModule === targetModule
    && reference.targetProjectId === targetProjectId
    && reference.status === "confirmed"
    && reference.snapshot.trim(),
  );
  if (references.length === 0) return "";
  return [
    "已确认可引用的上游资料（只作为参考依据，不等同于当前项目事实；请保留来源板块、项目和字段）：",
    ...references.map((reference, index) => [
      `${index + 1}. 来源板块：${moduleLabels[reference.sourceModule]}`,
      `项目：${reference.sourceProjectTitle}`,
      `字段：${reference.sourceFieldLabel}`,
      `内容：${reference.snapshot}`,
      `引用时间：${reference.referencedAt}`,
    ].join("\n")),
    "引用规则：不得把上游推断改写成事实；如果当前项目证据与上游资料冲突，单独标注冲突和待验证项。",
  ].join("\n");
}
