import { calculateHardCost } from "@/features/workbench/product-knowledge";
import type {
  CompetitiveLandscape,
  MarketOverview,
  ProductBenchmark,
  ProductCostItem,
  ProductDormantReason,
  ProductImportIssue as ProductModelImportIssue,
  ProductKnowledgeV2,
  ProductLifecycleStage,
  ProductMaterialStructure,
  ProductOptimizationOption,
  ProductProcurementQuote,
  ProductResearchDocument,
  ProductRiskSet,
  ProductSignalActivationTrigger,
  ProductSignalStatus,
  ProductSpecification,
  ResearchTable,
  SupplyChainFindings,
  UserInsights
} from "@/features/workbench/product-knowledge";
import {
  DORMANT_REASONS,
  PRODUCT_LIFECYCLE_STAGES,
  SIGNAL_STATUSES,
  ProductSignalActivationTriggerSchema
} from "@/features/workbench/product-knowledge";

const STANDARD_SECTIONS = [
  "产品与规格",
  "产品定位",
  "关键规格",
  "1688采购参考",
  "原料与结构",
  "材料与产品硬成本",
  "生产流程与设备",
  "制造方式",
  "成熟替代与优化",
  "替代与优化",
  "缺陷与风险",
  "风险与缺陷",
  "采购与验证",
  "延伸机会",
  "决策摘要",
  "市场与竞争",
  "用户与需求"
] as const;

type StandardSection = typeof STANDARD_SECTIONS[number];
type SectionMap = Map<StandardSection, string[]>;
type FieldValues = { label: string; values: string[] };
type FieldMap = Map<string, FieldValues>;
type MarkdownRow = Record<string, string>;
type TableRow = { values: MarkdownRow; cells: string[]; raw: string };
type MarkdownTable = { headers: string[]; rows: TableRow[]; invalidRows: TableRow[] };
type InvalidRow = { section: string; reason: string; cells: string[]; raw: string };
type ConflictRecorder = (field: string, values: string[]) => void;

// ===== 品类调研报告扩展：数字编号章节解析 =====
type NumberedSection = {
  title: string;
  subSections: Map<string, string[]>;
  lines: string[];
};
type NumberedSectionMap = Map<string, NumberedSection>;
type ResearchSectionKind =
  | "marketOverview"
  | "competitiveLandscape"
  | "productBenchmark"
  | "userInsights"
  | "supplyChainFindings"
  | "decision";
type CategoryResearchFields = {
  marketOverview?: MarketOverview;
  competitiveLandscape?: CompetitiveLandscape;
  productBenchmark?: ProductBenchmark;
  userInsights?: UserInsights;
  supplyChainFindings?: SupplyChainFindings;
};

export type ProductResearchSource = {
  fileName?: string;
  importedAt?: string;
  sourceUrl?: string;
};

export type ProductImportIssue = {
  id: string;
  severity: "blocking" | "warning" | "conflict";
  section: string;
  message: string;
};

export type ParsedProductResearch = {
  product: ProductKnowledgeV2;
  issues: ProductImportIssue[];
};

export function parseProductResearchMarkdown(rawText: string, source: ProductResearchSource = {}): ParsedProductResearch {
  const sections = splitSections(rawText);
  const issues: ProductImportIssue[] = [];
  const fieldConflicts: Record<string, string[]> = {};
  const invalidRows: InvalidRow[] = [];
  const addIssue = (severity: ProductImportIssue["severity"], section: string, message: string) => {
    issues.push({ id: `issue-${issues.length + 1}`, severity, section, message });
  };
  const recordConflict = (section: StandardSection): ConflictRecorder => (field, candidates) => {
    const key = `${section}.${field}`;
    if (fieldConflicts[key] || candidates.length < 2) return;
    fieldConflicts[key] = candidates;
    addIssue("conflict", section, `字段“${field}”存在多个不一致值，待确认。`);
  };
  const fields = (section: StandardSection) => fieldsIn(sections.get(section) ?? [], recordConflict(section));

  // 提取文档开头的产品名与元数据（处理品类调研报告：# 标题 / 视角：xxx 等前置信息）
  const docMeta = extractDocumentMeta(rawText);

  const positioningSection: StandardSection = sections.has("产品与规格") ? "产品与规格" : "产品定位";
  const positioning = fields(positioningSection);
  const name = field(positioning, "产品名称") ?? docMeta.name ?? fallbackProductName(source.fileName);
  const category = field(positioning, "产品品类") ?? docMeta.category;
  const coreUse = field(positioning, "核心用途") ?? docMeta.coreUse;
  const targetUsers = field(positioning, "目标用户") ?? docMeta.targetUsers;
  const useScenarios = values(field(positioning, "使用场景")).length > 0
    ? values(field(positioning, "使用场景"))
    : docMeta.useScenarios ?? [];
  const defaultUnit = field(positioning, "默认计量单位");
  if (!name) addIssue("blocking", positioningSection, "缺少产品名称，无法入库。");

  const specifications = parseSpecifications(sections.get("关键规格") ?? [], addIssue, recordConflict("关键规格"));
  const procurementQuotes = parseProcurementQuotes(sections.get("1688采购参考") ?? [], recordConflict("1688采购参考"));
  const materialStructures = parseMaterialStructures(sections.get("原料与结构") ?? [], recordConflict("原料与结构"));
  const costs = parseCosts(sections.get("材料与产品硬成本") ?? [], addIssue, recordConflict("材料与产品硬成本"), invalidRows);
  const calculatedCost = calculateHardCost(costs.items);
  if (costs.declaredTotal !== undefined && calculatedCost.total !== undefined && !sameAmount(costs.declaredTotal, calculatedCost.total)) {
    addIssue("conflict", "材料与产品硬成本", "声明的产品硬成本合计与成本明细小计不一致。");
  }

  const hasCostConflict = issues.some((issue) => issue.section === "材料与产品硬成本" && issue.severity === "conflict");
  const hardCostConfirmed = calculatedCost.status === "confirmed" && !costs.hasIncompleteEvidence && !hasCostConflict;
  const manufacturingSection: StandardSection = sections.has("生产流程与设备") ? "生产流程与设备" : "制造方式";
  const manufacturingLines = sections.get(manufacturingSection) ?? [];
  const manufacturingFields = fieldsIn(manufacturingLines, recordConflict(manufacturingSection));
  const optimizationSection: StandardSection = sections.has("成熟替代与优化") ? "成熟替代与优化" : "替代与优化";
  const riskSection: StandardSection = sections.has("缺陷与风险") ? "缺陷与风险" : "风险与缺陷";
  const stableId = `product-research-${fingerprint((name ?? "未命名产品").trim().toLowerCase())}`;
  const product: ProductKnowledgeV2 = {
    schemaVersion: 2,
    id: stableId,
    name: name ?? "未命名产品",
    category,
    coreUse,
    targetUsers,
    useScenarios,
    defaultUnit,
    specifications,
    procurementQuotes,
    materialStructures,
    machinery: values(field(manufacturingFields, "所需机器")),
    qualityControls: values(field(manufacturingFields, "质量控制点")),
    industryClusters: values(field(manufacturingFields, "主要产业带")),
    costItems: costs.items,
    ...(hardCostConfirmed && calculatedCost.total !== undefined ? { hardCostTotal: calculatedCost.total } : {}),
    hardCostStatus: hardCostConfirmed ? "confirmed" : "pending",
    manufacturing: parseManufacturing(manufacturingLines, recordConflict(manufacturingSection)),
    optimizationOptions: parseOptimizationOptions(sections.get(optimizationSection) ?? [], recordConflict(optimizationSection)),
    risks: parseRisks(sections.get(riskSection) ?? [], recordConflict(riskSection)),
    opportunities: parseOpportunities(sections.get("延伸机会") ?? [], recordConflict("延伸机会")),
    decision: sections.has("采购与验证")
      ? parseProcurementDecision(sections.get("采购与验证") ?? [], recordConflict("采购与验证"))
      : parseDecision(sections.get("决策摘要") ?? [], recordConflict("决策摘要")),
    rawDocument: buildRawDocument(rawText, source, fieldConflicts, invalidRows),
    importIssues: toProductModelIssues(issues),
    createdAt: source.importedAt ?? "unknown",
    // 流水线/信号池（文档头部解析）
    lifecycleStage: docMeta.lifecycleStage,
    signalStatus: docMeta.signalStatus,
    dormantReason: docMeta.dormantReason,
    activationTrigger: docMeta.activationTrigger
  };

  // ===== 解析"市场与竞争"和"用户与需求"章节（情报机每日情报格式） =====
  const signalCompetition = parseMarketAndCompetition(
    sections.get("市场与竞争") ?? []
  );
  if (signalCompetition.competitiveLandscape) {
    product.competitiveLandscape = { ...product.competitiveLandscape, ...signalCompetition.competitiveLandscape };
    product.researchDepth = product.researchDepth ?? "category";
  }
  if (signalCompetition.marketOverview) {
    product.marketOverview = { ...product.marketOverview, ...signalCompetition.marketOverview };
    product.researchDepth = product.researchDepth ?? "category";
  }
  // 把差评/退货分析追加到 risks.other
  if (signalCompetition.negativesFromReviews.length > 0) {
    product.risks.other = [...product.risks.other, ...signalCompetition.negativesFromReviews];
  }

  const signalUsers = parseUsersAndNeeds(
    sections.get("用户与需求") ?? []
  );
  if (signalUsers.userInsights) {
    product.userInsights = { ...product.userInsights, ...signalUsers.userInsights };
    product.researchDepth = product.researchDepth ?? "category";
  }
  // 把痛点描述也追加到 risks.other（避免浪费信息）
  if (signalUsers.painPoints.length > 0 && product.risks.other.length === 0) {
    product.risks.other = [...signalUsers.painPoints];
  }

  // ===== 合并品类调研报告扩展字段（数字编号格式章节） =====
  const categoryFields = parseCategoryResearchFields(rawText);
  if (
    categoryFields.marketOverview
    || categoryFields.competitiveLandscape
    || categoryFields.productBenchmark
    || categoryFields.userInsights
    || categoryFields.supplyChainFindings
  ) {
    product.researchDepth = "category";
    if (categoryFields.marketOverview) product.marketOverview = { ...product.marketOverview, ...categoryFields.marketOverview };
    if (categoryFields.competitiveLandscape) product.competitiveLandscape = { ...product.competitiveLandscape, ...categoryFields.competitiveLandscape };
    if (categoryFields.productBenchmark) product.productBenchmark = categoryFields.productBenchmark;
    if (categoryFields.userInsights) product.userInsights = { ...product.userInsights, ...categoryFields.userInsights };
    if (categoryFields.supplyChainFindings) product.supplyChainFindings = categoryFields.supplyChainFindings;
  }

  return { product, issues };
}

