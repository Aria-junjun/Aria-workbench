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
  productFamilyKey?: string;
  skuIds: string[];
  internalSkuCodes: string[];
  operatingProductCode?: string;
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

export type ProductSupplierDisplay = {
  label: "当前供应商" | "本期入仓供应商" | "供货关系";
  names: string[];
  note: string;
};

export function buildProductSupplierDisplay(
  relationships: Array<{ supplierName?: string; supplierRelationshipSource: string }>,
  inboundSuppliers: Array<{ supplierName: string }>,
): ProductSupplierDisplay {
  const assignedNames = [...new Set(
    relationships
      .filter((summary) => summary.supplierRelationshipSource === "family_assignment" || summary.supplierRelationshipSource === "sku_assignment")
      .map((summary) => summary.supplierName?.trim())
      .filter((name): name is string => Boolean(name)),
  )];
  const inboundNames = [...new Set(
    inboundSuppliers
      .map((supplier) => supplier.supplierName.trim())
      .filter(Boolean),
  )];

  if (assignedNames.length) {
    const unexpectedInboundNames = inboundNames.filter((name) => !assignedNames.includes(name));
    return {
      label: "当前供应商",
      names: assignedNames,
      note: unexpectedInboundNames.length
        ? `本期入仓记录出现${unexpectedInboundNames.join("、")}，仅作异常证据，不自动更改供应关系`
        : "关系持续有效",
    };
  }

  if (inboundNames.length) {
    return {
      label: "本期入仓供应商",
      names: inboundNames,
      note: "有本期入仓证据，尚未建立持续供应关系",
    };
  }

  return {
    label: "供货关系",
    names: ["待确认"],
    note: "尚未建立供应关系，也没有本期入仓证据",
  };
}

type InboundSnapshotForSummary = {
  id?: string;
  sourceFileName?: string;
  sourceSheetName?: string;
  importedAt?: string;
  skuMasterId: string;
  productFamilyKey?: string;
  operatingProductCode?: string;
  mappingLevel?: "sku" | "operating_product";
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
  productFamilyKey?: string;
  operatingProductCode?: string;
  mappingLevel?: "sku" | "operating_product";
  period: string;
  receivedQuantity?: number;
  supplierId?: string;
  supplierName?: string;
};

function inboundMatchesSkus(snapshot: { skuMasterId: string; operatingProductCode?: string; mappingLevel?: "sku" | "operating_product" }, skus: ProductMasterSkuInput[]) {
  const skuIds = new Set(skus.map((sku) => sku.id));
  if (snapshot.mappingLevel !== "operating_product") return skuIds.has(snapshot.skuMasterId);
  const codes = new Set(skus.map((sku) => deriveOperatingProductCode(sku.internalSkuCode, sku.productName, sku.specification, skus.map((item) => item.internalSkuCode))));
  return Boolean(snapshot.operatingProductCode && codes.has(snapshot.operatingProductCode));
}

export type ProductSupplierDecision =
  | "maintain_primary"
  | "review_split"
  | "confirm_supplier"
  | "review_quality";

export type ProductSupplierDecisionRow = {
  familyKey: string;
  productName: string;
  supplierId?: string;
  supplierName: string;
  supplierNames: string[];
  totalSkuCount: number;
  coveredSkuCount: number;
  receivedQuantity: number;
  shippedQuantity?: number;
  returnQuantity?: number;
  returnRate?: number;
  skuDetails: Array<{
    internalSkuCode: string;
    specification: string;
    supplierNames: string[];
    receivedQuantity: number;
    returnRate?: number;
  }>;
  decision: ProductSupplierDecision;
  actionLabel: string;
  reason: string;
};

export type ProductSupplierDecisionGroupInput = {
  familyKey: string;
  productName: string;
  skus: ProductMasterSkuInput[];
};

type OperatingDecisionSnapshot = OperatingSnapshotForSummary & {
  returnQuantity?: number;
};

