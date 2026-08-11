import { z } from "zod";

export const ProductSpecificationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  value: z.string(),
  unit: z.string().optional(),
  source: z.enum(["manual", "research", "legacy"]).optional()
});

export type ProductSpecification = z.infer<typeof ProductSpecificationSchema>;

export const ProductCostItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  name: z.string(),
  quantity: z.number().finite().optional(),
  unit: z.string().optional(),
  unitCost: z.number().finite().optional(),
  subtotal: z.number().finite().optional(),
  currency: z.string().optional(),
  included: z.boolean().optional(),
  source: z.string().optional()
});

export type ProductCostItem = z.infer<typeof ProductCostItemSchema>;

export const ProductProcurementQuoteSchema = z.object({
  source: z.string().min(1),
  specification: z.string().min(1),
  price: z.string().min(1),
  moq: z.string().optional(),
  freight: z.string().optional(),
  quotedAt: z.string().optional(),
  sourceUrl: z.string().optional(),
  note: z.string().optional()
});

export type ProductProcurementQuote = z.infer<typeof ProductProcurementQuoteSchema>;

export const ProductMaterialStructureSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  keyParameters: z.string().optional(),
  weaknesses: z.string().optional()
});

export type ProductMaterialStructure = z.infer<typeof ProductMaterialStructureSchema>;

export const ProductTechnologyOutlookSchema = z.object({
  mainstream: z.array(z.string()),
  alternatives: z.array(z.string()),
  emerging: z.array(z.string()),
  replacementRisks: z.array(z.string()),
  watchSignals: z.array(z.string()),
  updatedAt: z.string().optional()
});

export type ProductTechnologyOutlook = z.infer<typeof ProductTechnologyOutlookSchema>;

export const ProductManufacturingSchema = z.object({
  processes: z.array(z.string()),
  leadTime: z.string().optional(),
  minimumOrderQuantity: z.string().optional(),
  notes: z.string().optional()
});

export type ProductManufacturing = z.infer<typeof ProductManufacturingSchema>;

export const ProductOptimizationOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  impact: z.string().optional(),
  status: z.enum(["candidate", "selected", "rejected"])
});

export type ProductOptimizationOption = z.infer<typeof ProductOptimizationOptionSchema>;

export const ProductRiskSetSchema = z.object({
  quality: z.array(z.string()),
  supply: z.array(z.string()),
  compliance: z.array(z.string()),
  other: z.array(z.string())
});

export type ProductRiskSet = z.infer<typeof ProductRiskSetSchema>;

export const ProductDecisionSummarySchema = z.object({
  summary: z.string().optional(),
  recommendation: z.string().optional(),
  rationale: z.string().optional(),
  status: z.enum(["undecided", "proceed", "hold", "reject"])
});

export type ProductDecisionSummary = z.infer<typeof ProductDecisionSummarySchema>;

export const ProductResearchDocumentSchema = z.object({
  sourceName: z.string().optional(),
  sourceUrl: z.string().optional(),
  content: z.string().optional(),
  capturedAt: z.string().optional(),
  rawData: z.unknown().optional()
});

export type ProductResearchDocument = z.infer<typeof ProductResearchDocumentSchema>;

// ===== 品类调研扩展字段 =====
// 以下 5 组字段全部可空，专门给"品类调研报告"用
// 原有产品卡不受影响（字段全空时走原有逻辑）

/** 通用表格结构（Markdown 表格解析后的标准形态） */
export const ResearchTableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.string())),
  caption: z.string().optional()
});

export type ResearchTable = z.infer<typeof ResearchTableSchema>;

/** ① 行业概览 */
export const MarketOverviewSchema = z.object({
  marketSize: z.string().optional(),
  yoyGrowth: z.string().optional(),
  subCategoryTrend: z.string().optional(),
  pestel: z.array(z.object({
    dimension: z.string(),
    factor: z.string(),
    impact: z.string()
  })).optional(),
  entryBarriers: z.array(z.object({
    name: z.string(),
    level: z.string(),
    analysis: z.string()
  })).optional(),
  marketSizeTable: ResearchTableSchema.optional(),
  segmentStructure: ResearchTableSchema.optional()
});

export type MarketOverview = z.infer<typeof MarketOverviewSchema>;

/** ② 竞争格局 */
export const CompetitiveLandscapeSchema = z.object({
  cr5: z.string().optional(),
  topBrandRanking: ResearchTableSchema.optional(),
  porterFiveForces: z.array(z.object({
    force: z.string(),
    strength: z.string(),
    basis: z.string()
  })).optional(),
  strategyDifferences: z.string().optional(),
  brandRankingByCategory: ResearchTableSchema.optional()
});

export type CompetitiveLandscape = z.infer<typeof CompetitiveLandscapeSchema>;

/** ③ 产品对标 */
export const ProductBenchmarkSchema = z.object({
  tmallProtectiveFilm: ResearchTableSchema.optional(),
  tmallHangingBoard: ResearchTableSchema.optional(),
  formComparison: ResearchTableSchema.optional(),
  priceTiers: ResearchTableSchema.optional(),
  keyFindings: z.string().optional()
});

export type ProductBenchmark = z.infer<typeof ProductBenchmarkSchema>;

/** ④ 用户洞察 */
export const UserInsightsSchema = z.object({
  personas: ResearchTableSchema.optional(),
  coreMetrics: ResearchTableSchema.optional(),
  purchasePriorities: z.array(z.string()).optional(),
  complaints: ResearchTableSchema.optional(),
  praisePoints: z.array(z.string()).optional()
});

export type UserInsights = z.infer<typeof UserInsightsSchema>;

