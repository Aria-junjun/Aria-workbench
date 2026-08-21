export type ProductMasterSkuInput = {
  id: string;
  internalSkuCode: string;
  productName: string;
  specification: string;
};

export type ProductMasterGroup = {
  productName: string;
  skuIds: string[];
  internalSkuCodes: string[];
};

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
    const current = groups.get(productName) ?? { productName, skuIds: [], internalSkuCodes: [] };
    if (!current.skuIds.includes(row.id)) current.skuIds.push(row.id);
    if (!current.internalSkuCodes.includes(row.internalSkuCode)) current.internalSkuCodes.push(row.internalSkuCode);
    groups.set(productName, current);
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