function decisionForSupplierRow(args: {
  hasUnconfirmedSupplier: boolean;
  supplierCount: number;
  coveredSkuCount: number;
  totalSkuCount: number;
  returnRate?: number;
  qualityReviewRate: number;
}): Pick<ProductSupplierDecisionRow, "decision" | "actionLabel" | "reason"> {
  if (args.hasUnconfirmedSupplier) {
    return { decision: "confirm_supplier", actionLabel: "补充实际供应商", reason: "存在未标注供应商的实际入仓记录，先补齐供应商归属。" };
  }
  if (args.supplierCount > 1) {
    return { decision: "review_split", actionLabel: "复核主供/备供", reason: "同一产品族存在供应商分拆，需要确认主供、备供和分拆原因。" };
  }
  if (args.returnRate !== undefined && args.returnRate >= args.qualityReviewRate) {
    return { decision: "review_quality", actionLabel: "复核产品/供应商质量", reason: "产品退货率达到复核阈值；这是产品层质量信号，多供应商时不直接归因。" };
  }
  return { decision: "maintain_primary", actionLabel: "保持主供", reason: "当前实际供货关系未触发供应商分拆或质量复核信号；SKU覆盖仅作参考。" };
}

export function buildProductSupplierDecisionRows(
  groups: ProductSupplierDecisionGroupInput[],
  inboundSnapshots: InboundSupplierForSummary[],
  operatingSnapshots: OperatingDecisionSnapshot[],
  period: string,
  qualityReviewRate = 5,
): ProductSupplierDecisionRow[] {
  return groups.map((group) => {
    const skuIds = new Set(group.skus.map((sku) => sku.id));
    const inbound = inboundSnapshots.filter((snapshot) => snapshot.period === period && inboundMatchesSkus(snapshot, group.skus));
    const operating = operatingSnapshots.filter((snapshot) => skuIds.has(snapshot.skuMasterId) && snapshot.period === period);
    const supplierNames = [...new Set(inbound.map((snapshot) => snapshot.supplierName?.trim()).filter((name): name is string => Boolean(name)))];
    const namedSupplierIds = [...new Set(inbound.map((snapshot) => snapshot.supplierId).filter((id): id is string => Boolean(id)))];
    const coveredSkuIds = new Set(inbound.flatMap((snapshot) => snapshot.mappingLevel === "operating_product" ? group.skus.map((sku) => sku.id) : [snapshot.skuMasterId]));
    const receivedQuantity = inbound.reduce((total, snapshot) => total + (snapshot.receivedQuantity ?? 0), 0);
    const shippedQuantity = operating.reduce((total, snapshot) => total + (snapshot.shippedQuantity ?? snapshot.monthlySales ?? 0), 0);
    const returnQuantity = operating.reduce((total, snapshot) => total + (snapshot.returnQuantity ?? 0), 0);
    const hasReturnQuantity = operating.some((snapshot) => snapshot.returnQuantity !== undefined);
    const returnRate = hasReturnQuantity && shippedQuantity > 0 ? Number(((returnQuantity / shippedQuantity) * 100).toFixed(2)) : undefined;
    const skuDetails = group.skus.map((sku) => {
      const skuInbound = inbound.filter((snapshot) => snapshot.mappingLevel !== "operating_product" && snapshot.skuMasterId === sku.id);
      const skuOperating = operating.filter((snapshot) => snapshot.skuMasterId === sku.id);
      const skuShipped = skuOperating.reduce((total, snapshot) => total + (snapshot.shippedQuantity ?? snapshot.monthlySales ?? 0), 0);
      const skuReturned = skuOperating.reduce((total, snapshot) => total + (snapshot.returnQuantity ?? 0), 0);
      const skuHasReturnQuantity = skuOperating.some((snapshot) => snapshot.returnQuantity !== undefined);
      return {
        internalSkuCode: sku.internalSkuCode,
        specification: sku.specification,
        supplierNames: [...new Set(skuInbound.map((snapshot) => snapshot.supplierName?.trim()).filter((name): name is string => Boolean(name)))],
        receivedQuantity: skuInbound.reduce((total, snapshot) => total + (snapshot.receivedQuantity ?? 0), 0),
        ...(skuHasReturnQuantity && skuShipped > 0 ? { returnRate: Number(((skuReturned / skuShipped) * 100).toFixed(2)) } : {}),
      };
    });
    const decision = decisionForSupplierRow({
      hasUnconfirmedSupplier: inbound.some((snapshot) => !snapshot.supplierName?.trim()),
      supplierCount: supplierNames.length,
      coveredSkuCount: coveredSkuIds.size,
      totalSkuCount: group.skus.length,
      returnRate,
      qualityReviewRate,
    });
    return {
      familyKey: group.familyKey,
      productName: group.productName,
      ...(namedSupplierIds.length === 1 ? { supplierId: namedSupplierIds[0] } : {}),
      supplierName: supplierNames.length ? supplierNames.join("、") : "供应商待确认",
      supplierNames,
      totalSkuCount: group.skus.length,
      coveredSkuCount: coveredSkuIds.size,
      receivedQuantity,
      ...(operating.some((snapshot) => snapshot.shippedQuantity !== undefined || snapshot.monthlySales !== undefined) ? { shippedQuantity } : {}),
      ...(hasReturnQuantity ? { returnQuantity } : {}),
      ...(returnRate !== undefined ? { returnRate } : {}),
      skuDetails,
      ...decision,
    };
  });
}

