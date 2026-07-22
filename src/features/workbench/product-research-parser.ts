import { calculateHardCost } from "@/features/workbench/product-knowledge";
import type {
  ProductCostItem,
  ProductImportIssue as ProductModelImportIssue,
  ProductKnowledgeV2,
  ProductMaterialStructure,
  ProductOptimizationOption,
  ProductProcurementQuote,
  ProductResearchDocument,
  ProductRiskSet,
  ProductSpecification
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
  "决策摘要"
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

  const positioningSection: StandardSection = sections.has("产品与规格") ? "产品与规格" : "产品定位";
  const positioning = fields(positioningSection);
  const name = field(positioning, "产品名称");
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
  const product: ProductKnowledgeV2 = {
    schemaVersion: 2,
    id: `product-research-${fingerprint(rawText)}`,
    name: name ?? "未命名产品",
    category: field(positioning, "产品品类"),
    coreUse: field(positioning, "核心用途"),
    targetUsers: field(positioning, "目标用户"),
    useScenarios: values(field(positioning, "使用场景")),
    defaultUnit: field(positioning, "默认计量单位"),
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
    createdAt: source.importedAt ?? "unknown"
  };

  return { product, issues };
}

function parseProcurementQuotes(lines: string[], recordConflict: ConflictRecorder): ProductProcurementQuote[] {
  return firstTable(lines, recordConflict).rows.map(({ values: row }) => {
    const source = column(row, "来源");
    const specification = column(row, "对应规格");
    const price = column(row, "批发报价");
    if (!source || !specification || !price) return undefined;
    return {
      source,
      specification,
      price,
      moq: column(row, "MOQ"),
      freight: column(row, "运费口径"),
      quotedAt: column(row, "报价时间")
    };
  }).filter(isDefined);
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
    const heading = line.match(/^##\s+(.+?)\s*$/)?.[1].trim();
    if (heading) {
      currentSection = isStandardSection(heading) ? heading : undefined;
      if (currentSection && !sections.has(currentSection)) sections.set(currentSection, []);
      return;
    }
    if (currentSection) sections.get(currentSection)?.push(line);
  });

  return sections;
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
  if (table.rows.length === 0) addIssue("warning", "关键规格", "关键规格表为空，待补资料。");
  const missingHeaders = missingHeadersFrom(table.headers, ["参数", "数值"]);
  if (missingHeaders.length > 0) addIssue("warning", "关键规格", `关键规格表缺少必需列：${missingHeaders.join("、")}。`);
  if (table.invalidRows.length > 0) addIssue("warning", "关键规格", "关键规格表存在列数不匹配的行。");

  const grouped = new Map<string, { name: string; candidates: ProductSpecification[] }>();
  table.rows.forEach(({ values: row }, index) => {
    const name = column(row, "参数");
    const value = column(row, "数值");
    if (!name || !value) {
      const missing = [!name ? "参数" : undefined, !value ? "数值" : undefined].filter(isDefined);
      addIssue("warning", "关键规格", `关键规格第 ${index + 1} 行缺少${missing.join("、")}。`);
      return;
    }
    const key = normalizeHeader(name);
    const candidate: ProductSpecification = {
      id: `spec-${key}`,
      name: name.trim(),
      value,
      unit: column(row, "单位"),
      source: "research"
    };
    const entry = grouped.get(key) ?? { name: candidate.name, candidates: [] };
    if (!entry.candidates.some((existing) => sameSpecification(existing, candidate))) entry.candidates.push(candidate);
    grouped.set(key, entry);
  });

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
  if (value.includes("待")) return "hold";
  if (value.includes("否") || value.includes("不值得")) return "reject";
  if (value.includes("是") || value.includes("继续")) return "proceed";
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
