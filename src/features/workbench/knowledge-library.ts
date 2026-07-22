export type KnowledgeBookDraft = {
  title: string;
  author?: string;
  coverImage?: string;
  theme?: string;
  purpose?: string;
  framework?: string;
  businessScenarios: string[];
};

export type DecisionToolDraft = {
  name: string;
  problem?: string;
  triggers: string[];
  diagnosticQuestions: string[];
  actions: string[];
  limitations: string[];
  sourceChapter?: string;
  tags: string[];
  status?: "ready" | "needs_review";
  legacyCardId?: string;
};

export type ParsedBookPackage = {
  book: KnowledgeBookDraft;
  tools: DecisionToolDraft[];
  rawText: string;
};

export type AuditableDecisionTool = DecisionToolDraft & { id?: string };
export type AuditedListField = "triggers" | "diagnosticQuestions" | "actions" | "limitations" | "tags";

export type KnowledgeToolAudit = {
  name: string;
  currentToolId?: string;
  isNewTool: boolean;
  currentCounts: Record<AuditedListField, number>;
  parsedCounts: Record<AuditedListField, number>;
  additions: Record<AuditedListField, string[]>;
  cleanupItemCount: number;
  scalarAdditions: {
    problem?: string;
    sourceChapter?: string;
  };
  sourceInsufficient: boolean;
};

export type KnowledgeBookAudit = {
  status: "recoverable" | "identical" | "source_insufficient";
  currentToolCount: number;
  parsedToolCount: number;
  newToolCount: number;
  recoverableItemCount: number;
  cleanupItemCount: number;
  sourceInsufficientToolNames: string[];
  tools: KnowledgeToolAudit[];
};

const bookFieldLabels = ["书名", "作者", "主题", "主要解决的问题", "全书框架概览", "适合我的业务场景"] as const;
const toolFieldLabels = ["工具名称", "解决的问题", "触发信号", "诊断问题", "行动建议", "不适用情况", "来源章节", "关联标签"] as const;
const auditedListFields: AuditedListField[] = ["triggers", "diagnosticQuestions", "actions", "limitations", "tags"];

type LegacyKnowledgeCardLike = {
  id: string;
  title: string;
  source?: string;
  summary?: string;
  applicableScenarios: string[];
  steps: string[];
  scripts: string[];
  risks: string[];
  tags: string[];
};

export function parseBookPackage(text: string): ParsedBookPackage {
  const rawText = text.trim();
  const bookSection = section(rawText, "书籍");
  const bookFields = parseFields(bookSection, bookFieldLabels);
  const title = bookFields["书名"];
  if (!title) throw new Error("没有识别到书名，请检查【书籍】模块。");

  const toolSections = sections(rawText, "决策工具");
  const tools = toolSections
    .map(parseDecisionTool)
    .filter((tool): tool is DecisionToolDraft => Boolean(tool));
  if (tools.length === 0) throw new Error("没有识别到可用的决策工具。");

  return {
    book: {
      title,
      author: bookFields["作者"],
      theme: bookFields["主题"],
      purpose: bookFields["主要解决的问题"],
      framework: bookFields["全书框架概览"],
      businessScenarios: splitList(bookFields["适合我的业务场景"])
    },
    tools,
    rawText
  };
}

export function auditKnowledgeBookImport(rawText: string, currentTools: AuditableDecisionTool[]): KnowledgeBookAudit {
  const parsed = parseBookPackage(rawText);
  const currentByName = new Map(currentTools.map((tool) => [normalize(tool.name), tool]));
  let recoverableItemCount = 0;
  let cleanupItemCount = 0;
  let newToolCount = 0;

  const tools = parsed.tools.map((parsedTool): KnowledgeToolAudit => {
    const currentTool = currentByName.get(normalize(parsedTool.name));
    const isNewTool = !currentTool;
    if (isNewTool) newToolCount += 1;

    const currentCounts = emptyAuditCounts();
    const parsedCounts = emptyAuditCounts();
    const additions = emptyAuditLists();
    let toolCleanupItemCount = 0;

    auditedListFields.forEach((fieldName) => {
      const currentValues = currentTool?.[fieldName] ?? [];
      const normalizedCurrentValues = currentValues.map(normalizeKnowledgeListItem).filter(Boolean);
      const currentKeys = new Set(normalizedCurrentValues);
      const duplicateCount = normalizedCurrentValues.length - currentKeys.size;
      toolCleanupItemCount += duplicateCount;
      cleanupItemCount += duplicateCount;
      currentCounts[fieldName] = currentValues.length;
      parsedCounts[fieldName] = parsedTool[fieldName].length;
      additions[fieldName] = parsedTool[fieldName].filter((item) => !currentKeys.has(normalizeKnowledgeListItem(item)));
      recoverableItemCount += additions[fieldName].length;
    });

    const scalarAdditions = {
      problem: !currentTool?.problem ? parsedTool.problem : undefined,
      sourceChapter: !currentTool?.sourceChapter ? parsedTool.sourceChapter : undefined
    };
    recoverableItemCount += Number(Boolean(scalarAdditions.problem)) + Number(Boolean(scalarAdditions.sourceChapter));

    return {
      name: parsedTool.name,
      currentToolId: currentTool?.id,
      isNewTool,
      currentCounts,
      parsedCounts,
      additions,
      cleanupItemCount: toolCleanupItemCount,
      scalarAdditions,
      sourceInsufficient: parsedTool.diagnosticQuestions.length < 2 || parsedTool.actions.length < 2
    };
  });

  const sourceInsufficientToolNames = tools.filter((tool) => tool.sourceInsufficient).map((tool) => tool.name);
  const status = recoverableItemCount > 0 || cleanupItemCount > 0
    ? "recoverable"
    : sourceInsufficientToolNames.length > 0
      ? "source_insufficient"
      : "identical";

  return {
    status,
    currentToolCount: currentTools.length,
    parsedToolCount: parsed.tools.length,
    newToolCount,
    recoverableItemCount,
    cleanupItemCount,
    sourceInsufficientToolNames,
    tools
  };
}