export type SupplierDecisionOverviewRow = {
  supplierId?: string;
  supplierName: string;
  productCount: number;
  productNames: string[];
  coveredSkuCount: number;
  totalSkuCount: number;
  receivedQuantity: number;
  returnRate?: number;
  decision: Extract<ProductSupplierDecision, "maintain_primary" | "review_split" | "confirm_supplier" | "review_quality">;
  actionLabel: string;
  evidence: string;
  score?: number;
};

export function buildSupplierDecisionOverviewRows(
  groups: ProductSupplierDecisionGroupInput[],
  inboundSnapshots: InboundSupplierForSummary[],
  period: string,
  operatingSnapshots: OperatingDecisionSnapshot[] = [],
  qualityReviewRate = 5,
  assignmentPeriod = period,
  productSupplierAssignments: Array<{
    productFamilyKey: string;
    supplierId?: string;
    supplierName?: string;
    role: "primary" | "backup";
    effectiveFrom: string;
    effectiveTo?: string;
    status: "active" | "ended";
    source?: string;
    reason?: string;
    evidence?: string;
  }> = [],
): SupplierDecisionOverviewRow[] {
  const rows = new Map<string, {
    supplierId?: string;
    supplierName: string;
    productNames: Set<string>;
    productKeys: Set<string>;
    skuIds: Set<string>;
    totalSkuCount: number;
    receivedQuantity: number;
    splitProduct: boolean;
    hasAssignment: boolean;
  }>();

  for (const group of groups) {
    const skuIds = new Set(group.skus.map((sku) => sku.id));
    const familyKeys = new Set(group.skus.map((sku) => deriveProductFamilyKey(sku.productName, sku.productFamilyKey)));
    const inbound = inboundSnapshots.filter((snapshot) => snapshot.period === period && inboundMatchesSkus(snapshot, group.skus));
    const assignments = productSupplierAssignments.filter((assignment) =>
      assignment.productFamilyKey === group.familyKey &&
      assignment.status === "active" &&
      assignment.effectiveFrom <= assignmentPeriod &&
      (!assignment.effectiveTo || assignment.effectiveTo >= assignmentPeriod),
    );
    const supplierKeys = new Set([
      ...inbound.map((snapshot) => snapshot.supplierId ? `id:${snapshot.supplierId}` : `name:${snapshot.supplierName?.trim() || "供应商待确认"}`),
      ...assignments.map((assignment) => assignment.supplierId ? `id:${assignment.supplierId}` : `name:${assignment.supplierName?.trim() || "供应商待确认"}`),
    ]);
    for (const snapshot of inbound) {
      const supplierName = snapshot.supplierName?.trim() || "供应商待确认";
      const key = snapshot.supplierId ? `id:${snapshot.supplierId}` : `name:${supplierName}`;
      const current = rows.get(key) ?? {
        supplierId: snapshot.supplierId,
        supplierName,
        productNames: new Set<string>(),
        productKeys: new Set<string>(),
        skuIds: new Set<string>(),
        totalSkuCount: 0,
        receivedQuantity: 0,
        splitProduct: false,
        hasAssignment: false,
      };
      current.productNames.add(group.productName);
      if (!current.productKeys.has(group.familyKey)) {
        current.productKeys.add(group.familyKey);
        current.totalSkuCount += group.skus.length;
      }
      current.skuIds.add(snapshot.skuMasterId);
      current.receivedQuantity += snapshot.receivedQuantity ?? 0;
      current.splitProduct = current.splitProduct || supplierKeys.size > 1;
      rows.set(key, current);
    }
    for (const assignment of assignments) {
      const supplierName = assignment.supplierName?.trim() || "供应商待确认";
      const key = assignment.supplierId ? `id:${assignment.supplierId}` : `name:${supplierName}`;
      const current = rows.get(key) ?? {
        supplierId: assignment.supplierId,
        supplierName,
        productNames: new Set<string>(),
        productKeys: new Set<string>(),
        skuIds: new Set<string>(),
        totalSkuCount: 0,
        receivedQuantity: 0,
        splitProduct: false,
        hasAssignment: false,
      };
      current.productNames.add(group.productName);
      if (!current.productKeys.has(group.familyKey)) {
        current.productKeys.add(group.familyKey);
        current.totalSkuCount += group.skus.length;
      }
      current.hasAssignment = true;
      current.splitProduct = current.splitProduct || supplierKeys.size > 1;
      rows.set(key, current);
    }
  }

  return [...rows.values()]
    .map((row) => {
      const isUnconfirmed = row.supplierName === "供应商待确认";
      const familySkuIds = new Set(
        groups
          .filter((group) => row.productKeys.has(group.familyKey))
          .flatMap((group) => group.skus.map((sku) => sku.id)),
      );
      const familyOperating = operatingSnapshots.filter(
        (snapshot) => familySkuIds.has(snapshot.skuMasterId) && snapshot.period === period,
      );
      const shippedQuantity = familyOperating.reduce(
        (total, snapshot) => total + (snapshot.shippedQuantity ?? snapshot.monthlySales ?? 0),
        0,
      );
      const returnQuantity = familyOperating.reduce(
        (total, snapshot) => total + (snapshot.returnQuantity ?? 0),
        0,
      );
      const hasReturnQuantity = familyOperating.some((snapshot) => snapshot.returnQuantity !== undefined);
      const returnRate = hasReturnQuantity && shippedQuantity > 0
        ? Number(((returnQuantity / shippedQuantity) * 100).toFixed(2))
        : undefined;
      const qualitySignal = returnRate !== undefined && returnRate >= qualityReviewRate;
      const decision: SupplierDecisionOverviewRow["decision"] = isUnconfirmed
        ? "confirm_supplier"
        : row.splitProduct
          ? "review_split"
          : qualitySignal
            ? "review_quality"
            : "maintain_primary";
      const qualityEvidence = returnRate !== undefined ? ` · 退货率 ${returnRate}%（产品信号）` : "";
      const evidence = row.hasAssignment
        ? `已维护供应关系：${[...row.productNames].join("、")} · `
        : "";
      const inboundEvidence = row.skuIds.size > 0
        ? `实际入仓：${[...row.productNames].join("、")} · ${row.skuIds.size} 个 SKU · ${row.receivedQuantity || 0}`
        : "当前周期暂无实际入仓证据";
      return {
        ...(row.supplierId ? { supplierId: row.supplierId } : {}),
        supplierName: row.supplierName,
        productCount: row.productNames.size,
        productNames: [...row.productNames],
        coveredSkuCount: row.skuIds.size,
        totalSkuCount: row.totalSkuCount,
        receivedQuantity: row.receivedQuantity,
        ...(returnRate !== undefined ? { returnRate } : {}),
        decision,
        actionLabel: isUnconfirmed
          ? "补充实际供应商"
          : row.splitProduct
            ? "复核主供/备供"
            : qualitySignal
              ? "复核产品/供应商质量"
              : "保持主供",
        evidence: `${evidence}${inboundEvidence}${qualityEvidence}`,
      };
    })
    .sort((left, right) => right.receivedQuantity - left.receivedQuantity || left.supplierName.localeCompare(right.supplierName));
}

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
  const familyKeys = new Set(skuMasters.map((sku) => deriveProductFamilyKey(sku.productName, sku.productFamilyKey)));
    const inbound = inboundSnapshots.filter((snapshot) => snapshot.period === period && inboundMatchesSkus(snapshot, skuMasters));
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
    const missingPreviousPeriod = !inboundSnapshots.some((snapshot) => snapshot.period === previousPeriod && inboundMatchesSkus(snapshot, skuMasters));
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
    .filter((snapshot) => snapshot.period === period && inboundMatchesSkus(snapshot, skuMasters))
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
      if (snapshot.mappingLevel === "operating_product") skuMasters.forEach((sku) => current.skuIds.add(sku.id));
      else current.skuIds.add(snapshot.skuMasterId);
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

