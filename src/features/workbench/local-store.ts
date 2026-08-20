import defaultData from "@/data/workbench-data.json";
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
import type {
  SupplierEvaluationRecord,
  SupplierOrderRecord,
  SupplierQualityIssue,
  SupplierServiceEvent,
  SupplierCostReduction,
  SupplierEvaluationMetrics,
  SupplierEvaluationScores,
  ManualDeduction
} from "./supplier-evaluation";
import {
  evaluateSupplierFromRaw,
  SupplierEvaluationRecordSchema,
  aggregateMetricsFromRecords,
  calculateDeliveryScore,
  calculateCostScore,
  calculateQualityScore,
  calculateServiceScore,
  calculateTotalScoreAndGrade
} from "./supplier-evaluation";
import { parseSupplierChat } from "./supplier-chat-parser";
import { hasPendingLocalWrite } from "./sync-guard";
import type {
  SupplierChatExtractionDraft,
  SupplierOrderRecordDraft,
  SupplierQualityIssueDraft,
  SupplierServiceEventDraft,
  SupplierCostReductionDraft
} from "./schemas";
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
  // 合作模式：入仓型(inbound) / 代发型(dropship) / 混合型(hybrid)
  businessModel?: "inbound" | "dropship" | "hybrid";
  contactName?: string;
  contactMethod?: string;
  storeUrl?: string;
  sourcePlatform?: string;
  cooperationLevel?: string;
  riskTags: string[];
  notes?: string;
  createdAt: string;
  // 供应商 QCDS 评估扩展字段
  evaluations?: SupplierEvaluationRecord[];
  orderRecords?: SupplierOrderRecord[];
  qualityRecords?: SupplierQualityIssue[];
  serviceRecords?: SupplierServiceEvent[];
  costReductionRecords?: SupplierCostReduction[];
  manualDeductions?: ManualDeduction[];
  latestEvaluationScore?: number;
  latestEvaluationGrade?: SupplierEvaluationRecord["scores"]["grade"];
  latestEvaluationPeriod?: string;
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
  productId?: string;
  productName?: string;
  productStage?: string;
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

/** 内部产品/SKU主表：商品编码是公司内部与聚水潭共用的权威键，不等同于供应商规格编码。 */
export type LocalSkuMaster = {
  id: string;
  internalSkuCode: string;
  productName: string;
  specification: string;
  status: "ready" | "needs_spec";
  source: "excel" | "manual";
  sourceFileName?: string;
  sourceSheetName?: string;
  importedAt: string;
  importBatchId?: string;
};

export type LocalSkuImportBatch = {
  id: string;
  fileName: string;
  sheetName: string;
  importedAt: string;
  totalRows: number;
  importedRows: number;
  warningRows: number;
  errorRows: number;
  status: "pending_review" | "confirmed";
};

export type LocalSkuOfferLink = {
  id: string;
  skuMasterId: string;
  offerId: string;
  offerSkuId?: string;
  status: "confirmed" | "revoked";
  confirmedAt: string;
  revokedAt?: string;
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
  /** 首次导入先进入待确认区，确认后才参与报价关联。 */
  skuMasters?: LocalSkuMaster[];
  skuImportBatches?: LocalSkuImportBatch[];
  skuOfferLinks?: LocalSkuOfferLink[];
};

export type LocalCollectionName = "suppliers" | "communications" | "offers" | "products" | "tasks" | "knowledgeCards" | "knowledgeBooks" | "decisionTools" | "knowledgeApplications" | "decisionCases" | "researchReports";
type LocalItem<C extends LocalCollectionName> = LocalWorkbenchData[C][number];

const storageKey = "personal-commercial-workbench";
const pendingSyncKey = `${storageKey}:pending-sync`;
const PROXY_URL = "/api/supabase-proxy";
export const SYNC_TIMEOUT_MS = 8000;

/** 代理访问 Supabase：绕开浏览器网络限制，走本地 Next.js 服务器转发 */
async function proxyFetch<T = unknown>(
  action: "latest" | "count" | "upsert" | "insert" | "update",
  payload?: Record<string, unknown>
): Promise<T> {
  const url = action === "latest" || action === "count"
    ? `${PROXY_URL}?action=${action}`
    : PROXY_URL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: action === "latest" || action === "count" ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "latest" || action === "count" ? undefined : JSON.stringify({ action, ...payload }),
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    throw new Error(`Proxy HTTP ${res.status}`);
  }
  const json = (await res.json()) as { ok: boolean; status: number; data: T };
  if (!json.ok) {
    throw new Error(`Proxy error: ${JSON.stringify(json.data)}`);
  }
  return json.data;
}

export async function loadWorkbenchData(): Promise<LocalWorkbenchData> {
  console.log("[Sync] loadWorkbenchData 开始执行（走服务端代理）");
  // 1. 尝试从 Supabase 读取（通过本地代理，绕开浏览器网络限制）
  try {
    const proxyData = await proxyFetch<Array<{ data: LocalWorkbenchData }> | null>("latest");

    console.log("[Sync] 代理响应:", {
      type: Array.isArray(proxyData) ? "array" : typeof proxyData,
      length: Array.isArray(proxyData) ? proxyData.length : 0
    });

    const first = Array.isArray(proxyData) ? proxyData[0] : undefined;
    if (first?.data) {
      // 用户刚保存的本地数据尚未确认写入云端时，旧云端快照不能覆盖本地编辑。
      if (typeof window !== "undefined" && hasPendingLocalWrite(window.localStorage.getItem(pendingSyncKey))) {
        console.warn("[Sync] 检测到待确认的本地编辑，保留本地数据，跳过旧云端快照");
        return loadLocalWorkbenchData();
      }
      // 合并本地 rejected/confirmed 字段，防止云端旧代码丢失手动关联状态
      // 场景：本地删除关联 → 写入 rejected → 同步到 Supabase → 云端旧代码
      //       normalize 丢弃 rejected → autoBridge 重新关联 → 覆盖回 Supabase
      // 修复：从云端拉取后，先把本地 localStorage 中的 rejected/confirmed 合并进去，再跑桥接
      const cloudData = { ...first.data };
      if (typeof window !== "undefined") {
        const localStored = window.localStorage.getItem(storageKey);
        if (localStored) {
          try {
            const localData = JSON.parse(localStored) as Partial<LocalWorkbenchData>;
            const localProductMap = new Map((localData.products ?? []).map((p) => [p.id, p]));
            const cloudProducts = (cloudData as Partial<LocalWorkbenchData>).products ?? [];
            (cloudData as Partial<LocalWorkbenchData>).products = cloudProducts.map((p) => {
              const localP = localProductMap.get(p.id);
              if (!localP) return p;
              return {
                ...p,
                rejectedSupplierIds: [...new Set([...(p.rejectedSupplierIds ?? []), ...(localP.rejectedSupplierIds ?? [])])],
                rejectedOfferIds: [...new Set([...(p.rejectedOfferIds ?? []), ...(localP.rejectedOfferIds ?? [])])],
                confirmedSupplierIds: [...new Set([...(p.confirmedSupplierIds ?? []), ...(localP.confirmedSupplierIds ?? [])])],
                confirmedOfferIds: [...new Set([...(p.confirmedOfferIds ?? []), ...(localP.confirmedOfferIds ?? [])])]
              };
            });
          } catch {
            // 本地数据解析失败，直接用云端数据
          }
        }
      }
      const parsed = normalizeWorkbenchDataWithBridges(cloudData);
      const hadBridging = parsed.tasks.length > (first.data.tasks?.length ?? 0) ||
        parsed.products.some((p, i) =>
          (p.relatedSupplierIds ?? []).length > ((first.data.products?.[i]?.relatedSupplierIds as string[] | undefined)?.length ?? 0) ||
          (p.relatedOfferIds ?? []).length > ((first.data.products?.[i]?.relatedOfferIds as string[] | undefined)?.length ?? 0)
        );
      console.log("[Sync] 云端数据解析成功:", {
        products: parsed.products.length,
        autoBridged: {
          totalTasks: parsed.tasks.length,
          highPriority: parsed.tasks.filter(t => t.priority === 'high' && t.status !== 'done').length,
          productsWithSuppliers: parsed.products.filter(p => (p.relatedSupplierIds ?? []).length > 0).length,
          productsWithOffers: parsed.products.filter(p => (p.relatedOfferIds ?? []).length > 0).length,
          persistedToCloud: hadBridging
        }
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(parsed));
      }
      if (hadBridging) {
        saveWorkbenchData(parsed).catch(() => {});
      }
      return parsed;
    }
  } catch (e) {
    console.warn("[Sync] 代理/Supabase 读取失败:", e instanceof Error ? e.message : e);
  }

  // 2. 回退到 localStorage
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        const data = normalizeWorkbenchDataWithBridges(JSON.parse(stored) as Partial<LocalWorkbenchData>);
        console.log("[Sync] 回退到 localStorage:", { products: data.products.length });
        return data;
      } catch {
        // 解析失败
      }
    }
  }

  // 3. 使用默认数据
  const defaults = normalizeWorkbenchDataWithBridges(defaultData as Partial<LocalWorkbenchData>);
  console.log("[Sync] 使用默认数据");
  return defaults;
}