export function legacyCardToDecisionTool(card: LegacyKnowledgeCardLike): DecisionToolDraft {
  return {
    name: card.title,
    problem: card.summary,
    triggers: card.applicableScenarios,
    diagnosticQuestions: [],
    actions: card.steps,
    limitations: card.risks,
    tags: card.tags,
    status: "needs_review",
    legacyCardId: card.id
  };
}

export function matchDecisionTools<T extends DecisionToolDraft>(question: string, tools: T[]) {
  const normalizedQuestion = normalize(question);
  if (normalizedQuestion.length < 2) return [];

  return tools
    .map((tool) => {
      const reasons = [...tool.tags, ...tool.triggers]
        .filter((value) => value.length >= 2 && normalizedQuestion.includes(normalize(value)))
        .slice(0, 3);
      const searchable = normalize([
        tool.name,
        tool.problem,
        ...tool.triggers,
        ...tool.diagnosticQuestions,
        ...tool.actions,
        ...tool.tags
      ].filter(Boolean).join(" "));
      const overlap = ngrams(normalizedQuestion).filter((gram) => searchable.includes(gram));
      const score = reasons.length * 12 + new Set(overlap).size;
      return { tool, score, reasons };
    })
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function parseDecisionTool(value: string): DecisionToolDraft | undefined {
  const fields = parseFields(value, toolFieldLabels);
  const name = fields["工具名称"];
  if (!name) return undefined;
  return {
    name,
    problem: fields["解决的问题"],
    triggers: splitList(fields["触发信号"]),
    diagnosticQuestions: splitList(fields["诊断问题"]),
    actions: splitList(fields["行动建议"]),
    limitations: splitList(fields["不适用情况"]),
    sourceChapter: fields["来源章节"],
    tags: splitList(fields["关联标签"]),
    status: "ready"
  };
}

function section(text: string, heading: string) {
  return sections(text, heading)[0] ?? "";
}

function sections(text: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`【${escaped}】([\\s\\S]*?)(?=\\n?【[^】]+】|$)`, "g");
  return [...text.matchAll(pattern)].map((match) => match[1].trim());
}

function parseFields<T extends readonly string[]>(text: string, labels: T) {
  const labelSet = new Set<string>(labels);
  const result: Partial<Record<T[number], string>> = {};
  let currentLabel: T[number] | undefined;

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:：]+?)\s*[:：]\s*(.*)$/);
    const possibleLabel = match?.[1]?.trim();
    if (match && possibleLabel && labelSet.has(possibleLabel)) {
      currentLabel = possibleLabel as T[number];
      const initialValue = match[2].trim();
      if (initialValue) result[currentLabel] = initialValue;
      continue;
    }
    if (!currentLabel || !line.trim()) continue;
    result[currentLabel] = [result[currentLabel], line.trim()].filter(Boolean).join("\n");
  }

  return result;
}

function splitList(value?: string) {
  if (!value) return [];
  return value
    .split(/\n/)
    .flatMap((line) => line
      .replace(/^\s*(?:(?:[-*•·])\s*|(?:\d+)\s*[.、)）:：-]\s*)/, "")
      .split(/[；;、]/))
    .map((item) => item.trim())
    .filter(Boolean);
}

export function canonicalizeKnowledgeListItem(value: string) {
  return value
    .replace(/^\s*(?:(?:[-*•·])\s*|(?:\d+)\s*[.、，:：)]\s*)/, "")
    .trim();
}

export function normalizeKnowledgeListItem(value: string) {
  return canonicalizeKnowledgeListItem(value)
    .toLocaleLowerCase()
    .replace(/[\s，。；;、：:！？!?（）()《》【】]/g, "");
}

function emptyAuditCounts(): Record<AuditedListField, number> {
  return { triggers: 0, diagnosticQuestions: 0, actions: 0, limitations: 0, tags: 0 };
}

function emptyAuditLists(): Record<AuditedListField, string[]> {
  return { triggers: [], diagnosticQuestions: [], actions: [], limitations: [], tags: [] };
}

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[\s，。；;、：:！？!?（）()《》【】]/g, "");
}

function ngrams(value: string) {
  const compact = normalize(value);
  const result: string[] = [];
  for (let index = 0; index < compact.length - 1; index += 1) {
    result.push(compact.slice(index, index + 2));
  }
  return result;
}