export function deriveOperatingProductCode(
  internalSkuCode: string,
  productName = "",
  specification = "",
  allInternalSkuCodes: string[] = [],
): string {
  const code = internalSkuCode.trim();
  const isGiftVariant = /-8$/.test(code) && (
    /\+|＋|组合装|套装|礼盒|件套/.test(`${productName} ${specification}`) ||
    allInternalSkuCodes.includes(code.replace(/-8$/, ""))
  );
  return isGiftVariant ? code.replace(/-8$/, "") : code;
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
    const current = groups.get(familyKey) ?? { familyKey, productName: familyKey, skuIds: [], internalSkuCodes: [] };
    if (!current.skuIds.includes(row.id)) current.skuIds.push(row.id);
    if (!current.internalSkuCodes.includes(row.internalSkuCode)) current.internalSkuCodes.push(row.internalSkuCode);
    groups.set(familyKey, current);
  }
  return [...groups.values()];
}

export function groupSkuMastersByOperatingProduct(rows: ProductMasterSkuInput[]): ProductMasterGroup[] {
  const groups = new Map<string, ProductMasterGroup>();
  const codes = new Set(rows.map((row) => row.internalSkuCode.trim()).filter(Boolean));

  for (const row of rows) {
    const code = row.internalSkuCode.trim();
    const productFamilyKey = deriveProductFamilyKey(row.productName, row.productFamilyKey);
    if (!code || !productFamilyKey) continue;
    const isGiftVariant = /-8$/.test(code) && (
      /\+|＋|组合装|套装|礼盒|件套/.test(`${row.productName} ${row.specification}`) ||
      codes.has(code.replace(/-8$/, ""))
    );
    const operatingProductCode = isGiftVariant ? code.replace(/-8$/, "") : code;
    const familyKey = `${productFamilyKey}::${operatingProductCode}`;
    const current = groups.get(familyKey) ?? {
      familyKey,
      productName: productFamilyKey,
      productFamilyKey,
      skuIds: [],
      internalSkuCodes: [],
      operatingProductCode,
    };
    if (!current.skuIds.includes(row.id)) current.skuIds.push(row.id);
    if (!current.internalSkuCodes.includes(code)) current.internalSkuCodes.push(code);
    groups.set(familyKey, current);
  }
  return [...groups.values()];
}

