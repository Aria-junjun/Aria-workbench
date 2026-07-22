import { describe, expect, it } from "vitest";
import { DraftExtractionSchema } from "@/features/workbench/schemas";

describe("DraftExtractionSchema", () => {
  it("accepts a supplier communication draft with offer, knowledge, and task", () => {
    const result = DraftExtractionSchema.parse({
      supplier: {
        name: "义乌某包装厂",
        sourceUrl: "https://example.1688.com",
        categories: ["包装盒"],
        location: "浙江义乌",
        contactName: "王经理",
        contactMethod: "微信",
        supplierType: "factory",
        cooperationLevel: "medium",
        priceLevel: "low",
        qualityJudgement: "待样品确认",
        riskTags: ["需要确认交期"],
        notes: "配合度一般"
      },
      communication: {
        summary: "报价 12.5 元，MOQ 1000，交期 7 天。",
        promises: ["7 天交货"],
        questions: ["包装方式未确认"],
        risks: ["交期需要复核"],
        nextActions: ["明天确认包装方式"]
      },
      offers: [
        {
          name: "白卡纸包装盒",
          category: "包装盒",
          quotedPrice: "12.5 元",
          moq: "1000",
          leadTime: "7 天",
          specs: "白卡纸 350g",
          packaging: "未确认",
          sampleStatus: "可寄样",
          channelFit: "电商",
          advantages: "价格低",
          risks: "包装方式未确认",
          notes: ""
        }
      ],
      productKnowledge: [
        {
          name: "包装盒",
          materials: "白卡纸",
          process: "印刷、覆膜、模切、糊盒",
          costStructure: "纸张、印刷、人工、损耗",
          keyParameters: "克重、尺寸、覆膜方式",
          qualityRisks: "压痕、色差、爆边",
          commonPitfalls: "只看单价不看损耗",
          alternatives: "灰板盒",
          judgement: "需要拿样确认挺度"
        }
      ],
      tasks: [
        {
          title: "确认包装方式",
          dueText: "明天",
          priority: "medium",
          type: "confirm_quote"
        }
      ],
      knowledgeCards: [],
      uncertaintyNotes: ["供应商真实类型需要确认"]
    });

    expect(result.supplier?.name).toBe("义乌某包装厂");
    expect(result.offers[0].moq).toBe("1000");
    expect(result.tasks[0].priority).toBe("medium");
  });
});