/** ⑤ 供应链寻源 */
export const SupplyChainFindingsSchema = z.object({
  coreMetrics: ResearchTableSchema.optional(),
  filmSuppliers: ResearchTableSchema.optional(),
  boardSuppliers: ResearchTableSchema.optional(),
  priceGradientFilm: ResearchTableSchema.optional(),
  priceGradientBoard: ResearchTableSchema.optional(),
  comboSupply: z.string().optional(),
  sourcingAdvice: ResearchTableSchema.optional(),
  sourcingPathSteps: z.array(z.string()).optional()
});

export type SupplyChainFindings = z.infer<typeof SupplyChainFindingsSchema>;

export const ProductImportIssueSchema = z.object({
  field: z.string(),
  message: z.string(),
  severity: z.enum(["blocking", "warning", "conflict"])
});

export type ProductImportIssue = z.infer<typeof ProductImportIssueSchema>;

// ===== 流水线阶段 + 信号池休眠/激活机制 =====
export const PRODUCT_LIFECYCLE_STAGES = [
  "signal",           // 信号池（每日情报导入的原始机会，未进入执行）
  "validated",        // 已验证通过，决定做
  "defined",          // 产品定义完成（产品知识卡填充完毕）
  "supply_locked",    // 供应锁定（供应商、货盘、成本都齐了）
  "listing",          // 上架测试中
  "evaluating",       // 评估决策（看上架数据决定放量/止损）
  "archived",         // 归档（成功跑完闭环）
  "discontinued"      // 已淘汰（明确不做，区别于休眠）
] as const;
export type ProductLifecycleStage = typeof PRODUCT_LIFECYCLE_STAGES[number];

export const SIGNAL_STATUSES = ["active", "dormant", "rejected"] as const;
export type ProductSignalStatus = typeof SIGNAL_STATUSES[number];

export const DORMANT_REASONS = [
  "供应商不成熟",
  "采购成本过高",
  "季节不适配",
  "资金不足",
  "产能受限",
  "竞争太激烈",
  "其他"
] as const;
export type ProductDormantReason = typeof DORMANT_REASONS[number];

export const ProductSignalActivationTriggerSchema = z.object({
  requiredSupplierCategories: z.array(z.string()).optional(),
  maxUnitCost: z.number().finite().optional(),
  applicableMonths: z.array(z.number().int().min(1).max(12)).optional(),
  minSupplierCooperationLevel: z.string().optional(),
  customRule: z.string().optional()
});
export type ProductSignalActivationTrigger = z.infer<typeof ProductSignalActivationTriggerSchema>;

// ===== 历史遗留兼容字段 =====
type LegacyProductKnowledgeFields = {
  supplierId?: string;
  supplierName?: string;
  communicationId?: string;
  materials?: string;
  process?: string;
  costStructure?: string;
  keyParameters?: string;
  qualityRisks?: string;
  commonPitfalls?: string;
  alternatives?: string;
  judgement?: string;
};

export type ProductKnowledgeV2 = {
  schemaVersion: 2;
  id: string;
  pinned?: boolean;
  name: string;
  category?: string;
  coreUse?: string;
  targetUsers?: string;
  useScenarios: string[];
  defaultUnit?: string;
  specifications: ProductSpecification[];
  procurementQuotes: ProductProcurementQuote[];
  materialStructures: ProductMaterialStructure[];
  machinery: string[];
  qualityControls: string[];
  industryClusters: string[];
  technologyOutlook?: ProductTechnologyOutlook;
  costItems: ProductCostItem[];
  hardCostTotal?: number;
  hardCostStatus: "confirmed" | "pending";
  manufacturing: ProductManufacturing;
  optimizationOptions: ProductOptimizationOption[];
  risks: ProductRiskSet;
  opportunities: string[];
  decision: ProductDecisionSummary;
  rawDocument?: ProductResearchDocument;
  importIssues: ProductImportIssue[];
  legacyNotes?: string;
  createdAt: string;
  updatedAt?: string;
  // ===== 流水线阶段 + 信号池休眠/激活 =====
  lifecycleStage?: ProductLifecycleStage;
  signalStatus?: ProductSignalStatus;          // 仅 lifecycleStage === "signal" 时有效
  dormantReason?: ProductDormantReason;        // signalStatus === "dormant" 时填写原因
  activationTrigger?: ProductSignalActivationTrigger;  // 系统何时可以提醒你重新评估
  lastActivationCheckAt?: string;              // 上次扫描匹配时间，避免重复提醒
  // ===== 品类调研扩展字段（全部可空） =====
  researchDepth?: "product" | "category";
  marketOverview?: MarketOverview;
  competitiveLandscape?: CompetitiveLandscape;
  productBenchmark?: ProductBenchmark;
  userInsights?: UserInsights;
  supplyChainFindings?: SupplyChainFindings;
  // ===== 闭环关联字段 =====
  relatedSupplierIds?: string[];
  relatedOfferIds?: string[];
} & LegacyProductKnowledgeFields;

