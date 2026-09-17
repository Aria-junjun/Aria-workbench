// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { whiteboardEvidenceFixture } from "../fixtures/whiteboard-evidence";
import { buildEvidenceSourceProjects } from "@/features/workbench/evidence-sources";
import { confirmWorkbenchEvidenceField, saveEvidenceReferenceChanges } from "@/features/workbench/evidence-reference-store";
import { loadLocalWorkbenchData, saveLocalWorkbenchData } from "@/features/workbench/local-store";
import { createEvidenceReference } from "@/features/workbench/evidence-references";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: null }) }));
});
afterEach(() => vi.unstubAllGlobals());

it("从四类实际项目构建字段；不将事实标签、完成状态或 AI 初稿当成确认", () => {
  const fixture = whiteboardEvidenceFixture();
  fixture.industry.status = "completed";
  fixture.industry.dimensions[0].fact = "真实字段";
  fixture.industry.aiDrafts = [{ id: "ai", fieldPath: "conclusion.opportunity", value: "未发布 AI 草稿", status: "accepted", sourceRefs: [], importedAt: "today" }];
  const sources = buildEvidenceSourceProjects(fixture.data);
  expect(sources).toHaveLength(4);
  for (const source of sources) {
    expect(source.fields.some((field) => field.snapshot === fixture.record.problem)).toBe(true);
    expect(source.fields.every((field) => field.status !== "confirmed")).toBe(true);
  }
  expect(sources.flatMap((s) => s.fields).some((f) => f.snapshot === "未发布 AI 草稿")).toBe(false);
  expect(sources[0].fields.find((f) => f.path === "dimensions.scale.fact")?.snapshot).toBe("真实字段");
  expect(sources.find((s) => s.module === "competitor-analysis")!.fields.find((f) => f.path === `evidence.${fixture.competitor.evidence[0].id}.statement`)?.status).toBe("to-verify");
});

it("确认绑定字段当前值并持久化；原字段修改后失效，陈旧页面不能确认新内容", () => {
  const fixture = whiteboardEvidenceFixture();
  saveLocalWorkbenchData(fixture.data);
  confirmWorkbenchEvidenceField("industry-insight", fixture.industry.id, "decisionQuestion", fixture.record.problem);
  expect(buildEvidenceSourceProjects(loadLocalWorkbenchData())[0].fields.find((f) => f.path === "decisionQuestion")?.status).toBe("confirmed");
  const latest = loadLocalWorkbenchData();
  latest.industryInsightProjects![0].decisionQuestion = "新的待验证问题";
  saveLocalWorkbenchData(latest);
  expect(buildEvidenceSourceProjects(loadLocalWorkbenchData())[0].fields.find((f) => f.path === "decisionQuestion")?.status).toBe("edited");
  expect(() => confirmWorkbenchEvidenceField("industry-insight", fixture.industry.id, "decisionQuestion", fixture.record.problem)).toThrow("已变化");
});

it("陈旧页面只合并变更的引用，不覆盖另一工作区或同项目新加入的引用", () => {
  const fixture = whiteboardEvidenceFixture();
  saveLocalWorkbenchData(fixture.data);
  const input = { sourceModule: "industry-insight" as const, sourceProjectId: fixture.industry.id, sourceProjectTitle: fixture.industry.title, sourceFieldPath: "decisionQuestion", sourceFieldLabel: "决策问题", snapshot: fixture.record.problem, status: "confirmed" as const };
  const first = createEvidenceReference({ ...input, targetModule: "demand-exploration", targetProjectId: fixture.demand.id });
  const second = createEvidenceReference({ ...input, targetModule: "competitor-analysis", targetProjectId: fixture.competitor.id });
  const third = createEvidenceReference({ ...input, sourceFieldPath: "boundary.object", targetModule: "demand-exploration", targetProjectId: fixture.demand.id });
  saveEvidenceReferenceChanges([], [first]);
  saveEvidenceReferenceChanges([], [second]);
  saveEvidenceReferenceChanges([first], [first, third]);
  saveEvidenceReferenceChanges([first], [{ ...first, snapshot: "本地修改", status: "edited" }]);
  const saved = loadLocalWorkbenchData().evidenceReferences!;
  expect(saved).toHaveLength(3);
  expect(saved.find((r) => r.id === second.id)).toEqual(second);
  expect(saved.find((r) => r.id === third.id)).toEqual(third);
  expect(saved.find((r) => r.id === first.id)?.status).toBe("edited");
  saveEvidenceReferenceChanges([], [createEvidenceReference({ ...input, targetModule: "competitor-analysis", targetProjectId: fixture.competitor.id })]);
  expect(loadLocalWorkbenchData().evidenceReferences).toHaveLength(3);
});
