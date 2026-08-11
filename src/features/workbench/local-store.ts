import defaultData from "@/data/workbench-data.json";
import { supabase } from "@/lib/supabase";
import { setWorkbenchSnapshot } from "./workbench-store";
import type { DraftExtraction } from "./schemas";
import type { DecisionAnalysis, DecisionModelSection } from "./decision-analysis";
import {
  DecisionCaseSchema,
  DecisionCycleSchema,
  mergeActionSources,
  normalizeProblemKey,
  type DecisionCase,
  type DecisionCycle,
  type ToolContribution
} from "./decision-cases";
import {
  normalizeProductImportIssueCompatibility,
  normalizeProductKnowledge,
  ProductKnowledgeV2Schema,
  type ProductKnowledgeV2
} from "./product-knowledge";
import { randomId } from "@/lib/random-id";
import {
  canonicalizeKnowledgeListItem,
  normalizeKnowledgeListItem,
  parseBookPackage,
  type ParsedBookPackage
} from "./knowledge-library";

export type LocalSupplier = {
  id: string;
  pinned?: boolean;
  name: string;
  categories: string[];
  location?: string;
  supplierType?: string;
  contactName?: string;
  contactMethod?: string;
  storeUrl?: string;
  sourcePlatform?: string;
  cooperationLevel?: string;
  riskTags: string[];
  notes?: string;
  createdAt: string;
};

export type OfferSku = {
  id: string;
  specName: string;
  specCode?: string;
  width?: string;
  length?: string;
  thickness?: string;
  unitPrice?: number;
  unitPriceStr?: string;
  pricingUnit?: string;
  moq?: string;
  notes?: string;
  priceHistory?: {
    date: string;
    price: number;
    source?: string;
  }[];
};

export type LocalOffer = {
  id: string;
  pinned?: boolean;
  supplierId?: string;
  communicationId?: string;
  supplierName?: string;
  productId?: string;
  productName?: string;
  name: string;
  category?: string;
  productUrl?: string;
  resourceUrl?: string;
  quotedPrice?: string;
  priceDetails?: string;
  skus?: OfferSku[];
  skuCount?: number;
  minPrice?: number;
  maxPrice?: number;
  untaxedUnitPrice?: string;
  untaxedPlateFee?: string;
  taxedUnitPrice?: string;
  taxedPlateFee?: string;
  taxFreightTerms?: string;
  comparisonBasis?: string;
  normalizedPriceDetails?: string;
  dimensions?: string;
  pricingUnit?: string;
  packageUnit?: string;
  keySpecs?: string;
  materialGrade?: string;
  width?: string;
  rollLength?: string;
  gramWeightOptions?: string;
  rollWeight?: string;
  freightIncluded?: string;
  priceAdjustmentRule?: string;
  moq?: string;
  leadTime?: string;
  specs?: string;
  packaging?: string;
  sampleStatus?: string;
  channelFit?: string;
  advantages?: string;
  risks?: string;
  notes?: string;
  createdAt: string;
  // 数值字段（从原始 string 解析，用于排序/筛选/趋势分析）
  quotedPriceNum?: number | null;
  moqNum?: number | null;
  leadTimeDays?: number | null;
  untaxedUnitPriceNum?: number | null;
  taxedUnitPriceNum?: number | null;
};

export type LocalProductKnowledge = ProductKnowledgeV2;

export type LocalTask = {
  id: string;
  pinned?: boolean;
  supplierId?: string;
  supplierName?: string;
  communicationId?: string;
  offerId?: string;
  offerName?: string;
  title: string;
  dueText?: string;
  priority: string;
  type?: string;
  status: "open" | "done";
  createdAt: string;
  reviewNote?: string;        // 复盘备注
  reviewOutcome?: string;     // 实际结果（如"成功""失败""部分达成"）
  reviewedAt?: string;        // 复盘时间
};

export type LocalCommunication = {
  id: string;
  supplierId?: string;
  supplierName?: string;
  offerId?: string;
  offerName?: string;
  summary: string;
  promises: string[];
  questions: string[];
  risks: string[];
  nextActions: string[];
  createdAt: string;
};

export type LocalKnowledgeCard = {
  id: string;
  pinned?: boolean;
  title: string;
  source?: string;
  summary?: string;
  applicableScenarios: string[];
  steps: string[];
  scripts: string[];
  risks: string[];
  tags: string[];
  createdAt: string;
};

export type LocalKnowledgeBook = {
  id: string;
  title: string;
  author?: string;
  coverImage?: string;
  theme?: string;
  purpose?: string;
  framework?: string;
  businessScenarios: string[];
  rawText?: string;
  createdAt: string;
};

export type LocalDecisionTool = {
  id: string;
  bookId?: string;
  name: string;
  problem?: string;
  triggers: string[];
  diagnosticQuestions: string[];
  actions: string[];
  limitations: string[];
  sourceChapter?: string;
  tags: string[];
  status: "ready" | "needs_review";
  legacyCardId?: string;
  createdAt: string;
};

export type LocalKnowledgeApplication = {
  id: string;
  problem: string;
  toolIds: string[];
  diagnosis?: string;
  selectedActions: string[];
  selectedActionSources?: LocalKnowledgeActionSource[];
  outcome?: string;
  status: "open" | "completed";
  createdAt: string;
  rawInput?: string;
  analysisStatus?: "not_requested" | "analyzed";
  modelId?: "business-model-canvas";
  modelSections?: DecisionModelSection[];
  openQuestions?: string[];
  version?: number;
  rootApplicationId?: string;
  updatedAt?: string;
};

export type LocalKnowledgeActionSource = {
  toolId: string;
  toolName: string;
  action: string;
};

// 深度调研报告：作为独立模块存储，保留原始 Markdown 全文，后期再关联产品
export type ResearchReport = {
  id: string;
  title: string;           // 报告标题（从H1提取或手动输入）
  category?: string;       // 品类名称
  content: string;         // 原始Markdown全文
  summary?: string;        // 一句话摘要
  source?: string;         // 来源（文件名等）
  importedAt: string;      // 导入时间
  updatedAt?: string;      // 更新时间
  status: "draft" | "active" | "archived";
  linkedProductIds?: string[];  // 关联的产品ID列表
  tags?: string[];         // 标签
};

export type LocalWorkbenchData = {
  suppliers: LocalSupplier[];
  communications: LocalCommunication[];
  offers: LocalOffer[];
  products: LocalProductKnowledge[];
  tasks: LocalTask[];
  knowledgeCards: LocalKnowledgeCard[];
  knowledgeBooks: LocalKnowledgeBook[];
  decisionTools: LocalDecisionTool[];
  knowledgeApplications: LocalKnowledgeApplication[];
  decisionCases: DecisionCase[];
  researchReports: ResearchReport[];
};

export type LocalCollectionName = keyof LocalWorkbenchData;
type LocalItem<C extends LocalCollectionName> = LocalWorkbenchData[C][number];

const storageKey = "personal-commercial-workbench";

