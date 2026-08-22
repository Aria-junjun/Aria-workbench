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
  erpCostPrice?: number;
  shippedQuantity?: number;
  returnQuantity?: number;
  grossMarginRate?: number;
  inventoryDays?: number;
  stockoutCount?: number;
  returnRate?: number;
};

export type ProductFamilyMetricSummary = SkuMetricInput & {
  source: "sku_manual" | "sku_imported" | "pending";
  skuCount: number;
};

export type ProductFamilySnapshotComparison = {
  period: string;
  current: ProductFamilyMetricSummary;
  previous: ProductFamilyMetricSummary;
  delta: SkuMetricInput;
};

export type ProductInboundSummary = {
  receivedQuantity: number;
  actualStock?: number;
  availableStock?: number;
  inventoryGap?: number;
  inTransitQuantity?: number;
  receivedToShippedRatio?: number;
  missingPreviousPeriod: boolean;
};

export type ProductInboundSupplierSummary = {
  suppliers: Array<{
    supplierId?: string;
    supplierName: string;
    receivedQuantity: number;
    skuCount: number;
  }>;
  totalReceivedQuantity: number;
  isSplit: boolean;
};

type InboundSnapshotForSummary = {
  id?: string;
  sourceFileName?: string;
  sourceSheetName?: string;
  importedAt?: string;
  skuMasterId: string;
  period: string;
  receivedQuantity?: number;
  actualStock?: number;
  availableStock?: number;
  inTransitQuantity?: number;
};

type OperatingSnapshotForSummary = {
  id?: string;
  source?: "manual" | "imported";
  createdAt?: string;
  updatedAt?: string;
  skuMasterId: string;
  period: string;
  shippedQuantity?: number;
  monthlySales?: number;
};

type InboundSupplierForSummary = {
  skuMasterId: string;
  period: string;
  receivedQuantity?: number;
  supplierId?: string;
  supplierName?: string;
};

function previousMonth(period: string) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function buildProductInboundSummary(
  skuMasters: ProductMasterSkuInput[],
  inboundSnapshots: InboundSnapshotForSummary[],
  salesSnapshots: OperatingSnapshotForSummary[],
  period: string
): ProductInboundSummary {
  const skuIds = new Set(skuMasters.map((sku) => sku.id));
  const inbound = inboundSnapshots.filter((snapshot) => skuIds.has(snapshot.skuMasterId) && snapshot.period === period);
  const sales = salesSnapshots.filter((snapshot) => skuIds.has(snapshot.skuMasterId) && snapshot.period === period);
  const sum = (values: Array<number | undefined>): number | undefined => {
    const defined = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
    return defined.length ? defined.reduce((total, value) => total + value, 0) : undefined;
  };
  const receivedQuantity = sum(inbound.map((snapshot) => snapshot.receivedQuantity)) ?? 0;
  const actualStock = sum(inbound.map((snapshot) => snapshot.actualStock));
  const availableStock = sum(inbound.map((snapshot) => snapshot.availableStock));
  const shippedQuantity = sum(sales.map((snapshot) => snapshot.shippedQuantity ?? snapshot.monthlySales));
  const previousPeriod = previousMonth(period);
  const missingPreviousPeriod = !inboundSnapshots.some((snapshot) => skuIds.has(snapshot.skuMasterId) && snapshot.period === previousPeriod);
  return {
    receivedQuantity,
    actualStock,
    availableStock,
    inventoryGap: actualStock !== undefined && availableStock !== undefined ? actualStock - availableStock : undefined,
    inTransitQuantity: sum(inbound.map((snapshot) => snapshot.inTransitQuantity)),
    receivedToShippedRatio: shippedQuantity && shippedQuantity > 0 ? Number((receivedQuantity / shippedQuantity).toFixed(2)) : undefined,
    missingPreviousPeriod
  };
}

