import { classifyKanoResponse, type KanoCategory } from "@/features/workbench/demand-exploration";
import type { DemandConfirmationDocument, DemandItem } from "@/features/workbench/demand-confirmation";

const categoryLabels: Record<KanoCategory, string> = { A: "魅力", O: "期望", M: "必备", I: "无差异", R: "反向", Q: "待复核" };

export function exportDemandConfirmationMarkdown(document: DemandConfirmationDocument): string {
  const lines = [`# 需求确认文档`, ``, `## 1. 基本信息`, ``, `- 文档名称：${document.title || "未命名"}`, `- 产品/产品族：${document.productName || "未填写"}`, `- 目标用户：${document.userType || "未填写"}`, `- 使用场景：${document.scenario || "未填写"}`, `- 当前问题：${document.problem || "未填写"}`, `- 研究目标：${document.goal || "未填写"}`, `- 需求来源：${document.source || "未填写"}`, ``];
  lines.push(`## 2. 需求结构`, ``);
  for (const section of document.sections) {
    lines.push(`### ${section.name}`, ``);
    for (const item of document.demandItems.filter((candidate) => candidate.sectionId === section.id)) lines.push(`- ${item.subFeature}：${item.needStatement}`);
    lines.push(``);
  }
  lines.push(`## 3. 需求项分析`, ``, `原始回答明细和公式代入如下：`, ``);
  for (const item of document.demandItems) appendItem(lines, item);
  lines.push(`## 4. 证据限制与结论`, ``, `- 本文档保留原始回答、分类结果和公式，结论需要结合证据质量复核。`, `- 当前系统未将好评、中评、差评转换为 KANO 状态。`, ``);
  return lines.join("\n");
}

function appendItem(lines: string[], item: DemandItem): void {
  const denominator = item.counts.A + item.counts.O + item.counts.M + item.counts.I;
  lines.push(`### ${item.subFeature}`, ``, `- 需求描述：${item.needStatement}`, `- 正向问题：${item.functionalQuestion || "未设计"}`, `- 反向问题：${item.dysfunctionalQuestion || "未设计"}`, `- 回答数量：${item.responses.length}`, `- A/O/M/I/R/Q：${item.counts.A}/${item.counts.O}/${item.counts.M}/${item.counts.I}/${item.counts.R}/${item.counts.Q}`, `- 有效样本数：${denominator}`, `- SI / Better：${denominator ? `(${item.counts.A} + ${item.counts.O}) ÷ ${denominator} = ${(item.si ?? 0).toFixed(2)}` : "N/A"}`, `- DSI / Worse：${denominator ? `-(${item.counts.M} + ${item.counts.O}) ÷ ${denominator} = ${(item.dsi ?? 0).toFixed(2)}` : "N/A"}`, ``, `| 序号 | 正向回答 | 反向回答 | 自动分类 |`, `|---:|---|---|---|`);
  item.responses.forEach((response, index) => lines.push(`| ${index + 1} | ${response.functional} | ${response.dysfunctional} | ${categoryLabels[classifyKanoResponse(response.functional, response.dysfunctional)]} |`));
  lines.push(``);
}
