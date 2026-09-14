import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProductDecompositionProject } from "@/features/workbench/product-decomposition";
import {
  loadLocalWorkbenchData,
  loadProductDecompositionProjects,
  saveProductDecompositionProject,
} from "@/features/workbench/local-store";

describe("product decomposition persistence", () => {
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

  it("loads a missing collection as an empty list and saves a project without changing legacy collections", () => {
    const before = loadLocalWorkbenchData();
    const project = createProductDecompositionProject({ title: "本地保存测试", centralQuestion: "测试问题" });
    saveProductDecompositionProject(project);
    const after = loadLocalWorkbenchData();

    expect(loadProductDecompositionProjects()).toHaveLength(1);
    expect(after.products).toEqual(before.products);
    expect(after.productDecompositionProjects?.[0].id).toBe(project.id);
  });
});
