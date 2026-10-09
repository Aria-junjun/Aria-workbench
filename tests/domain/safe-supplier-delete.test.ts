import { describe, expect, it } from "vitest";
import { normalizeWorkbenchData, type LocalWorkbenchData } from "@/features/workbench/local-store";
import { emptyLifecycleRecord } from "@/features/workbench/supplier-lifecycle";
import {
  applySafeSupplierDelete,
  buildSafeSupplierDeletePreview,
  createWorkbenchSnapshotRevision,
} from "@/features/workbench/safe-supplier-delete";

function baseData(): LocalWorkbenchData {
  return normalizeWorkbenchData({
    suppliers: [
      { id: "supplier-a", name: "供应商甲", categories: [], riskTags: [], createdAt: "2026-09-24" },
      { id: "supplier-b", name: "供应商乙", categories: [], riskTags: [], createdAt: "2026-09-24" },
    ],
  });
}

describe("safe supplier deletion", () => {
  it("counts supplier references across all relevant workbench collections", () => {
    const data = baseData();
    data.supplierBusinessRecords = [{ id:"business", kind:"dropship_period", supplierIds:["supplier-a"], offerIds:[], productScope:"商品", status:"completed", title:"履约", owner:"", fields:{}, attachmentIds:[], revision:1, createdAt:"", updatedAt:"" }];
    data.pendingDropshipSuppliers = [{ id:"pending", platform:"1688", sourceName:"甲", filingBand:"eligible", sourceFileName:"样例.xlsx", createdAt:"", periodStart:"2026-09-01", periodEnd:"2026-09-07", paidOrders:1, gmv:1, status:"resolved", linkedSupplierId:"supplier-a" }];
    data.dropshipProductPeriods = [{ id:"period", platform:"1688", productName:"商品", periodStart:"2026-09-01", periodEnd:"2026-09-07", paidOrders:1, gmv:1, sourceSheetName:"商品", sourceRowNumber:2, fileName:"样例.xlsx", businessKey:"商品", importedAt:"", supplierId:"supplier-a", businessMode:"dropship" }];
    data.dropshipProductRoutings = [{ id:"routing", platform:"1688", productName:"商品", normalizedProductName:"商品", supplierId:"supplier-a", businessMode:"dropship", confirmedAt:"" }];
    data.supplierAliasMappings = [{ id:"alias", platform:"1688", sourceName:"甲", normalizedSourceName:"甲", supplierId:"supplier-a", confirmedAt:"" }];
    data.productSupplierAssignments = [{ id:"product-assignment", productFamilyKey:"商品", supplierId:"supplier-a", role:"primary", effectiveFrom:"", status:"active", source:"manual" }];
    data.skuSupplierAssignments = [{ id:"sku-assignment", skuCode:"SKU", supplierId:"supplier-a", effectiveFrom:"", status:"active", source:"manual" }];
    data.offers = [{ id:"offer", name:"报价", supplierId:"supplier-a", createdAt:"" }];
    data.tasks = [{ id:"task", title:"复核", supplierId:"supplier-a", priority:"中", status:"open", createdAt:"" }];
    data.supplierDecisionRecords = [{ id:"decision", supplierId:"supplier-a", period:"2026-09", action:"review_quality", status:"open", createdAt:"" }];
    data.supplierOfferDecisions = [{ id:"offer-decision", productId:"p", supplierId:"supplier-a", status:"candidate", reason:"", decidedAt:"" }];
    data.supplierCapabilities = [{ id:"cap", supplierId:"supplier-a", processNames:[], materialNames:[], equipmentNames:[], sourceRecordIds:[], sourceType:"manual", status:"verified", createdAt:"", updatedAt:"" }];
    data.supplierLifecycleRecords = [{ ...emptyLifecycleRecord("agreements"), id:"life", supplierIds:["supplier-a"], title:"合作" }];

    const preview = buildSafeSupplierDeletePreview(data, "supplier-a");

    expect(preview.totalReferences).toBe(13);
    expect(preview.references).toMatchObject({
      supplierBusinessRecords: 1,
      pendingDropshipSuppliers: 1,
      dropshipProductPeriods: 1,
      dropshipProductRoutings: 1,
      supplierAliasMappings: 1,
      productSupplierAssignments: 1,
      skuSupplierAssignments: 1,
      offers: 1,
      tasks: 1,
      supplierDecisionRecords: 1,
      supplierOfferDecisions: 1,
      supplierCapabilities: 1,
      supplierLifecycleRecords: 1,
    });
    expect(preview.canDelete).toBe(false);
    expect(preview.backupJson).toContain('"supplier-a"');
  });

  it("deletes only an unreferenced supplier from the captured unchanged snapshot", () => {
    const data = baseData();
    const preview = buildSafeSupplierDeletePreview(data, "supplier-a");
    const result = applySafeSupplierDelete(data, {
      supplierId: "supplier-a",
      expectedRevision: preview.revision,
      typedName: "供应商甲",
      secondConfirmed: true,
      backupDownloaded: true,
    });

    expect(result.suppliers.map((supplier) => supplier.id)).toEqual(["supplier-b"]);
    expect(result.offers).toEqual(data.offers);
  });

  it("blocks deletion when referenced, confirmation is incomplete, or data changed", () => {
    const data = baseData();
    const preview = buildSafeSupplierDeletePreview(data, "supplier-a");
    expect(() => applySafeSupplierDelete(data, { supplierId:"supplier-a", expectedRevision:preview.revision, typedName:"错误", secondConfirmed:true, backupDownloaded:true })).toThrow("输入的供应商名称不一致");
    expect(() => applySafeSupplierDelete(data, { supplierId:"supplier-a", expectedRevision:preview.revision, typedName:"供应商甲", secondConfirmed:false, backupDownloaded:true })).toThrow("请完成二次确认");
    expect(() => applySafeSupplierDelete(data, { supplierId:"supplier-a", expectedRevision:preview.revision, typedName:"供应商甲", secondConfirmed:true, backupDownloaded:false })).toThrow("请先下载完整数据备份");

    const changed = { ...data, tasks:[...data.tasks, { id:"new", title:"新增", supplierId:"supplier-a", priority:"中", status:"open" as const, createdAt:"" }] };
    expect(createWorkbenchSnapshotRevision(changed)).not.toBe(preview.revision);
    expect(() => applySafeSupplierDelete(changed, { supplierId:"supplier-a", expectedRevision:preview.revision, typedName:"供应商甲", secondConfirmed:true, backupDownloaded:true })).toThrow("数据已发生变化");

    const referenced = { ...data, offers:[{ id:"offer", name:"报价", supplierId:"supplier-a", createdAt:"" }] };
    const referencedPreview = buildSafeSupplierDeletePreview(referenced, "supplier-a");
    expect(() => applySafeSupplierDelete(referenced, { supplierId:"supplier-a", expectedRevision:referencedPreview.revision, typedName:"供应商甲", secondConfirmed:true, backupDownloaded:true })).toThrow("仍被 1 条数据引用");
  });
});
