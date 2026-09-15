import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveIndustryInsightProject,
  loadIndustryInsightProjects,
  saveIndustryInsightProject,
  updateIndustryInsightProjectRecord,
} from "@/features/workbench/local-store";
import { createIndustryInsightProject } from "@/features/workbench/industry-insight";
import type { IndustryInsightDraftField } from "@/features/workbench/industry-insight-bridge";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
});

describe("industry insight local store", () => {
  it("initializes AI drafts as an empty list", () => {
    expect(createIndustryInsightProject({ title: "白板贴行业判断" }).aiDrafts).toEqual([]);
  });

  it("persists AI drafts without changing formal fields", () => {
    const project = createIndustryInsightProject({
      title: "白板贴行业判断",
      decisionQuestion: "原始决策问题",
    });
    const draft: IndustryInsightDraftField = {
      id: "draft-1",
      fieldPath: "decisionQuestion",
      value: "AI 初稿决策问题",
      status: "draft",
      sourceRefs: ["https://example.com/source"],
      importedAt: "2026-09-15T00:00:00.000Z",
    };

    saveIndustryInsightProject({ ...project, aiDrafts: [draft] });

    const loaded = loadIndustryInsightProjects()[0];
    expect(loaded.aiDrafts).toEqual([draft]);
    expect(loaded.decisionQuestion).toBe("原始决策问题");
  });

  it("loads legacy projects without AI drafts as an empty list", () => {
    const project = createIndustryInsightProject({ title: "历史行业判断" });
    const legacyProject = { ...project } as Partial<typeof project>;
    delete legacyProject.aiDrafts;
    storage.set("personal-commercial-workbench", JSON.stringify({ industryInsightProjects: [legacyProject] }));

    expect(loadIndustryInsightProjects()[0].aiDrafts).toEqual([]);
  });

  it("saves a project and loads it after the store is read again", () => {
    const project = createIndustryInsightProject({ title: "白板贴行业判断" });
    saveIndustryInsightProject(project);
    expect(loadIndustryInsightProjects()).toEqual([expect.objectContaining({ id: project.id, title: "白板贴行业判断" })]);
  });

  it("updates and restores the matching project without changing its id", () => {
    const project = createIndustryInsightProject({ title: "白板贴行业判断" });
    saveIndustryInsightProject(project);
    updateIndustryInsightProjectRecord(project.id, { status: "in_progress", targetUsers: "家庭办公用户" });
    archiveIndustryInsightProject(project.id, true);
    expect(loadIndustryInsightProjects()[0]).toEqual(expect.objectContaining({ id: project.id, status: "archived", targetUsers: "家庭办公用户" }));
    archiveIndustryInsightProject(project.id, false);
    expect(loadIndustryInsightProjects()[0]).toEqual(expect.objectContaining({ id: project.id, status: "draft" }));
  });
});
