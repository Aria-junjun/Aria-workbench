import { describe, expect, it } from "vitest";
import {
  findEvidenceConflicts,
  markEvidenceConflictToVerify,
} from "@/features/workbench/evidence-conflicts";
import type { EvidenceReference } from "@/features/workbench/evidence-references";

function reference(overrides: Partial<EvidenceReference> = {}): EvidenceReference {
  return {
    id: "reference-1",
    targetModule: "product-decomposition",
    targetProjectId: "decomposition-1",
    sourceModule: "competitor-analysis",
    sourceProjectId: "competitor-1",
    sourceProjectTitle: "竞品分析 A",
    sourceFieldPath: "evidence.erase-performance",
    sourceFieldLabel: "擦除表现证据",
    snapshot: "事实：擦除后会留下痕迹。",
    status: "confirmed",
    referencedAt: "2026-09-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("evidence conflicts", () => {
  it("groups distinct non-empty snapshots for one target field and preserves both sources", () => {
    const first = reference({
      targetFieldPath: "conclusion.erase-performance",
      targetFieldLabel: "擦除表现结论",
    } as Partial<EvidenceReference>);
    const second = reference({
      id: "reference-2",
      sourceModule: "demand-exploration",
      sourceProjectId: "demand-1",
      sourceProjectTitle: "需求探索 B",
      sourceFieldPath: "items.erase-observation",
      sourceFieldLabel: "用户观察",
      snapshot: "事实：多数用户认为擦除后没有明显痕迹。",
      targetFieldPath: "conclusion.erase-performance",
      targetFieldLabel: "擦除表现结论",
    } as Partial<EvidenceReference>);

    expect(findEvidenceConflicts([first, second])).toEqual([{
      fieldPath: "conclusion.erase-performance",
      fieldLabel: "擦除表现结论",
      references: [first, second],
      reason: "fact-mismatch",
    }]);
  });

  it("does not flag equal or empty snapshots as conflicts", () => {
    const same = reference({ id: "reference-2", sourceProjectId: "competitor-2", sourceProjectTitle: "竞品分析 B" });
    const empty = reference({ id: "reference-3", sourceProjectId: "competitor-3", snapshot: "   " });

    expect(findEvidenceConflicts([reference(), same, empty])).toEqual([]);
  });

  it("does not upgrade unconfirmed material and changes only the conflict copies to to-verify on review", () => {
    const first = reference({ id: "reference-1", status: "original", snapshot: "判断：应该优先进入家庭办公。" });
    const second = reference({ id: "reference-2", status: "inference", snapshot: "判断：应先验证教育场景。" });
    const conflict = findEvidenceConflicts([first, second])[0];

    expect(conflict).toMatchObject({ reason: "judgment-mismatch", references: [first, second] });
    expect(markEvidenceConflictToVerify([first, second], conflict!)).toEqual([
      { ...first, status: "to-verify" },
      { ...second, status: "to-verify" },
    ]);
  });
});
