import { describe, expect, it } from "vitest";
import { buildSupplyDecisionTasks, buildSupplyPlan, type SupplyDecisionData } from "@/features/workbench/supply-decision";

describe("product supply plan", () => {
  it("groups matched supplier SKUs under the internal SKU and exposes decision status", () => {
    const data: SupplyDecisionData = {
      products: [{ id: "product-1", name: "白板贴" }],
      skuMasters: [{ id: "master-1", internalSkuCode: "Y-01BBT", productName: "白板贴", specification: "0.3*0.6m*1" }],
      suppliers: [
        { id: "supplier-a", name: "供应商A" },
        { id: "supplier-b", name: "供应商B" },
        { id: "supplier-c", name: "供应商C" }
      ],
      offers: [
        { id: "offer-a", supplierId: "supplier-a", supplierName: "供应商A", name: "白板贴", leadTime: "7天", skus: [{ id: "sku-a", specName: "30CM*60CM", unitPrice: 2.2, moq: "100" }] },
        { id: "offer-b", supplierId: "supplier-b", supplierName: "供应商B", name: "白板贴", skus: [{ id: "sku-b", specName: "30CM*60CM", unitPrice: 2.5, moq: "200" }] },
        { id: "offer-c", supplierId: "supplier-c", supplierName: "供应商C", name: "白板贴", leadTime: "5天", skus: [{ id: "sku-c", specName: "30CM*60CM", unitPrice: 2.4, moq: "100" }] }
      ],
      links: [
        { skuMasterId: "master-1", offerId: "offer-a", offerSkuId: "sku-a", status: "confirmed" },
        { skuMasterId: "master-1", offerId: "offer-b", offerSkuId: "sku-b", status: "confirmed" },
        { skuMasterId: "master-1", offerId: "offer-c", offerSkuId: "sku-c", status: "confirmed" }
      ],
      decisions: [
        { id: "decision-a", productId: "product-1", skuMasterId: "master-1", supplierId: "supplier-a", offerId: "offer-a", status: "primary", reason: "价格和MOQ平衡", decidedAt: "2026-08-21" },
        { id: "decision-b", productId: "product-1", skuMasterId: "master-1", supplierId: "supplier-c", offerId: "offer-c", status: "backup", reason: "交期更短", decidedAt: "2026-08-21" }
      ]
    };

    const plan = buildSupplyPlan(data, "product-1");

    expect(plan.skuRows).toHaveLength(1);
    expect(plan.skuRows[0]).toMatchObject({ internalSkuCode: "Y-01BBT", primarySupplierId: "supplier-a", backupSupplierIds: ["supplier-c"] });
    expect(plan.skuRows[0].suppliers).toHaveLength(3);
    expect(plan.skuRows[0].missingFields).toContain("供应商B缺少交期");
    const tasks = buildSupplyDecisionTasks(plan);
    expect(tasks.map((task) => task.title)).toContain("Y-01BBT：补齐供应商B缺少交期");
    const undecidedPlan = buildSupplyPlan({ ...data, decisions: [] }, "product-1");
    expect(buildSupplyDecisionTasks(undecidedPlan).map((task) => task.title)).toContain("Y-01BBT：确认主供应商");
  });
});
