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
  cooperationLevel: z.string().optional(),
  priceLevel: z.string().optional(),
  qualityJudgement: z.string().optional(),
  riskTags: z.array(z.string()).default([]),
  notes: z.string().optional()
});

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
  uncertaintyNotes: z.array(z.string()).default([])
});

export type DraftExtraction = z.infer<typeof DraftExtractionSchema>;
