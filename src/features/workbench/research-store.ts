import { randomId } from "@/lib/random-id";
import { loadLocalWorkbenchData, saveLocalWorkbenchData, type ResearchReport } from "./local-store";

// 从 Markdown 原文构造调研报告：提取 H1 作为标题、取首段作为摘要
export function createResearchReportFromMarkdown(markdown: string, options?: { fileName?: string }): ResearchReport {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  // 从H1标题提取报告标题
  let title = "未命名调研报告";
  const h1Line = lines.find(line => /^#\s+/.test(line));
  if (h1Line) {
    const rawTitle = h1Line.replace(/^#\s+/, "").trim();
    // 去掉常见后缀
    const cleaned = rawTitle
      .replace(/\s*[-—–]\s*品类调研.*$/i, "")
      .replace(/\s*[-—–]\s*调研.*$/i, "")
      .replace(/\s*品类调研.*$/i, "")
      .replace(/\s*调研报告\s*$/i, "")
      .replace(/\s*报告\s*$/i, "")
      .trim();
    if (cleaned) title = cleaned;
  }

  // 简单摘要：取第一段非标题非表格的文本
  let summary = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("|") || trimmed.startsWith("-")) continue;
    if (trimmed.length > 20) {
      summary = trimmed.slice(0, 100);
      break;
    }
  }

  const report: ResearchReport = {
    id: randomId(),
    title,
    content: markdown,
    summary,
    source: options?.fileName,
    importedAt: new Date().toISOString(),
    status: "active",
    linkedProductIds: [],
    tags: []
  };

  return report;
}

// 从 Markdown 原文构造并保存调研报告到本地存储
export function saveResearchReportFromMarkdown(markdown: string, options?: { fileName?: string }): ResearchReport {
  const report = createResearchReportFromMarkdown(markdown, options);
  const current = loadLocalWorkbenchData();
  saveLocalWorkbenchData({
    ...current,
    researchReports: [report, ...current.researchReports]
  });
  return report;
}
