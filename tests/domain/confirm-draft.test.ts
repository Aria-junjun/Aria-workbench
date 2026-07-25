import { describe, expect, it } from "vitest";
import type { DraftExtraction } from "@/features/workbench/schemas";
import { buildConfirmedRecords } from "@/features/workbench/confirm-draft";

describe("buildConfirmedRecords", () => {
  it("converts an extraction into permanent record inputs", () => {
    const extraction: DraftExtraction = {
      supplier: {
        name: "义乌某包装厂",
        categories: ["包装盒"],
        supplierType: "factory",
        riskTags: ["交期待确认"]
      },
      communication: {
        summary: "报价 12.5 元，MOQ 1000。",
        promises: [],
        questions: ["包装方式未确认"],
        risks: ["交期待确认"],
        nextActions: ["明天确认包装"]
      },
      offers: [{ name: "白卡纸包装盒", quotedPrice: "12.5 元", moq: "1000", skus: [] }],
      productKnowledge: [{ name: "包装盒", materials: "白卡纸" }],
      tasks: [{ title: "确认包装方式", priority: "medium", type: "confirm_quote", dueText: "明天" }],
      knowledgeCards: [],
      uncertaintyNotes: []
    };

    const batch = buildConfirmedRecords({
      userId: "user-1",
      draftId: "draft-1",
      extraction
    });

    expect(batch.supplier?.name).toBe("义乌某包装厂");
    expect(batch.communication.summary).toContain("MOQ 1000");
    expect(batch.offers).toHaveLength(1);
    expect(batch.productKnowledge).toHaveLength(1);
    expect(batch.tasks[0].title).toBe("确认包装方式");
  });
});
