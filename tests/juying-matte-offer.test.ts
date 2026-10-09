import { describe, expect, it } from "vitest";
import { buildJuyingMatteOffer } from "@/features/workbench/juying-matte-offer";

describe("聚赢哑面墙贴报价", () => {
  it("只生成截图中有明确单价的16个规格并保留价格范围", () => {
    const offer = buildJuyingMatteOffer("test-offer", "2026-09-03T00:00:00.000Z");
    expect(offer.supplierName).toBe("聚赢");
    expect(offer.name).toContain("哑光墙贴");
    expect(offer.productName).toBe("静电哑光墙贴");
    expect(offer.skus).toHaveLength(16);
    expect(offer.skus?.find((sku) => sku.specName === "45*1")).toBeUndefined();
    expect(offer.minPrice).toBe(1.7);
    expect(offer.maxPrice).toBe(13);
    expect(offer.skus?.find((sku) => sku.specName === "120*10")?.unitPrice).toBe(13);
  });
});
