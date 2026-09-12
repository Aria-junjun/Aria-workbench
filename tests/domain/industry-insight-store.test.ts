import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveIndustryInsightProject,
  loadIndustryInsightProjects,
  saveIndustryInsightProject,
  updateIndustryInsightProjectRecord,
} from "@/features/workbench/local-store";
import { createIndustryInsightProject } from "@/features/workbench/industry-insight";

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