// 保持同步版本用于兼容旧代码
export function loadLocalWorkbenchData(): LocalWorkbenchData {
  if (typeof window === "undefined") {
    return normalizeWorkbenchDataWithBridges(defaultData as Partial<LocalWorkbenchData>);
  }
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    return normalizeWorkbenchDataWithBridges(defaultData as Partial<LocalWorkbenchData>);
  }

  try {
    return normalizeWorkbenchDataWithBridges(JSON.parse(stored) as Partial<LocalWorkbenchData>);
  } catch {
    return normalizeWorkbenchDataWithBridges(defaultData as Partial<LocalWorkbenchData>);
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
      : { name, categories: [] as string[], supplierType: "unknown" as const, businessModel: "inbound" as const, riskTags: [] as string[] };
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

  // 走统一保存路径：normalizeWorkbenchData → 评分重算 → Zustand 通知订阅者 → 云端同步
  // （直接 localStorage.setItem 会绕过评分重算和 Zustand store 更新，导致列表页不刷新）
  saveLocalWorkbenchData(next);
}

export async function saveWorkbenchData(data: LocalWorkbenchData): Promise<void> {
  // 1. 写入 localStorage（始终保存本地副本）
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  }

  // 2. 写入 Supabase（通过本地代理，绕开浏览器网络限制）
  try {
    await proxyFetch("upsert", { data });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(pendingSyncKey);
    }
    console.log("[Sync] 代理写入 Supabase 成功");
  } catch (e) {
    // 同步失败是可恢复的网络状态，不应使用 console.error 触发 Next.js 开发错误面板。
    // pending-sync 标记会保留，下一次保存或手动同步时继续尝试。
    console.warn("[Sync] 云端暂未同步，本地已保存，稍后将重试:", e instanceof Error ? e.message : e);
  }
}