export const ProductKnowledgeV2Schema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(1),
  pinned: z.boolean().optional(),
  name: z.string().min(1),
  category: z.string().optional(),
  coreUse: z.string().optional(),
  targetUsers: z.string().optional(),
  useScenarios: z.array(z.string()),
  defaultUnit: z.string().optional(),
  specifications: z.array(ProductSpecificationSchema),
  procurementQuotes: z.array(ProductProcurementQuoteSchema).default([]),
  materialStructures: z.array(ProductMaterialStructureSchema).default([]),
  machinery: z.array(z.string()).default([]),
  qualityControls: z.array(z.string()).default([]),
  industryClusters: z.array(z.string()).default([]),
  technologyOutlook: ProductTechnologyOutlookSchema.optional(),
  costItems: z.array(ProductCostItemSchema),
  hardCostTotal: z.number().finite().optional(),
  hardCostStatus: z.enum(["confirmed", "pending"]),
  manufacturing: ProductManufacturingSchema,
  optimizationOptions: z.array(ProductOptimizationOptionSchema),
  risks: ProductRiskSetSchema,
  opportunities: z.array(z.string()),
  decision: ProductDecisionSummarySchema,
  rawDocument: ProductResearchDocumentSchema.optional(),
  importIssues: z.array(ProductImportIssueSchema),
  legacyNotes: z.string().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().optional(),
  // 流水线阶段 + 信号池休眠/激活
  lifecycleStage: z.enum(PRODUCT_LIFECYCLE_STAGES).optional(),
  signalStatus: z.enum(SIGNAL_STATUSES).optional(),
  dormantReason: z.enum(DORMANT_REASONS).optional(),
  activationTrigger: ProductSignalActivationTriggerSchema.optional(),
  lastActivationCheckAt: z.string().optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  communicationId: z.string().optional(),
  materials: z.string().optional(),
  process: z.string().optional(),
  costStructure: z.string().optional(),
  keyParameters: z.string().optional(),
  qualityRisks: z.string().optional(),
  commonPitfalls: z.string().optional(),
  alternatives: z.string().optional(),
  judgement: z.string().optional(),
  // 品类调研扩展
  researchDepth: z.enum(["product", "category"]).optional(),
  marketOverview: MarketOverviewSchema.optional(),
  competitiveLandscape: CompetitiveLandscapeSchema.optional(),
  productBenchmark: ProductBenchmarkSchema.optional(),
  userInsights: UserInsightsSchema.optional(),
  supplyChainFindings: SupplyChainFindingsSchema.optional(),
  // 闭环关联
  relatedSupplierIds: z.array(z.string()).optional(),
  relatedOfferIds: z.array(z.string()).optional()
});

export function calculateHardCost(items: ProductCostItem[]): { total?: number; status: "confirmed" | "pending" } {
  const includedItems = items.filter((item) => item.included !== false);
  if (includedItems.length === 0 || includedItems.some((item) => !hasCompleteHardCostEvidence(item))) {
    return { status: "pending" };
  }

  const currencies = new Set(includedItems.map((item) => item.currency));
  if (currencies.size !== 1) return { status: "pending" };

  return {
    total: includedItems.reduce((total, item) => total + (item.subtotal ?? 0), 0),
    status: "confirmed"
  };
}

function hasCompleteHardCostEvidence(item: ProductCostItem): boolean {
  return item.quantity !== undefined
    && Boolean(item.unit?.trim())
    && item.unitCost !== undefined
    && item.subtotal !== undefined
    && Boolean(item.currency?.trim())
    && Boolean(item.source?.trim());
}

