import { z } from "zod";

export const PrioritySchema = z.enum(["low", "medium", "high"]);

export const SupplierDraftSchema = z.object({
  name: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  categories: z.array(z.string()).default([]),
  location: z.string().optional(),
  contactName: z.string().optional(),
  contactMethod: z.string().optional(),
  storeUrl: z.string().optional(),
  sourcePlatform: z.string().optional(),
  supplierType: z.enum(["factory", "trader", "unknown"]).default("unknown"),
  // 合作模式：入仓型(我方仓)/代发型(供应商直发)/混合
  businessModel: z.enum(["inbound", "dropship", "hybrid"]).default("inbound"),
  cooperationLevel: z.string().optional(),
  priceLevel: z.string().optional(),
  qualityJudgement: z.string().optional(),
  riskTags: z.array(z.string()).default([]),
  notes: z.string().optional()
});

export const SupplierCapabilitySchema = z.object({
  id: z.string().min(1),
  supplierId: z.string().min(1),
  productFamilyKey: z.string().min(1).optional(),
  processNames: z.array(z.string()).default([]),
  materialNames: z.array(z.string()).default([]),
  equipmentNames: z.array(z.string()).default([]),
  supportsSampling: z.boolean().optional(),
  supportsCustomization: z.boolean().optional(),
  moq: z.string().optional(),
  leadTime: z.string().optional(),
  sourceRecordIds: z.array(z.string()).default([]),
  sourceType: z.enum(["offer", "communication", "inbound", "manual"]).default("manual"),
  status: z.enum(["candidate", "verified", "expired"]).default("candidate"),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type SupplierCapability = z.infer<typeof SupplierCapabilitySchema>;

export const CommunicationDraftSchema = z.object({
  summary: z.string().min(1),
  promises: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([])
});

export const OfferSkuDraftSchema = z.object({
  specName: z.string().min(1),
  specCode: z.string().optional(),
  width: z.string().optional(),
  length: z.string().optional(),
  thickness: z.string().optional(),
  unitPrice: z.number().optional(),
  unitPriceStr: z.string().optional(),
  pricingUnit: z.string().optional(),
  moq: z.string().optional(),
  notes: z.string().optional()
});

export const OfferDraftSchema = z.object({
  name: z.string().min(1),
  supplierName: z.string().optional(),
  category: z.string().optional(),
  productUrl: z.string().optional(),
  resourceUrl: z.string().optional(),
  quotedPrice: z.string().optional(),
  priceDetails: z.string().optional(),
  skus: z.array(OfferSkuDraftSchema).default([]),
  skuCount: z.number().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  untaxedUnitPrice: z.string().optional(),
  untaxedPlateFee: z.string().optional(),
  taxedUnitPrice: z.string().optional(),
  taxedPlateFee: z.string().optional(),
  taxFreightTerms: z.string().optional(),
  comparisonBasis: z.string().optional(),
  normalizedPriceDetails: z.string().optional(),
  dimensions: z.string().optional(),
  pricingUnit: z.string().optional(),
  packageUnit: z.string().optional(),
  keySpecs: z.string().optional(),
  materialGrade: z.string().optional(),
  width: z.string().optional(),
  rollLength: z.string().optional(),
  gramWeightOptions: z.string().optional(),
  rollWeight: z.string().optional(),
  freightIncluded: z.string().optional(),
  priceAdjustmentRule: z.string().optional(),
  moq: z.string().optional(),
  leadTime: z.string().optional(),
  specs: z.string().optional(),
  packaging: z.string().optional(),
  sampleStatus: z.string().optional(),
  channelFit: z.string().optional(),
  advantages: z.string().optional(),
  risks: z.string().optional(),
  notes: z.string().optional()
});

export const ProductKnowledgeDraftSchema = z.object({
  name: z.string().min(1),
  materials: z.string().optional(),
  process: z.string().optional(),
  costStructure: z.string().optional(),
  keyParameters: z.string().optional(),
  qualityRisks: z.string().optional(),
  commonPitfalls: z.string().optional(),
  alternatives: z.string().optional(),
  judgement: z.string().optional()
});

export const TaskDraftSchema = z.object({
  title: z.string().min(1),
  dueText: z.string().optional(),
  priority: PrioritySchema.default("medium"),
  type: z.enum([
    "confirm_quote",
    "follow_sample",
    "confirm_moq",
    "confirm_lead_time",
    "supplement_product_knowledge",
    "review_supplier",
    "follow_up"
  ])
});

// ============== 供应商聊天/评估相关 Draft ==============
export const SupplierOrderRecordDraftSchema = z.object({
  supplierNameGuess: z.string().optional(),
  productName: z.string().optional(),
  skuSpec: z.string().optional(),
  orderedAt: z.string().optional(),
  promisedDeliveryAt: z.string().optional(),
  actualDeliveryAt: z.string().optional(),
  orderQuantity: z.number().optional(),
  deliveredQuantity: z.number().optional(),
  isPeak: z.boolean().default(false),
  unitPrice: z.number().optional(),
  status: z.enum(["pending", "partial", "fulfilled", "overdue", "cancelled"]).optional(),
  note: z.string().optional(),
  sourceLineText: z.string().optional()
});
export type SupplierOrderRecordDraft = z.infer<typeof SupplierOrderRecordDraftSchema>;

export const SupplierQualityIssueDraftSchema = z.object({
  supplierNameGuess: z.string().optional(),
  productName: z.string().optional(),
  issueCount: z.number().default(1),
  totalBatchSize: z.number().optional(),
  issueDescription: z.string().optional(),
  isCustomerReturn: z.boolean().optional(),
  wrongShipIssue: z.boolean().optional(),
  isClosed: z.boolean().default(false),
  repeated: z.boolean().default(false),
  sourceLineText: z.string().optional()
});
export type SupplierQualityIssueDraft = z.infer<typeof SupplierQualityIssueDraftSchema>;

export const SupplierServiceEventDraftSchema = z.object({
  supplierNameGuess: z.string().optional(),
  type: z.enum([
    "promise", "price_change", "response", "cooperation_rating",
    "attitude", "solution_proposal", "solution_fulfilled", "evasion"
  ]),
  content: z.string(),
  promisedAt: z.string().optional(),
  expectedAt: z.string().optional(),
  actualAt: z.string().optional(),
  fulfilled: z.boolean().optional(),
  priceBefore: z.number().optional(),
  priceAfter: z.number().optional(),
  marketPriceChangedAt: z.string().optional(),
  responseHours: z.number().optional(),
  cooperationScore: z.number().optional(),
  // ——— 综合分析扩展字段（attitude / solution_* / evasion）———
  attitudeScore: z.number().optional(), // 1=极差 5=极好
  solutionRequested: z.boolean().optional(), // 我方是否提了问题/请求
  solutionProvided: z.boolean().optional(), // 对方是否给了方案
  solutionDelivered: z.boolean().optional(), // 方案后续是否落地
  evasionSeverity: z.number().optional(), // 推诿严重度 0-2（0=无 1=轻微 2=严重）
  sourceLineText: z.string().optional()
});
export type SupplierServiceEventDraft = z.infer<typeof SupplierServiceEventDraftSchema>;

export const SupplierCostReductionDraftSchema = z.object({
  supplierNameGuess: z.string().optional(),
  productName: z.string().optional(),
  priceBefore: z.number(),
  priceAfter: z.number(),
  method: z.string().optional(),
  note: z.string().optional()
});
export type SupplierCostReductionDraft = z.infer<typeof SupplierCostReductionDraftSchema>;

export const SupplierChatExtractionDraftSchema = z.object({
  period: z.string().optional(),
  orders: z.array(SupplierOrderRecordDraftSchema).default([]),
  qualityIssues: z.array(SupplierQualityIssueDraftSchema).default([]),
  serviceEvents: z.array(SupplierServiceEventDraftSchema).default([]),
  costReductions: z.array(SupplierCostReductionDraftSchema).default([]),
  suppliersMentioned: z.array(z.string()).default([]),
  uncertaintyNotes: z.array(z.string()).default([])
});
export type SupplierChatExtractionDraft = z.infer<typeof SupplierChatExtractionDraftSchema>;

export const DraftExtractionSchema = z.object({
  supplier: SupplierDraftSchema.optional(),
  communication: CommunicationDraftSchema,
  offers: z.array(OfferDraftSchema).default([]),
  productKnowledge: z.array(ProductKnowledgeDraftSchema).default([]),
  tasks: z.array(TaskDraftSchema).default([]),
  knowledgeCards: z
    .array(
      z.object({
        title: z.string().min(1),
        source: z.string().optional(),
        summary: z.string().optional(),
        applicableScenarios: z.array(z.string()).default([]),
        steps: z.array(z.string()).default([]),
        scripts: z.array(z.string()).default([]),
        risks: z.array(z.string()).default([]),
        tags: z.array(z.string()).default([])
      })
    )
    .default([]),
  uncertaintyNotes: z.array(z.string()).default([]),
  supplierChat: SupplierChatExtractionDraftSchema.optional()
});

export type DraftExtraction = z.infer<typeof DraftExtractionSchema>;
