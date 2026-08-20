import { parseProductResearchMarkdown } from "./src/features/workbench/product-research-parser.ts";

const text = `1. 行业概览与市场机会

1.4 行业进入门槛分析

| 门槛维度 | 分析 | 高低 |
|---|---|---|
| 资金门槛 | 低端PET膜自动化产线投资数百万元即可启动 | 低 |
| 技术门槛（低端） | 基础PET膜生产技术成熟，代工模式普及 | 低 |
| 技术门槛（高端） | 微结构模具设计、光学级涂布有显著壁垒 | 高 |
| 品牌门槛 | 头部品牌已建立消费者认知和渠道壁垒 | 中高 |
`;

const result = parseProductResearchMarkdown(text, { fileName: "test.md" });
const p = result.product;
console.log("researchDepth:", p.researchDepth);
console.log("marketOverview:", !!p.marketOverview);
if (p.marketOverview) {
  console.log("  keys:", Object.keys(p.marketOverview));
  console.log("  entryBarriers:", JSON.stringify(p.marketOverview.entryBarriers, null, 2));
  console.log("  entryBarriers length:", p.marketOverview.entryBarriers?.length);
}