export function normalizeProductKnowledge(value: unknown): ProductKnowledgeV2 {
  const originalCandidate = asRecord(value);
  const compatibility = normalizeProductImportIssueCompatibility(originalCandidate);
  const candidate = compatibility.value;
  const parsed = ProductKnowledgeV2Schema.safeParse(candidate);

  if (parsed.success) {
    const context: NormalizationContext = { issues: [], rawData: {} };
    preserveUnknownImportIssueEvidence(context, compatibility.unknownIssues);
    if (hasStrippedFields(candidate, parsed.data)) {
      addImportIssue(
        context,
        "originalRecord",
        "V2 规范化移除了未建模字段，完整原始记录已保留。",
        snapshotWithoutRawData(candidate)
      );
    }
    const hardCost = calculateHardCost(parsed.data.costItems);
    const hasUnverifiedHardCost = hardCost.status === "pending" && (
      parsed.data.hardCostTotal !== undefined || parsed.data.hardCostStatus !== hardCost.status
    );

    const categoryResearch: Pick<
      ProductKnowledgeV2,
      "researchDepth" | "marketOverview" | "competitiveLandscape" | "productBenchmark" | "userInsights" | "supplyChainFindings"
    > = {
      researchDepth: parsed.data.researchDepth,
      marketOverview: parsed.data.marketOverview,
      competitiveLandscape: parsed.data.competitiveLandscape,
      productBenchmark: parsed.data.productBenchmark,
      userInsights: parsed.data.userInsights,
      supplyChainFindings: parsed.data.supplyChainFindings
    };

    let product: ProductKnowledgeV2;
    const hasExplicitStage = parsed.data.lifecycleStage !== undefined;
    if (hasUnverifiedHardCost) {
      if (parsed.data.hardCostTotal !== undefined) {
        addImportIssue(context, "hardCostTotal", "硬成本总额未确认，原始值已保留。", parsed.data.hardCostTotal);
      }
      if (parsed.data.hardCostStatus !== hardCost.status) {
        addImportIssue(context, "hardCostStatus", "硬成本状态已重新计算，原始值已保留。", parsed.data.hardCostStatus);
      }
      const { hardCostTotal: _hardCostTotal, hardCostStatus: _hardCostStatus, ...parsedProduct } = parsed.data;
      product = {
        ...parsedProduct,
        ...categoryResearch,
        hardCostStatus: "pending",
        legacyNotes: mergeLegacyNotes(
          parsed.data.legacyNotes,
          "硬成本未完整确认，原始总额和状态已保留在 rawDocument.rawData。"
        )
      };
    } else {
      product = {
        ...parsed.data,
        ...categoryResearch,
        hardCostTotal: hardCost.total,
        hardCostStatus: hardCost.status
      };
    }
    // 信号池默认值：未设 stage 的非品类调研报告 → 自动视为信号池活跃机会
    if (!hasExplicitStage && product.researchDepth !== "category") {
      product.lifecycleStage = "signal";
      if (!product.signalStatus) product.signalStatus = "active";
    }
    const importIssues = dedupeImportIssues([...parsed.data.importIssues, ...context.issues]);
    if (context.issues.length === 0 && importIssues.length === parsed.data.importIssues.length) return product;
    return {
      ...product,
      rawDocument: withCapturedRawData(parsed.data.rawDocument, context.rawData),
      importIssues,
      legacyNotes: context.issues.length > 0
        ? mergeLegacyNotes(product.legacyNotes, "部分字段未能规范化，原始内容已保留在 rawDocument.rawData。")
        : product.legacyNotes
    };
  }

  const context = createNormalizationContext(value);
  preserveUnknownImportIssueEvidence(context, compatibility.unknownIssues);
  addImportIssue(
    context,
    "originalRecord",
    "记录未通过 V2 校验，完整原始记录已在迁移前保留。",
    snapshotWithoutRawData(originalCandidate)
  );
  const fingerprint = stableFingerprint(value);
  preserveInvalidSchemaVersion(candidate, context);
  const pinned = optionalBoolean(candidate, "pinned", context);
  const id = requiredString(candidate, "id", `imported-${fingerprint}`, context, "缺少有效 id；已生成导入标识，不代表原始值。");
  const name = requiredString(candidate, "name", `导入记录-${fingerprint}`, context, "缺少有效名称；已使用导入标签，不代表原始名称。");
  const createdAt = requiredString(candidate, "createdAt", "unknown", context, "缺少有效创建时间；原始时间不可用。");
  const keyParameters = optionalString(candidate, "keyParameters", context);
  const materials = optionalString(candidate, "materials", context);
  const process = optionalString(candidate, "process", context);
  const category = optionalString(candidate, "category", context);
  const coreUse = optionalString(candidate, "coreUse", context);
  const targetUsers = optionalString(candidate, "targetUsers", context);
  const defaultUnit = optionalString(candidate, "defaultUnit", context);
  const updatedAt = optionalString(candidate, "updatedAt", context);
  const supplierId = optionalString(candidate, "supplierId", context);
  const supplierName = optionalString(candidate, "supplierName", context);
  const communicationId = optionalString(candidate, "communicationId", context);
  const qualityRisks = optionalString(candidate, "qualityRisks", context);
  const commonPitfalls = optionalString(candidate, "commonPitfalls", context);
  const alternatives = optionalString(candidate, "alternatives", context);
  const judgement = optionalString(candidate, "judgement", context);
  const costStructure = optionalString(candidate, "costStructure", context);
  const useScenarios = normalizeStringArray(candidate.useScenarios, "useScenarios", context);
  const opportunities = normalizeStringArray(candidate.opportunities, "opportunities", context);
  const procurementQuotes = parseStructuredArray(candidate.procurementQuotes, "procurementQuotes", ProductProcurementQuoteSchema, context);
  const materialStructures = parseStructuredArray(candidate.materialStructures, "materialStructures", ProductMaterialStructureSchema, context);
  const machinery = normalizeStringArray(candidate.machinery, "machinery", context);
  const qualityControls = normalizeStringArray(candidate.qualityControls, "qualityControls", context);
  const industryClusters = normalizeStringArray(candidate.industryClusters, "industryClusters", context);
  const technologyOutlook = normalizeTechnologyOutlook(candidate.technologyOutlook, context);
  const costItems = parseStructuredArray(candidate.costItems, "costItems", ProductCostItemSchema, context);
  const hardCost = calculateHardCost(costItems);
  preserveUnverifiedHardCost(candidate, context);
  const rawDocument = normalizeRawDocument(candidate.rawDocument, context);
  const manufacturing = normalizeManufacturing(candidate.manufacturing, context);
  const risks = normalizeRisks(candidate.risks, context);
  const decision = normalizeDecision(candidate.decision, judgement, context);
  const specifications = [
    ...parseStructuredArray(candidate.specifications, "specifications", ProductSpecificationSchema, context),
    ...legacySpecification("旧版关键参数", keyParameters),
    ...legacySpecification("旧版原材料", materials)
  ];
  const optimizationOptions = [
    ...parseStructuredArray(candidate.optimizationOptions, "optimizationOptions", ProductOptimizationOptionSchema, context),
    ...(alternatives ? [{ name: "旧版替代方案", description: alternatives, status: "candidate" as const }] : [])
  ];
  const existingImportIssues = parseStructuredArray(candidate.importIssues, "importIssues", ProductImportIssueSchema, context);
  captureUnknownFields(candidate, context);
  const legacyNotes = mergeLegacyNotes(
    optionalString(candidate, "legacyNotes", context),
    costStructure,
    context.issues.some((issue) => issue.field !== "originalRecord")
      ? "部分字段未能规范化，原始内容已保留在 rawDocument.rawData。"
      : undefined
  );
  const normalizedRawDocument = withCapturedRawData(rawDocument, context.rawData);
  const importIssues = dedupeImportIssues([...existingImportIssues, ...context.issues]);

  const researchDepth = normalizeOptionalEnum(candidate.researchDepth, ["product", "category"] as const, context);
  const lifecycleStage = normalizeOptionalEnum(candidate.lifecycleStage, PRODUCT_LIFECYCLE_STAGES, context);
  const signalStatus = normalizeOptionalEnum(candidate.signalStatus, SIGNAL_STATUSES, context);
  const dormantReason = normalizeOptionalEnum(candidate.dormantReason, DORMANT_REASONS, context);
  const activationTrigger = parseStructuredObject(
    candidate.activationTrigger, "activationTrigger", ProductSignalActivationTriggerSchema, context
  );
  const lastActivationCheckAt = optionalString(candidate, "lastActivationCheckAt", context);

  const product: ProductKnowledgeV2 = {
    schemaVersion: 2,
    id,
    pinned,
    name,
    category,
    coreUse,
    targetUsers,
    useScenarios,
    defaultUnit,
    specifications,
    procurementQuotes,
    materialStructures,
    machinery,
    qualityControls,
    industryClusters,
    technologyOutlook,
    costItems,
    ...(hardCost.total === undefined ? {} : { hardCostTotal: hardCost.total }),
    hardCostStatus: hardCost.status,
    manufacturing: {
      ...manufacturing,
      processes: mergeStrings(manufacturing.processes, process ? [process] : [])
    },
    optimizationOptions,
    risks: {
      ...risks,
      quality: mergeStrings(risks.quality, stringArray(qualityRisks)),
      other: mergeStrings(risks.other, stringArray(commonPitfalls))
    },
    opportunities,
    decision,
    rawDocument: normalizedRawDocument,
    importIssues,
    legacyNotes,
    createdAt,
    updatedAt,
    supplierId,
    supplierName,
    communicationId,
    materials,
    process,
    costStructure,
    keyParameters,
    qualityRisks,
    commonPitfalls,
    alternatives,
    judgement,
    // 流水线/信号池
    lifecycleStage,
    signalStatus,
    dormantReason,
    activationTrigger,
    lastActivationCheckAt,
    // 品类调研扩展
    researchDepth,
    marketOverview: parseStructuredObject(candidate.marketOverview, "marketOverview", MarketOverviewSchema, context),
    competitiveLandscape: parseStructuredObject(candidate.competitiveLandscape, "competitiveLandscape", CompetitiveLandscapeSchema, context),
    productBenchmark: parseStructuredObject(candidate.productBenchmark, "productBenchmark", ProductBenchmarkSchema, context),
    userInsights: parseStructuredObject(candidate.userInsights, "userInsights", UserInsightsSchema, context),
    supplyChainFindings: parseStructuredObject(candidate.supplyChainFindings, "supplyChainFindings", SupplyChainFindingsSchema, context),
    // 闭环关联
    relatedSupplierIds: normalizeStringArray(candidate.relatedSupplierIds, "relatedSupplierIds", context),
    relatedOfferIds: normalizeStringArray(candidate.relatedOfferIds, "relatedOfferIds", context)
  };

  // 信号池默认值：未设 stage 的非品类调研报告 → 自动视为信号池活跃机会
  if (!lifecycleStage && researchDepth !== "category") {
    product.lifecycleStage = "signal";
    if (!product.signalStatus) product.signalStatus = "active";
  }

  return product;
}

function normalizeOptionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  context: NormalizationContext
): T | undefined {
  if (typeof value !== "string") return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  addImportIssue(context, "", `枚举值不合法：${value}`, value);
  return undefined;
}

function parseStructuredObject<T>(
  value: unknown,
  fieldName: string,
  schema: z.ZodType<T>,
  context: NormalizationContext
): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    addImportIssue(context, fieldName, `${fieldName} 结构不合法`, value);
    return undefined;
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    addImportIssue(context, fieldName, `${fieldName} 解析失败`, value);
    return undefined;
  }
  return parsed.data;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export type ProductImportIssueCompatibility = {
  value: Record<string, unknown>;
  unknownIssues: unknown[];
};

export function normalizeProductImportIssueCompatibility(value: unknown): ProductImportIssueCompatibility {
  const candidate = asRecord(value);
  if (!Array.isArray(candidate.importIssues)) return { value: candidate, unknownIssues: [] };

  const unknownIssues: unknown[] = [];
  const importIssues = candidate.importIssues.map((rawIssue) => {
    const issue = asRecord(rawIssue);
    if (issue.severity === "error") return { ...issue, severity: "blocking" };
    if (issue.severity === "blocking" || issue.severity === "warning" || issue.severity === "conflict") {
      return rawIssue;
    }
    if (typeof issue.field === "string" && typeof issue.message === "string") {
      unknownIssues.push(rawIssue);
      return { ...issue, severity: "warning" };
    }
    return rawIssue;
  });

  const compatibleValue = { ...candidate, importIssues };
  if (unknownIssues.length === 0) {
    return { value: compatibleValue, unknownIssues };
  }

  const rawDocument = candidate.rawDocument;
  const rawDocumentWithEvidence = rawDocument && typeof rawDocument === "object" && !Array.isArray(rawDocument)
    ? withCapturedRawData(rawDocument as ProductResearchDocument, { importIssues: unknownIssues })
    : { rawData: { ...(rawDocument === undefined ? {} : { documentRawData: rawDocument }), importIssues: unknownIssues } };

  return {
    value: { ...compatibleValue, rawDocument: rawDocumentWithEvidence },
    unknownIssues
  };
}

type NormalizationContext = {
  issues: ProductImportIssue[];
  rawData: Record<string, unknown>;
};

function preserveUnknownImportIssueEvidence(context: NormalizationContext, unknownIssues: unknown[]) {
  if (unknownIssues.length === 0) return;
  addImportIssue(context, "importIssues", "导入问题严重级别未知，已按 warning 处理，原始内容已保留。", unknownIssues);
}

function createNormalizationContext(value: unknown): NormalizationContext {
  const context: NormalizationContext = { issues: [], rawData: {} };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addImportIssue(context, "record", "产品记录不是对象，原始内容已保留。", value);
  }
  return context;
}