type ProductMasterOperatingSortSnapshot = {
  skuMasterId: string;
  period: string;
  shippedQuantity?: number;
  monthlySales?: number;
};

type ProductMasterInboundSortSnapshot = {
  skuMasterId: string;
  period: string;
  receivedQuantity?: number;
};

function compareProductMasterMetrics(
  left: { shippedQuantity: number; receivedQuantity: number; hasData: boolean; name: string },
  right: { shippedQuantity: number; receivedQuantity: number; hasData: boolean; name: string },
) {
  return Number(right.hasData) - Number(left.hasData)
    || right.shippedQuantity - left.shippedQuantity
    || right.receivedQuantity - left.receivedQuantity
    || left.name.localeCompare(right.name, "zh-CN");
}

function metricForSku(
  skuMasterId: string,
  operatingSnapshots: ProductMasterOperatingSortSnapshot[],
  inboundSnapshots: ProductMasterInboundSortSnapshot[],
  period: string,
) {
  const operating = operatingSnapshots.filter((snapshot) => snapshot.skuMasterId === skuMasterId && snapshot.period === period);
  const inbound = inboundSnapshots.filter((snapshot) => snapshot.skuMasterId === skuMasterId && snapshot.period === period);
  const shippedQuantity = operating.reduce((total, snapshot) => total + (snapshot.shippedQuantity ?? snapshot.monthlySales ?? 0), 0);
  const receivedQuantity = inbound.reduce((total, snapshot) => total + (snapshot.receivedQuantity ?? 0), 0);
  return {
    shippedQuantity,
    receivedQuantity,
    hasData: operating.some((snapshot) => snapshot.shippedQuantity !== undefined || snapshot.monthlySales !== undefined)
      || inbound.some((snapshot) => snapshot.receivedQuantity !== undefined),
  };
}

