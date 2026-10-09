// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EvidenceReferencePicker } from "@/components/workbench/evidence-reference-picker";
import type { EvidenceReference } from "@/features/workbench/evidence-references";

afterEach(cleanup);

describe("统一证据引用选择器", () => {
  it("只展示允许方向中的已确认来源，并将可编辑副本加入目标而不触碰目标字段", () => {
    const onReferencesChange = vi.fn();
    const targetField = "需求文档原有问题";
    const sourceProjects = [
      {
        module: "industry-insight" as const,
        projectId: "industry-1",
        projectTitle: "白板贴行业洞察",
        fields: [
          { path: "dimensions.trend.evidence", label: "趋势证据", snapshot: "家庭办公场景增加", status: "confirmed" as const },
          { path: "conclusion.opportunity", label: "机会判断", snapshot: "AI 初稿", status: "ai-draft" as const },
        ],
      },
      {
        module: "competitor-analysis" as const,
        projectId: "competitor-1",
        projectTitle: "不应逆向引用的竞品项目",
        fields: [{ path: "summary", label: "摘要", snapshot: "不应显示", status: "confirmed" as const }],
      },
    ];
    function PickerHarness() {
      const [references, setReferences] = React.useState<EvidenceReference[]>([]);
      const updateReferences = (next: EvidenceReference[]) => { setReferences(next); onReferencesChange(next); };
      return <EvidenceReferencePicker targetModule="demand-exploration" targetProjectId="demand-1" targetFieldPath="evidenceReferences" targetFieldLabel="引用证据" currentReferences={references} onReferencesChange={updateReferences} sourceProjects={sourceProjects} />;
    }

    render(<PickerHarness />);

    expect(screen.getByText("行业洞察")).toBeTruthy();
    expect(screen.getByText("白板贴行业洞察")).toBeTruthy();
    expect(screen.getByText("趋势证据")).toBeTruthy();
    expect(screen.getByText("家庭办公场景增加")).toBeTruthy();
    expect(screen.queryByText("AI 初稿")).toBeNull();
    expect(screen.queryByText("不应逆向引用的竞品项目")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "引用" }));

    expect(targetField).toBe("需求文档原有问题");
    expect(onReferencesChange).toHaveBeenCalledOnce();
    const added = onReferencesChange.mock.calls[0][0] as EvidenceReference[];
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      targetModule: "demand-exploration",
      targetProjectId: "demand-1",
      targetFieldPath: "evidenceReferences",
      targetFieldLabel: "引用证据",
      sourceModule: "industry-insight",
      sourceProjectId: "industry-1",
      snapshot: "家庭办公场景增加",
      status: "confirmed",
    });

    fireEvent.change(screen.getByLabelText("引用副本：趋势证据"), { target: { value: "目标侧已补充说明" } });
    const edited = onReferencesChange.mock.calls[1][0] as EvidenceReference[];
    expect(edited[0].snapshot).toBe("目标侧已补充说明");
    expect(edited[0].status).toBe("edited");
    expect(screen.getByText("引用自：行业洞察 / 白板贴行业洞察 / 趋势证据")).toBeTruthy();
  });

  it("明确标注快照并阻止重复引用同一来源字段", () => {
    function Harness() {
      const [references, setReferences] = React.useState<EvidenceReference[]>([]);
      return <EvidenceReferencePicker targetModule="demand-exploration" targetProjectId="d" targetFieldPath="evidenceReferences" targetFieldLabel="引用证据" currentReferences={references} onReferencesChange={setReferences} sourceProjects={[{ module: "industry-insight", projectId: "i", projectTitle: "白板贴", fields: [{ path: "decisionQuestion", label: "决策问题", snapshot: "是否进入教育场景", status: "confirmed" }] }]} />;
    }
    render(<Harness />);
    expect(screen.getByText("快照：")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "引用" }));
    expect((screen.getByRole("button", { name: "已引用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "已引用" }));
    expect(screen.getAllByLabelText("引用副本：决策问题")).toHaveLength(1);
  });

  it("不展示仅限本项目使用的已确认资料", () => {
    render(<EvidenceReferencePicker targetModule="demand-exploration" targetProjectId="d" targetFieldPath="evidenceReferences" targetFieldLabel="引用证据" currentReferences={[]} onReferencesChange={vi.fn()} sourceProjects={[{ module: "industry-insight", projectId: "i", projectTitle: "白板贴", fields: [{ path: "decisionQuestion", label: "仅本项目问题", snapshot: "不应跨项目引用", status: "confirmed", referenceable: false }] }]} />);
    expect(screen.queryByText("仅本项目问题")).toBeNull();
    expect(screen.getByText("暂无符合方向且已确认的可引用资料。")).toBeTruthy();
  });
});