export async function loadWorkbenchData(): Promise<LocalWorkbenchData> {
  // 1. 尝试从 Supabase 读取
  try {
    const { data, error } = await supabase
      .from("workbench_data")
      .select("data")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (!error && data?.data) {
      const parsed = normalizeWorkbenchData(data.data as Partial<LocalWorkbenchData>);
      // 同时缓存到 localStorage
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(parsed));
      }
      // 通知全局 store 更新（让所有页面看到最新云端数据）
      setWorkbenchSnapshot(parsed);
      return parsed;
    }
    if (error) {
      console.warn("[Sync] Supabase 读取失败:", error.message);
    }
  } catch (e) {
    console.warn("[Sync] Supabase 连接异常:", e);
  }

  // 2. 回退到 localStorage（但标记为"需要同步"，下次成功拉取后会覆盖）
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        const data = normalizeWorkbenchData(JSON.parse(stored) as Partial<LocalWorkbenchData>);
        // 重要：即使是本地数据也要更新全局 store，确保所有页面一致
        setWorkbenchSnapshot(data);
        return data;
      } catch {
        // 解析失败
      }
    }
  }

  // 3. 使用默认数据
  const defaults = normalizeWorkbenchData(defaultData as Partial<LocalWorkbenchData>);
  setWorkbenchSnapshot(defaults);
  return defaults;
}

// 保持同步版本用于兼容旧代码
export function loadLocalWorkbenchData(): LocalWorkbenchData {
  if (typeof window === "undefined") {
    return normalizeWorkbenchData(defaultData as Partial<LocalWorkbenchData>);
  }
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    return normalizeWorkbenchData(defaultData as Partial<LocalWorkbenchData>);
  }

  try {
    return normalizeWorkbenchData(JSON.parse(stored) as Partial<LocalWorkbenchData>);
  } catch {
    return normalizeWorkbenchData(defaultData as Partial<LocalWorkbenchData>);
  }
}

/** 从云端强制同步到本地（在页面关键入口调用以确保数据新鲜） */
export function syncFromCloud(): Promise<LocalWorkbenchData> {
  return loadWorkbenchData();
}

export function saveDraftToLocalWorkbench(extraction: DraftExtraction) {
  const current = loadLocalWorkbenchData();
  const now = new Date().toISOString();
  const communicationId = randomId();

  // ===== 多供应商收集与匹配 =====
  // 从 extraction.supplier 和 offers.supplierName 收集所有不同的供应商名
  const allSupplierNames = new Set<string>();
  if (extraction.supplier?.name) {
    allSupplierNames.add(extraction.supplier.name);
  }
  for (const offer of extraction.offers) {
    if (offer.supplierName) {
      allSupplierNames.add(offer.supplierName);
    }
  }

  // 为每个供应商名匹配/创建，处理同名别名合并
  const supplierByName = new Map<string, { id: string; supplier: LocalSupplier }>();
  const supplierById = new Map<string, LocalSupplier>();

  for (const name of allSupplierNames) {
    const existing = findMatchingSupplier(current.suppliers, name);
    const id = existing?.id ?? randomId();

    // 如果已通过其他名字匹配到同一个已有供应商，复用
    if (existing && supplierById.has(existing.id)) {
      supplierByName.set(name, { id: existing.id, supplier: supplierById.get(existing.id)! });
      continue;
    }

    // 主供应商用 extraction.supplier 的详细信息，非主供应商用最小信息
    const isPrimary = extraction.supplier && name === extraction.supplier.name;
    const draftSupplier = isPrimary && extraction.supplier
      ? extraction.supplier
      : { name, categories: [] as string[], supplierType: "unknown" as const, riskTags: [] as string[] };
    const supplier = mergeSupplier(existing, draftSupplier, id, now);
    supplierByName.set(name, { id, supplier });
    supplierById.set(id, supplier);
  }

  // 主供应商（用于 communication 和 tasks 关联）
  const primaryName = extraction.supplier?.name;
  const primaryEntry = primaryName ? supplierByName.get(primaryName) : undefined;
  const primarySupplierId = primaryEntry?.id;
  const primarySupplierName = primaryEntry?.supplier.name;

  // 合并所有供应商到 current.suppliers
  const allNewSuppliers = Array.from(supplierById.values());
  const newSupplierIds = new Set(allNewSuppliers.map((s) => s.id));
  const updatedSuppliers = [
    ...allNewSuppliers,
    ...current.suppliers.filter((s) => !newSupplierIds.has(s.id))
  ];

  // tasks 关联到主供应商
  const newTasks = extraction.tasks
    .filter((task) => !current.tasks.some((saved) => saved.status === "open" && saved.supplierId === primarySupplierId && normalizeText(saved.title) === normalizeText(task.title)))
    .map((task) => ({
      id: randomId(),
      supplierId: primarySupplierId,
      supplierName: primarySupplierName,
      communicationId,
      title: task.title,
      dueText: task.dueText,
      priority: task.priority,
      type: task.type,
      status: "open" as const,
      createdAt: now
    }));

  const next: LocalWorkbenchData = {
    suppliers: updatedSuppliers,
    communications: [{
      id: communicationId,
      supplierId: primarySupplierId,
      supplierName: primarySupplierName,
      summary: extraction.communication.summary,
      promises: extraction.communication.promises,
      questions: extraction.communication.questions,
      risks: extraction.communication.risks,
      nextActions: extraction.communication.nextActions,
      createdAt: now
    }, ...current.communications],
    offers: [
      ...extraction.offers.map((offer) => {
        const offerSupplierName = offer.supplierName || primaryName;
        const entry = offerSupplierName ? supplierByName.get(offerSupplierName) : undefined;
        const offerSupplierId = entry?.id ?? primarySupplierId;
        const resolvedName = entry?.supplier.name || offerSupplierName || primarySupplierName;
        return {
        id: randomId(),
        supplierId: offerSupplierId,
        communicationId,
        supplierName: resolvedName,
        name: offer.name,
        category: offer.category,
        productUrl: offer.productUrl,
        resourceUrl: offer.resourceUrl,
        quotedPrice: offer.quotedPrice,
        priceDetails: offer.priceDetails,
        skus: offer.skus?.map((sku, idx) => ({
          id: randomId(),
          specName: sku.specName,
          specCode: sku.specCode,
          width: sku.width,
          length: sku.length,
          thickness: sku.thickness,
          unitPrice: sku.unitPrice,
          unitPriceStr: sku.unitPriceStr,
          pricingUnit: sku.pricingUnit,
          moq: sku.moq,
          notes: sku.notes,
          priceHistory: []
        })),
        skuCount: offer.skuCount,
        minPrice: offer.minPrice,
        maxPrice: offer.maxPrice,
        untaxedUnitPrice: offer.untaxedUnitPrice,
        untaxedPlateFee: offer.untaxedPlateFee,
        taxedUnitPrice: offer.taxedUnitPrice,
        taxedPlateFee: offer.taxedPlateFee,
        taxFreightTerms: offer.taxFreightTerms,
        comparisonBasis: offer.comparisonBasis,
        normalizedPriceDetails: offer.normalizedPriceDetails,
        dimensions: offer.dimensions,
        pricingUnit: offer.pricingUnit,
        packageUnit: offer.packageUnit,
        keySpecs: offer.keySpecs,
        materialGrade: offer.materialGrade,
        width: offer.width,
        rollLength: offer.rollLength,
        gramWeightOptions: offer.gramWeightOptions,
        rollWeight: offer.rollWeight,
        freightIncluded: offer.freightIncluded,
        priceAdjustmentRule: offer.priceAdjustmentRule,
        moq: offer.moq,
        leadTime: offer.leadTime,
        specs: offer.specs,
        packaging: offer.packaging,
        sampleStatus: offer.sampleStatus,
        channelFit: offer.channelFit,
        advantages: offer.advantages,
        risks: offer.risks,
        notes: offer.notes,
        createdAt: now
        };
      }),
      ...current.offers
    ],
    products: current.products,
    tasks: [...newTasks, ...current.tasks],
    knowledgeBooks: current.knowledgeBooks,
    decisionTools: current.decisionTools,
    knowledgeApplications: current.knowledgeApplications,
    decisionCases: current.decisionCases,
    researchReports: current.researchReports,
    knowledgeCards: [
      ...extraction.knowledgeCards.map((card) => ({
        id: randomId(),
        title: card.title,
        source: card.source,
        summary: card.summary,
        applicableScenarios: card.applicableScenarios,
        steps: card.steps,
        scripts: card.scripts,
        risks: card.risks,
        tags: card.tags,
        createdAt: now
      })),
      ...current.knowledgeCards
    ]
  };

  window.localStorage.setItem(storageKey, JSON.stringify(next));
}

