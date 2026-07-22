import { describe, expect, it } from "vitest";
import type { LocalWorkbenchData } from "@/features/workbench/local-store";
import { getDashboardView } from "@/features/workbench/dashboard";
import { normalizeProductKnowledge } from "@/features/workbench/product-knowledge";

const data: LocalWorkbenchData = {
  communications: [],
  suppliers: [
    {
      id: "supplier-1",
      name: "供应商甲",
      categories: ["气泡膜"],
      riskTags: [],
      pinned: true,
      location: "武汉",
      createdAt: "2026-07-10T09:00:00.000Z"
    }
  ],
  offers: [
    {
      id: "offer-1",
      name: "气泡膜报价",
      supplierName: "供应商甲",
      quotedPrice: "47元/件",
      createdAt: "2026-07-10T10:00:00.000Z"
    }
  ],
  products: [
    normalizeProductKnowledge({
      id: "product-1",
      name: "气泡膜知识",
      materials: "PE",
      createdAt: "2026-07-09T10:00:00.000Z"
    })
  ],
  tasks: [
    {
      id: "task-low",
      title: "补充产品知识",
      priority: "low",
      status: "open",
      createdAt: "2026-07-10T08:00:00.000Z"
    },
    {
      id: "task-high",
      title: "确认最终到手价",
      priority: "high",
      status: "open",
      createdAt: "2026-07-09T08:00:00.000Z"
    },
    {
      id: "task-done",
      title: "已完成事项",
      priority: "high",
      status: "done",
      createdAt: "2026-07-10T11:00:00.000Z"
    }
  ],
  knowledgeCards: [
    {
      id: "knowledge-1",
      title: "不要接受第一次报价",
      summary: "保留后续谈判空间",
      applicableScenarios: [],
      steps: [],
      scripts: [],
      risks: [],
      tags: ["谈判"],
      createdAt: "2026-07-10T11:00:00.000Z"
    }
  ],
  knowledgeBooks: [],
  decisionTools: [],
  knowledgeApplications: []
  ,decisionCases: []
};

describe("getDashboardView", () => {
  it("shows open tasks by priority and excludes completed tasks", () => {
    const view = getDashboardView(data);

    expect(view.openTasks.map((task) => task.id)).toEqual(["task-high", "task-low"]);
    expect(view.openTasks.every((task) => task.status === "open")).toBe(true);
  });

  it("combines pinned records from the supported workbench libraries", () => {
    const view = getDashboardView(data);

    expect(view.pinnedItems).toEqual([
      expect.objectContaining({ id: "supplier-1", kind: "supplier", title: "供应商甲" })
    ]);
  });

  it("sorts recent records across libraries and keeps concise summaries", () => {
    const view = getDashboardView(data);

    expect(view.recentItems.map((item) => item.id)).toEqual([
      "knowledge-1",
      "offer-1",
      "supplier-1",
      "product-1"
    ]);
    expect(view.recentItems.find((item) => item.id === "offer-1")?.summary).toBe("47元/件");
  });
});
