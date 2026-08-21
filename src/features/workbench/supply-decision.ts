import type { LocalOffer, LocalSkuMaster, LocalSkuOfferLink, LocalSupplierOfferDecision, OfferSku, SupplierOfferDecisionStatus } from "./local-store";

export type SupplierOfferDecision = LocalSupplierOfferDecision;

export type SupplyDecisionData = {
  products: Array<{ id: string; name: string; productFamilyKey?: string }>;
  skuMasters: Array<Pick<LocalSkuMaster, "id" | "internalSkuCode" | "productName" | "specification" | "productId" | "productFamilyKey">>;
  suppliers: Array<{ id: string; name: string }>;
  offers: Array<Pick<LocalOffer, "id" | "supplierId" | "supplierName" | "name" | "leadTime" | "moq" | "quotedPrice"> & { skus?: OfferSku[] }>;
  links: Array<Pick<LocalSkuOfferLink, "skuMasterId" | "offerId" | "offerSkuId" | "status">>;
  decisions: SupplierOfferDecision[];
};

export type SupplyPlanSupplier = {
  supplierId?: string;
  supplierName: string;
  offerId: string;
  offerSkuId: string;
  specName: string;
  unitPrice?: number;
  moq?: string;
  leadTime?: string;
  status: SupplierOfferDecisionStatus;
};

export type SupplyPlanSkuRow = {
  skuMasterId: string;
  internalSkuCode: string;
  specification: string;
  primarySupplierId?: string;
  backupSupplierIds: string[];
  suppliers: SupplyPlanSupplier[];
  missingFields: string[];
};

export type SupplyPlan = {
  productId: string;
  skuRows: SupplyPlanSkuRow[];
  primarySuppliers: string[];
  backupSuppliers: string[];
  missingFields: string[];
};

export type SupplyDecisionTaskDraft = {
  title: string;
  priority: "high" | "medium";
  type: "supply_decision";
  skuMasterId: string;
};

export function buildSupplyPlan(data: SupplyDecisionData, productId: string): SupplyPlan {
  const product = data.products.find((item) => item.id === productId);
  if (!product) return { productId, skuRows: [], primarySuppliers: [], backupSuppliers: [], missingFields: ["未找到产品"] };

  const supplierNames = new Map(data.suppliers.map((supplier) => [supplier.id, supplier.name]));
  const skuByOffer = new Map(data.offers.map((offer) => [offer.id, new Map((offer.skus ?? []).map((sku) => [sku.id, sku]))]));
  const relevantSkuIds = new Set(data.skuMasters.filter((sku) => sku.productId === productId || (product.productFamilyKey && sku.productFamilyKey === product.productFamilyKey) || (!sku.productId && !sku.productFamilyKey && sku.productName === product.name)).map((sku) => sku.id));
  const rows = data.skuMasters
    .filter((skuMaster) => relevantSkuIds.has(skuMaster.id))
    .map((skuMaster): SupplyPlanSkuRow => {
      const links = data.links.filter((link) => link.skuMasterId === skuMaster.id && link.status === "confirmed" && link.offerSkuId);
      const suppliers = links.flatMap((link) => {
        const offer = data.offers.find((item) => item.id === link.offerId);
        const sku = offer && link.offerSkuId ? skuByOffer.get(offer.id)?.get(link.offerSkuId) : undefined;
        if (!offer || !sku || !link.offerSkuId) return [];
        const decision = data.decisions.find((item) => item.productId === productId && item.skuMasterId === skuMaster.id && item.offerId === offer.id);
        return [{
          supplierId: offer.supplierId,
          supplierName: offer.supplierName || (offer.supplierId ? supplierNames.get(offer.supplierId) : undefined) || "未关联供应商",
          offerId: offer.id,
          offerSkuId: link.offerSkuId,
          specName: sku.specName,
          unitPrice: sku.unitPrice,
          moq: sku.moq || offer.moq,
          leadTime: offer.leadTime,
          status: decision?.status ?? "unreviewed"
        } satisfies SupplyPlanSupplier];
      });
      const missingFields = suppliers.flatMap((supplier) => [
        supplier.moq ? "" : `${supplier.supplierName}缺少MOQ`,
        supplier.leadTime ? "" : `${supplier.supplierName}缺少交期`
      ]).filter(Boolean);
      const primarySupplierId = suppliers.find((supplier) => supplier.status === "primary")?.supplierId;
      const backupSupplierIds = [...new Set(suppliers.filter((supplier) => supplier.status === "backup" && supplier.supplierId).map((supplier) => supplier.supplierId!))];
      return {
        skuMasterId: skuMaster.id,
        internalSkuCode: skuMaster.internalSkuCode,
        specification: skuMaster.specification,
        primarySupplierId,
        backupSupplierIds,
        suppliers,
        missingFields: suppliers.length === 0 ? ["没有已确认的供应商货盘"] : missingFields
      };
    });

  return {
    productId,
    skuRows: rows,
    primarySuppliers: [...new Set(rows.map((row) => row.primarySupplierId).filter(Boolean) as string[])],
    backupSuppliers: [...new Set(rows.flatMap((row) => row.backupSupplierIds))],
    missingFields: [...new Set(rows.flatMap((row) => row.missingFields))]
  };
}

export function buildSupplyDecisionTasks(plan: SupplyPlan): SupplyDecisionTaskDraft[] {
  return plan.skuRows.flatMap((row) => {
    const tasks: SupplyDecisionTaskDraft[] = [];
    if (row.suppliers.length > 0 && !row.primarySupplierId) {
      tasks.push({ title: `${row.internalSkuCode}：确认主供应商`, priority: "high", type: "supply_decision", skuMasterId: row.skuMasterId });
    }
    for (const missing of row.missingFields) {
      if (!missing.includes("缺少")) continue;
      tasks.push({ title: `${row.internalSkuCode}：补齐${missing}`, priority: "medium", type: "supply_decision", skuMasterId: row.skuMasterId });
    }
    return tasks;
  });
}