export async function saveWorkbenchData(data: LocalWorkbenchData): Promise<void> {
  // 1. 写入 localStorage（始终保存本地副本）
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  }

  // 2. 写入 Supabase
  try {
    // 查询是否已有记录
    const { data: existing, error: selectError } = await supabase
      .from("workbench_data")
      .select("id")
      .limit(1)
      .single();

    if (selectError) {
      console.error("[Sync] 查询 Supabase 记录失败:", selectError.message);
      throw selectError;
    }

    if (existing?.id) {
      // 更新已有记录
      const { error: updateError } = await supabase
        .from("workbench_data")
        .update({ data: data as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      
      if (updateError) {
        console.error("[Sync] 更新 Supabase 记录失败:", updateError.message);
        throw updateError;
      }
      console.log("[Sync] 更新 Supabase 成功");
    } else {
      // 插入新记录
      const { error: insertError } = await supabase
        .from("workbench_data")
        .insert({ data: data as unknown as Record<string, unknown> });
      
      if (insertError) {
        console.error("[Sync] 插入 Supabase 记录失败:", insertError.message);
        throw insertError;
      }
      console.log("[Sync] 插入 Supabase 成功");
    }
  } catch (e) {
    console.error("[Sync] Supabase 写入失败:", e);
    console.error("[Sync] 本地已保存，不影响使用");
  }
}

// 保持同步版本用于兼容旧代码
export function saveLocalWorkbenchData(data: LocalWorkbenchData) {
  if (typeof window === "undefined") return;
  const normalized = normalizeWorkbenchData(data);
  window.localStorage.setItem(storageKey, JSON.stringify(normalized));

  // 立即通知全局 store（所有页面即时刷新）
  setWorkbenchSnapshot(normalized);

  // 异步同步到 Supabase
  saveWorkbenchData(normalized).catch(() => {
    // 云端同步失败不影响本地操作
  });
}

export function saveProductKnowledge(product: ProductKnowledgeV2): ProductKnowledgeV2 {
  if (product.importIssues.some((issue) => issue.severity === "blocking")) {
    throw new Error("产品名称缺失，无法入库");
  }

  const validatedInput = ProductKnowledgeV2Schema.parse(
    normalizeProductImportIssueCompatibility(product).value
  );
  if (validatedInput.importIssues.some((issue) => issue.severity === "blocking")) {
    throw new Error("产品名称缺失，无法入库");
  }
  const normalized = normalizeProductKnowledge({
    ...validatedInput,
    updatedAt: new Date().toISOString()
  });
  const validated = ProductKnowledgeV2Schema.parse(normalized);

  // Safety net: if validation strips category research data, merge it back
  const hasOriginalCategoryData = validatedInput.marketOverview || validatedInput.competitiveLandscape || validatedInput.productBenchmark || validatedInput.userInsights || validatedInput.supplyChainFindings;
  const hasValidatedCategoryData = validated.marketOverview || validated.competitiveLandscape || validated.productBenchmark || validated.userInsights || validated.supplyChainFindings;
  const finalProduct: ProductKnowledgeV2 = (hasOriginalCategoryData && !hasValidatedCategoryData)
    ? {
        ...validated,
        marketOverview: validatedInput.marketOverview,
        competitiveLandscape: validatedInput.competitiveLandscape,
        productBenchmark: validatedInput.productBenchmark,
        userInsights: validatedInput.userInsights,
        supplyChainFindings: validatedInput.supplyChainFindings,
        researchDepth: validatedInput.researchDepth || product.researchDepth
      }
    : validated;

  const current = loadLocalWorkbenchData();
  const existing = current.products.find((item) => item.id === finalProduct.id);
  const incomingSupplierIds = finalProduct.relatedSupplierIds ?? [];
  const incomingOfferIds = finalProduct.relatedOfferIds ?? [];
  // 新导入的产品通常不自带关联，如果空数组就从旧记录继承（保护手动关联）
  const relatedSupplierIds = incomingSupplierIds.length > 0
    ? incomingSupplierIds
    : (existing?.relatedSupplierIds ?? []);
  const relatedOfferIds = incomingOfferIds.length > 0
    ? incomingOfferIds
    : (existing?.relatedOfferIds ?? []);
  let updatedOffers = current.offers;
  if (relatedSupplierIds.length > 0 || relatedOfferIds.length > 0) {
    const offerIdSet = new Set(relatedOfferIds);
    updatedOffers = current.offers.map((offer) => {
      const matchedByOfferId = offerIdSet.has(offer.id);
      const matchedBySupplierId = Boolean(offer.supplierId) && relatedSupplierIds.includes(offer.supplierId!);
      if (matchedByOfferId || matchedBySupplierId) {
        return { ...offer, productId: finalProduct.id, productName: finalProduct.name };
      }
      return offer;
    });
  }
  saveLocalWorkbenchData({
    ...current,
    products: [finalProduct, ...current.products.filter((item) => item.id !== finalProduct.id)],
    offers: updatedOffers
  });
  return finalProduct;
}

// 保存或更新调研报告：已存在则更新，否则前置插入
export function saveResearchReport(report: ResearchReport): ResearchReport {
  const current = loadLocalWorkbenchData();
  const existing = current.researchReports.find(r => r.id === report.id);
  const updated = { ...report, updatedAt: new Date().toISOString() };
  if (existing) {
    saveLocalWorkbenchData({
      ...current,
      researchReports: current.researchReports.map(r => r.id === report.id ? updated : r)
    });
  } else {
    saveLocalWorkbenchData({
      ...current,
      researchReports: [updated, ...current.researchReports]
    });
  }
  return updated;
}

// 删除调研报告
export function deleteResearchReport(id: string): void {
  const current = loadLocalWorkbenchData();
  saveLocalWorkbenchData({
    ...current,
    researchReports: current.researchReports.filter(r => r.id !== id)
  });
}

// 把调研报告关联到指定产品（去重追加 productId）
export function linkResearchToProduct(reportId: string, productId: string): void {
  const current = loadLocalWorkbenchData();
  saveLocalWorkbenchData({
    ...current,
    researchReports: current.researchReports.map(r =>
      r.id === reportId
        ? { ...r, linkedProductIds: [...new Set([...(r.linkedProductIds ?? []), productId])] }
        : r
    )
  });
}

export function saveBookPackage(parsed: ParsedBookPackage) {
  const current = loadLocalWorkbenchData();
  const now = new Date().toISOString();
  const book: LocalKnowledgeBook = {
    id: randomId(),
    ...parsed.book,
    rawText: parsed.rawText,
    createdAt: now
  };
  const tools: LocalDecisionTool[] = parsed.tools.map((tool) => ({
    id: randomId(),
    bookId: book.id,
    name: tool.name,
    problem: tool.problem,
    triggers: tool.triggers,
    diagnosticQuestions: tool.diagnosticQuestions,
    actions: tool.actions,
    limitations: tool.limitations,
    sourceChapter: tool.sourceChapter,
    tags: tool.tags,
    status: tool.status ?? "ready",
    createdAt: now
  }));

  saveLocalWorkbenchData({
    ...current,
    knowledgeBooks: [book, ...current.knowledgeBooks],
    decisionTools: [...tools, ...current.decisionTools]
  });
  return { book, tools };
}

export function createTaskFromKnowledgeAction(toolId: string, action: string) {
  const current = loadLocalWorkbenchData();
  const tool = current.decisionTools.find((item) => item.id === toolId);
  if (!tool) throw new Error("没有找到对应的决策工具。");
  const task: LocalTask = {
    id: randomId(),
    title: `${tool.name}：${action}`,
    priority: "medium",
    type: "knowledge_action",
    status: "open",
    createdAt: new Date().toISOString()
  };
  saveLocalWorkbenchData({ ...current, tasks: [task, ...current.tasks] });
  return task;
}

/**
 * 待办复盘反哺到产品知识：
 * 通过 task.offerId → offer.productId 找到关联产品，根据 reviewOutcome 把 reviewNote
 * 追加到对应字段（失败→risks.other，成功→opportunities，部分达成→optimizationOptions）。
 * 若 task 没有 offerId、offer 没有 productId、没有 reviewNote，或结果为"取消"，静默返回。
 */
export function applyTaskReviewToProduct(taskId: string): void {
  const data = loadLocalWorkbenchData();
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task) return;
  const reviewNote = task.reviewNote?.trim();
  if (!reviewNote) return;

  // 通过 task.offerId → offer.productId 解析关联产品
  let productId: string | undefined;
  if (task.offerId) {
    const offer = data.offers.find((item) => item.id === task.offerId);
    productId = offer?.productId;
  }
  if (!productId) return;

  const product = data.products.find((item) => item.id === productId);
  if (!product) return;

  const outcome = task.reviewOutcome;
  const stampedNote = `[待办复盘 · ${task.title}] ${reviewNote}`;

  let updatedProduct: ProductKnowledgeV2;
  if (outcome === "failure") {
    updatedProduct = {
      ...product,
      risks: { ...product.risks, other: [...product.risks.other, stampedNote] }
    };
  } else if (outcome === "success") {
    updatedProduct = {
      ...product,
      opportunities: [...product.opportunities, stampedNote]
    };
  } else if (outcome === "partial") {
    updatedProduct = {
      ...product,
      optimizationOptions: [
        ...product.optimizationOptions,
        {
          id: randomId(),
          name: `复盘发现：${task.title}`,
          description: reviewNote,
          status: "candidate"
        }
      ]
    };
  } else {
    // outcome 为 "cancelled" 或未知，不修改产品
    return;
  }

  updatedProduct.updatedAt = new Date().toISOString();

  saveLocalWorkbenchData({
    ...data,
    products: data.products.map((item) => (item.id === productId ? updatedProduct : item))
  });
}