function addImportIssue(context: NormalizationContext, field: string, message: string, rawValue?: unknown) {
  context.issues.push({ field, message, severity: "warning" });
  if (rawValue !== undefined) context.rawData[field] = rawValue;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function optionalBoolean(candidate: Record<string, unknown>, field: string, context: NormalizationContext): boolean | undefined {
  const value = candidate[field];
  if (value === undefined) return undefined;
  const normalized = booleanValue(value);
  if (normalized !== undefined) return normalized;
  addImportIssue(context, field, "字段不是布尔值，原始内容已保留。", value);
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function normalizeStringArray(value: unknown, field: string, context: NormalizationContext): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    addImportIssue(context, field, "字段不是字符串数组，原始内容已保留。", value);
    return [];
  }

  const normalized: string[] = [];
  const rejected: unknown[] = [];
  value.forEach((item, index) => {
    if (typeof item === "string" && item.trim()) {
      normalized.push(item);
    } else {
      rejected.push(item);
      context.issues.push({ field: `${field}[${index}]`, message: "条目不是有效文本，原始内容已保留。", severity: "warning" });
    }
  });
  if (rejected.length > 0) context.rawData[field] = rejected;
  return normalized;
}

function requiredString(
  candidate: Record<string, unknown>,
  field: string,
  fallback: string,
  context: NormalizationContext,
  message: string
): string {
  const value = stringValue(candidate[field]);
  if (value) return value;
  addImportIssue(context, field, message, candidate[field]);
  return fallback;
}

function optionalString(candidate: Record<string, unknown>, field: string, context: NormalizationContext): string | undefined {
  const value = candidate[field];
  if (value === undefined) return undefined;
  const normalized = stringValue(value);
  if (normalized) return normalized;
  addImportIssue(context, field, "字段不是有效文本，原始内容已保留。", value);
  return undefined;
}

function parseStructuredArray<T>(value: unknown, field: string, schema: z.ZodType<T>, context: NormalizationContext): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    addImportIssue(context, field, "字段不是数组，原始内容已保留。", value);
    return [];
  }

  const normalized: T[] = [];
  const rejected: unknown[] = [];
  value.forEach((item, index) => {
    const parsed = schema.safeParse(item);
    if (parsed.success) {
      normalized.push(parsed.data);
    } else {
      rejected.push(item);
      context.issues.push({ field: `${field}[${index}]`, message: "条目无法规范化，原始内容已保留。", severity: "warning" });
    }
  });
  if (rejected.length > 0) context.rawData[field] = rejected;
  return normalized;
}

function normalizeManufacturing(value: unknown, context: NormalizationContext): ProductManufacturing {
  if (value === undefined) return { processes: [] };
  const parsed = ProductManufacturingSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const candidate = asRecord(value);
  addImportIssue(context, "manufacturing", "制造信息无法完整规范化，原始内容已保留。", value);
  return {
    processes: stringArray(candidate.processes),
    leadTime: stringValue(candidate.leadTime),
    minimumOrderQuantity: stringValue(candidate.minimumOrderQuantity),
    notes: stringValue(candidate.notes)
  };
}

function normalizeRisks(value: unknown, context: NormalizationContext): ProductRiskSet {
  if (value === undefined) return emptyRisks();
  const parsed = ProductRiskSetSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const candidate = asRecord(value);
  addImportIssue(context, "risks", "风险信息无法完整规范化，原始内容已保留。", value);
  return {
    quality: stringArray(candidate.quality),
    supply: stringArray(candidate.supply),
    compliance: stringArray(candidate.compliance),
    other: stringArray(candidate.other)
  };
}

function normalizeDecision(value: unknown, judgement: string | undefined, context: NormalizationContext): ProductDecisionSummary {
  if (value === undefined) return judgement ? { summary: judgement, status: "undecided" } : { status: "undecided" };
  const parsed = ProductDecisionSummarySchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const candidate = asRecord(value);
  addImportIssue(context, "decision", "决策信息无法完整规范化，原始内容已保留。", value);
  return {
    summary: stringValue(candidate.summary) ?? judgement,
    recommendation: stringValue(candidate.recommendation),
    rationale: stringValue(candidate.rationale),
    status: "undecided"
  };
}

function normalizeRawDocument(value: unknown, context: NormalizationContext): ProductResearchDocument | undefined {
  if (value === undefined) return undefined;
  const parsed = ProductResearchDocumentSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  addImportIssue(context, "rawDocument", "原始研究文档无法规范化，原始内容已保留。", value);
  return undefined;
}

function normalizeTechnologyOutlook(value: unknown, context: NormalizationContext): ProductTechnologyOutlook | undefined {
  if (value === undefined) return undefined;
  const parsed = ProductTechnologyOutlookSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  addImportIssue(context, "technologyOutlook", "技术趋势信息无法完整规范化，原始内容已保留。", value);
  return undefined;
}

function preserveUnverifiedHardCost(candidate: Record<string, unknown>, context: NormalizationContext) {
  if (candidate.hardCostTotal !== undefined) {
    addImportIssue(context, "hardCostTotal", "硬成本总额已重新计算，原始值已保留。", candidate.hardCostTotal);
  }
  if (candidate.hardCostStatus !== undefined) {
    addImportIssue(context, "hardCostStatus", "硬成本状态已重新计算，原始值已保留。", candidate.hardCostStatus);
  }
}

function preserveInvalidSchemaVersion(candidate: Record<string, unknown>, context: NormalizationContext) {
  if (candidate.schemaVersion !== undefined && candidate.schemaVersion !== 2) {
    addImportIssue(context, "schemaVersion", "不支持的 schemaVersion 已迁移为 V2，原始值已保留。", candidate.schemaVersion);
  }
}