function parseProcurementQuotes(lines: string[], recordConflict: ConflictRecorder): ProductProcurementQuote[] {
  const table = firstTable(lines, recordConflict);
  const results: ProductProcurementQuote[] = [];

  function pushQuote(quote: ProductProcurementQuote | undefined) {
    if (!quote) return;
    if (!quote.source || !quote.specification || !quote.price) return;
    results.push(quote);
  }

  // 路径1：标准表格
  table.rows.forEach(({ values: row }) => {
    const source = column(row, "来源");
    const specification = column(row, "对应规格");
    const price = column(row, "批发报价");
    if (!source || !specification || !price) return;
    pushQuote({
      source,
      specification,
      price,
      moq: column(row, "MOQ"),
      freight: column(row, "运费口径"),
      quotedAt: column(row, "报价时间")
    });
  });

  // 路径2：单行管道格式（如：来源：1688 | 规格：xxx | 价格：¥36 | MOQ：1件起批 | 运费：待确认 | 链接：xxx）
  // 也兼容无竖线的 bullet key:value 多行格式，每行一条报价
  // 支持以任意报价相关字段开头（规格、来源、价格、批发报价等）
  const kvField = /(来源|规格|页面标价|批发报价|售价|价格|MOQ|起订量|运费|链接|报价时间|备注)\s*[:=：]\s*([^｜|\n]*?)\s*(?=(?:\s*[｜|]\s*(?:来源|规格|页面标价|批发报价|售价|价格|MOQ|起订量|运费|链接|报价时间|备注)\s*[:=：])|$)/g;
  const headerPattern = /^[\s\-*\u2022]*\s*(?:来源|规格|页面标价|批发报价|售价|价格|MOQ|起订量|运费|链接|报价时间|备注)\s*[:=：]/i;

  /** 对于"链接"字段额外清理：只取 http(s) URL，剔除反引号后的尾巴注释 */
  function cleanUrl(raw: string): string {
    const s = raw.trim().replace(/^`|`$/g, "");
    const urlMatch = s.match(/https?:\/\/[^\s`'"（）()【】\[\]]+/i);
    return urlMatch ? urlMatch[0] : s;
  }

  lines.forEach((rawLine) => {
    if (rawLine.match(/^\s*\|/)) return;
    if (!headerPattern.test(rawLine)) return;
    const line = rawLine.trim();
    const found: Record<string, string> = {};
    let m: RegExpExecArray | null;
    while ((m = kvField.exec(line)) !== null) {
      const key = m[1];
      const rawValue = m[2].trim();
      const value = key === "链接" ? cleanUrl(rawValue) : rawValue.replace(/^`|`$/g, "");
      if (!value) continue;
      if (key === "来源") found.source = found.source || value;
      else if (key === "规格") found.specification = found.specification || value;
      else if (key === "页面标价" || key === "批发报价" || key === "售价" || key === "价格") found.price = found.price || value;
      else if (key === "MOQ" || key === "起订量") found.moq = found.moq || value;
      else if (key === "运费") found.freight = found.freight || value;
      else if (key === "报价时间") found.quotedAt = found.quotedAt || value;
      else if (key === "链接") found.sourceUrl = found.sourceUrl || value;
      else if (key === "备注") found.note = found.note || value;
    }
    // 如果有规格和价格，即使没有来源也生成报价（默认来源为"线上"）
    if (found.specification && found.price) {
      pushQuote({
        source: found.source || "线上",
        specification: found.specification,
        price: found.price,
        moq: found.moq,
        freight: found.freight,
        quotedAt: found.quotedAt,
        sourceUrl: found.sourceUrl,
        note: found.note
      });
    }
  });

  return results;
}

function parseMaterialStructures(lines: string[], recordConflict: ConflictRecorder): ProductMaterialStructure[] {
  return firstTable(lines, recordConflict).rows.map(({ values: row }) => {
    const name = column(row, "原料或结构");
    if (!name) return undefined;
    return {
      name,
      role: column(row, "作用"),
      keyParameters: column(row, "关键参数"),
      weaknesses: column(row, "已知弊端")
    };
  }).filter(isDefined);
}

function splitSections(rawText: string): SectionMap {
  const sections: SectionMap = new Map();
  let currentSection: StandardSection | undefined;

  rawText.replace(/\r\n/g, "\n").split("\n").forEach((line) => {
    // 路径1：标准 Markdown ## 标题
    const heading = line.match(/^##\s+(.+?)\s*$/)?.[1].trim();
    if (heading) {
      currentSection = isStandardSection(heading) ? heading : undefined;
      if (currentSection && !sections.has(currentSection)) sections.set(currentSection, []);
      return;
    }
    // 路径2：纯文本章节标题（整行去掉空白后精确匹配章节名）
    // 启发式：整行字符数 ≤ 15（避免把正文里的"关键规格"等词误判为章节）
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length <= 15 && isStandardSection(trimmed)) {
      // 再确认一下：这行只包含章节名，没有其他内容（允许前后空白）
      currentSection = trimmed;
      if (!sections.has(currentSection)) sections.set(currentSection, []);
      return;
    }
    if (currentSection) sections.get(currentSection)?.push(line);
  });

  return sections;
}

/**
 * 品类调研报告的前置元数据提取。
 * 支持：
 *   # 电脑防窥防蓝光防反光保护膜及防窥挂板 - 品类调研评估报告
 *   视角：产品经理
 *   渠道：天猫排行榜对标 + 1688供应链
 *   产品线：保护膜 + 防窥挂板
 *   报告日期：2026-07-31
 *   ===== 以下为每日情报专用字段（可选，留空会使用默认值） =====
 *   流水线阶段：signal          # signal | validated | defined | supply_locked | listing | evaluating | archived | discontinued
 *   信号状态：dormant           # active（默认）| dormant | rejected
 *   休眠原因：采购成本过高      # 仅当信号状态= dormant 时填写，枚举见下
 *   激活触发：{"requiredSupplierCategories": ["日用品"], "maxUnitCost": 12, "applicableMonths": [9,10,11]}
 */
type DocumentMeta = {
  name?: string;
  category?: string;
  coreUse?: string;
  targetUsers?: string;
  useScenarios?: string[];
  productLine?: string;
  perspective?: string;
  lifecycleStage?: ProductLifecycleStage;
  signalStatus?: ProductSignalStatus;
  dormantReason?: ProductDormantReason;
  activationTrigger?: ProductSignalActivationTrigger;
};

function extractDocumentMeta(rawText: string): DocumentMeta {
  const normalized = rawText.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const meta: DocumentMeta = {};

  // ==============================================================
  // 1) 产品名提取：优先 H1 → 否则取文档第一行（若该行不是纯章节名）
  // ==============================================================
  const h1Line = lines.find((line) => /^#\s+/.test(line));
  if (h1Line) {
    const rawTitle = h1Line.replace(/^#\s+/, "").trim();
    const cleaned = rawTitle
      .replace(/\s*[-—–—]\s*品类调研评估报告.*$/i, "")
      .replace(/\s*[-—–—]\s*品类调研.*$/i, "")
      .replace(/\s*[-—–—]\s*调研评估报告.*$/i, "")
      .replace(/\s*[-—–—]\s*调研报告.*$/i, "")
      .replace(/\s*品类调研评估报告\s*$/i, "")
      .replace(/\s*品类调研\s*$/i, "")
      .replace(/\s*调研评估报告\s*$/i, "")
      .replace(/\s*调研报告\s*$/i, "")
      .replace(/\s*报告\s*$/i, "")
      .trim();
    if (cleaned) meta.name = cleaned;
  }
  // Fallback：如果没有 H1，取第一行作为产品名（排除空行和纯章节名）
  if (!meta.name) {
    const firstNonEmpty = lines.find((l) => l.trim().length > 0);
    if (firstNonEmpty) {
      const trimmed = firstNonEmpty.trim();
      // 排除 Markdown 标题（#、##、### 开头的，前面 H1 逻辑没命中说明它不是 H1）
      if (trimmed.startsWith("#")) {
        // 跳过，不作为 fallback
      } else if (!isStandardSection(trimmed) && trimmed.length > 1) {
        // 如果首行是"产品名 产品品类：xxx"这种拼接，取"产品品类："之前的部分
        const idx = trimmed.search(/\s*(产品品类|核心用途|目标用户|流水线阶段|信号状态|来源证据|扫描日期)\s*[:：]/);
        if (idx > 0) {
          meta.name = trimmed.slice(0, idx).trim();
        } else if (!trimmed.match(/^[\u4e00-\u9fa5A-Za-z]{2,12}\s*[:：]/)) {
          // 首行不是 "key：value" 开头的，直接作为产品名
          meta.name = trimmed;
        }
      }
    }
  }

  // ==============================================================
  // 2) 元数据字段解析：支持"多个 key-value 挤在同一行"
  //    例：产品品类：衣柜收纳 核心用途：xxx 目标用户：xxx ...
  // ==============================================================
  const multiKvKeys = [
    "产品线", "产品", "产品品类", "品类", "核心用途", "用途", "目标用户", "用户群体",
    "使用场景", "应用场景", "视角", "报告视角", "渠道", "调研渠道",
    "流水线阶段", "阶段", "lifecycleStage", "信号状态", "signalStatus",
    "休眠原因", "dormantReason", "激活触发", "激活条件", "activationTrigger",
    "来源证据", "扫描日期", "报告日期", "数据周期", "默认计量单位", "产品名称"
  ];
  const multiKvPattern = new RegExp(
    `(${multiKvKeys.join("|")})\\s*[:=：]\\s*`,
    "g"
  );

  /** 把一行文本（可能包含多个 key:value）拆成 [key, value][] */
  function splitMultiKv(line: string): Array<[string, string]> {
    const matches: Array<{ key: string; start: number }> = [];
    let m: RegExpExecArray | null;
    multiKvPattern.lastIndex = 0;
    while ((m = multiKvPattern.exec(line)) !== null) {
      matches.push({ key: m[1], start: multiKvPattern.lastIndex });
    }
    if (matches.length === 0) return [];
    const result: Array<[string, string]> = [];
    for (let i = 0; i < matches.length; i += 1) {
      const start = matches[i].start;
      const end = i + 1 < matches.length
        ? line.lastIndexOf(matches[i + 1].key, matches[i + 1].start)
        : line.length;
      const value = line.slice(start, end).trim().replace(/\s+$/, "");
      result.push([matches[i].key, value]);
    }
    return result;
  }

  function applyKv(key: string, value: string) {
    switch (key) {
      case "产品名称":
        if (!meta.name) meta.name = value;
        break;
      case "产品线":
      case "产品":
      case "产品品类":
        meta.productLine = meta.productLine ?? value;
        if (!meta.category) {
          meta.category = value
            .split(/[+＋,，、/]/)
            .map((item) => item.trim())
            .filter(Boolean)
            .join(" / ");
        }
        break;
      case "品类":
        meta.category = meta.category ?? value;
        break;
      case "核心用途":
      case "用途":
        meta.coreUse = meta.coreUse ?? value;
        break;
      case "目标用户":
      case "用户群体":
        meta.targetUsers = meta.targetUsers ?? value;
        break;
      case "使用场景":
      case "应用场景":
        if (!meta.useScenarios || meta.useScenarios.length === 0) {
          meta.useScenarios = values(value);
        }
        break;
      case "视角":
      case "报告视角":
        meta.perspective = meta.perspective ?? value;
        break;
      case "渠道":
      case "调研渠道":
        meta.productLine = meta.productLine ?? value;
        break;
      case "流水线阶段":
      case "阶段":
      case "lifecycleStage": {
        if (meta.lifecycleStage) break;
        const v = value.trim().toLowerCase().replace(/\s+/g, "_");
        if ((PRODUCT_LIFECYCLE_STAGES as readonly string[]).includes(v)) {
          meta.lifecycleStage = v as ProductLifecycleStage;
        }
        break;
      }
      case "信号状态":
      case "signalStatus": {
        if (meta.signalStatus) break;
        const v = value.trim().toLowerCase();
        if ((SIGNAL_STATUSES as readonly string[]).includes(v)) {
          meta.signalStatus = v as ProductSignalStatus;
        }
        break;
      }
      case "休眠原因":
      case "dormantReason": {
        if (meta.dormantReason) break;
        const v = value.trim();
        if ((DORMANT_REASONS as readonly string[]).includes(v)) {
          meta.dormantReason = v as ProductDormantReason;
        }
        break;
      }
      case "激活触发":
      case "激活条件":
      case "activationTrigger": {
        if (meta.activationTrigger) break;
        const payload = value.trim();
        if (!payload) break;
        try {
          let parsed: unknown;
          if (payload.startsWith("{") && payload.endsWith("}")) {
            parsed = JSON.parse(payload);
          } else {
            parsed = parseActivationTriggerCompact(payload);
          }
          const validated = ProductSignalActivationTriggerSchema.safeParse(parsed);
          if (validated.success) meta.activationTrigger = validated.data;
        } catch {
          // 跳过
        }
        break;
      }
      default:
        break;
    }
  }

  // 扫描开头 40 行
  const scanLimit = Math.min(lines.length, 40);
  for (let i = 0; i < scanLimit; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    // 跳过纯章节名
    if (line.length <= 15 && isStandardSection(line)) continue;
    // ① 尝试多 kv 拆分
    const multi = splitMultiKv(line);
    if (multi.length > 0) {
      multi.forEach(([k, v]) => applyKv(k, v));
      continue;
    }
    // ② 回落到原始的单 kv 模式（兼容原逻辑）
    const kv = line.match(/^([\u4e00-\u9fa5A-Za-z]{2,12})\s*[:：]\s*(.+?)\s*$/);
    if (kv) applyKv(kv[1], kv[2]);
  }

  // 如果 H1 没抓到且 fallback 也没抓到，回落到 H1 原始文本
  if (!meta.name && h1Line) meta.name = h1Line.replace(/^#\s+/, "").trim();

  return meta;
}

/** 激活触发简化格式："requiredSupplierCategories=A,B;maxUnitCost=12;applicableMonths=9,10,11" */
function parseActivationTriggerCompact(payload: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const segments = payload.split(/[;；]/);
  for (const seg of segments) {
    const eqIdx = seg.indexOf("=");
    if (eqIdx <= 0) continue;
    const rawKey = seg.slice(0, eqIdx).trim();
    const rawValue = seg.slice(eqIdx + 1).trim();
    const key = triggerKeyAlias(rawKey);
    if (!key) continue;
    // 数字数组或普通数组
    if (key === "applicableMonths") {
      const nums = rawValue.split(/[,，、\s]+/).map((x) => Number(x)).filter((x) => Number.isFinite(x));
      if (nums.length) out[key] = nums;
      continue;
    }
    if (key === "requiredSupplierCategories") {
      const arr = rawValue.split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean);
      if (arr.length) out[key] = arr;
      continue;
    }
    if (key === "maxUnitCost") {
      const n = Number(rawValue);
      if (Number.isFinite(n)) out[key] = n;
      continue;
    }
    out[key] = rawValue;
  }
  return out;
}

function triggerKeyAlias(raw: string): keyof ProductSignalActivationTrigger | undefined {
  switch (raw) {
    case "requiredSupplierCategories":
    case "供应商品类":
    case "所需供应商品类":
      return "requiredSupplierCategories";
    case "maxUnitCost":
    case "单位成本上限":
    case "最大单位成本":
      return "maxUnitCost";
    case "applicableMonths":
    case "适用月份":
    case "季节月份":
      return "applicableMonths";
    case "minSupplierCooperationLevel":
    case "最低合作等级":
      return "minSupplierCooperationLevel";
    case "customRule":
    case "自定义规则":
      return "customRule";
    default:
      return undefined;
  }
}

function fallbackProductName(fileName?: string): string | undefined {
  if (!fileName) return undefined;
  const stem = fileName.replace(/\.[^.]+$/, "").trim();
  if (!stem || stem.length < 2) return undefined;
  return stem;
}

function isStandardSection(value: string): value is StandardSection {
  return (STANDARD_SECTIONS as readonly string[]).includes(value);
}

function fieldsIn(lines: string[], recordConflict: ConflictRecorder): FieldMap {
  const fields: FieldMap = new Map();
  lines.forEach((line) => {
    if (line.trim().startsWith("|")) return;
    const match = line.trim().replace(/^-\s*/, "").match(/^([^：:]+)[：:]\s*(.*)$/);
    if (!match) return;
    const label = match[1].trim();
    const value = match[2].trim();
    const key = normalizeHeader(label);
    const entry = fields.get(key) ?? { label, values: [] };
    if (!entry.values.includes(value)) entry.values.push(value);
    fields.set(key, entry);
  });
  fields.forEach(({ label, values: candidates }) => {
    if (candidates.length > 1) recordConflict(label, candidates);
  });
  return fields;
}

function field(fields: FieldMap, name: string): string | undefined {
  const value = fields.get(normalizeHeader(name))?.values[0];
  return value && value !== "待确认" ? value : undefined;
}

function parseSpecifications(
  lines: string[],
  addIssue: (severity: ProductImportIssue["severity"], section: string, message: string) => void,
  recordConflict: ConflictRecorder
): ProductSpecification[] {
  const table = firstTable(lines, recordConflict);
  const grouped = new Map<string, { name: string; candidates: ProductSpecification[] }>();

  function pushSpec(nameIn: string, valueIn: string, unit?: string) {
    const name = nameIn.trim();
    const value = valueIn.trim();
    if (!name || !value) return;
    const key = normalizeHeader(name);
    const candidate: ProductSpecification = {
      id: `spec-${key}`,
      name,
      value,
      unit,
      source: "research"
    };
    const entry = grouped.get(key) ?? { name: candidate.name, candidates: [] };
    if (!entry.candidates.some((existing) => sameSpecification(existing, candidate))) entry.candidates.push(candidate);
    grouped.set(key, entry);
  }

  // 路径1：标准3列表格（参数｜数值｜单位）
  if (table.rows.length > 0) {
    const missingHeaders = missingHeadersFrom(table.headers, ["参数", "数值"]);
    if (missingHeaders.length > 0) addIssue("warning", "关键规格", `关键规格表缺少必需列：${missingHeaders.join("、")}。`);
    if (table.invalidRows.length > 0) addIssue("warning", "关键规格", "关键规格表存在列数不匹配的行。");
    table.rows.forEach(({ values: row }, index) => {
      const name = column(row, "参数");
      const value = column(row, "数值");
      if (!name || !value) {
        const missing = [!name ? "参数" : undefined, !value ? "数值" : undefined].filter(isDefined);
        addIssue("warning", "关键规格", `关键规格表第 ${index + 1} 行缺少${missing.join("、")}。`);
        return;
      }
      pushSpec(name, value, column(row, "单位"));
    });
  }

  // 路径2：纯文本自由格式（每行一个"名称：值"或"名称=值"，可带 bullet -/*）
  const loosePattern = /^[\s\-*\u2022]*\s*(.+?)\s*[：:=]\s*(.+)$/;
  const plainRows: string[] = [];
  lines.forEach((line) => {
    if (line.match(/^\s*\|/)) return; // 跳过表格行
    if (line.match(/^\s*$/)) return;   // 跳过空行
    const m = line.match(loosePattern);
    if (m) plainRows.push(line);
  });

  if (plainRows.length > 0) {
    const blacklist = new Set(["流水线阶段", "信号状态", "休眠原因", "激活触发", "产品品类", "核心用途", "目标用户", "使用场景", "默认计量单位", "产品名称", "产品线", "视角", "报告日期", "扫描日期", "来源证据", "渠道"]);
    plainRows.forEach((line) => {
      const m = line.match(loosePattern);
      if (!m) return;
      if (blacklist.has(m[1].trim())) return;
      pushSpec(m[1], m[2]);
    });
  }

  if (table.rows.length === 0 && plainRows.length === 0) {
    addIssue("warning", "关键规格", "关键规格表为空，待补资料。");
  }

  return [...grouped.values()].map((entry) => {
    if (entry.candidates.length > 1) recordConflict(`参数${entry.name}`, entry.candidates.map(specificationCandidate));
    return entry.candidates[0];
  });
}

function parseCosts(
  lines: string[],
  addIssue: (severity: ProductImportIssue["severity"], section: string, message: string) => void,
  recordConflict: ConflictRecorder,
  invalidRows: InvalidRow[]
): { items: ProductCostItem[]; declaredTotal?: number; hasIncompleteEvidence: boolean } {
  let hasIncompleteEvidence = false;
  const table = firstTable(lines, recordConflict);
  const requiredHeaders = ["名称", "规格或用量", "单价", "计价单位", "小计", "货币", "来源", "地区", "日期", "可信程度"];
  const missingHeaders = missingHeadersFrom(table.headers, requiredHeaders);
  const hasCostRows = table.rows.length > 0 || table.invalidRows.length > 0;
  if (table.headers.length === 0 || !hasCostRows) {
    addIssue("warning", "材料与产品硬成本", "材料与产品硬成本待补。");
  } else if (missingHeaders.length > 0) {
    addIssue("warning", "材料与产品硬成本", `成本表缺少必需列：${missingHeaders.join("、")}。`);
  }
  table.invalidRows.forEach(({ cells, raw }) => {
    if (!hasContent(cells)) return;
    const includedValue = included(valueFromCells(table.headers, cells, "是否计入"));
    addIssue("warning", "材料与产品硬成本", "成本表存在列数不匹配的非空行。", );
    invalidRows.push({ section: "材料与产品硬成本", reason: "列数不匹配", cells, raw });
    if (includedValue !== false) hasIncompleteEvidence = true;
  });

  const items = table.rows.map(({ values: row, cells, raw }, index) => {
    const includedValue = included(column(row, "是否计入"));
    const blocksConfirmation = includedValue !== false;
    if (missingHeaders.length > 0) {
      invalidRows.push({ section: "材料与产品硬成本", reason: `缺少必需列：${missingHeaders.join("、")}`, cells, raw });
      if (blocksConfirmation) hasIncompleteEvidence = true;
      return undefined;
    }
    const name = column(row, "名称");
    if (!name) {
      addIssue("warning", "材料与产品硬成本", "成本条目缺少名称。");
      invalidRows.push({ section: "材料与产品硬成本", reason: "缺少名称", cells, raw });
      if (blocksConfirmation) hasIncompleteEvidence = true;
      return undefined;
    }
    const quantity = numberValue(column(row, "数量") ?? column(row, "规格或用量"));
    const unit = column(row, "计价单位") ?? column(row, "单位");
    const unitCost = numberValue(column(row, "单价"));
    const subtotal = numberValue(column(row, "小计"));
    const currency = column(row, "货币");
    const provenance = [
      ["来源", column(row, "来源")],
      ["地区", column(row, "地区")],
      ["日期", column(row, "日期")],
      ["可信程度", column(row, "可信程度")]
    ] as const;
    const missing = [
      ["规格或用量", quantity],
      ["单价", unitCost],
      ["计价单位", unit],
      ["小计", subtotal],
      ["货币", currency],
      ...provenance
    ].filter(([, value]) => value === undefined || value === "").map(([label]) => label);
    if (missing.length > 0) {
      if (blocksConfirmation) hasIncompleteEvidence = true;
      addIssue("warning", "材料与产品硬成本", `成本条目“${name}”缺少${missing.join("、")}。`);
    }
    if (blocksConfirmation && quantity !== undefined && unitCost !== undefined && subtotal !== undefined && !sameAmount(quantity * unitCost, subtotal, 0.01)) {
      addIssue("conflict", "材料与产品硬成本", `成本条目“${name}”的数量、单价与小计不一致。`);
    }
    const source = provenance.filter(([, value]) => value).map(([label, value]) => `${label}：${value}`).join("；") || undefined;
    return {
      id: `cost-${index + 1}`,
      category: column(row, "类别") ?? column(row, "成本类别") ?? "未分类",
      name,
      quantity,
      unit,
      unitCost,
      subtotal,
      ...(currency ? { currency } : {}),
      included: includedValue,
      source
    };
  }).filter(isDefined);
  const declaredTotal = numberValue(field(fieldsIn(lines, recordConflict), "产品硬成本合计"));

  return { items, declaredTotal, hasIncompleteEvidence };
}

function parseManufacturing(lines: string[], recordConflict: ConflictRecorder) {
  const fields = fieldsIn(lines, recordConflict);
  const notes = ["所需机器", "生产难点", "质量控制点", "主要产业带"]
    .map((name) => {
      const value = field(fields, name);
      return value ? `${name}：${value}` : undefined;
    })
    .filter(isDefined);
  return { processes: values(field(fields, "核心工艺")), notes: notes.join("\n") || undefined };
}

function parseOptimizationOptions(lines: string[], recordConflict: ConflictRecorder): ProductOptimizationOption[] {
  return firstTable(lines, recordConflict).rows.map(({ values: row }, index) => {
    const name = column(row, "具体方案") ?? column(row, "替代方案");
    if (!name) return undefined;
    const description = [
      labelValue("优化对象", column(row, "优化对象") ?? column(row, "替代对象")),
      labelValue("改善目标", column(row, "改善目标") ?? column(row, "降本或改善目标")),
      labelValue("保持效果的依据", column(row, "保持效果的依据")),
      labelValue(
        column(row, "实现条件") ? "实现条件" : "可实现性",
        column(row, "实现条件") ?? column(row, "可实现性")
      ),
      labelValue("新风险", column(row, "新风险") ?? column(row, "风险")),
      labelValue("验证方法", column(row, "验证方法")),
      labelValue("是否建议打样", column(row, "是否建议打样"))
    ].filter(isDefined).join("；");
    const impact = [
      labelValue("预计成本变化", column(row, "预计成本变化") ?? column(row, "成本变化方向")),
      labelValue("质量影响", column(row, "质量影响"))
    ].filter(isDefined).join("；");
    return { id: `optimization-${index + 1}`, name, description: description || undefined, impact: impact || undefined, status: "candidate" as const };
  }).filter(isDefined);
}

function parseRisks(lines: string[], recordConflict: ConflictRecorder): ProductRiskSet {
  const fields = fieldsIn(lines, recordConflict);
  return {
    quality: [...values(field(fields, "产品缺陷")), ...values(field(fields, "工艺风险"))],
    supply: values(field(fields, "原材料风险")),
    compliance: values(field(fields, "合规风险")),
    other: [
      ...values(field(fields, "使用风险")),
      ...values(field(fields, "产品售后风险")),
      ...values(field(fields, "与产品本身直接相关的售后风险"))
    ]
  };
}

function parseOpportunities(lines: string[], recordConflict: ConflictRecorder): string[] {
  const fields = fieldsIn(lines, recordConflict);
  return ["可延伸场景", "可开发规格", "可搭配产品"].flatMap((name) => values(field(fields, name)));
}

function parseDecision(lines: string[], recordConflict: ConflictRecorder) {
  const fields = fieldsIn(lines, recordConflict);

  // ==============================================================
  // 路径1：嵌套分组格式（情报机每日情报表的格式）
  //   初步结论：GO
  //   核心优势：
  //   优势1——说明
  //   优势2——说明
  //   主要风险：
  //   风险1——说明
  //   判定依据：
  //   依据1：xxx
  //   建议零售价区间：¥29-59
  //   成本区间（页面标价估算）：¥6-52
  //   推荐主攻平台：淘宝/拼多多
  // ==============================================================
  const grouped = parseDecisionGroupedFormat(lines);
  if (grouped) {
    const recommendation = grouped.initialConclusion ?? field(fields, "是否值得继续询价或打样");
    const summaryParts: string[] = [];
    if (grouped.coreAdvantages.length > 0) {
      summaryParts.push(`核心优势：${grouped.coreAdvantages.join("；")}`);
    }
    if (grouped.suggestedPriceRange) summaryParts.push(`建议零售价：${grouped.suggestedPriceRange}`);
    if (grouped.costRangeEstimate) summaryParts.push(`成本区间：${grouped.costRangeEstimate}`);
    if (grouped.recommendedPlatforms) summaryParts.push(`主攻平台：${grouped.recommendedPlatforms}`);

    const rationaleParts: string[] = [];
    if (grouped.mainRisks.length > 0) rationaleParts.push(`主要风险：${grouped.mainRisks.join("；")}`);
    if (grouped.judgementBasis.length > 0) rationaleParts.push(`判定依据：${grouped.judgementBasis.join("；")}`);

    return {
      summary: summaryParts.join("\n").trim() || undefined,
      recommendation,
      rationale: rationaleParts.join("\n").trim() || undefined,
      status: decisionStatus(recommendation)
    };
  }

  // 路径2：标准格式（最大成本驱动因素/是否值得继续询价或打样）
  const costDriver = field(fields, "最大成本驱动因素");
  const competition = field(fields, "核心竞争点");
  const missing = field(fields, "当前缺失信息");
  const nextStep = field(fields, "下一步行动");
  const recommendation = field(fields, "是否值得继续询价或打样");
  return {
    summary: [labelValue("最大成本驱动因素", costDriver), labelValue("核心竞争点", competition)].filter(isDefined).join("；") || undefined,
    recommendation,
    rationale: [labelValue("当前缺失信息", missing), labelValue("下一步行动", nextStep)].filter(isDefined).join("；") || undefined,
    status: decisionStatus(recommendation)
  };
}

/**
 * 解析"情报机嵌套格式"的决策摘要：
 *   初步结论：GO
 *   核心优势：
 *   痛点真实——xxx
 *   成本低——xxx
 *   主要风险：
 *   xxx——xxx
 *   判定依据：
 *   xxx：xxx
 *   建议零售价区间：xxx
 *   成本区间（页面标价估算）：xxx
 *   推荐主攻平台：xxx
 *
 * 返回 undefined 表示该格式不匹配，走旧格式解析。
 */
function parseDecisionGroupedFormat(
  lines: string[]
):
  | {
      initialConclusion?: string;
      coreAdvantages: string[];
      mainRisks: string[];
      judgementBasis: string[];
      suggestedPriceRange?: string;
      costRangeEstimate?: string;
      recommendedPlatforms?: string;
    }
  | undefined {
  // 检测情报机格式的分组头
  const hasGroupHeader = lines.some((l) =>
    /^\s*(初步结论|核心优势|主要风险|判定依据|建议零售价区间|成本区间|推荐主攻平台)\s*[:：]/.test(l)
  );

  // 检测用户自定义的 ### 子标题格式（功能需求/性能要求/采购建议/风险评估）
  const hasSubHeading = lines.some((l) =>
    /^\s*###\s*(功能需求|性能要求|采购建议|风险评估|功能|性能|采购|风险)\s*$/.test(l)
  );

  if (!hasGroupHeader && !hasSubHeading) return undefined;

  const result = {
    coreAdvantages: [] as string[],
    mainRisks: [] as string[],
    judgementBasis: [] as string[]
  } as {
    initialConclusion?: string;
    coreAdvantages: string[];
    mainRisks: string[];
    judgementBasis: string[];
    suggestedPriceRange?: string;
    costRangeEstimate?: string;
    recommendedPlatforms?: string;
  };

  // 处理 ### 子标题格式
  if (hasSubHeading) {
    let currentSubGroup: "function" | "performance" | "procurement" | "risk" | undefined;
    const functionItems: string[] = [];
    const performanceItems: string[] = [];
    const procurementItems: string[] = [];
    const riskItems: string[] = [];

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      // 识别 ### 子标题
      const subHeading = line.match(/^###\s*(功能需求|性能要求|采购建议|风险评估|功能|性能|采购|风险)\s*$/);
      if (subHeading) {
        const name = subHeading[1];
        if (name.startsWith("功能")) currentSubGroup = "function";
        else if (name.startsWith("性能")) currentSubGroup = "performance";
        else if (name.startsWith("采购")) currentSubGroup = "procurement";
        else if (name.startsWith("风险")) currentSubGroup = "risk";
        continue;
      }

      // 收集子标题下的条目
      if (currentSubGroup) {
        const item = parseBulletItem(line);
        if (!item) continue;
        if (currentSubGroup === "function") functionItems.push(item);
        else if (currentSubGroup === "performance") performanceItems.push(item);
        else if (currentSubGroup === "procurement") procurementItems.push(item);
        else if (currentSubGroup === "risk") riskItems.push(item);
      }
    }

    // 映射到标准字段
    if (functionItems.length > 0) {
      result.coreAdvantages.push(`功能需求：${functionItems.join("；")}`);
    }
    if (performanceItems.length > 0) {
      result.coreAdvantages.push(`性能要求：${performanceItems.join("；")}`);
    }
    if (procurementItems.length > 0) {
      result.judgementBasis.push(`采购建议：${procurementItems.join("；")}`);
    }
    if (riskItems.length > 0) {
      result.mainRisks.push(...riskItems);
    }

    return result;
  }

  // 处理标准情报机分组格式
  let currentGroup: "advantages" | "risks" | "basis" | undefined;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // 分组头识别
    const header = line.match(/^(初步结论|核心优势|主要风险|判定依据|建议零售价区间|成本区间[（(]页面标价估算[)）]?|推荐主攻平台)\s*[:：]\s*(.*)$/);
    if (header) {
      const key = header[1];
      const rest = header[2].trim();
      if (key === "初步结论") {
        result.initialConclusion = rest || undefined;
        currentGroup = undefined;
      } else if (key === "核心优势") {
        currentGroup = "advantages";
        if (rest) result.coreAdvantages.push(rest);
      } else if (key === "主要风险") {
        currentGroup = "risks";
        if (rest) result.mainRisks.push(rest);
      } else if (key === "判定依据") {
        currentGroup = "basis";
        if (rest) result.judgementBasis.push(rest);
      } else if (key === "建议零售价区间") {
        result.suggestedPriceRange = rest || undefined;
        currentGroup = undefined;
      } else if (key.startsWith("成本区间")) {
        result.costRangeEstimate = rest || undefined;
        currentGroup = undefined;
      } else if (key === "推荐主攻平台") {
        result.recommendedPlatforms = rest || undefined;
        currentGroup = undefined;
      }
      continue;
    }
    // 分组内容：识别为 "xxx——xxx"（em 破折号）或 "xxx：xxx"（判定依据子项）或 "- xxx"（列表）
    if (currentGroup === "advantages") {
      const item = parseBulletItem(line);
      if (item) result.coreAdvantages.push(item);
    } else if (currentGroup === "risks") {
      const item = parseBulletItem(line);
      if (item) result.mainRisks.push(item);
    } else if (currentGroup === "basis") {
      const item = parseBulletItem(line);
      if (item) result.judgementBasis.push(item);
    }
  }

  return result;
}

/** 把 "痛点真实——xxxx" / "≥3信号源：xxx" / "- xxx" 等格式，统一提取出描述文本 */
function parseBulletItem(line: string): string | undefined {
  const trimmed = line.trim()
    .replace(/^[\s\-*\u2022•]+/, "")  // 去掉 bullet 前缀 - * •
    .trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function parseProcurementDecision(lines: string[], recordConflict: ConflictRecorder) {
  const fields = fieldsIn(lines, recordConflict);
  const confirmation = field(fields, "必须确认");
  const sampling = field(fields, "打样重点");
  const inspection = field(fields, "验货重点");
  const variables = field(fields, "影响报价和质量的关键变量");
  const recommendation = field(fields, "是否值得继续");
  const nextStep = field(fields, "下一步行动");
  return {
    summary: [labelValue("影响报价和质量的关键变量", variables), labelValue("必须确认", confirmation)].filter(isDefined).join("；") || undefined,
    recommendation,
    rationale: [
      labelValue("打样重点", sampling),
      labelValue("验货重点", inspection),
      labelValue("下一步行动", nextStep)
    ].filter(isDefined).join("；") || undefined,
    status: decisionStatus(recommendation)
  };
}

// ====================================================================
// 市场与竞争 / 用户与需求（情报机每日情报表专用章节）
// ====================================================================

type SignalCompetitionResult = {
  competitiveLandscape?: CompetitiveLandscape;
  marketOverview?: MarketOverview;
  negativesFromReviews: string[];
};

/**
 * 解析"市场与竞争"章节：
 *   搜索热度：淘宝"衣柜分层隔板"月销量数万件；...
 *   淘宝TOP3竞品：
 *   百荷家居生活馆 | 衣柜隔板置物架 | 售价¥36.90 | 月销3000+ | 主打免打孔、可伸缩
 *   ...
 *   差异化空间：现有产品普遍反馈"粘得不稳会掉"；可针对这些痛点做升级款
 *   差评/退货分析：竞品差评集中在"掉了""不稳""承重差"等方面
 */
function parseMarketAndCompetition(lines: string[]): SignalCompetitionResult {
  const fields = fieldsIn(lines, () => {});
  const result: SignalCompetitionResult = { negativesFromReviews: [] };

  // ① 搜索热度 → marketOverview.marketSize / marketSentiment
  const searchHeat = field(fields, "搜索热度");
  if (searchHeat) {
    result.marketOverview = { marketSize: searchHeat };
  }

  // ② 淘宝TOP3竞品 → competitiveLandscape.topBrandRanking（把管道分隔的行解析成表格）
  const topCompetitorsTable = extractPipeDelimitedTable(
    lines,
    "淘宝TOP3竞品",
    ["店铺/品牌", "产品名", "售价", "月销", "核心卖点"]
  );
  if (topCompetitorsTable) {
    result.competitiveLandscape = { topBrandRanking: topCompetitorsTable };
  }

  // ③ 差异化空间 → competitiveLandscape.strategyDifferences
  const differentiation = field(fields, "差异化空间") ?? field(fields, "差异化定位");
  if (differentiation) {
    result.competitiveLandscape = {
      ...result.competitiveLandscape,
      strategyDifferences: differentiation
    };
  }

  // ④ 差评/退货分析 → negativesFromReviews（追加到 risks.other）
  const reviewNeg = field(fields, "差评/退货分析") ?? field(fields, "差评分析") ?? field(fields, "退货分析");
  if (reviewNeg) {
    result.negativesFromReviews = values(reviewNeg);
  }

  return result;
}

type SignalUsersResult = {
  userInsights?: UserInsights;
  painPoints: string[];
};

/**
 * 解析"用户与需求"章节：
 *   用户画像：租房青年、老旧小区住户...
 *   痛点描述：衣柜上层空荡荡、下层挤爆炸；...
 *   需求强度：重要性8/10 × 不满足度9/10 = 7.2分
 */
function parseUsersAndNeeds(lines: string[]): SignalUsersResult {
  const fields = fieldsIn(lines, () => {});
  const result: SignalUsersResult = { painPoints: [] };
  const ui: UserInsights = {};

  // 用户画像 → 拼成表格行的 ResearchTable（若有多个画像）
  const persona = field(fields, "用户画像");
  if (persona) {
    ui.personas = {
      headers: ["人群", "核心特征"],
      rows: [{ "人群": persona, "核心特征": persona }]
    };
  }

  // 痛点描述 → painPoints + purchasePriorities（作为购买决策痛点的反向输入）
  const pain = field(fields, "痛点描述");
  if (pain) {
    result.painPoints = values(pain);
    if (result.painPoints.length > 0) {
      ui.purchasePriorities = [...result.painPoints];
    }
  }

  // 需求强度 → 写入 userInsights 的一个 key-value（塞进 coreMetrics 表格）
  const demand = field(fields, "需求强度");
  if (demand) {
    ui.coreMetrics = {
      headers: ["指标", "数值"],
      rows: [{ "指标": "需求强度", "数值": demand }]
    };
  }

  if (Object.keys(ui).length > 0) result.userInsights = ui;
  return result;
}

/**
 * 从形如：
 *   淘宝TOP3竞品：
 *   百荷家居生活馆 | 衣柜隔板置物架宽可伸缩柜内分层架 | 售价¥36.90 | 月销3000+ | 主打免打孔、可伸缩
 *   伊思家旗舰店 | 衣柜隔板置物架... | 售价¥36.90 | 月销3000+ | 同款不同店
 *   爱家收纳 | 衣柜分层架... | 售价¥16.76 | 月销200+ | 低价款
 * 这样的内容中，提取管道（|）分隔的行，组装成 ResearchTable。
 * headerNames 是期望的列名。
 */
function extractPipeDelimitedTable(
  lines: string[],
  triggerHeaderKey: string,
  headerNames: string[]
): ResearchTable | undefined {
  // 找到 "淘宝TOP3竞品：" 所在的行号
  let triggerIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith(triggerHeaderKey)) {
      triggerIdx = i;
      break;
    }
  }
  if (triggerIdx < 0) return undefined;

  // 从下一行开始，扫描所有包含 "|" 的非表格（非 |---|）行
  const rows: Array<Record<string, string>> = [];
  for (let i = triggerIdx + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    // 如果碰到下一个章节标题（或 key：value 头）停止
    if (/^[\u4e00-\u9fa5A-Za-z]{2,12}\s*[:：]/.test(line) && !line.includes("|")) break;
    if (line.match(/^\s*\|/)) continue; // 跳过真正的 Markdown 表格
    if (!line.includes("|")) continue;
    // 是 "店铺 | 产品 | 售价 | 月销 | 卖点" 这种管道行
    const cells = line.split(/[｜|]/).map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 2) continue;
    const row: Record<string, string> = {};
    headerNames.forEach((name, idx) => {
      row[name] = cells[idx] ?? "";
    });
    rows.push(row);
  }
  if (rows.length === 0) return undefined;
  return { headers: headerNames, rows };
}

function firstTable(lines: string[], recordConflict: ConflictRecorder): MarkdownTable {
  for (let start = 0; start < lines.length - 1; start += 1) {
    if (!lines[start].trim().startsWith("|") || !isTableDivider(lines[start + 1])) continue;
    const headers = tableCells(lines[start]);
    const rows: TableRow[] = [];
    const invalidRows: TableRow[] = [];
    const duplicateHeaders = new Map<string, { label: string; values: string[] }>();
    headers.forEach((header) => {
      const key = normalizeHeader(header);
      const entry = duplicateHeaders.get(key) ?? { label: header, values: [] };
      duplicateHeaders.set(key, entry);
    });
    const repeatedHeaderKeys = new Set(headers.map(normalizeHeader).filter((header, index, all) => all.indexOf(header) !== index));

    for (let index = start + 2; index < lines.length && lines[index].trim().startsWith("|"); index += 1) {
      const cells = tableCells(lines[index]);
      if (cells.length !== headers.length) {
        invalidRows.push({ values: {}, cells, raw: lines[index] });
        continue;
      }
      const row: MarkdownRow = {};
      const rowDuplicateValues = new Map<string, string[]>();
      headers.forEach((header, cellIndex) => {
        const key = normalizeHeader(header);
        if (row[key] === undefined) row[key] = cells[cellIndex];
        if (repeatedHeaderKeys.has(key)) {
          const candidates = rowDuplicateValues.get(key) ?? [];
          if (!candidates.includes(cells[cellIndex])) candidates.push(cells[cellIndex]);
          rowDuplicateValues.set(key, candidates);
        }
      });
      rowDuplicateValues.forEach((candidates, key) => {
        if (candidates.length < 2) return;
        const entry = duplicateHeaders.get(key);
        candidates.forEach((candidate) => {
          if (entry && !entry.values.includes(candidate)) entry.values.push(candidate);
        });
      });
      rows.push({ values: row, cells, raw: lines[index] });
    }
    repeatedHeaderKeys.forEach((key) => {
      const entry = duplicateHeaders.get(key);
      if (entry && entry.values.length > 1) recordConflict(`表头${entry.label}`, entry.values);
    });
    return { headers, rows, invalidRows };
  }
  return { headers: [], rows: [], invalidRows: [] };
}

function isTableDivider(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function column(row: MarkdownRow, name: string): string | undefined {
  const value = row[normalizeHeader(name)];
  return value && value !== "待确认" ? value : undefined;
}

function normalizeHeader(value: string): string {
  return value.replace(/[\s：:]/g, "").trim();
}

function values(value: string | undefined): string[] {
  return value ? value.split(/[；;、，,\n]/).map((item) => item.trim()).filter(Boolean) : [];
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function numberValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const matched = value.match(/-?\d[\d,]*(?:\.\d+)?/);
  return matched ? Number(matched[0].replace(/,/g, "")) : undefined;
}

function included(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  if (["否", "不计入", "false"].includes(value.toLowerCase())) return false;
  if (["是", "计入", "true"].includes(value.toLowerCase())) return true;
  return undefined;
}

function sameAmount(left: number, right: number, tolerance = 0.000001): boolean {
  return Math.abs(left - right) <= tolerance;
}

function sameSpecification(left: ProductSpecification, right: ProductSpecification): boolean {
  return left.value === right.value && left.unit === right.unit;
}

function specificationCandidate(specification: ProductSpecification): string {
  return specification.unit ? `${specification.value} ${specification.unit}` : specification.value;
}

function missingHeadersFrom(headers: string[], requiredHeaders: string[]): string[] {
  const normalizedHeaders = new Set(headers.map(normalizeHeader));
  return requiredHeaders.filter((header) => !normalizedHeaders.has(normalizeHeader(header)));
}

function valueFromCells(headers: string[], cells: string[], header: string): string | undefined {
  const index = headers.findIndex((candidate) => normalizeHeader(candidate) === normalizeHeader(header));
  return index >= 0 ? cells[index] : undefined;
}

function hasContent(cells: string[]): boolean {
  return cells.some((cell) => cell.trim() && cell.trim() !== "待确认");
}

function labelValue(label: string, value: string | undefined): string | undefined {
  return value ? `${label}：${value}` : undefined;
}

function decisionStatus(value: string | undefined): ProductKnowledgeV2["decision"]["status"] {
  if (!value) return "undecided";
  if (value.includes("待") || value.includes("HOLD") || value.includes("观察") || value.includes("hold")) return "hold";
  if (value.includes("否") || value.includes("不值得") || value.includes("REJECT") || value.includes("NO") || value.includes("淘汰") || value.includes("reject")) return "reject";
  if (
    value.includes("是") || value.includes("继续") ||
    value === "GO" || value.toUpperCase() === "GO" || value.includes("GO") ||
    value.includes("PROCEED") || value.includes("proceed") ||
    value.includes("推进") || value.includes("建议做")
  ) return "proceed";
  return "undecided";
}

function buildRawDocument(
  rawText: string,
  source: ProductResearchSource,
  fieldConflicts: Record<string, string[]>,
  invalidRows: InvalidRow[]
): ProductResearchDocument {
  const rawData = {
    ...(Object.keys(fieldConflicts).length > 0 ? { fieldConflicts } : {}),
    ...(invalidRows.length > 0 ? { invalidRows } : {})
  };
  return {
    ...(source.fileName ? { sourceName: source.fileName } : {}),
    ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
    content: rawText,
    ...(source.importedAt ? { capturedAt: source.importedAt } : {}),
    ...(Object.keys(rawData).length > 0 ? { rawData } : {})
  };
}

function toProductModelIssues(issues: ProductImportIssue[]): ProductModelImportIssue[] {
  return issues.map((issue) => ({ field: issue.section, message: issue.message, severity: issue.severity }));
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

// ====================================================================
// 品类调研报告扩展：数字编号章节解析（与 splitSections 并行的新逻辑）
// ====================================================================

/**
 * 识别 `1. 行业概览` / `1.1 市场规模` 这种数字编号格式的章节，
 * 返回 Map<sectionNumber, { title, subSections, lines }>。
 *
 * - 大章节标题：`^(\d+)\.\s+(.+)` 例如 `1. 行业概览与市场机会`
 * - 子章节标题：`^(\d+)\.(\d+)\s+(.+)` 例如 `1.1 市场规模与增长趋势`
 *
 * subSections 的 key 是子章节编号（如 "1.1"），value 是该子章节的所有行
 * （首行是子章节标题行，后续行是内容，包含表格、字段等）。
 * lines 是直接挂在大章节下、不属于任何子章节的内容行。
 */
function splitNumberedSections(rawText: string): NumberedSectionMap {
  const sections: NumberedSectionMap = new Map();
  const ensureSection = (number: string): NumberedSection => {
    let section = sections.get(number);
    if (!section) {
      section = { title: "", subSections: new Map(), lines: [] };
      sections.set(number, section);
    }
    return section;
  };

  const lines = rawText.replace(/\r\n/g, "\n").split("\n");

  // Check what kind of document we're dealing with
  const hasHeadingSections = lines.some((line) => /^#+\s*\d+\.\d*\s+/.test(line));
  const hasNumberedOnly = lines.some((line) => /^(\d+)\.\s+/.test(line.trim().replace(/^#+\s*/, "")));
  const hasHeadingNoNumber = lines.some((line) => /^##+\s+(?!\d+\.\d*)/.test(line));

  let currentSectionNumber: string | undefined;
  let currentSubsectionNumber: string | undefined;

  // Strategy: if document has numbered headings (with or without #), use numbered parsing
  if (hasHeadingSections || hasNumberedOnly) {
    const allowBareNumbered = !hasHeadingSections;

    lines.forEach((line) => {
      const trimmed = line.trim();
      const isHeading = /^#+\s*\d+\.\d*\s+/.test(trimmed);
      const normalizedLine = trimmed.replace(/^#+\s*/, "").trim();

      const subMatch = normalizedLine.match(/^(\d+)\.(\d+)\s+(.+?)\s*$/);
      if (subMatch && (allowBareNumbered || isHeading)) {
        const [, main, sub, title] = subMatch;
        const subNumber = `${main}.${sub}`;
        const section = ensureSection(main);
        section.subSections.set(subNumber, [`${subNumber} ${title.trim()}`]);
        currentSectionNumber = main;
        currentSubsectionNumber = subNumber;
        return;
      }

      const mainMatch = normalizedLine.match(/^(\d+)\.\s+(.+?)\s*$/);
      if (mainMatch && (allowBareNumbered || isHeading)) {
        const [, number, title] = mainMatch;
        const section = ensureSection(number);
        if (!section.title) section.title = title.trim();
        currentSectionNumber = number;
        currentSubsectionNumber = undefined;
        return;
      }

      if (!currentSectionNumber) return;
      const section = sections.get(currentSectionNumber);
      if (!section) return;
      if (currentSubsectionNumber) {
        section.subSections.get(currentSubsectionNumber)?.push(line);
      } else {
        section.lines.push(line);
      }
    });
  } else if (hasHeadingNoNumber) {
    // Strategy: document uses standard Markdown headings without numbers
    // Assign synthetic section numbers based on heading order
    let sectionCounter = 0;
    let subCounter = 0;

    lines.forEach((line) => {
      const trimmed = line.trim();
      const headingMatch = trimmed.match(/^(#{2,3})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length; // ## = 2, ### = 3
        const title = headingMatch[2].trim();

        if (level === 2) {
          sectionCounter++;
          currentSectionNumber = String(sectionCounter);
          currentSubsectionNumber = undefined;
          const section = ensureSection(currentSectionNumber);
          if (!section.title) section.title = title;
          subCounter = 0;
        } else if (level === 3 && currentSectionNumber) {
          subCounter++;
          currentSubsectionNumber = `${currentSectionNumber}.${subCounter}`;
          const section = ensureSection(currentSectionNumber);
          section.subSections.set(currentSubsectionNumber, [title]);
        }
        return;
      }

      if (!currentSectionNumber) return;
      const section = sections.get(currentSectionNumber);
      if (!section) return;
      if (currentSubsectionNumber) {
        section.subSections.get(currentSubsectionNumber)?.push(line);
      } else {
        section.lines.push(line);
      }
    });
  }

  return sections;
}

/**
 * 根据章节标题关键词判断该章节属于哪一组扩展字段。
 * 返回 undefined 表示无法归类。
 */
function classifySection(title: string): ResearchSectionKind | undefined {
  const keywordGroups: Array<{ kind: ResearchSectionKind; keywords: string[] }> = [
    {
      kind: "marketOverview",
      keywords: ["行业概览", "市场规模", "市场机会", "PESTEL", "进入门槛", "pestel"]
    },
    {
      kind: "competitiveLandscape",
      keywords: ["竞争格局", "头部玩家", "头部品牌", "波特五力", "市占率", "份额排名", "CR5", "cr5"]
    },
    {
      kind: "productBenchmark",
      keywords: ["产品竞争", "差异化", "天猫", "排行榜", "对标", "价格分层", "形态对比"]
    },
    {
      kind: "userInsights",
      keywords: ["用户需求", "用户画像", "痛点", "差评", "好评", "购买决策"]
    },
    {
      kind: "supplyChainFindings",
      keywords: ["供应链", "寻源", "1688", "供应商", "批发价", "价差", "一件代发"]
    },
    {
      kind: "decision",
      keywords: ["结论", "建议"]
    }
  ];
  for (const { kind, keywords } of keywordGroups) {
    if (keywords.some((keyword) => title.includes(keyword))) return kind;
  }
  return undefined;
}

/**
 * 把现有的 firstTable 输出转换为 ResearchTable 格式。
 * 返回 undefined 表示没有可识别的表格。
 */
function extractResearchTable(lines: string[]): ResearchTable | undefined {
  const noop: ConflictRecorder = () => {};
  const table = firstTable(lines, noop);
  if (table.headers.length === 0 && table.rows.length === 0) return undefined;
  return {
    headers: table.headers,
    rows: table.rows.map(({ values }) => values)
  };
}

/**
 * 主入口：解析品类调研报告（数字编号格式）的扩展字段。
 * 与原有 splitSections 逻辑并行，不互斥，识别到任意一组数据即返回。
 */
function parseCategoryResearchFields(rawText: string): CategoryResearchFields {
  const sections = splitNumberedSections(rawText);
  const fields: CategoryResearchFields = {};
  const ensureMarketOverview = () => (fields.marketOverview ??= {});
  const ensureCompetitiveLandscape = () => (fields.competitiveLandscape ??= {});
  const ensureProductBenchmark = () => (fields.productBenchmark ??= {});
  const ensureUserInsights = () => (fields.userInsights ??= {});
  const ensureSupplyChainFindings = () => (fields.supplyChainFindings ??= {});

  // 把每个大章节拆成多个"块"（直接行 + 各子章节），分别处理
  const blocks: Array<{ title: string; lines: string[]; sectionTitle: string }> = [];
  for (const [, section] of sections) {
    if (section.lines.length > 0) {
      blocks.push({ title: section.title, lines: section.lines, sectionTitle: section.title });
    }
    for (const [, subLines] of section.subSections) {
      // subLines[0] 形如 "1.1 市场规模与增长趋势"
      const titleLine = subLines[0] ?? "";
      const subTitle = titleLine.replace(/^\d+\.\d+\s+/, "").trim();
      blocks.push({ title: subTitle, lines: subLines.slice(1), sectionTitle: section.title });
    }
  }

  for (const block of blocks) {
    const kind = classifySection(block.sectionTitle) ?? classifySection(block.title);
    if (!kind || kind === "decision") continue;

    handleResearchBlock(block, kind, {
      ensureMarketOverview,
      ensureCompetitiveLandscape,
      ensureProductBenchmark,
      ensureUserInsights,
      ensureSupplyChainFindings
    });
  }

  // 清理空对象（仅保留有内容的字段组）
  return pruneEmptyFields(fields);
}

type ResearchBlockHandlers = {
  ensureMarketOverview: () => MarketOverview;
  ensureCompetitiveLandscape: () => CompetitiveLandscape;
  ensureProductBenchmark: () => ProductBenchmark;
  ensureUserInsights: () => UserInsights;
  ensureSupplyChainFindings: () => SupplyChainFindings;
};

function handleResearchBlock(
  block: { title: string; lines: string[] },
  kind: ResearchSectionKind,
  handlers: ResearchBlockHandlers
) {
  const subTitle = block.title;
  const lines = block.lines;

  // ① 特殊结构提取（优先匹配关键词，命中后不再走默认表格逻辑）
  if (subTitle.includes("PESTEL") || subTitle.includes("PEST")) {
    const pestel = extractPestelArray(lines);
    if (pestel.length > 0) {
      handlers.ensureMarketOverview().pestel = pestel;
    }
    return;
  }
  if (subTitle.includes("波特五力") || subTitle.includes("五力")) {
    const forces = extractPorterFiveForces(lines);
    if (forces.length > 0) {
      handlers.ensureCompetitiveLandscape().porterFiveForces = forces;
    }
    return;
  }
  if (subTitle.includes("进入门槛") || subTitle.includes("进入壁垒") || subTitle.includes("门槛分析") || subTitle.includes("壁垒分析")) {
    const barriers = extractEntryBarriers(lines);
    if (barriers.length > 0) {
      handlers.ensureMarketOverview().entryBarriers = barriers;
    }
    return;
  }
  if (subTitle.includes("购买决策") || subTitle.includes("购买优先") || subTitle.includes("决策因素")) {
    const priorities = extractListItems(lines);
    if (priorities.length > 0) {
      handlers.ensureUserInsights().purchasePriorities = priorities;
    }
    return;
  }
  if (
    subTitle.includes("执行路径")
    || subTitle.includes("寻源步骤")
    || subTitle.includes("寻源路径")
    || subTitle.includes("落地步骤")
  ) {
    const steps = extractListItems(lines);
    if (steps.length > 0) {
      handlers.ensureSupplyChainFindings().sourcingPathSteps = steps;
    }
    return;
  }
  if (subTitle.includes("好评") || subTitle.includes("好评点")) {
    const praises = extractListItems(lines);
    if (praises.length > 0) {
      handlers.ensureUserInsights().praisePoints = praises;
    }
    return;
  }

  // ② 默认表格/字段提取：按章节类型把第一个表格塞到合适的槽位
  const table = extractResearchTable(lines);
  const directFields = fieldsIn(lines, () => {});

  if (kind === "marketOverview") {
    const mo = handlers.ensureMarketOverview();
    if (!mo.marketSize) {
      const marketSize = field(directFields, "市场规模") ?? field(directFields, "整体规模");
      if (marketSize) mo.marketSize = marketSize;
    }
    if (!mo.yoyGrowth) {
      const yoy = field(directFields, "同比增长") ?? field(directFields, "同比增长率") ?? field(directFields, "YoY");
      if (yoy) mo.yoyGrowth = yoy;
    }
    if (!mo.subCategoryTrend) {
      const trend = field(directFields, "细分趋势") ?? field(directFields, "子品类趋势");
      if (trend) mo.subCategoryTrend = trend;
    }
    if (table) {
      if (subTitle.includes("细分") || subTitle.includes("结构")) {
        if (!mo.segmentStructure) mo.segmentStructure = table;
      } else if (!mo.marketSizeTable) {
        mo.marketSizeTable = table;
      } else if (!mo.segmentStructure) {
        mo.segmentStructure = table;
      }
    }
    return;
  }

  if (kind === "competitiveLandscape") {
    const cl = handlers.ensureCompetitiveLandscape();
    if (!cl.cr5) {
      const cr5 = field(directFields, "CR5") ?? field(directFields, "cr5") ?? field(directFields, "前五市占率");
      if (cr5) cl.cr5 = cr5;
    }
    if (!cl.strategyDifferences) {
      const strategy = field(directFields, "策略差异") ?? field(directFields, "战略差异");
      if (strategy) cl.strategyDifferences = strategy;
    }
    if (table) {
      if (subTitle.includes("分类") || subTitle.includes("分品类")) {
        if (!cl.brandRankingByCategory) cl.brandRankingByCategory = table;
      } else if (!cl.topBrandRanking) {
        cl.topBrandRanking = table;
      } else if (!cl.brandRankingByCategory) {
        cl.brandRankingByCategory = table;
      }
    }
    return;
  }

  if (kind === "productBenchmark") {
    const pb = handlers.ensureProductBenchmark();
    if (!pb.keyFindings) {
      const findings = field(directFields, "关键发现") ?? field(directFields, "核心发现");
      if (findings) pb.keyFindings = findings;
    }
    if (table) {
      if (subTitle.includes("膜") && !subTitle.includes("板")) {
        if (!pb.tmallProtectiveFilm) pb.tmallProtectiveFilm = table;
      } else if (subTitle.includes("板")) {
        if (!pb.tmallHangingBoard) pb.tmallHangingBoard = table;
      } else if (subTitle.includes("形态")) {
        if (!pb.formComparison) pb.formComparison = table;
      } else if (subTitle.includes("价格分层") || subTitle.includes("价格")) {
        if (!pb.priceTiers) pb.priceTiers = table;
      } else if (!pb.tmallProtectiveFilm) {
        pb.tmallProtectiveFilm = table;
      } else if (!pb.tmallHangingBoard) {
        pb.tmallHangingBoard = table;
      } else if (!pb.formComparison) {
        pb.formComparison = table;
      } else if (!pb.priceTiers) {
        pb.priceTiers = table;
      }
    }
    return;
  }

  if (kind === "userInsights") {
    const ui = handlers.ensureUserInsights();
    if (table) {
      if (subTitle.includes("画像")) {
        if (!ui.personas) ui.personas = table;
      } else if (subTitle.includes("核心指标") || subTitle.includes("关键指标")) {
        if (!ui.coreMetrics) ui.coreMetrics = table;
      } else if (subTitle.includes("差评") || subTitle.includes("投诉")) {
        if (!ui.complaints) ui.complaints = table;
      } else if (!ui.personas) {
        ui.personas = table;
      } else if (!ui.coreMetrics) {
        ui.coreMetrics = table;
      } else if (!ui.complaints) {
        ui.complaints = table;
      }
    }
    return;
  }

  if (kind === "supplyChainFindings") {
    const sc = handlers.ensureSupplyChainFindings();
    if (!sc.comboSupply) {
      const combo = field(directFields, "组合供应") ?? field(directFields, "一件代发");
      if (combo) sc.comboSupply = combo;
    }
    if (table) {
      const tableText = (table.headers?.join(" ") ?? "") + " " + (table.rows?.flat().join(" ") ?? "");
      const surroundingText = lines.filter(l => !l.trim().startsWith("|")).join(" ");
      const combinedText = tableText + " " + surroundingText;
      const isBoardTable = combinedText.includes("挂板") || combinedText.includes("挂式") || combinedText.includes("亚克力");
      const isFilmTable = combinedText.includes("贴膜") || (combinedText.includes("膜") && !isBoardTable);

      if (subTitle.includes("价格") || subTitle.includes("梯度")) {
        if (isBoardTable) {
          if (!sc.priceGradientBoard) sc.priceGradientBoard = table;
        } else if (isFilmTable) {
          if (!sc.priceGradientFilm) sc.priceGradientFilm = table;
        } else if (!sc.priceGradientFilm) {
          sc.priceGradientFilm = table;
        } else if (!sc.priceGradientBoard) {
          sc.priceGradientBoard = table;
        }
      } else if (subTitle.includes("建议")) {
        if (!sc.sourcingAdvice) sc.sourcingAdvice = table;
      } else if (subTitle.includes("核心指标") || subTitle.includes("关键指标")) {
        if (!sc.coreMetrics) sc.coreMetrics = table;
      } else if (subTitle.includes("膜") && !subTitle.includes("板")) {
        if (!sc.filmSuppliers) sc.filmSuppliers = table;
        else if (!sc.boardSuppliers) sc.boardSuppliers = table;
      } else if (subTitle.includes("板") || isBoardTable) {
        if (!sc.boardSuppliers) sc.boardSuppliers = table;
        else if (!sc.priceGradientBoard) sc.priceGradientBoard = table;
        else if (!sc.filmSuppliers) sc.filmSuppliers = table;
      } else if (isFilmTable) {
        if (!sc.filmSuppliers) sc.filmSuppliers = table;
        else if (!sc.boardSuppliers) sc.boardSuppliers = table;
      } else if (!sc.filmSuppliers) {
        sc.filmSuppliers = table;
      } else if (!sc.boardSuppliers) {
        sc.boardSuppliers = table;
      } else if (!sc.priceGradientFilm) {
        sc.priceGradientFilm = table;
      } else if (!sc.priceGradientBoard) {
        sc.priceGradientBoard = table;
      } else if (!sc.sourcingAdvice) {
        sc.sourcingAdvice = table;
      }
    }
    return;
  }
}

/** PESTEL 表格 → pestel 数组（dimension / factor / impact） */
function extractPestelArray(lines: string[]): Array<{ dimension: string; factor: string; impact: string }> {
  const noop: ConflictRecorder = () => {};
  const table = firstTable(lines, noop);
  return table.rows
    .map(({ values: row }) => {
      const dimension = column(row, "维度") ?? column(row, "Dimension") ?? column(row, "PESTEL") ?? "";
      const factor = column(row, "因素") ?? column(row, "Factor") ?? column(row, "关键因素") ?? "";
      const impact = column(row, "影响") ?? column(row, "Impact") ?? column(row, "影响分析") ?? "";
      if (!dimension && !factor && !impact) return undefined;
      return { dimension, factor, impact };
    })
    .filter(isDefined);
}

/** 波特五力表格 → porterFiveForces 数组（force / strength / basis） */
function extractPorterFiveForces(
  lines: string[]
): Array<{ force: string; strength: string; basis: string }> {
  const noop: ConflictRecorder = () => {};
  const table = firstTable(lines, noop);
  return table.rows
    .map(({ values: row }) => {
      const force = column(row, "五力") ?? column(row, "Force") ?? column(row, "竞争力量") ?? column(row, "力量") ?? "";
      const strength = column(row, "强度") ?? column(row, "Strength") ?? column(row, "力量强度") ?? "";
      const basis = column(row, "依据") ?? column(row, "Basis") ?? column(row, "分析依据") ?? column(row, "理由") ?? "";
      if (!force && !strength && !basis) return undefined;
      return { force, strength, basis };
    })
    .filter(isDefined);
}

/** 进入门槛表格 → entryBarriers 数组（name / level / analysis） */
function extractEntryBarriers(
  lines: string[]
): Array<{ name: string; level: string; analysis: string }> {
  const noop: ConflictRecorder = () => {};
  const table = firstTable(lines, noop);
  return table.rows
    .map(({ values: row }) => {
      const name = column(row, "名称") ?? column(row, "Name") ?? column(row, "门槛") ?? column(row, "壁垒") ?? column(row, "门槛维度") ?? column(row, "维度") ?? "";
      const level = column(row, "等级") ?? column(row, "Level") ?? column(row, "强度") ?? column(row, "门槛高度") ?? column(row, "高低") ?? column(row, "级别") ?? "";
      const analysis = column(row, "分析") ?? column(row, "Analysis") ?? column(row, "说明") ?? column(row, "解读") ?? "";
      if (!name && !level && !analysis) return undefined;
      return { name, level, analysis };
    })
    .filter(isDefined);
}

/**
 * 把段落里的列表项（`- xxx` / `1. xxx` / `1) xxx` / `1、xxx`）抽出来。
 * 用于 purchasePriorities、sourcingPathSteps、praisePoints 等字符串数组字段。
 */
function extractListItems(lines: string[]): string[] {
  const items: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("|")) continue;
    const match = trimmed.match(/^[-•]\s+(.+)$/) ?? trimmed.match(/^\d+[.)、]\s+(.+)$/);
    if (match) {
      const value = match[1].trim();
      if (value && !items.includes(value)) items.push(value);
    }
  }
  return items;
}

/** 清理：仅保留至少有一个非空字段的扩展组，避免产出空对象 */
function pruneEmptyFields(fields: CategoryResearchFields): CategoryResearchFields {
  const result: CategoryResearchFields = {};
  if (fields.marketOverview && hasAnyFieldValue(fields.marketOverview)) {
    result.marketOverview = fields.marketOverview;
  }
  if (fields.competitiveLandscape && hasAnyFieldValue(fields.competitiveLandscape)) {
    result.competitiveLandscape = fields.competitiveLandscape;
  }
  if (fields.productBenchmark && hasAnyFieldValue(fields.productBenchmark)) {
    result.productBenchmark = fields.productBenchmark;
  }
  if (fields.userInsights && hasAnyFieldValue(fields.userInsights)) {
    result.userInsights = fields.userInsights;
  }
  if (fields.supplyChainFindings && hasAnyFieldValue(fields.supplyChainFindings)) {
    result.supplyChainFindings = fields.supplyChainFindings;
  }
  return result;
}

function hasAnyFieldValue(value: Record<string, unknown>): boolean {
  return Object.values(value).some((v) => {
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length > 0;
    return Boolean(v);
  });
}