export function buildProductInboundSupplierSummary(
  skuMasters: ProductMasterSkuInput[],
  inboundSnapshots: InboundSupplierForSummary[],
  period: string,
): ProductInboundSupplierSummary {
  const skuIds = new Set(skuMasters.map((sku) => sku.id));
  const grouped = new Map<string, { supplierId?: string; supplierName: string; receivedQuantity: number; skuIds: Set<string> }>();

  inboundSnapshots
    .filter((snapshot) => skuIds.has(snapshot.skuMasterId) && snapshot.period === period)
    .forEach((snapshot) => {
      const supplierName = snapshot.supplierName?.trim() || "供应商待确认";
      const key = snapshot.supplierId ? `id:${snapshot.supplierId}` : `name:${supplierName}`;
      const current = grouped.get(key) ?? {
        supplierId: snapshot.supplierId,
        supplierName,
        receivedQuantity: 0,
        skuIds: new Set<string>(),
      };
      current.receivedQuantity += snapshot.receivedQuantity ?? 0;
      current.skuIds.add(snapshot.skuMasterId);
      grouped.set(key, current);
    });

  const suppliers = [...grouped.values()]
    .map(({ skuIds: relatedSkuIds, ...supplier }) => ({ ...supplier, skuCount: relatedSkuIds.size }))
    .sort((left, right) => right.receivedQuantity - left.receivedQuantity || left.supplierName.localeCompare(right.supplierName));
  return {
    suppliers,
    totalReceivedQuantity: suppliers.reduce((total, supplier) => total + supplier.receivedQuantity, 0),
    isSplit: suppliers.filter((supplier) => supplier.supplierName !== "供应商待确认").length > 1,
  };
}

export function aggregateSkuMetrics(rows: SkuMetricInput[]): ProductFamilyMetricSummary {
  const sum = (key: keyof SkuMetricInput) => rows.reduce((total, row) => total + (typeof row[key] === "number" ? row[key]! : 0), 0);
  const totalSalesAmount = sum("salesAmount");
  const costRows = rows.filter((row) => typeof row.erpCostPrice === "number" && typeof row.monthlySales === "number");
  const weightedSales = costRows.reduce((total, row) => total + row.monthlySales!, 0);
  const weightedCost = costRows.length > 0 && weightedSales > 0
    ? costRows.reduce((total, row) => total + row.monthlySales! * row.erpCostPrice!, 0) / weightedSales
    : undefined;
  const shippedQuantity = sum("shippedQuantity");
  const returnQuantity = sum("returnQuantity");
  const hasData = rows.some((row) => Object.values(row).some((value) => typeof value === "number"));
  return {
    skuCount: rows.length,
    source: hasData ? "sku_manual" : "pending",
    ...(hasData ? {
      monthlySales: sum("monthlySales"),
      salesAmount: totalSalesAmount,
      ...(weightedCost === undefined ? {} : { erpCostPrice: Number(weightedCost.toFixed(3)) }),
      ...(rows.some((row) => row.shippedQuantity !== undefined) ? { shippedQuantity } : {}),
      ...(rows.some((row) => row.returnQuantity !== undefined) ? { returnQuantity } : {}),
      ...(shippedQuantity > 0 && rows.some((row) => row.returnQuantity !== undefined) ? { returnRate: Number(((returnQuantity / shippedQuantity) * 100).toFixed(2)) } : {}),
      inventoryDays: rows.some((row) => row.inventoryDays !== undefined) ? Number((sum("inventoryDays") / rows.filter((row) => row.inventoryDays !== undefined).length).toFixed(2)) : undefined,
      stockoutCount: sum("stockoutCount"),
      ...(rows.some((row) => row.returnRate !== undefined) && shippedQuantity === 0 ? { returnRate: Number((sum("returnRate") / rows.filter((row) => row.returnRate !== undefined).length).toFixed(2)) } : {})
    } : {})
  };
}

export function aggregateSkuSnapshots(currentRows: SkuMetricInput[], previousRows: SkuMetricInput[], period: string): ProductFamilySnapshotComparison {
  const current = aggregateSkuMetrics(currentRows);
  const previous = aggregateSkuMetrics(previousRows);
  const keys: Array<keyof SkuMetricInput> = ["monthlySales", "salesAmount", "inventoryDays", "stockoutCount", "returnRate"];
  const delta = keys.reduce<SkuMetricInput>((result, key) => {
    const currentValue = current[key];
    const previousValue = previous[key];
    if (typeof currentValue === "number" && typeof previousValue === "number") {
      result[key] = Number((currentValue - previousValue).toFixed(2));
    }
    return result;
  }, {});
  return { period, current, previous, delta };
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