export function saveKnowledgeApplication(input: {
  problem: string;
  toolIds: string[];
  diagnosis?: string;
  selectedActions: string[];
  selectedActionSources?: LocalKnowledgeActionSource[];
}) {
  const current = loadLocalWorkbenchData();
  const application: LocalKnowledgeApplication = {
    id: randomId(),
    problem: input.problem.trim(),
    toolIds: input.toolIds,
    diagnosis: input.diagnosis?.trim() || undefined,
    selectedActions: [...new Set(input.selectedActions.map((item) => item.trim()).filter(Boolean))],
    selectedActionSources: input.selectedActionSources ?? [],
    status: "open",
    createdAt: new Date().toISOString()
  };
  saveLocalWorkbenchData({
    ...current,
    knowledgeApplications: [application, ...current.knowledgeApplications]
  });
  return application;
}

export function savePlainKnowledgeApplication(input: { rawInput: string }) {
  const rawInput = input.rawInput.trim();
  if (!rawInput) throw new Error("请输入需要保存的内容。");
  const now = new Date().toISOString();
  const application: LocalKnowledgeApplication = {
    id: randomId(),
    problem: rawInput,
    rawInput,
    analysisStatus: "not_requested",
    toolIds: [],
    selectedActions: [],
    status: "open",
    version: 1,
    createdAt: now,
    updatedAt: now
  };
  const current = loadLocalWorkbenchData();
  saveLocalWorkbenchData({
    ...current,
    knowledgeApplications: [application, ...current.knowledgeApplications]
  });
  return application;
}

export function saveAnalyzedKnowledgeApplication(input: {
  rawInput: string;
  analysis: DecisionAnalysis;
}) {
  const rawInput = input.rawInput.trim();
  if (!rawInput) throw new Error("请输入需要分析的内容。");
  const now = new Date().toISOString();
  const application: LocalKnowledgeApplication = {
    id: randomId(),
    problem: input.analysis.summary,
    rawInput,
    analysisStatus: "analyzed",
    diagnosis: input.analysis.initialJudgement,
    modelId: input.analysis.recommendedModelId,
    modelSections: input.analysis.modelSections,
    openQuestions: input.analysis.openQuestions,
    toolIds: [],
    selectedActions: input.analysis.nextActions,
    status: "open",
    version: 1,
    createdAt: now,
    updatedAt: now
  };
  const current = loadLocalWorkbenchData();
  saveLocalWorkbenchData({
    ...current,
    knowledgeApplications: [application, ...current.knowledgeApplications]
  });
  return application;
}

