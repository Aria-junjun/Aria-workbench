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

export type SkuMetricInput = {
  monthlySales?: number;
  salesAmount?: number;
  grossMarginRate?: number;
  inventoryDays?: number;
  stockoutCount?: number;
  returnRate?: number;
};

export type ProductFamilyMetricSummary = SkuMetricInput & {
  source: "sku_manual" | "sku_imported" | "pending";
  skuCount: number;
};

export function aggregateSkuMetrics(rows: SkuMetricInput[]): ProductFamilyMetricSummary {
  const sum = (key: keyof SkuMetricInput) => rows.reduce((total, row) => total + (typeof row[key] === "number" ? row[key]! : 0), 0);
  const salesRows = rows.filter((row) => typeof row.salesAmount === "number" && typeof row.grossMarginRate === "number");
  const totalSalesAmount = sum("salesAmount");
  const weightedSalesAmount = salesRows.reduce((total, row) => total + row.salesAmount!, 0);
  const weightedMargin = salesRows.length > 0 && weightedSalesAmount > 0
    ? salesRows.reduce((total, row) => total + row.salesAmount! * row.grossMarginRate!, 0) / weightedSalesAmount
    : undefined;
  const hasData = rows.some((row) => Object.values(row).some((value) => typeof value === "number"));
  return {
    skuCount: rows.length,
    source: hasData ? "sku_manual" : "pending",
    ...(hasData ? {
      monthlySales: sum("monthlySales"),
      salesAmount: totalSalesAmount,
      ...(weightedMargin === undefined ? {} : { grossMarginRate: Number(weightedMargin.toFixed(2)) }),
      inventoryDays: rows.some((row) => row.inventoryDays !== undefined) ? Number((sum("inventoryDays") / rows.filter((row) => row.inventoryDays !== undefined).length).toFixed(2)) : undefined,
      stockoutCount: sum("stockoutCount"),
      returnRate: rows.some((row) => row.returnRate !== undefined) ? Number((sum("returnRate") / rows.filter((row) => row.returnRate !== undefined).length).toFixed(2)) : undefined
    } : {})
  };
}

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
