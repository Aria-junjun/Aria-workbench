// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { EvidenceConflictStatus } from "@/components/workbench/evidence-conflict-status";
import type { EvidenceReference } from "@/features/workbench/evidence-references";

const references: EvidenceReference[] = [
  {
    id: "reference-1", targetModule: "product-decomposition", targetProjectId: "decomposition-1",
    sourceModule: "competitor-analysis", sourceProjectId: "competitor-1", sourceProjectTitle: "竞品研究", sourceFieldPath: "evidence.erase", sourceFieldLabel: "擦除表现", snapshot: "事实：擦除后留痕。", status: "confirmed", referencedAt: "2026-09-17T00:00:00.000Z",
  },
  {
    id: "reference-2", targetModule: "product-decomposition", targetProjectId: "decomposition-1",
    sourceModule: "demand-exploration", sourceProjectId: "demand-1", sourceProjectTitle: "用户研究", sourceFieldPath: "evidence.erase", sourceFieldLabel: "擦除表现", snapshot: "事实：多数用户未观察到留痕。", status: "inference", referencedAt: "2026-09-17T00:00:00.000Z",
  },
];

describe("证据状态与冲突展示", () => {
  it("并列展示冲突来源、状态说明和信息缺口，并只将冲突副本转为待验证", () => {
    const onReferencesChange = vi.fn();
    render(<EvidenceConflictStatus references={references} informationGaps={["耐擦写次数"]} onReferencesChange={onReferencesChange} />);

    expect(screen.getByText("事实：记录材料直接支持的内容")).toBeTruthy();
    expect(screen.getByText("推断：基于证据的解释，不等同事实")).toBeTruthy();
    expect(screen.getByText("待验证：存在分歧或证据不足，不能作为定论")).toBeTruthy();
    expect(screen.getByText("信息缺口：耐擦写次数")).toBeTruthy();
    expect(screen.getByText("竞品分析 / 竞品研究 / 擦除表现")).toBeTruthy();
    expect(screen.getByText("需求探索 / 用户研究 / 擦除表现")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "将擦除表现的冲突转为待验证" }));

    expect(onReferencesChange).toHaveBeenCalledWith([
      { ...references[0], status: "to-verify" },
      { ...references[1], status: "to-verify" },
    ]);
  });
});