export function saveKnowledgeApplicationVersion(
  applicationId: string,
  patch: Partial<Omit<LocalKnowledgeApplication, "id" | "createdAt" | "version" | "rootApplicationId">>
) {
  const current = loadLocalWorkbenchData();
  const versions = getApplicationVersions(current.knowledgeApplications, applicationId);
  const latest = versions[0];
  if (!latest) throw new Error("没有找到这条应用记录。");
  const rootApplicationId = latest.rootApplicationId ?? latest.id;
  const now = new Date().toISOString();
  const next: LocalKnowledgeApplication = {
    ...latest,
    ...patch,
    id: randomId(),
    rootApplicationId,
    version: (latest.version ?? 1) + 1,
    createdAt: now,
    updatedAt: now
  };
  saveLocalWorkbenchData({
    ...current,
    knowledgeApplications: [next, ...current.knowledgeApplications]
  });
  return next;
}

export function applicationVersions(applicationId: string) {
  return getApplicationVersions(loadLocalWorkbenchData().knowledgeApplications, applicationId);
}

export function loadDecisionCases() {
  const data = loadLocalWorkbenchData();
  if (data.decisionCases.length > 0) return data.decisionCases;
  return migrateKnowledgeApplicationsToCases(data);
}

export function createDecisionCase(input: {
  title: string;
  rawInput: string;
  objective?: string;
  initialJudgement?: string;
  supplierIds?: string[];
  offerIds?: string[];
  productIds?: string[];
}): DecisionCase {
  const title = input.title.trim();
  const rawInput = input.rawInput.trim();
  if (!title || !rawInput) throw new Error("问题名称和原始信息不能为空。");
  const now = new Date().toISOString();
  const firstCycle = createCycle({
    cycleNumber: 1,
    title: "首次判断",
    rawInput,
    initialJudgement: input.initialJudgement
  }, now);
  const caseItem = DecisionCaseSchema.parse({
    id: randomId(),
    title,
    normalizedProblemKey: normalizeProblemKey(title),
    objective: input.objective?.trim() || undefined,
    cycles: [firstCycle],
    supplierIds: input.supplierIds ?? [],
    offerIds: input.offerIds ?? [],
    productIds: input.productIds ?? [],
    createdAt: now,
    updatedAt: now
  });
  const data = loadLocalWorkbenchData();
  const existingCases = data.decisionCases.length > 0 ? data.decisionCases : migrateKnowledgeApplicationsToCases(data);
  saveLocalWorkbenchData({ ...data, decisionCases: [caseItem, ...existingCases] });
  return caseItem;
}

export function addDecisionCycle(caseId: string, input: {
  title: string;
  rawInput: string;
  newInformation?: string;
  initialJudgement?: string;
}) {
  const data = loadLocalWorkbenchData();
  const decisionCases = data.decisionCases.length > 0 ? data.decisionCases : migrateKnowledgeApplicationsToCases(data);
  const caseItem = decisionCases.find((item) => item.id === caseId);
  if (!caseItem) throw new Error("没有找到问题档案。");
  const now = new Date().toISOString();
  const cycle = createCycle({
    ...input,
    cycleNumber: Math.max(0, ...caseItem.cycles.map((item) => item.cycleNumber)) + 1
  }, now);
  saveLocalWorkbenchData({
    ...data,
    decisionCases: decisionCases.map((item) =>
      item.id === caseId ? { ...item, cycles: [...item.cycles, cycle], updatedAt: now } : item
    )
  });
  return cycle;
}

export function updateDecisionCycleVersion(
  caseId: string,
  cycleId: string,
  patch: Partial<Omit<DecisionCycle, "id" | "cycleNumber" | "createdAt">>
) {
  const data = loadLocalWorkbenchData();
  const decisionCases = data.decisionCases.length > 0 ? data.decisionCases : migrateKnowledgeApplicationsToCases(data);
  const caseItem = decisionCases.find((item) => item.id === caseId);
  const cycle = caseItem?.cycles.find((item) => item.id === cycleId);
  if (!caseItem || !cycle) throw new Error("没有找到当前决策周期。");
  const now = new Date().toISOString();
  const updated = DecisionCycleSchemaCompat({
    ...cycle,
    ...patch,
    version: cycle.version + 1,
    updatedAt: now
  });
  saveLocalWorkbenchData({
    ...data,
    decisionCases: decisionCases.map((item) =>
      item.id === caseId
        ? { ...item, cycles: item.cycles.map((value) => value.id === cycleId ? updated : value), updatedAt: now }
        : item
    )
  });
  return updated;
}

export function addToolContribution(caseId: string, cycleId: string, input: {
  toolId: string;
  toolName: string;
  sourceBook?: string;
  judgement: string;
  actions: string[];
}) {
  const cases = loadDecisionCases();
  const caseItem = cases.find((item) => item.id === caseId);
  const cycle = caseItem?.cycles.find((item) => item.id === cycleId);
  if (!caseItem || !cycle) throw new Error("没有找到当前决策周期。");
  const contribution: ToolContribution = {
    id: randomId(),
    toolId: input.toolId,
    toolName: input.toolName,
    sourceBook: input.sourceBook,
    judgement: input.judgement.trim(),
    actions: [...new Set(input.actions.map((item) => item.trim()).filter(Boolean))],
    createdAt: new Date().toISOString()
  };
  return updateDecisionCycleVersion(caseId, cycleId, {
    toolContributions: [...cycle.toolContributions, contribution],
    initialJudgement: input.judgement.trim() || cycle.initialJudgement,
    nextActions: mergeDecisionActions([...cycle.toolContributions, contribution])
  });
}

export function migrateKnowledgeApplicationsToCases(data: LocalWorkbenchData) {
  const grouped = new Map<string, LocalKnowledgeApplication[]>();
  for (const application of [...data.knowledgeApplications].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const key = normalizeProblemKey(application.rawInput || application.problem);
    grouped.set(key, [...(grouped.get(key) ?? []), application]);
  }
  return [...grouped.entries()].map(([key, applications]) => {
    const first = applications[0];
    const cycles = applications.map((application, index) => migrateApplicationCycle(application, index + 1, data));
    return DecisionCaseSchema.parse({
      id: `legacy-case:${first.id}`,
      title: first.rawInput || first.problem,
      normalizedProblemKey: key,
      cycles,
      createdAt: first.createdAt,
      updatedAt: applications[applications.length - 1].updatedAt ?? applications[applications.length - 1].createdAt
    });
  });
}