// 保持同步版本用于兼容旧代码
export function saveLocalWorkbenchData(data: LocalWorkbenchData) {
  if (typeof window === "undefined") return;
  const bridged = autoBridgeCategoryData(data);
  const normalized = normalizeWorkbenchData(bridged);
  // 每次保存都重算评分：新录入的供应商可能有 orderRecords/qualityRecords 等原始数据，
  // 需要生成评估记录并更新 latestEvaluationScore/Grade，否则列表页显示"未评估"
  const withEvaluations = recalcEvaluationsWithDeductions(normalized);
  const withTasks = ensureProductStageTasks(withEvaluations);
  window.localStorage.setItem(storageKey, JSON.stringify(withTasks));
  window.localStorage.setItem(pendingSyncKey, String(Date.now()));

  try {
    const { setWorkbenchSnapshot } = require("./workbench-store");
    if (typeof setWorkbenchSnapshot === "function") {
      setWorkbenchSnapshot(withTasks);
    }
  } catch {
    // workbench-store 尚未加载，忽略
  }

  saveWorkbenchData(withTasks).catch(() => {
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
  // 供应商合作模式变更会改变评分权重，需触发评分重算
  if (collection === "suppliers" && patch && "businessModel" in patch) {
    const recalced = recalcEvaluationsWithDeductions(next);
    saveLocalWorkbenchData(recalced);
    return recalced[collection].find((item) => item.id === id);
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
    pinned: target.pinned || source.pinned,
    // 合并评估和原始记录：按 period / orderCode / 各自主键去重，再重算 latest 缓存
    evaluations: dedupeRecordsByKey(
      [
        ...(Array.isArray(target.evaluations) ? target.evaluations : []),
        ...(Array.isArray(source.evaluations) ? source.evaluations : [])
      ],
      "period"
    ),
    orderRecords: concatDedupedRecords(target.orderRecords, source.orderRecords, "id"),
    qualityRecords: concatDedupedRecords(target.qualityRecords, source.qualityRecords, "id"),
    serviceRecords: concatDedupedRecords(target.serviceRecords, source.serviceRecords, "id"),
    costReductionRecords: concatDedupedRecords(target.costReductionRecords, source.costReductionRecords, "id")
  };

  // 根据合并后的 evaluations 重新计算 latest 快照，以最新 period 为准
  const mergedEvaluations = sortEvaluationsNewestFirst(updatedTarget.evaluations ?? []);
  if (mergedEvaluations[0]) {
    updatedTarget.latestEvaluationScore = mergedEvaluations[0].scores.total;
    updatedTarget.latestEvaluationGrade = mergedEvaluations[0].scores.grade;
    updatedTarget.latestEvaluationPeriod = mergedEvaluations[0].period;
  }

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

// ---------- 供应商 QCDS 评估写入 ----------
export type SaveSupplierEvaluationInput = {
  supplierId: string;
  period: string;
  periodType?: "month" | "quarter" | "year";
  rawData?: {
    orders?: SupplierOrderRecord[];
    qualityIssues?: SupplierQualityIssue[];
    serviceEvents?: SupplierServiceEvent[];
    costReduction?: SupplierCostReduction[];
  };
  metrics?: Partial<SupplierEvaluationMetrics>;
  // 允许直接传入外部算好的 scores + 风险标签
  scores?: SupplierEvaluationScores;
  riskLabels?: string[];
  note?: string;
  evaluatedAt?: string;
};

/**
 * 保存一份供应商评估：
 * - 如果传入 metrics，会通过 evaluateSupplierFromRaw 用 QCDS 公式生成完整评估
 * - 否则允许直接传入 scores + riskLabels 作为外部算分结果
 * - 追加到 supplier.evaluations（按 period 去重，同周期覆盖），同时写入 4 类原始 records
 * - 更新 latestEvaluationScore / Grade / Period 缓存，便于列表快速排序筛选
 */
export function saveSupplierEvaluation(input: SaveSupplierEvaluationInput): SupplierEvaluationRecord {
  const current = loadLocalWorkbenchData();
  const { supplierId } = input;
  const now = new Date().toISOString();
  const supplier = current.suppliers.find((s) => s.id === supplierId);
  const businessModel = supplier?.businessModel ?? "inbound";

  let evaluation: SupplierEvaluationRecord;
  if (input.metrics && Object.keys(input.metrics).length > 0) {
    evaluation = evaluateSupplierFromRaw({
      supplierId,
      period: input.period,
      periodType: input.periodType,
      businessModel,
      metrics: input.metrics as SupplierEvaluationMetrics,
      manualDeductions: supplier?.manualDeductions ?? [],
      note: input.note,
      evaluatedAt: input.evaluatedAt
    });
    if (input.riskLabels && input.riskLabels.length > 0) {
      // 允许调用方指定的风险标签覆盖 / 叠加公式结果
      evaluation = { ...evaluation, riskLabels: Array.from(new Set([...evaluation.riskLabels, ...input.riskLabels])) };
    }
    if (input.scores) {
      // 手动修正过的分数以传入值为准
      evaluation = { ...evaluation, scores: { ...evaluation.scores, ...input.scores } };
    }
  } else if (input.scores) {
    evaluation = SupplierEvaluationRecordSchema.parse({
      id: "ev_" + Math.random().toString(36).slice(2, 10),
      supplierId,
      period: input.period,
      periodType: input.periodType ?? "quarter",
      scores: input.scores,
      rawMetrics: input.metrics ?? {},
      riskLabels: input.riskLabels ?? ["无风险"],
      note: input.note,
      evaluatedAt: input.evaluatedAt ?? now.slice(0, 10)
    });
  } else {
    throw new Error("saveSupplierEvaluation 需要 metrics 或 scores 之一");
  }

  // 找到对应供应商，追加评估 + 原始记录，更新缓存
  const updatedSuppliers = current.suppliers.map((s) => {
    if (s.id !== supplierId) return s;

    const existingEvaluations = Array.isArray(s.evaluations) ? s.evaluations : [];
    const restEvaluations = existingEvaluations.filter((ev) => ev.period !== evaluation.period);
    const mergedEvaluations = [...restEvaluations, evaluation];

    const mergedOrders = concatDedupedRecords(s.orderRecords, input.rawData?.orders, "id");
    const mergedQuality = concatDedupedRecords(s.qualityRecords, input.rawData?.qualityIssues, "id");
    const mergedService = concatDedupedRecords(s.serviceRecords, input.rawData?.serviceEvents, "id");
    const mergedCostReduction = concatDedupedRecords(s.costReductionRecords, input.rawData?.costReduction, "id");

    const sorted = sortEvaluationsNewestFirst(mergedEvaluations);
    return {
      ...s,
      evaluations: mergedEvaluations,
      orderRecords: mergedOrders,
      qualityRecords: mergedQuality,
      serviceRecords: mergedService,
      costReductionRecords: mergedCostReduction,
      latestEvaluationScore: sorted[0]?.scores.total,
      latestEvaluationGrade: sorted[0]?.scores.grade,
      latestEvaluationPeriod: sorted[0]?.period
    };
  });

  const result: LocalWorkbenchData = { ...current, suppliers: updatedSuppliers };
  saveLocalWorkbenchData(result);
  return evaluation;
}

// ---------- 手动修改/删除供应商原始记录，并自动重算评估 ----------
export type SupplierRecordType = "order" | "quality" | "service";

export function updateSupplierRecord(
  supplierId: string,
  type: SupplierRecordType,
  recordId: string,
  patch: Record<string, unknown>,
  period?: string
) {
  const current = loadLocalWorkbenchData();
  const supplier = current.suppliers.find((s) => s.id === supplierId);
  if (!supplier) throw new Error("未找到供应商");

  const listKey =
    type === "order" ? "orderRecords" : type === "quality" ? "qualityRecords" : "serviceRecords";
  const list = supplier[listKey] as Array<{ id: string }>;
  const updatedList = list.map((r) => (r.id === recordId ? { ...r, ...patch } : r));

  const updatedSupplier = { ...supplier, [listKey]: updatedList };
  const updatedData: LocalWorkbenchData = {
    ...current,
    suppliers: current.suppliers.map((s) => (s.id === supplierId ? updatedSupplier : s)),
  };
  saveLocalWorkbenchData(updatedData);

  // 若存在评估周期，重新基于 records 算分并覆盖最新评估（含手动扣分项）
  if (period) {
    recalcWithDeductions(supplierId, period);
  }
}

export function deleteSupplierRecord(
  supplierId: string,
  type: SupplierRecordType,
  recordId: string,
  period?: string
) {
  const current = loadLocalWorkbenchData();
  const supplier = current.suppliers.find((s) => s.id === supplierId);
  if (!supplier) throw new Error("未找到供应商");

  const listKey =
    type === "order" ? "orderRecords" : type === "quality" ? "qualityRecords" : "serviceRecords";
  const list = supplier[listKey] as Array<{ id: string }>;
  const updatedList = list.filter((r) => r.id !== recordId);

  const updatedSupplier = { ...supplier, [listKey]: updatedList };
  const updatedData: LocalWorkbenchData = {
    ...current,
    suppliers: current.suppliers.map((s) => (s.id === supplierId ? updatedSupplier : s)),
  };
  saveLocalWorkbenchData(updatedData);

  if (period) {
    recalcWithDeductions(supplierId, period);
  }
}

// ===== 手动扣分项 CRUD =====

export function addManualDeduction(
  supplierId: string,
  deduction: { dimension: ManualDeduction["dimension"]; type?: ManualDeduction["type"]; description: string; points: number },
  period?: string
): void {
  const current = loadLocalWorkbenchData();
  const supplier = current.suppliers.find((s) => s.id === supplierId);
  if (!supplier) throw new Error("未找到供应商");

  const newDeduction: ManualDeduction = {
    id: "ded_" + Math.random().toString(36).slice(2, 10),
    dimension: deduction.dimension,
    type: deduction.type ?? "deduction",
    description: deduction.description,
    points: Math.abs(deduction.points),
    source: "manual",
    createdAt: new Date().toISOString(),
    ignored: false,
  };

  const existing = supplier.manualDeductions ?? [];
  const updatedSupplier = { ...supplier, manualDeductions: [...existing, newDeduction] };
  const updatedData: LocalWorkbenchData = {
    ...current,
    suppliers: current.suppliers.map((s) => (s.id === supplierId ? updatedSupplier : s)),
  };
  saveLocalWorkbenchData(updatedData);

  // 重新算分
  if (period) {
    recalcWithDeductions(supplierId, period);
  }
}

export function updateManualDeduction(
  supplierId: string,
  deductionId: string,
  patch: Partial<ManualDeduction>,
  period?: string
): void {
  const current = loadLocalWorkbenchData();
  const supplier = current.suppliers.find((s) => s.id === supplierId);
  if (!supplier) throw new Error("未找到供应商");

  const existing = supplier.manualDeductions ?? [];
  const updated = existing.map((d) => (d.id === deductionId ? { ...d, ...patch } : d));
  const updatedSupplier = { ...supplier, manualDeductions: updated };
  const updatedData: LocalWorkbenchData = {
    ...current,
    suppliers: current.suppliers.map((s) => (s.id === supplierId ? updatedSupplier : s)),
  };
  saveLocalWorkbenchData(updatedData);

  if (period) {
    recalcWithDeductions(supplierId, period);
  }
}

export function deleteManualDeduction(supplierId: string, deductionId: string, period?: string): void {
  const current = loadLocalWorkbenchData();
  const supplier = current.suppliers.find((s) => s.id === supplierId);
  if (!supplier) throw new Error("未找到供应商");

  const existing = supplier.manualDeductions ?? [];
  const updated = existing.filter((d) => d.id !== deductionId);
  const updatedSupplier = { ...supplier, manualDeductions: updated };
  const updatedData: LocalWorkbenchData = {
    ...current,
    suppliers: current.suppliers.map((s) => (s.id === supplierId ? updatedSupplier : s)),
  };
  saveLocalWorkbenchData(updatedData);

  if (period) {
    recalcWithDeductions(supplierId, period);
  }
}

// 内部函数：带手动扣分项的重新算分
function recalcWithDeductions(supplierId: string, period: string): void {
  const current = loadLocalWorkbenchData();
  const supplier = current.suppliers.find((s) => s.id === supplierId);
  if (!supplier) return;

  const metrics = aggregateMetricsFromRecords({
    orders: supplier.orderRecords ?? [],
    qualityIssues: supplier.qualityRecords ?? [],
    serviceEvents: supplier.serviceRecords ?? [],
  });

  // 使用 evaluateSupplierFromRaw 并传入手动扣分项
  const businessModel = supplier.businessModel ?? "inbound";
  const evaluation = evaluateSupplierFromRaw({
    supplierId,
    period,
    businessModel,
    metrics,
    manualDeductions: supplier.manualDeductions ?? [],
  });

  const existingEvaluations = Array.isArray(supplier.evaluations) ? supplier.evaluations : [];
  const restEvaluations = existingEvaluations.filter((ev) => ev.period !== period);
  const mergedEvaluations = [...restEvaluations, evaluation];
  const sorted = mergedEvaluations.sort((a, b) => b.period.localeCompare(a.period));

  const updatedSupplier = {
    ...supplier,
    evaluations: mergedEvaluations,
    latestEvaluationScore: sorted[0]?.scores.total,
    latestEvaluationGrade: sorted[0]?.scores.grade,
    latestEvaluationPeriod: sorted[0]?.period,
  };
  const updatedData: LocalWorkbenchData = {
    ...current,
    suppliers: current.suppliers.map((s) => (s.id === supplierId ? updatedSupplier : s)),
  };
  saveLocalWorkbenchData(updatedData);
}

export function includesQuery(values: Array<string | undefined>, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

export function saveSkuMasterImport(input: {
  fileName: string;
  sheetName: string;
  importedAt: string;
  rows: Array<Pick<LocalSkuMaster, "internalSkuCode" | "productName" | "specification" | "status" | "sourceFileName" | "sourceSheetName" | "importedAt">>;
  warningRows: number;
  errorRows: number;
}): LocalSkuImportBatch {
  const current = loadLocalWorkbenchData();
  const batch: LocalSkuImportBatch = {
    id: `sku-import-${Date.now()}`,
    fileName: input.fileName,
    sheetName: input.sheetName,
    importedAt: input.importedAt,
    totalRows: input.rows.length + input.errorRows,
    importedRows: input.rows.length,
    warningRows: input.warningRows,
    errorRows: input.errorRows,
    status: "pending_review"
  };
  const existingByCode = new Map((current.skuMasters ?? []).map((item) => [item.internalSkuCode, item]));
  const imported = input.rows.map((row) => ({
    ...row,
    id: existingByCode.get(row.internalSkuCode)?.id ?? `sku-master-${row.internalSkuCode}`,
    source: "excel" as const,
    importBatchId: batch.id
  }));
  const merged = new Map(existingByCode);
  imported.forEach((item) => merged.set(item.internalSkuCode, item));
  saveLocalWorkbenchData({
    ...current,
    skuMasters: [...merged.values()],
    skuImportBatches: [batch, ...(current.skuImportBatches ?? [])]
  });
  return batch;
}

export function updateSkuMaster(id: string, patch: Partial<Pick<LocalSkuMaster, "productName" | "specification" | "status">>) {
  const current = loadLocalWorkbenchData();
  const next = (current.skuMasters ?? []).map((item) => item.id === id
    ? { ...item, ...patch, status: patch.specification?.trim() ? "ready" as const : item.status }
    : item);
  saveLocalWorkbenchData({ ...current, skuMasters: next });
}

export function confirmSkuImportBatch(batchId: string) {
  const current = loadLocalWorkbenchData();
  saveLocalWorkbenchData({
    ...current,
    skuImportBatches: (current.skuImportBatches ?? []).map((batch) => batch.id === batchId ? { ...batch, status: "confirmed" as const } : batch)
  });
}

export function confirmSkuOfferLink(skuMasterId: string, offerId: string, offerSkuId?: string) {
  const current = loadLocalWorkbenchData();
  const links = current.skuOfferLinks ?? [];
  const existing = links.find((link) => link.skuMasterId === skuMasterId && link.offerId === offerId && link.offerSkuId === offerSkuId);
  if (existing) {
    saveLocalWorkbenchData({
      ...current,
      skuOfferLinks: links.map((link) => link.id === existing.id ? { ...link, status: "confirmed" as const, revokedAt: undefined, confirmedAt: new Date().toISOString() } : link)
    });
    return;
  }
  saveLocalWorkbenchData({
    ...current,
    skuOfferLinks: [...links, {
      id: `sku-offer-link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      skuMasterId,
      offerId,
      offerSkuId,
      status: "confirmed",
      confirmedAt: new Date().toISOString()
    }]
  });
}

export function revokeSkuOfferLink(linkId: string) {
  const current = loadLocalWorkbenchData();
  saveLocalWorkbenchData({
    ...current,
    skuOfferLinks: (current.skuOfferLinks ?? []).map((link) => link.id === linkId
      ? { ...link, status: "revoked" as const, revokedAt: new Date().toISOString() }
      : link)
  });
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
    researchReports: [],
    skuMasters: [],
    skuImportBatches: [],
    skuOfferLinks: []
  };
}

// ---------- 供应商 QCDS 评估辅助 ----------
function sortEvaluationsNewestFirst(evals: SupplierEvaluationRecord[]): SupplierEvaluationRecord[] {
  return [...evals].sort((a, b) => {
    const ta = a.evaluatedAt || a.period || "";
    const tb = b.evaluatedAt || b.period || "";
    return tb.localeCompare(ta);
  });
}
function pickLatestEvaluationScore(evals: SupplierEvaluationRecord[]): number | undefined {
  const sorted = sortEvaluationsNewestFirst(evals);
  return sorted[0]?.scores?.total;
}
function pickLatestEvaluationGrade(evals: SupplierEvaluationRecord[]): SupplierEvaluationRecord["scores"]["grade"] | undefined {
  const sorted = sortEvaluationsNewestFirst(evals);
  return sorted[0]?.scores?.grade;
}
function pickLatestEvaluationPeriod(evals: SupplierEvaluationRecord[]): string | undefined {
  const sorted = sortEvaluationsNewestFirst(evals);
  return sorted[0]?.period;
}
function dedupeRecordsByKey<T extends { [k: string]: any }>(records: T[], key: keyof T & string): T[] {
  const seen = new Set<T[typeof key]>();
  const result: T[] = [];
  for (const r of records) {
    const k = r[key];
    if (k === undefined || k === null) { result.push(r); continue; }
    if (!seen.has(k)) { seen.add(k); result.push(r); }
  }
  return result;
}
function concatDedupedRecords<T extends { [k: string]: any }>(arrA: T[] | undefined, arrB: T[] | undefined, key: keyof T & string): T[] {
  const a = Array.isArray(arrA) ? arrA : [];
  const b = Array.isArray(arrB) ? arrB : [];
  return dedupeRecordsByKey([...a, ...b], key);
}

export function normalizeWorkbenchData(data: Partial<LocalWorkbenchData>): LocalWorkbenchData {
  const current = { ...emptyData(), ...data };
  const supplierIdByName = new Map(current.suppliers.map((supplier) => [normalizeText(supplier.name), supplier.id]));
  return {
    suppliers: current.suppliers.map((supplier) => {
      // 迁移 legacy supplier：补齐新字段的默认值，防止历史数据因缺字段导致访问 undefined 崩溃
      const normalizedEvaluations = Array.isArray((supplier as any).evaluations) ? (supplier as any).evaluations : [];
      const rawModel = (supplier as any).businessModel;
      const businessModel: "inbound" | "dropship" | "hybrid" =
        rawModel === "dropship" || rawModel === "hybrid" ? rawModel : "inbound";
      return {
        ...supplier,
        categories: Array.isArray(supplier.categories) ? supplier.categories : [],
        riskTags: Array.isArray(supplier.riskTags) ? supplier.riskTags : [],
        businessModel,
        evaluations: normalizedEvaluations,
        orderRecords: Array.isArray((supplier as any).orderRecords) ? (supplier as any).orderRecords : [],
        qualityRecords: Array.isArray((supplier as any).qualityRecords) ? (supplier as any).qualityRecords : [],
        serviceRecords: Array.isArray((supplier as any).serviceRecords) ? (supplier as any).serviceRecords : [],
        costReductionRecords: Array.isArray((supplier as any).costReductionRecords) ? (supplier as any).costReductionRecords : [],
        // 如果还没缓存 latest 快照，从 evaluations 里推导一次
        latestEvaluationScore: (supplier as any).latestEvaluationScore ?? pickLatestEvaluationScore(normalizedEvaluations),
        latestEvaluationGrade: (supplier as any).latestEvaluationGrade ?? pickLatestEvaluationGrade(normalizedEvaluations),
        latestEvaluationPeriod: (supplier as any).latestEvaluationPeriod ?? pickLatestEvaluationPeriod(normalizedEvaluations)
      };
    }),
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
    researchReports: data.researchReports ?? [],
    skuMasters: Array.isArray(data.skuMasters) ? data.skuMasters : [],
    skuImportBatches: Array.isArray(data.skuImportBatches) ? data.skuImportBatches : [],
    skuOfferLinks: Array.isArray(data.skuOfferLinks) ? data.skuOfferLinks : []
  };
}

export function normalizeWorkbenchDataWithBridges(data: Partial<LocalWorkbenchData>): LocalWorkbenchData {
  const normalized = normalizeWorkbenchData(data);
  const bridged = autoBridgeCategoryData(normalized);
  const withTasks = ensureProductStageTasks(bridged);
  return recalcEvaluationsWithDeductions(withTasks);
}

function recalcEvaluationsWithDeductions(data: LocalWorkbenchData): LocalWorkbenchData {
  const suppliers = data.suppliers.map((supplier) => {
    const deductions = supplier.manualDeductions ?? [];
    const hasActiveDeductions = deductions.some((d) => !d.ignored);
    const evaluations = Array.isArray(supplier.evaluations) ? supplier.evaluations : [];
    const hasRawRecords =
      (supplier.orderRecords ?? []).length > 0 ||
      (supplier.qualityRecords ?? []).length > 0 ||
      (supplier.serviceRecords ?? []).length > 0;

    // 重算触发条件（任一满足即重算，确保都按最新百分制公式）：
    //   1) 有手动调整项（加分/扣分）
    //   2) 已存在评估记录（用旧公式算的需要刷新）
    //   3) 有原始订单/质量/服务数据但还没有评估
    const needsRecalc = hasActiveDeductions || evaluations.length > 0 || hasRawRecords;
    if (!needsRecalc) return supplier;

    const metrics = aggregateMetricsFromRecords({
      orders: supplier.orderRecords ?? [],
      qualityIssues: supplier.qualityRecords ?? [],
      serviceEvents: supplier.serviceRecords ?? [],
    });

    const businessModel = supplier.businessModel ?? "inbound";
    const updatedEvaluations = evaluations.map((ev) => {
      // 如果此评估记录自带的 rawMetrics 不为空，优先用它（保存了当时的快照）
      // 否则回退到从原始记录重新聚合（兼容旧数据）
      const hasRawMetrics =
        ev.rawMetrics &&
        Object.keys(ev.rawMetrics).some(
          (k) => (ev.rawMetrics as Record<string, unknown>)[k] !== undefined
        );
      const evalMetrics = (hasRawMetrics
        ? { ...metrics, ...ev.rawMetrics }
        : metrics) as SupplierEvaluationMetrics;
      const newEval = evaluateSupplierFromRaw({
        supplierId: supplier.id,
        period: ev.period,
        periodType: ev.periodType,
        businessModel,
        metrics: evalMetrics,
        manualDeductions: deductions,
        note: ev.note,
        evaluatedAt: ev.evaluatedAt,
      });
      return { ...newEval, id: ev.id };
    });

    if (updatedEvaluations.length === 0 && hasRawRecords) {
      const period = new Date().toISOString().slice(0, 7);
      const newEval = evaluateSupplierFromRaw({
        supplierId: supplier.id,
        period,
        periodType: "month",
        businessModel,
        metrics,
        manualDeductions: deductions,
      });
      updatedEvaluations.push(newEval);
    }

    const sorted = [...updatedEvaluations].sort((a, b) => b.period.localeCompare(a.period));
    return {
      ...supplier,
      evaluations: updatedEvaluations.length > 0 ? updatedEvaluations : supplier.evaluations,
      latestEvaluationScore: sorted[0]?.scores.total,
      latestEvaluationGrade: sorted[0]?.scores.grade,
      latestEvaluationPeriod: sorted[0]?.period,
    };
  });
  return { ...data, suppliers };
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
  const rawModel = incoming.businessModel ?? (existing?.businessModel as "inbound" | "dropship" | "hybrid" | undefined);
  const businessModel: "inbound" | "dropship" | "hybrid" =
    rawModel === "dropship" || rawModel === "hybrid" ? rawModel : "inbound";
  return {
    id,
    pinned: existing?.pinned,
    name: incoming.name.trim(),
    categories: Array.from(new Set([...(existing?.categories ?? []), ...incoming.categories])),
    location: value(incoming.location, existing?.location),
    supplierType: value(incoming.supplierType, existing?.supplierType),
    businessModel,
    contactName: value(incoming.contactName, existing?.contactName),
    contactMethod: value(incoming.contactMethod, existing?.contactMethod),
    storeUrl: value(incoming.storeUrl, existing?.storeUrl),
    sourcePlatform: value(incoming.sourcePlatform, existing?.sourcePlatform),
    cooperationLevel: value(incoming.cooperationLevel, existing?.cooperationLevel),
    riskTags: Array.from(new Set([...(existing?.riskTags ?? []), ...incoming.riskTags])),
    notes: value(incoming.notes, existing?.notes),
    // draft merge 不丢历史评估
    evaluations: existing?.evaluations ?? [],
    orderRecords: existing?.orderRecords ?? [],
    qualityRecords: existing?.qualityRecords ?? [],
    serviceRecords: existing?.serviceRecords ?? [],
    costReductionRecords: existing?.costReductionRecords ?? [],
    latestEvaluationScore: existing?.latestEvaluationScore,
    latestEvaluationGrade: existing?.latestEvaluationGrade,
    latestEvaluationPeriod: existing?.latestEvaluationPeriod,
    createdAt: existing?.createdAt ?? now
  };
}

// ========== 智能桥接：产品-供应商-货盘自动关联 ==========

/** 通用词排除表：这些词的交集不产生自动关联 */
const GENERIC_KEYWORDS = new Set([
  "保护", "收纳", "家居", "定制", "家用", "新款", "通用", "多功能",
  "防滑", "防水", "免打孔", "加厚", "升级", "套装", "配件", "材料",
  "产品", "用品", "工具", "设备", "解决方案", "全套", "系列", "简易",
  "创意", "实用", "便携", "折叠", "可调", "智能", "环保", "安全",
  "门后", "桌下", "落地", "夹缝", "工位"
]);

/** 从文本中提取关键词（2字及以上的连续中文字符） */
function extractKeywords(text: string): Set<string> {
  const kw = new Set<string>();
  const matches = text.match(/[\u4e00-\u9fff]{2,}/g);
  if (matches) {
    for (const m of matches) {
      kw.add(m);
      if (m.length >= 3) {
        for (let i = 0; i <= m.length - 2; i++) {
          kw.add(m.slice(i, i + 2));
        }
      }
    }
  }
  return kw;
}

/** 获取非通用关键词 */
function getSpecificKeywords(text: string): Set<string> {
  const all = extractKeywords(text);
  const specific = new Set<string>();
  for (const k of all) {
    if (!GENERIC_KEYWORDS.has(k)) specific.add(k);
  }
  return specific;
}

/** 评分：计算两个文本的匹配分数（0-9） */
function matchScore(a: string, b: string): number {
  // 包含关系 → 9分（最强）
  if (a.includes(b) || b.includes(a)) return 9;

  const ka = getSpecificKeywords(a);
  const kb = getSpecificKeywords(b);

  // 3字+关键词交集 → 每个交集词贡献 3 分，取最高
  let bestScore = 0;
  for (const k of ka) {
    if (kb.has(k)) {
      if (k.length >= 3) bestScore = Math.max(bestScore, 6);
      else bestScore = Math.max(bestScore, 4);
    }
  }
  return bestScore;
}

const BRIDGE_THRESHOLD = 6; // >=6 才自动关联

/** 智能桥接：自动关联产品与供应商/货盘（尊重 confirmed/rejected） */
export function autoBridgeCategoryData(data: LocalWorkbenchData): LocalWorkbenchData {
  const products = data.products.map((p) => ({ ...p }));
  const offers = data.offers.map((o) => ({ ...o }));
  const suppliers = data.suppliers.map((s) => ({ ...s }));

  for (const product of products) {
    const rejectedOffers = new Set(product.rejectedOfferIds ?? []);
    const rejectedSuppliers = new Set(product.rejectedSupplierIds ?? []);
    const currentOfferIds = new Set(product.relatedOfferIds ?? []);
    const currentSupplierIds = new Set(product.relatedSupplierIds ?? []);

    // 1. 桥接货盘：关键词评分 + 品类匹配
    for (const offer of offers) {
      if (offer.productId === product.id) continue; // 已关联本产品
      if (rejectedOffers.has(offer.id)) continue;   // 用户拒绝过
      if (currentOfferIds.has(offer.id)) continue;  // 已在列表

      const score = matchScore(product.name, offer.name);
      const categoryMatch = offer.category && product.category && offer.category === product.category;

      if (score >= BRIDGE_THRESHOLD || categoryMatch) {
        offer.productId = product.id;
        offer.productName = product.name;
        currentOfferIds.add(offer.id);
        if (!product.relatedOfferIds) product.relatedOfferIds = [];
        product.relatedOfferIds!.push(offer.id);
      }
    }

    // 2. 桥接供应商：关键词评分
    for (const supplier of suppliers) {
      if (currentSupplierIds.has(supplier.id)) continue;
      if (rejectedSuppliers.has(supplier.id)) continue;

      const score = matchScore(product.name, supplier.name);
      if (score >= BRIDGE_THRESHOLD) {
        if (!product.relatedSupplierIds) product.relatedSupplierIds = [];
        product.relatedSupplierIds!.push(supplier.id);
        currentSupplierIds.add(supplier.id);
        const cat = product.category ?? "";
        if (cat && !supplier.categories.includes(cat)) {
          supplier.categories.push(cat);
        }
      }
    }

    // 3. 货盘→供应商级联：已关联的货盘的供应商自动追加到产品
    for (const offer of offers) {
      if (offer.productId !== product.id) continue;
      if (!offer.supplierId) continue;
      if (currentSupplierIds.has(offer.supplierId)) continue;
      if (rejectedSuppliers.has(offer.supplierId)) continue;

      if (!product.relatedSupplierIds) product.relatedSupplierIds = [];
      product.relatedSupplierIds!.push(offer.supplierId);
      currentSupplierIds.add(offer.supplierId);
    }
  }

  return { ...data, products, offers, suppliers, tasks: data.tasks };
}

/** 解除产品与货盘的关联（用户手动删除） */
export function removeOfferFromProduct(data: LocalWorkbenchData, productId: string, offerId: string): LocalWorkbenchData {
  const products = data.products.map((p) => {
    if (p.id !== productId) return p;
    return {
      ...p,
      relatedOfferIds: (p.relatedOfferIds ?? []).filter((id) => id !== offerId),
      confirmedOfferIds: (p.confirmedOfferIds ?? []).filter((id) => id !== offerId),
      rejectedOfferIds: [...new Set([...(p.rejectedOfferIds ?? []), offerId])]
    };
  });
  const offers = data.offers.map((o) =>
    o.id === offerId && o.productId === productId
      ? { ...o, productId: undefined, productName: undefined }
      : o
  );
  return { ...data, products, offers };
}

/** 解除产品与供应商的关联（用户手动删除） */
export function removeSupplierFromProduct(data: LocalWorkbenchData, productId: string, supplierId: string): LocalWorkbenchData {
  const products = data.products.map((p) => {
    if (p.id !== productId) return p;
    return {
      ...p,
      relatedSupplierIds: (p.relatedSupplierIds ?? []).filter((id) => id !== supplierId),
      confirmedSupplierIds: (p.confirmedSupplierIds ?? []).filter((id) => id !== supplierId),
      rejectedSupplierIds: [...new Set([...(p.rejectedSupplierIds ?? []), supplierId])]
    };
  });
  return { ...data, products };
}

/** 手动添加货盘到产品（用户在品类页选择） */
export function addOfferToProduct(data: LocalWorkbenchData, productId: string, offerId: string): LocalWorkbenchData {
  const product = data.products.find((p) => p.id === productId);
  const offer = data.offers.find((o) => o.id === offerId);
  if (!product || !offer) return data;

  const products = data.products.map((p) => {
    if (p.id !== productId) return p;
    const offerIds = new Set([...(p.relatedOfferIds ?? []), offerId]);
    const confirmed = new Set([...(p.confirmedOfferIds ?? []), offerId]);
    const rejected = (p.rejectedOfferIds ?? []).filter((id) => id !== offerId);
    return { ...p, relatedOfferIds: [...offerIds], confirmedOfferIds: [...confirmed], rejectedOfferIds: rejected };
  });
  const offers = data.offers.map((o) =>
    o.id === offerId ? { ...o, productId, productName: product.name } : o
  );
  // 级联供应商
  let result = { ...data, products, offers };
  if (offer.supplierId) {
    const supplierProducts = products.map((p) => {
      if (p.id !== productId) return p;
      if ((p.relatedSupplierIds ?? []).includes(offer.supplierId!)) return p;
      const sIds = [...(p.relatedSupplierIds ?? []), offer.supplierId!];
      const confirmedS = [...new Set([...(p.confirmedSupplierIds ?? []), offer.supplierId!])];
      return { ...p, relatedSupplierIds: sIds, confirmedSupplierIds: confirmedS };
    });
    result = { ...result, products: supplierProducts };
  }
  return result;
}

/** 手动添加供应商到产品 */
export function addSupplierToProduct(data: LocalWorkbenchData, productId: string, supplierId: string): LocalWorkbenchData {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return data;

  const products = data.products.map((p) => {
    if (p.id !== productId) return p;
    if ((p.relatedSupplierIds ?? []).includes(supplierId)) return p;
    const sIds = [...(p.relatedSupplierIds ?? []), supplierId];
    const confirmed = [...new Set([...(p.confirmedSupplierIds ?? []), supplierId])];
    const rejected = (p.rejectedSupplierIds ?? []).filter((id) => id !== supplierId);
    return { ...p, relatedSupplierIds: sIds, confirmedSupplierIds: confirmed, rejectedSupplierIds: rejected };
  });
  return { ...data, products };
}

// ========== 自动生成产品阶段待办 ==========

const STAGE_TITLES: Record<string, string> = {
  signal: "信号捕捉",
  validated: "机会验证",
  defined: "产品定义",
  supply_locked: "供应链锁定",
  listing: "上架准备",
  evaluating: "评估决策",
  archived: "归档",
  discontinued: "终止"
};

const STAGE_ORDER = ["signal", "validated", "defined", "supply_locked", "listing", "evaluating", "archived"] as const;

export function ensureProductStageTasks(data: LocalWorkbenchData): LocalWorkbenchData {
  const signalProductIds = new Set(
    data.products
      .filter((p) => p.lifecycleStage === "signal" || !p.lifecycleStage)
      .map((p) => p.id)
  );

  // 清理：已经处于 signal 阶段或未分阶段的产品，之前遗留的 product_stage 推进待办
  // （因策略变更不再自动生成）标记为 done，避免列表堆积
  const tasks = data.tasks.map((t) => {
    if (
      t.type === "product_stage" &&
      t.status !== "done" &&
      t.productId &&
      signalProductIds.has(t.productId)
    ) {
      return { ...t, status: "done" as const };
    }
    return t;
  });

  const existingTaskKeys = new Set(
    tasks
      .filter((t) => t.type === "product_stage" && t.status !== "done")
      .map((t) => `${t.productId}::${t.productStage}`)
  );

  for (const product of data.products) {
    const stage = product.lifecycleStage;
    // 信号池阶段不自动生成推进待办：即使系统判定为 active/GO，
    // 用户也不一定实际打算推进，避免信号池产品把待办列表塞爆
    if (!stage || stage === "signal" || stage === "archived" || stage === "discontinued") continue;

    const stageIdx = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
    if (stageIdx === -1 || stageIdx >= STAGE_ORDER.length - 1) continue;

    const nextStage = STAGE_ORDER[stageIdx + 1];
    const key = `${product.id}::${nextStage}`;
    if (existingTaskKeys.has(key)) continue;

    const nextTitle = STAGE_TITLES[nextStage] ?? nextStage;
    tasks.push({
      id: randomId(),
      title: `推进「${product.name}」到「${nextTitle}」阶段`,
      priority: "high",
      status: "open",
      type: "product_stage",
      productId: product.id,
      productName: product.name,
      productStage: nextStage,
      createdAt: new Date().toISOString(),
      dueText: "",
      pinned: false
    });
    existingTaskKeys.add(key);
  }

  return { ...data, tasks };
}

// =====================================================================
// Task 5: 聊天原文 → 草稿预览 → 正式评估 (快速录入 AI 提取管道)
// =====================================================================

export type ChatAnalyzeInput = {
  supplierId: string;
  chatText: string;
  period: string;
  referenceDate?: string;
  /** 允许调用方先把草稿返回给 UI 改完后再传回 commit */
  reviewerName?: string;
};

export type ChatAnalyzeResult = {
  supplierId: string;
  period: string;
  evaluatorName?: string;
  /** 原始聊天文本快照，便于追溯 */
  rawChatText: string;
  referenceDate?: string;
  /** 由解析器产出的未定稿 records（可编辑） */
  draft: SupplierChatExtractionDraft;
  /** 基于 draft 预聚合的指标（未做指标默认值填充，仅用于 UI 预览） */
  previewMetrics: Partial<SupplierEvaluationMetrics>;
  /** 基于 previewMetrics 给出的分数预览（仅用于 UI 预览） */
  previewScores?: SupplierEvaluationScores;
};

export function analyzeChatAsDraft(input: ChatAnalyzeInput): ChatAnalyzeResult {
  const draft = parseSupplierChat(input.chatText, { referenceDate: input.referenceDate });
  const orders = draft.orders.map(finalizeOrderRecord);
  const qualityIssues = draft.qualityIssues.map(finalizeQualityRecord);
  const serviceEvents = draft.serviceEvents.map(finalizeServiceEvent);
  const previewMetrics = aggregateMetricsFromRecords({
    orders, qualityIssues, serviceEvents
  }) as Partial<SupplierEvaluationMetrics>;
  const previewScores = calculateScoresFromPartialMetrics(previewMetrics);
  return {
    supplierId: input.supplierId,
    period: input.period,
    evaluatorName: input.reviewerName,
    rawChatText: input.chatText,
    referenceDate: input.referenceDate,
    draft,
    previewMetrics,
    previewScores
  };
}

export function commitChatAnalysis(analyzed: ChatAnalyzeResult): SupplierEvaluationRecord {
  const orders = analyzed.draft.orders.map(finalizeOrderRecord).map((o) => ({ ...o, supplierId: analyzed.supplierId }));
  const qualityIssues = analyzed.draft.qualityIssues.map(finalizeQualityRecord);
  const serviceEvents = analyzed.draft.serviceEvents.map(finalizeServiceEvent);
  const costReduction = analyzed.draft.costReductions.map(finalizeCostReductionRecord);

  const metrics = aggregateMetricsFromRecords({ orders, qualityIssues, serviceEvents });
  const scores = calculateScoresFromMetrics(metrics);

  const notes = [
    analyzed.evaluatorName ? `评估人：${analyzed.evaluatorName}` : null,
    analyzed.draft.uncertaintyNotes && analyzed.draft.uncertaintyNotes.length > 0
      ? `解析自动备注：${analyzed.draft.uncertaintyNotes.join("；")}`
      : null,
    analyzed.rawChatText
      ? `聊天原文（摘要）：${analyzed.rawChatText.slice(0, 300)}${analyzed.rawChatText.length > 300 ? "…" : ""}`
      : null
  ].filter(Boolean).join("\n") || undefined;

  return saveSupplierEvaluation({
    supplierId: analyzed.supplierId,
    period: analyzed.period,
    metrics,
    scores,
    rawData: { orders, qualityIssues, serviceEvents, costReduction },
    note: notes
  });
}

export type QuickCaptureInput = ChatAnalyzeInput & { autoSave?: boolean };

export function quickCaptureSupplierChat(input: QuickCaptureInput): SupplierEvaluationRecord {
  const analyzed = analyzeChatAsDraft(input);
  if (input.autoSave === false) {
    // 调用方不想自动保存时，仍需一个返回值；这里仅用 preview 等级数据 + 当前 supplier 构造 record
    // 但不写入 localStorage；实际实现里若要严格分离，可以返回一个临时的未保存 record。
    throw new Error(
      "autoSave=false 需要在 UI 层展示 analyzed.previewScores 后由用户调用 commitChatAnalysis 保存"
    );
  }
  return commitChatAnalysis(analyzed);
}

// ===== Draft → 正式 Records（补齐 id/timestamps + 字段名映射） =====

function finalizeOrderRecord(d: SupplierOrderRecordDraft): SupplierOrderRecord {
  return {
    id: randomId(),
    supplierId: "", // 保存函数会在外层按 supplierId 合并时再补齐
    supplierName: d.supplierNameGuess,
    productName: d.productName,
    skuSpec: d.skuSpec,
    orderedAt: d.orderedAt,
    promisedDeliveryAt: d.promisedDeliveryAt,
    actualDeliveryAt: d.actualDeliveryAt,
    orderQuantity: d.orderQuantity,
    deliveredQuantity: d.deliveredQuantity,
    isPeak: d.isPeak,
    unitPrice: d.unitPrice,
    currency: "CNY",
    status: d.status,
    note: d.note,
    source: "chat_parse",
    ignored: false,
    ignoreReason: undefined
  };
}

function finalizeQualityRecord(d: SupplierQualityIssueDraft): SupplierQualityIssue {
  return {
    id: randomId(),
    supplierName: d.supplierNameGuess,
    productName: d.productName,
    issueCount: d.issueCount,
    totalBatchSize: d.totalBatchSize,
    issueDescription: d.issueDescription,
    isCustomerReturn: !!d.isCustomerReturn,
    wrongShipIssue: !!d.wrongShipIssue,
    isClosed: d.isClosed,
    repeated: d.repeated,
    reportedAt: d.sourceLineText ? undefined : undefined, // 聊天行时间解析有难度，保持为undefined即可
    source: "chat_parse",
    ignored: false,
    ignoreReason: undefined
  };
}

function finalizeServiceEvent(d: SupplierServiceEventDraft): SupplierServiceEvent {
  return {
    id: randomId(),
    supplierName: d.supplierNameGuess,
    type: d.type,
    content: d.content,
    promisedAt: d.promisedAt,
    expectedAt: d.expectedAt,
    actualAt: d.actualAt,
    fulfilled: d.fulfilled,
    priceBefore: d.priceBefore,
    priceAfter: d.priceAfter,
    marketPriceChangedAt: d.marketPriceChangedAt,
    responseHours: d.responseHours,
    cooperationScore: d.cooperationScore,
    attitudeScore: d.attitudeScore,
    solutionRequested: d.solutionRequested,
    solutionProvided: d.solutionProvided,
    solutionDelivered: d.solutionDelivered,
    evasionSeverity: d.evasionSeverity,
    sourceLineText: d.sourceLineText,
    source: "chat_parse",
    recordedAt: new Date().toISOString(),
    ignored: false,
    ignoreReason: undefined
  };
}

function finalizeCostReductionRecord(d: SupplierCostReductionDraft): SupplierCostReduction {
  return {
    id: randomId(),
    supplierName: d.supplierNameGuess,
    productName: d.productName,
    priceBefore: d.priceBefore,
    priceAfter: d.priceAfter,
    method: d.method,
    note: d.note
  };
}

function computeDelayDays(promised?: string, actual?: string): number | undefined {
  if (!promised || !actual) return undefined;
  const p = new Date(promised).getTime();
  const a = new Date(actual).getTime();
  if (Number.isNaN(p) || Number.isNaN(a)) return undefined;
  return Math.max(0, Math.round((a - p) / 86400000));
}

// 把 partial metrics 转为 scores（用于预览/保存前预览，缺失字段直接按默认分算）
function calculateScoresFromPartialMetrics(partial: Partial<SupplierEvaluationMetrics>): SupplierEvaluationScores | undefined {
  // 用 undefined → 转换默认分的函数在 calculateXxxScore 里内部处理(m()函数)
  const asMetrics = {
    onTimeDeliveryRate: partial.onTimeDeliveryRate,
    peakDeliveryRate: partial.peakDeliveryRate,
    orderFulfillmentRate: partial.orderFulfillmentRate,
    expediteOnTimeRate: partial.expediteOnTimeRate,
    currentQuote: partial.currentQuote,
    categoryLowestPrice: partial.categoryLowestPrice,
    priceCompetitiveness: partial.priceCompetitiveness,
    priceRiseResponseDays: partial.priceRiseResponseDays,
    priceDropResponseDays: partial.priceDropResponseDays,
    priceStabilityScore: partial.priceStabilityScore,
    incomingPassRate: partial.incomingPassRate,
    qualityIssueClosureRate: partial.qualityIssueClosureRate,
    repeatIssueRate: partial.repeatIssueRate,
    promiseFulfillmentRate: partial.promiseFulfillmentRate,
    avgResponseHours: partial.avgResponseHours,
    cooperationAverageScore: partial.cooperationAverageScore
  } as SupplierEvaluationMetrics;
  return calculateScoresFromMetrics(asMetrics);
}

function calculateScoresFromMetrics(metrics: SupplierEvaluationMetrics): SupplierEvaluationScores {
  const delivery = calculateDeliveryScore(metrics);
  const cost = calculateCostScore(metrics);
  const quality = calculateQualityScore(metrics);
  const service = calculateServiceScore(metrics);
  const { total, grade } = calculateTotalScoreAndGrade({ delivery, cost, quality, service });
  return { delivery, cost, quality, service, total, grade };
}
