import { describe, expect, it } from "vitest";
import { buildQuoteClipboardText, buildQuoteRows, buildVisibleQuoteTable, quoteTableHeaders } from "@/features/workbench/quote-table";
import type { LocalOffer } from "@/features/workbench/local-store";

describe("quote table", () => {
  it("formats offers into stable quote rows", () => {
    const rows = buildQuoteRows([
      {
        id: "offer-1",
        supplierName: "义乌包装厂",
        name: "抽绳袋",
        category: "包装",
        quotedPrice: "1.2 元",
        priceDetails: "40克 91元/卷；70克 159元/卷",
        comparisonBasis: "按平方米折算",
        normalizedPriceDetails: "40克 0.57元/㎡；70克 0.99元/㎡",
        dimensions: "20x30cm",
        pricingUnit: "元/个",
        packageUnit: "100个/箱",
        keySpecs: "抽绳，磨砂材质",
        materialGrade: "全新料",
        width: "1.6米",
        rollLength: "100米/卷",
        gramWeightOptions: "40克 / 70克",
        freightIncluded: "含运费",
        moq: "1000",
        leadTime: "7 天",
        specs: "20x30cm",
        createdAt: "2026-07-09T00:00:00.000Z"
      } as LocalOffer
    ]);

    expect(rows[0]).toEqual([
      "义乌包装厂",
      "抽绳袋",
      "包装",
      "1.2 元",
      "40克 91元/卷；70克 159元/卷",
      "按平方米折算",
      "40克 0.57元/㎡；70克 0.99元/㎡",
      "20x30cm",
      "元/个",
      "100个/箱",
      "抽绳，磨砂材质",
      "全新料",
      "1.6米",
      "100米/卷",
      "40克 / 70克",
      "含运费",
      "1000",
      "7 天",
      "20x30cm",
      "未记录",
      "未记录",
      "未记录",
      "未记录",
      "未记录"
    ]);
  });

  it("builds tab separated clipboard text", () => {
    const text = buildQuoteClipboardText([["供应商A", "产品A"]]);

    expect(text).toBe(`${quoteTableHeaders.join("\t")}\n供应商A\t产品A`);
  });

  it("hides columns that are empty for all compared offers", () => {
    const table = buildVisibleQuoteTable([
      {
        id: "offer-1",
        supplierName: "凯帝塑料包装",
        name: "泡泡膜复合卷材",
        quotedPrice: "全新料 91-227元/卷",
        priceDetails: "全新料：40克 91元/卷；70克 159元/卷；100克 227元/卷",
        specs: "100米/卷；40克、70克、100克",
        moq: "最少30卷起",
        createdAt: "2026-07-09T00:00:00.000Z"
      },
      {
        id: "offer-2",
        supplierName: "Dus — 南羽家居供应链",
        name: "留言板货盘",
        quotedPrice: "供应商表示少量不能按去年价格做",
        moq: "爱心留言板至少50个",
        leadTime: "后天可发",
        createdAt: "2026-07-09T00:00:00.000Z"
      }
    ] as LocalOffer[]);

    expect(table.headers).toContain("报价明细");
    expect(table.headers).toContain("规格");
    expect(table.headers).not.toContain("尺寸");
    expect(table.headers).not.toContain("包装单位");
    expect(table.rows[0]).toHaveLength(table.headers.length);
  });
});