const knownProductFields = new Set([
  "schemaVersion", "id", "pinned", "name", "category", "coreUse", "targetUsers", "useScenarios", "defaultUnit",
  "specifications", "procurementQuotes", "materialStructures", "machinery", "qualityControls", "industryClusters",
  "technologyOutlook", "costItems", "hardCostTotal", "hardCostStatus", "manufacturing", "optimizationOptions", "risks",
  "opportunities", "decision", "rawDocument", "importIssues", "legacyNotes", "createdAt", "updatedAt", "supplierId",
  "supplierName", "communicationId", "materials", "process", "costStructure", "keyParameters", "qualityRisks",
  "commonPitfalls", "alternatives", "judgement",
  // 品类调研扩展字段
  "researchDepth", "marketOverview", "competitiveLandscape", "productBenchmark", "userInsights", "supplyChainFindings",
  // 闭环关联字段
  "relatedSupplierIds", "relatedOfferIds"
]);

function captureUnknownFields(candidate: Record<string, unknown>, context: NormalizationContext) {
  Object.entries(candidate).forEach(([field, value]) => {
    if (!knownProductFields.has(field)) {
      addImportIssue(context, field, "未识别的旧字段已保留。", value);
    }
  });
}

function hasStrippedFields(original: unknown, normalized: unknown): boolean {
  if (Array.isArray(original)) {
    return !Array.isArray(normalized) || original.some((value, index) => hasStrippedFields(value, normalized[index]));
  }
  if (!original || typeof original !== "object") return false;

  const originalRecord = asRecord(original);
  const normalizedRecord = asRecord(normalized);
  return Object.entries(originalRecord).some(([field, value]) => {
    if (field === "rawData") return false;
    return !(field in normalizedRecord) || hasStrippedFields(value, normalizedRecord[field]);
  });
}

function snapshotWithoutRawData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(snapshotWithoutRawData);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(asRecord(value))
      .filter(([field]) => field !== "rawData")
      .map(([field, child]) => [field, snapshotWithoutRawData(child)])
  );
}

function withCapturedRawData(document: ProductResearchDocument | undefined, rawData: Record<string, unknown>): ProductResearchDocument | undefined {
  if (Object.keys(rawData).length === 0) return document;
  const mergedRawData = mergeCapturedRawData(document?.rawData, rawData);
  return document ? { ...document, rawData: mergedRawData } : { rawData: mergedRawData };
}

function mergeCapturedRawData(existingRawData: unknown, capturedRawData: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = existingRawData && typeof existingRawData === "object" && !Array.isArray(existingRawData)
    ? { ...existingRawData as Record<string, unknown> }
    : existingRawData === undefined
      ? {}
      : { documentRawData: existingRawData };
  const { originalRecord, conflicts: _capturedConflicts, ...remainingRawData } = capturedRawData;

  Object.entries(remainingRawData).forEach(([field, value]) => {
    if (!(field in merged)) {
      merged[field] = value;
      return;
    }
    if (!deepEqual(merged[field], value)) appendRawDataConflict(merged, field, value);
  });

  if (originalRecord === undefined) return merged;
  if (merged.originalRecord === undefined) {
    merged.originalRecord = originalRecord;
    return merged;
  }
  if (deepEqual(merged.originalRecord, originalRecord)) return merged;

  const migrationRecords = merged.migrationRecords === undefined
    ? []
    : Array.isArray(merged.migrationRecords)
      ? [...merged.migrationRecords]
      : [merged.migrationRecords];
  if (!migrationRecords.some((record) => deepEqual(record, originalRecord))) migrationRecords.push(originalRecord);
  merged.migrationRecords = migrationRecords;
  return merged;
}

function appendRawDataConflict(rawData: Record<string, unknown>, field: string, incomingValue: unknown) {
  const existingConflicts = rawData.conflicts;
  const conflicts: Record<string, unknown> = existingConflicts && typeof existingConflicts === "object" && !Array.isArray(existingConflicts)
    ? { ...existingConflicts as Record<string, unknown> }
    : existingConflicts === undefined
      ? {}
      : { documentConflicts: [existingConflicts] };
  const values = conflicts[field] === undefined
    ? []
    : Array.isArray(conflicts[field])
      ? [...conflicts[field] as unknown[]]
      : [conflicts[field]];

  [rawData[field], incomingValue].forEach((value) => {
    if (!values.some((existingValue) => deepEqual(existingValue, value))) values.push(value);
  });
  conflicts[field] = values;
  rawData.conflicts = conflicts;
}

function dedupeImportIssues(issues: ProductImportIssue[]): ProductImportIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.severity}\u0000${issue.field}\u0000${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deepEqual(left: unknown, right: unknown): boolean {
  return stableSerialize(left) === stableSerialize(right);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(asRecord(value))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`)
      .join(",")}}`;
  }
  return `${typeof value}:${JSON.stringify(value)}`;
}

