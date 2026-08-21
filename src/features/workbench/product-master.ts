export type ProductMasterSkuInput = {
  id: string;
  internalSkuCode: string;
  productName: string;
  specification: string;
  productFamilyKey?: string;
};

export type ProductMasterGroup = {
  familyKey: string;
  productName: string;
  skuIds: string[];
  internalSkuCodes: string[];
};

export function deriveProductFamilyKey(productName: string, productFamilyKey?: string): string {
  if (productFamilyKey?.trim()) return productFamilyKey.trim();
  const normalized = productName.trim().replace(/[\s_]+/g, "");
  const specStart = normalized.search(/\d+(?:\.\d+)?\s*(?:cm|mm|m|米|厘米)?\s*[×x*]/i);
  const base = specStart > 0 ? normalized.slice(0, specStart) : normalized.split("+")[0];
  return base.replace(/[：:，,、/\\|]+$/g, "") || normalized;
}

export type PromotableProduct = {
  recordKind?: "opportunity" | "existing" | "observation" | "archived" | "unclassified";
  productMode?: "inbound" | "dropship" | "hybrid";
  portfolioStatus?: "active" | "observe" | "optimize" | "paused" | "discontinued";
  [key: string]: unknown;
};

export function groupSkuMastersByProduct(rows: ProductMasterSkuInput[]): ProductMasterGroup[] {
  const groups = new Map<string, ProductMasterGroup>();
  for (const row of rows) {
    const productName = row.productName.trim();
    if (!productName) continue;
    const familyKey = deriveProductFamilyKey(productName, row.productFamilyKey);
    const current = groups.get(familyKey) ?? { familyKey, productName: productName.split("+")[0], skuIds: [], internalSkuCodes: [] };
    if (!current.skuIds.includes(row.id)) current.skuIds.push(row.id);
    if (!current.internalSkuCodes.includes(row.internalSkuCode)) current.internalSkuCodes.push(row.internalSkuCode);
    groups.set(familyKey, current);
  }
  return [...groups.values()];
}

export function promoteProductToInbound<T extends PromotableProduct>(product: T): T {
  return {
    ...product,
    recordKind: "existing",
    productMode: "inbound",
    portfolioStatus: "active"
  };
}