export function sortProductMasterGroupsByOperatingData(
  groups: ProductMasterGroup[],
  operatingSnapshots: ProductMasterOperatingSortSnapshot[],
  inboundSnapshots: ProductMasterInboundSortSnapshot[],
  period: string,
): ProductMasterGroup[] {
  return groups
    .map((group, index) => ({
      group,
      index,
      metrics: group.skuIds.reduce((total, skuMasterId) => {
        const metrics = metricForSku(skuMasterId, operatingSnapshots, inboundSnapshots, period);
        return {
          shippedQuantity: total.shippedQuantity + metrics.shippedQuantity,
          receivedQuantity: total.receivedQuantity + metrics.receivedQuantity,
          hasData: total.hasData || metrics.hasData,
        };
      }, { shippedQuantity: 0, receivedQuantity: 0, hasData: false }),
    }))
    .sort((left, right) => compareProductMasterMetrics(
      { ...left.metrics, name: left.group.productName },
      { ...right.metrics, name: right.group.productName },
    ) || left.index - right.index)
    .map(({ group }) => group);
}

export function sortProductMasterSkusByOperatingData<T extends ProductMasterSkuInput>(
  skus: T[],
  operatingSnapshots: ProductMasterOperatingSortSnapshot[],
  inboundSnapshots: ProductMasterInboundSortSnapshot[],
  period: string,
): T[] {
  return skus
    .map((sku, index) => ({ sku, index, metrics: metricForSku(sku.id, operatingSnapshots, inboundSnapshots, period) }))
    .sort((left, right) => compareProductMasterMetrics(
      { ...left.metrics, name: left.sku.internalSkuCode },
      { ...right.metrics, name: right.sku.internalSkuCode },
    ) || left.index - right.index)
    .map(({ sku }) => sku);
}

export function promoteProductToInbound<T extends PromotableProduct>(product: T): T {
  return {
    ...product,
    recordKind: "existing",
    productMode: "inbound",
    portfolioStatus: "active"
  };
}