export function updateLocalItem<C extends LocalCollectionName>(collection: C, id: string, patch: Partial<LocalItem<C>>) {
  const data = loadLocalWorkbenchData();
  const next = {
    ...data,
    [collection]: data[collection].map((item) => (item.id === id ? { ...item, ...patch } : item))
  } as LocalWorkbenchData;
  // 货盘保存后，若 offer 关联了产品，把 offer.id 去重添加到对应 product 的 relatedOfferIds
  if (collection === "offers") {
    const updatedOffer = next.offers.find((item) => item.id === id);
    const productId = updatedOffer?.productId;
    if (productId) {
      next.products = next.products.map((product) => {
        if (product.id !== productId) return product;
        const existing = product.relatedOfferIds ?? [];
        if (existing.includes(id)) return product;
        return { ...product, relatedOfferIds: [...existing, id] };
      });
    }
  }
  saveLocalWorkbenchData(next);
  return next[collection].find((item) => item.id === id);
}

export function deleteLocalItem(collection: LocalCollectionName, id: string) {
  const data = loadLocalWorkbenchData();
  const next = {
    ...data,
    [collection]: data[collection].filter((item) => item.id !== id)
  } as LocalWorkbenchData;
  saveLocalWorkbenchData(next);
  return next;
}

export function deleteKnowledgeBook(bookId: string) {
  const data = loadLocalWorkbenchData();
  const next = {
    ...data,
    knowledgeBooks: data.knowledgeBooks.filter((book) => book.id !== bookId),
    decisionTools: data.decisionTools.filter((tool) => tool.bookId !== bookId)
  };
  saveLocalWorkbenchData(next);
  return next;
}

export function repairKnowledgeBookFromRawText(bookId: string) {
  const data = loadLocalWorkbenchData();
  const book = data.knowledgeBooks.find((item) => item.id === bookId);
  if (!book) throw new Error("没有找到这本书。");
  if (!book.rawText?.trim()) throw new Error("这本书没有保存原始书籍包，无法重新解析。");

  const parsed = parseBookPackage(book.rawText);
  const parsedByName = new Map(parsed.tools.map((tool) => [normalizeText(tool.name), tool]));
  const existingNames = new Set(
    data.decisionTools
      .filter((tool) => tool.bookId === bookId)
      .map((tool) => normalizeText(tool.name))
  );
  let updatedTools = 0;
  const now = new Date().toISOString();

  const repairedTools = data.decisionTools.map((tool) => {
    if (tool.bookId !== bookId) return tool;
    const parsedTool = parsedByName.get(normalizeText(tool.name));
    if (!parsedTool) return tool;

    const repaired: LocalDecisionTool = {
      ...tool,
      problem: tool.problem || parsedTool.problem,
      triggers: mergeKnowledgeListStrings(tool.triggers, parsedTool.triggers),
      diagnosticQuestions: mergeKnowledgeListStrings(tool.diagnosticQuestions, parsedTool.diagnosticQuestions),
      actions: mergeKnowledgeListStrings(tool.actions, parsedTool.actions),
      limitations: mergeKnowledgeListStrings(tool.limitations, parsedTool.limitations),
      sourceChapter: tool.sourceChapter || parsedTool.sourceChapter,
      tags: mergeUniqueStrings(tool.tags, parsedTool.tags)
    };
    if (JSON.stringify(repaired) !== JSON.stringify(tool)) updatedTools += 1;
    return repaired;
  });

  const addedTools: LocalDecisionTool[] = parsed.tools
    .filter((tool) => !existingNames.has(normalizeText(tool.name)))
    .map((tool) => ({
      id: randomId(),
      bookId,
      name: tool.name,
      problem: tool.problem,
      triggers: tool.triggers,
      diagnosticQuestions: tool.diagnosticQuestions,
      actions: tool.actions,
      limitations: tool.limitations,
      sourceChapter: tool.sourceChapter,
      tags: tool.tags,
      status: tool.status ?? "ready",
      createdAt: now
    }));

  saveLocalWorkbenchData({
    ...data,
    decisionTools: [...repairedTools, ...addedTools]
  });
  return { updatedTools, addedTools: addedTools.length };
}

export function exportLocalWorkbenchData() {
  return JSON.stringify(loadLocalWorkbenchData(), null, 2);
}

export function importLocalWorkbenchData(jsonText: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("备份文件不是有效的 JSON。");
  }

  if (!isWorkbenchDataLike(parsed)) {
    throw new Error("备份文件格式不正确。");
  }

  const next = normalizeWorkbenchData({
    ...emptyData(),
    ...parsed
  });
  saveLocalWorkbenchData(next);
  return next;
}

export function togglePinned(collection: "suppliers" | "offers" | "products" | "knowledgeCards", id: string) {
  const data = loadLocalWorkbenchData();
  saveLocalWorkbenchData({
    ...data,
    [collection]: data[collection].map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item))
  });
}

/** 检测重复供应商：按名称相似度找出一对一重复 */
export function findDuplicateSuppliers(): { target: LocalSupplier; source: LocalSupplier; reason: string }[] {
  const data = loadLocalWorkbenchData();
  const { suppliers } = data;
  const duplicates: { target: LocalSupplier; source: LocalSupplier; reason: string }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < suppliers.length; i++) {
    for (let j = i + 1; j < suppliers.length; j++) {
      const a = suppliers[i];
      const b = suppliers[j];
      const pairKey = [a.id, b.id].sort().join("|");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const aNorm = normalizeText(a.name);
      const bNorm = normalizeText(b.name);

      if (aNorm === bNorm) {
        duplicates.push({ target: a, source: b, reason: "完全同名" });
        continue;
      }

      // 包含关系
      if (aNorm.length > 1 && bNorm.length > 1 && (aNorm.includes(bNorm) || bNorm.includes(aNorm))) {
        duplicates.push({ target: a, source: b, reason: "名称包含关系" });
        continue;
      }

      // 斜杠别名匹配
      const aParts = aNorm.split(/[/／|、，,]/).map((p) => p.trim()).filter(Boolean);
      const bParts = bNorm.split(/[/／|、，,]/).map((p) => p.trim()).filter(Boolean);
      if (aParts.length > 1 || bParts.length > 1) {
        const hasMatch = aParts.some((ap) => bParts.some((bp) => ap === bp || (ap.length > 1 && bp.length > 1 && (ap.includes(bp) || bp.includes(ap)))));
        if (hasMatch) {
          duplicates.push({ target: a, source: b, reason: "别名/简称匹配" });
          continue;
        }
      }
    }
  }

  return duplicates;
}

