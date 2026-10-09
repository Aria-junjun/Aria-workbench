import { describe, expect, it } from "vitest";
import {
  addDemandSection,
  addDemandItem,
  addDemandQuestion,
  appendDemandResponse,
  archiveDemandItem,
  archiveDemandResponse,
  restoreDemandConfirmationDocument,
  createDemandConfirmationDocument,
  editDemandItem,
  editDemandResponse,
  summarizeDemandDocument,
} from "@/features/workbench/demand-confirmation";

describe("demand confirmation document", () => {
  it("can persist a functional section before any demand item is added", () => {
    let document = createDemandConfirmationDocument({ title: "需求确认", productName: "产品" });

    document = addDemandSection(document, "重复书写体验");

    expect(document.sections).toHaveLength(1);
    expect(document.sections[0]).toEqual(expect.objectContaining({ name: "重复书写体验", itemIds: [] }));
    expect(document.demandItems).toHaveLength(0);
  });

  it("does not create duplicate sections when the name already exists", () => {
    let document = createDemandConfirmationDocument({ title: "需求确认", productName: "产品" });

    document = addDemandSection(document, "重复书写体验");
    document = addDemandSection(document, "重复书写体验");

    expect(document.sections).toHaveLength(1);
  });

  it("supports multiple sections, items, and exploration questions", () => {
    let document = createDemandConfirmationDocument({
      title: "聊天工具需求确认",
      productName: "聊天工具",
      userType: "普通消费者",
      scenario: "日常沟通",
    });

    document = addDemandItem(document, { sectionName: "聊天功能", subFeature: "文字聊天", needStatement: "消息发送后不丢失" });
    document = addDemandItem(document, { sectionName: "聊天功能", subFeature: "视频聊天", needStatement: "通话过程稳定" });
    const itemId = document.demandItems[0].id;
    document = addDemandQuestion(document, itemId, { text: "谁在什么场景下遇到这个问题？", kind: "exploration" });
    document = addDemandQuestion(document, itemId, { text: "当前如何解决？", kind: "exploration" });

    expect(document.sections).toHaveLength(1);
    expect(document.demandItems).toHaveLength(2);
    expect(document.demandItems[0].questions).toHaveLength(2);
    expect(document.demandItems[1].questions).toHaveLength(0);
  });

  it("keeps responses and scores isolated per demand item", () => {
    let document = createDemandConfirmationDocument({ title: "需求确认", productName: "产品" });
    document = addDemandItem(document, { sectionName: "板块 A", subFeature: "功能 A", needStatement: "需求 A" });
    document = addDemandItem(document, { sectionName: "板块 B", subFeature: "功能 B", needStatement: "需求 B" });
    const firstId = document.demandItems[0].id;
    const secondId = document.demandItems[1].id;
    document = appendDemandResponse(document, firstId, { functional: "like", dysfunctional: "dislike" });
    document = appendDemandResponse(document, secondId, { functional: "must", dysfunctional: "dislike" });

    expect(document.demandItems[0].responses).toHaveLength(1);
    expect(document.demandItems[1].responses).toHaveLength(1);
    expect(document.demandItems[0].counts.A).toBe(1);
    expect(document.demandItems[1].counts.O).toBe(1);
  });

  it("summarizes document readiness without inventing scores", () => {
    let document = createDemandConfirmationDocument({ title: "需求确认", productName: "产品" });
    document = addDemandItem(document, { sectionName: "板块", subFeature: "功能 1", needStatement: "需求 1" });
    document = addDemandItem(document, { sectionName: "板块", subFeature: "功能 2", needStatement: "需求 2" });
    document = appendDemandResponse(document, document.demandItems[0].id, { functional: "like", dysfunctional: "dislike" });

    const summary = summarizeDemandDocument(document);
    expect(summary.demandItemCount).toBe(2);
    expect(summary.scoredDemandItemCount).toBe(1);
    expect(summary.comparableDemandItems).toHaveLength(1);
    expect(summary.evidencePendingCount).toBe(2);
  });

  it("edits items and archives responses without erasing history or scores", () => {
    let document = createDemandConfirmationDocument({ title: "测试", productName: "白板贴" });
    document = addDemandItem(document, { sectionName: "书写", subFeature: "擦除", needStatement: "原始描述" });
    const itemId = document.demandItems[0].id;
    document = editDemandItem(document, itemId, { subFeature: "内容擦除", needStatement: "擦除后继续使用" });
    document = appendDemandResponse(document, itemId, { functional: "like", dysfunctional: "dislike" });
    document = editDemandResponse(document, itemId, 0, { functional: "must" });
    expect(document.demandItems[0].subFeature).toBe("内容擦除");
    expect(document.demandItems[0].responses[0].editedAt).toBeTruthy();
    document = archiveDemandResponse(document, itemId, 0);
    expect(document.demandItems[0].responses[0].deletedAt).toBeTruthy();
    expect(document.demandItems[0].si).toBeNull();
    document = archiveDemandItem(document, itemId);
    expect(document.demandItems[0].status).toBe("archived");
  });

  it("restores a document without removing demand data or AI draft history", () => {
    const document = {
      ...createDemandConfirmationDocument({ title: "历史文档", productName: "白板贴" }),
      status: "archived" as const,
      aiDrafts: [{ id: "draft-1", importedAt: "2026-09-17T00:00:00.000Z", rawText: "原始结果", recognizedFields: { "demand.problem": "问题" }, unrecognizedLines: [], status: "draft" as const }],
    };
    const restored = restoreDemandConfirmationDocument(document);
    expect(restored.status).toBe("draft");
    expect(restored.aiDrafts).toEqual(document.aiDrafts);
    expect(restored.title).toBe("历史文档");
  });
});
