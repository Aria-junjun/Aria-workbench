import { describe, expect, it } from "vitest";
import { addDemandItem, appendDemandResponse, createDemandConfirmationDocument } from "@/features/workbench/demand-confirmation";
import { exportDemandConfirmationMarkdown } from "@/features/workbench/demand-confirmation-export";

describe("demand confirmation export", () => {
  it("exports traceable source data, formulas, scores, and response rows", () => {
    let document = createDemandConfirmationDocument({ title: "白板贴擦除体验需求确认", productName: "白板贴", userType: "办公室使用者", scenario: "会议后擦除内容", problem: "残留痕迹", goal: "确认不留痕迹是否为必备需求", source: "售后记录" });
    document = addDemandItem(document, { sectionName: "重复书写体验", subFeature: "内容擦除", needStatement: "擦除后不残留明显涂写痕迹，能够继续书写" });
    const itemId = document.demandItems[0].id;
    document = appendDemandResponse(document, itemId, { functional: "like", dysfunctional: "dislike" });
    const markdown = exportDemandConfirmationMarkdown(document);
    expect(markdown).toContain("需求确认文档");
    expect(markdown).toContain("原始回答明细");
    expect(markdown).toContain("SI / Better");
    expect(markdown).toContain("DSI / Worse");
    expect(markdown).toContain("正向回答");
    expect(markdown).toContain("白板贴擦除体验需求确认");
  });
});