/** 合并两个供应商：source 的所有数据迁移到 target，然后删除 source */
export function mergeSuppliers(targetId: string, sourceId: string): LocalWorkbenchData {
  const data = loadLocalWorkbenchData();
  const target = data.suppliers.find((s) => s.id === targetId);
  const source = data.suppliers.find((s) => s.id === sourceId);
  if (!target || !source) return data;

  // 合并品类
  const mergedCategories = Array.from(new Set([...target.categories, ...source.categories]));

  // 更新 target：保留非空值，优先选有意义的
  const updatedTarget: LocalSupplier = {
    ...target,
    categories: mergedCategories,
    location: target.location || source.location,
    contactName: target.contactName || source.contactName,
    contactMethod: target.contactMethod || source.contactMethod,
    storeUrl: target.storeUrl || source.storeUrl,
    sourcePlatform: target.sourcePlatform || source.sourcePlatform,
    supplierType: target.supplierType && target.supplierType !== "unknown" ? target.supplierType : source.supplierType,
    cooperationLevel: target.cooperationLevel || source.cooperationLevel,
    riskTags: Array.from(new Set([...target.riskTags, ...source.riskTags])),
    notes: [target.notes, source.notes].filter(Boolean).join("；"),
    pinned: target.pinned || source.pinned
  };

  // 迁移所有关联数据：offer / communication / task
  const updatedOffers = data.offers.map((o) =>
    o.supplierId === sourceId || o.supplierName === source.name
      ? { ...o, supplierId: targetId, supplierName: updatedTarget.name }
      : o
  );
  const updatedComms = data.communications.map((c) =>
    c.supplierId === sourceId ? { ...c, supplierId: targetId, supplierName: updatedTarget.name } : c
  );
  const updatedTasks = data.tasks.map((t) =>
    t.supplierId === sourceId ? { ...t, supplierId: targetId, supplierName: updatedTarget.name } : t
  );

  const updatedSuppliers = [
    updatedTarget,
    ...data.suppliers.filter((s) => s.id !== targetId && s.id !== sourceId)
  ];

  const result: LocalWorkbenchData = {
    ...data,
    suppliers: updatedSuppliers,
    offers: updatedOffers,
    communications: updatedComms,
    tasks: updatedTasks
  };

  saveLocalWorkbenchData(result);
  return result;
}

