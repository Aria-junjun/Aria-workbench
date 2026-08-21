import { describe, expect, it } from "vitest";
import { groupSkuMastersByProduct, promoteProductToInbound } from "@/features/workbench/product-master";

describe("inbound product master", () => {
  it("groups imported SKUs by product name without duplicating rows", () => {
    const groups = groupSkuMastersByProduct([
      { id: "sku-1", internalSkuCode: "Y-01", productName: "白板贴", specification: "30*60" },
      { id: "sku-2", internalSkuCode: "Y-02", productName: "白板贴", specification: "45*60" },
      { id: "sku-2", internalSkuCode: "Y-02", productName: "白板贴", specification: "45*60" },
      { id: "sku-3", internalSkuCode: "Y-03", productName: "静电贴", specification: "30*60" }
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ productName: "白板贴", skuIds: ["sku-1", "sku-2"] });
    expect(groups[1].skuIds).toEqual(["sku-3"]);
  });

  it("promotes an opportunity without deleting its research fields", () => {
    const promoted = promoteProductToInbound({ name: "白板贴", recordKind: "opportunity", opportunities: ["市场需求"], lifecycleStage: "validate" });
    expect(promoted).toMatchObject({ name: "白板贴", recordKind: "existing", productMode: "inbound", portfolioStatus: "active", opportunities: ["市场需求"], lifecycleStage: "validate" });
  });
});