function stableFingerprint(value: unknown): string {
  const source = JSON.stringify(value) ?? String(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function emptyRisks(): ProductRiskSet {
  return { quality: [], supply: [], compliance: [], other: [] };
}

function legacySpecification(name: string, value: string | undefined): ProductSpecification[] {
  return value ? [{ name, value, source: "legacy" }] : [];
}

function mergeStrings(current: string[], incoming: string[]): string[] {
  return [...new Set([...current, ...incoming])];
}

function mergeLegacyNotes(...notes: Array<string | undefined>): string | undefined {
  return notes.filter((note): note is string => Boolean(note)).join("\n") || undefined;
}

// ========== 休眠信号智能唤醒匹配 ==========

export type ActivationMatch = {
  productId: string;
  productName: string;
  matchedRules: string[];      // 人类可读的命中原因（列表）
  confidence: "weak" | "strong"; // 弱=仅建议 / 强=满足全部规则
};

export type SignalScanContext = {
  suppliers: Array<{
    id: string;
    name?: string;
    categories: string[];
    cooperationLevel?: string;  // 例如："A" "B" "C" "战略" "深度"
  }>;
  now?: Date;
};

/**
 * 扫描休眠信号，根据 activationTrigger + 当前供应商/月份/报价匹配可激活机会。
 * 返回按置信度降序排列的列表。
 */
export function scanDormantSignals(
  products: ProductKnowledgeV2[],
  ctx: SignalScanContext
): ActivationMatch[] {
  const now = ctx.now ?? new Date();
  const currentMonth = now.getMonth() + 1; // 1-12

  const matched: ActivationMatch[] = [];

  for (const product of products) {
    // 只扫描休眠信号
    if (product.signalStatus !== "dormant") continue;
    if (product.lifecycleStage !== undefined && product.lifecycleStage !== "signal") continue;

    const trigger = product.activationTrigger;
    if (!trigger) {
      // 没设激活规则：默认匹配"供应商类别命中产品品类"的弱建议
      const hitSuppliers = product.category
        ? ctx.suppliers.filter((s) => s.categories.includes(product.category!))
        : [];
      if (hitSuppliers.length > 0) {
        matched.push({
          productId: product.id,
          productName: product.name,
          matchedRules: [`品类已有 ${hitSuppliers.length} 家供应商：${hitSuppliers.slice(0, 2).map((s) => s.name || s.id).join("、")}`],
          confidence: "weak"
        });
      }
      continue;
    }

    const rules: string[] = [];
    let strongCount = 0;
    let ruleCount = 0;

    // 1. 供应商类别匹配
    if (trigger.requiredSupplierCategories && trigger.requiredSupplierCategories.length > 0) {
      ruleCount += trigger.requiredSupplierCategories.length;
      for (const category of trigger.requiredSupplierCategories) {
        const hitSuppliers = ctx.suppliers.filter((s) => s.categories.includes(category));
        if (hitSuppliers.length > 0) {
          rules.push(
            trigger.requiredSupplierCategories.length === 1
              ? `「${category}」品类已积累 ${hitSuppliers.length} 家供应商`
              : `「${category}」供应商就位（${hitSuppliers.length} 家）`
          );
          strongCount += 1;
        }
      }
    }

    // 2. 产品硬成本 ≤ maxUnitCost（如果有阈值和报价）
    if (trigger.maxUnitCost !== undefined && product.hardCostTotal !== undefined) {
      ruleCount += 1;
      if (product.hardCostTotal <= trigger.maxUnitCost) {
        rules.push(`硬成本 ${product.hardCostTotal.toFixed(2)} 已降到阈值 ${trigger.maxUnitCost} 以内`);
        strongCount += 1;
      }
    }

    // 3. 季节/月份
    if (trigger.applicableMonths && trigger.applicableMonths.length > 0) {
      ruleCount += 1;
      if (trigger.applicableMonths.includes(currentMonth)) {
        rules.push(`当前月份（${currentMonth}月）已进入适用季节`);
        strongCount += 1;
      }
    }

    // 4. 供应商合作等级
    if (trigger.minSupplierCooperationLevel) {
      const productRelatedSuppliers = product.relatedSupplierIds ?? [];
      const candidates = ctx.suppliers.filter((s) => productRelatedSuppliers.includes(s.id) ||
        (product.category ? s.categories.includes(product.category) : false));
      ruleCount += 1;
      const hit = candidates.find((s) => s.cooperationLevel === trigger.minSupplierCooperationLevel) ||
        candidates.find((s) => s.cooperationLevel);
      if (hit) {
        rules.push(`已有合作等级 ≥ ${trigger.minSupplierCooperationLevel} 的供应商（${hit.name || hit.id}）`);
        strongCount += 1;
      }
    }

    if (rules.length === 0) continue;

    const confidence: ActivationMatch["confidence"] =
      ruleCount > 0 && strongCount >= Math.max(1, Math.ceil(ruleCount * 0.8)) ? "strong" : "weak";

    matched.push({
      productId: product.id,
      productName: product.name,
      matchedRules: rules,
      confidence
    });
  }

  // 先强后弱排序
  matched.sort((a, b) => {
    const score = (x: ActivationMatch) =>
      (x.confidence === "strong" ? 1000 : 0) + x.matchedRules.length;
    return score(b) - score(a);
  });

  return matched;
}

/** 返回修改后的新对象（不直接 mutate） */
export function activateSignal(product: ProductKnowledgeV2, at?: Date): ProductKnowledgeV2 {
  const now = (at ?? new Date()).toISOString();
  return {
    ...product,
    signalStatus: "active",
    dormantReason: undefined,
    lastActivationCheckAt: now,
    updatedAt: product.updatedAt ? (now > product.updatedAt ? now : product.updatedAt) : now
  };
}

export function dormanizeSignal(
  product: ProductKnowledgeV2,
  reason: ProductDormantReason,
  trigger?: ProductSignalActivationTrigger,
  at?: Date
): ProductKnowledgeV2 {
  const now = (at ?? new Date()).toISOString();
  return {
    ...product,
    lifecycleStage: product.lifecycleStage ?? "signal",
    signalStatus: "dormant",
    dormantReason: reason,
    activationTrigger: trigger ?? product.activationTrigger,
    lastActivationCheckAt: undefined,
    updatedAt: product.updatedAt ? (now > product.updatedAt ? now : product.updatedAt) : now
  };
}