export function sortPinnedFirst<T extends { pinned?: boolean; createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function includesQuery(values: Array<string | undefined>, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

function emptyData(): LocalWorkbenchData {
  return {
    suppliers: [],
    communications: [],
    offers: [],
    products: [],
    tasks: [],
    knowledgeCards: [],
    knowledgeBooks: [],
    decisionTools: [],
    knowledgeApplications: []
    ,decisionCases: [],
    researchReports: []
  };
}

function normalizeWorkbenchData(data: Partial<LocalWorkbenchData>): LocalWorkbenchData {
  const current = { ...emptyData(), ...data };
  const supplierIdByName = new Map(current.suppliers.map((supplier) => [normalizeText(supplier.name), supplier.id]));
  return {
    suppliers: current.suppliers.map((supplier) => ({
      ...supplier,
      categories: Array.isArray(supplier.categories) ? supplier.categories : [],
      riskTags: Array.isArray(supplier.riskTags) ? supplier.riskTags : []
    })),
    communications: current.communications.map((communication) => ({
      ...communication,
      supplierId: communication.supplierId ?? (communication.supplierName ? supplierIdByName.get(normalizeText(communication.supplierName)) : undefined),
      promises: Array.isArray(communication.promises) ? communication.promises : [],
      questions: Array.isArray(communication.questions) ? communication.questions : [],
      risks: Array.isArray(communication.risks) ? communication.risks : [],
      nextActions: Array.isArray(communication.nextActions) ? communication.nextActions : []
    })),
    offers: current.offers.map((offer) => ({
      ...offer,
      supplierId: offer.supplierId ?? (offer.supplierName ? supplierIdByName.get(normalizeText(offer.supplierName)) : undefined),
      quotedPriceNum: offer.quotedPriceNum ?? extractPriceNumber(offer.quotedPrice),
      moqNum: offer.moqNum ?? extractMOQNumber(offer.moq),
      leadTimeDays: offer.leadTimeDays ?? extractLeadTimeDays(offer.leadTime),
      untaxedUnitPriceNum: offer.untaxedUnitPriceNum ?? extractPriceNumber(offer.untaxedUnitPrice),
      taxedUnitPriceNum: offer.taxedUnitPriceNum ?? extractPriceNumber(offer.taxedUnitPrice)
    })),
    products: current.products.map(normalizeProductKnowledge),
    tasks: current.tasks,
    knowledgeBooks: current.knowledgeBooks.map((book) => ({
      ...book,
      coverImage: typeof book.coverImage === "string" ? book.coverImage : undefined,
      businessScenarios: Array.isArray(book.businessScenarios) ? book.businessScenarios : []
    })),
    decisionTools: current.decisionTools.map((tool) => ({
      ...tool,
      triggers: Array.isArray(tool.triggers) ? tool.triggers : [],
      diagnosticQuestions: Array.isArray(tool.diagnosticQuestions) ? tool.diagnosticQuestions : [],
      actions: Array.isArray(tool.actions) ? tool.actions : [],
      limitations: Array.isArray(tool.limitations) ? tool.limitations : [],
      tags: Array.isArray(tool.tags) ? tool.tags : [],
      status: tool.status === "needs_review" ? "needs_review" : "ready"
    })),
    knowledgeApplications: current.knowledgeApplications.map((application) => ({
      ...application,
      toolIds: Array.isArray(application.toolIds) ? application.toolIds : [],
      selectedActions: Array.isArray(application.selectedActions) ? application.selectedActions : [],
      selectedActionSources: Array.isArray(application.selectedActionSources) ? application.selectedActionSources : [],
      modelSections: Array.isArray(application.modelSections) ? application.modelSections : undefined,
      openQuestions: Array.isArray(application.openQuestions) ? application.openQuestions : undefined,
      status: application.status === "completed" ? "completed" : "open"
    })),
    decisionCases: current.decisionCases
      .map((item) => DecisionCaseSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data),
    knowledgeCards: current.knowledgeCards.map((card) => ({
      ...card,
      applicableScenarios: Array.isArray(card.applicableScenarios) ? card.applicableScenarios : [],
      steps: Array.isArray(card.steps) ? card.steps : [],
      scripts: Array.isArray(card.scripts) ? card.scripts : [],
      risks: Array.isArray(card.risks) ? card.risks : [],
      tags: Array.isArray(card.tags) ? card.tags : []
    })),
    researchReports: data.researchReports ?? []
  };
}

function getApplicationVersions(applications: LocalKnowledgeApplication[], applicationId: string) {
  const selected = applications.find((item) => item.id === applicationId);
  const rootId = selected?.rootApplicationId ?? selected?.id ?? applicationId;
  return applications
    .filter((item) => item.id === rootId || item.rootApplicationId === rootId)
    .sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
}

function isWorkbenchDataLike(value: unknown): value is Partial<LocalWorkbenchData> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Record<LocalCollectionName, unknown>>;
  return ["suppliers", "communications", "offers", "products", "tasks", "knowledgeCards", "knowledgeBooks", "decisionTools", "knowledgeApplications", "decisionCases", "researchReports"].every((key) => {
    const collection = candidate[key as LocalCollectionName];
    return collection === undefined || Array.isArray(collection);
  });
}

function createCycle(input: {
  cycleNumber: number;
  title: string;
  rawInput: string;
  newInformation?: string;
  initialJudgement?: string;
}, now: string): DecisionCycle {
  return DecisionCycleSchemaCompat({
    id: randomId(),
    cycleNumber: input.cycleNumber,
    title: input.title.trim(),
    rawInput: input.rawInput.trim(),
    newInformation: input.newInformation?.trim() || undefined,
    initialJudgement: input.initialJudgement?.trim() || undefined,
    toolContributions: [],
    modelSections: [],
    nextActions: [],
    status: "judging",
    version: 1,
    createdAt: now,
    updatedAt: now
  });
}

function DecisionCycleSchemaCompat(value: unknown) {
  return DecisionCycleSchema.parse(value);
}

function migrateApplicationCycle(
  application: LocalKnowledgeApplication,
  cycleNumber: number,
  data: LocalWorkbenchData
): DecisionCycle {
  const sources = application.selectedActionSources ?? [];
  const contributionToolIds = [...new Set([...application.toolIds, ...sources.map((source) => source.toolId)])];
  const toolContributions: ToolContribution[] = contributionToolIds.map((toolId) => {
    const tool = data.decisionTools.find((item) => item.id === toolId);
    const sourceActions = sources.filter((source) => source.toolId === toolId);
    const actions = sourceActions.length > 0
      ? sourceActions.map((source) => source.action)
      : application.toolIds.length === 1 ? application.selectedActions : [];
    return {
      id: randomId(),
      toolId,
      toolName: tool?.name ?? sourceActions[0]?.toolName ?? "历史知识工具",
      sourceBook: tool?.bookId ? data.knowledgeBooks.find((book) => book.id === tool.bookId)?.title : undefined,
      judgement: application.diagnosis ?? "",
      actions,
      createdAt: application.createdAt
    };
  });
  return DecisionCycleSchemaCompat({
    id: `legacy-cycle:${application.id}`,
    cycleNumber,
    title: cycleNumber === 1 ? "首次判断" : `历史判断 ${cycleNumber}`,
    rawInput: application.rawInput || application.problem,
    initialJudgement: application.diagnosis,
    toolContributions,
    modelId: application.modelId,
    modelSections: application.modelSections ?? [],
    conclusion: application.diagnosis,
    nextActions: application.selectedActions.map((action) => ({
      action,
      sourceToolIds: toolContributions.filter((item) => item.actions.includes(action)).map((item) => item.toolId)
    })),
    status: application.status === "completed" ? "completed" : "judging",
    version: application.version ?? 1,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt ?? application.createdAt
  });
}

function mergeDecisionActions(contributions: ToolContribution[]) {
  return mergeActionSources(contributions);
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase();
}

/**
 * 供应商模糊匹配：支持同名、包含关系、斜杠分隔的别名匹配
 * 例如 "温州域德/橙萤" 能匹配到已存在的 "温州域德" 或 "橙萤"
 */
function findMatchingSupplier(suppliers: LocalSupplier[], incomingName: string): LocalSupplier | undefined {
  const incoming = normalizeText(incomingName);
  // 精确匹配
  let match = suppliers.find((s) => normalizeText(s.name) === incoming);
  if (match) return match;

  // 拆分斜杠别名，检查是否有任一别名匹配
  const incomingParts = incoming.split(/[/／|、，,]/).map((p) => p.trim()).filter(Boolean);
  if (incomingParts.length > 1) {
    // 输入"温州域德/橙萤"，检查已有供应商是否包含任一部分
    match = suppliers.find((s) => {
      const existing = normalizeText(s.name);
      return incomingParts.some((part) => existing === part || existing.includes(part) || part.includes(existing));
    });
    if (match) return match;

    // 反向：已有供应商也是"xxx/yyy"格式，检查是否有交集
    match = suppliers.find((s) => {
      const existingParts = normalizeText(s.name).split(/[/／|、，,]/).map((p) => p.trim()).filter(Boolean);
      return existingParts.some((ep) => incomingParts.some((ip) => ep === ip || ep.includes(ip) || ip.includes(ep)));
    });
    if (match) return match;
  }

  // 包含关系匹配："温州域德" 匹配 "温州域德/橙萤"
  match = suppliers.find((s) => {
    const existing = normalizeText(s.name);
    return existing.includes(incoming) || incoming.includes(existing);
  });
  if (match) return match;

  return undefined;
}

/** 从价格字符串中提取数值（元） */
function extractPriceNumber(priceText?: string): number | null {
  if (!priceText) return null;
  // 匹配数字（支持整数和小数）
  const matches = priceText.match(/(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length === 0) return null;
  // 取第一个匹配到的数字
  const num = parseFloat(matches[0]);
  return isNaN(num) ? null : num;
}

/** 从 MOQ 字符串中提取数值 */
function extractMOQNumber(moqText?: string): number | null {
  if (!moqText) return null;
  const matches = moqText.match(/(\d+)/g);
  if (!matches || matches.length === 0) return null;
  const num = parseInt(matches[0], 10);
  return isNaN(num) ? null : num;
}

/** 从交期字符串中提取天数 */
function extractLeadTimeDays(leadTimeText?: string): number | null {
  if (!leadTimeText) return null;
  // 匹配 "X天"、"X个工作日"、"X-day" 等模式
  const dayMatch = leadTimeText.match(/(\d+)\s*(?:天|日|个工作日|working days?|days?)/i);
  if (dayMatch) {
    const num = parseInt(dayMatch[1], 10);
    return isNaN(num) ? null : num;
  }
  // 如果没有明确单位，尝试提取第一个数字
  const fallbackMatch = leadTimeText.match(/(\d+)/);
  if (fallbackMatch) {
    const num = parseInt(fallbackMatch[1], 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

function mergeUniqueStrings(current: string[], incoming: string[]) {
  const seen = new Set(current.map(normalizeText));
  return [...current, ...incoming.filter((value) => {
    const key = normalizeText(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
}

function mergeKnowledgeListStrings(current: string[], incoming: string[]) {
  const seen = new Set<string>();
  return [...current, ...incoming]
    .map(canonicalizeKnowledgeListItem)
    .filter((value) => {
      const key = normalizeKnowledgeListItem(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function mergeSupplier(
  existing: LocalSupplier | undefined,
  incoming: NonNullable<DraftExtraction["supplier"]>,
  id: string,
  now: string
): LocalSupplier {
  const value = <T>(next: T | undefined, previous: T | undefined) => next || previous;
  return {
    id,
    pinned: existing?.pinned,
    name: incoming.name.trim(),
    categories: Array.from(new Set([...(existing?.categories ?? []), ...incoming.categories])),
    location: value(incoming.location, existing?.location),
    supplierType: value(incoming.supplierType, existing?.supplierType),
    contactName: value(incoming.contactName, existing?.contactName),
    contactMethod: value(incoming.contactMethod, existing?.contactMethod),
    storeUrl: value(incoming.storeUrl, existing?.storeUrl),
    sourcePlatform: value(incoming.sourcePlatform, existing?.sourcePlatform),
    cooperationLevel: value(incoming.cooperationLevel, existing?.cooperationLevel),
    riskTags: Array.from(new Set([...(existing?.riskTags ?? []), ...incoming.riskTags])),
    notes: value(incoming.notes, existing?.notes),
    createdAt: existing?.createdAt ?? now
  };
}
