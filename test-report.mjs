import { parseProductResearchMarkdown } from "./src/features/workbench/product-research-parser.ts";

const reportMarkdown = `# 电脑防窥防蓝光防反光保护膜及防窥挂板 - 品类调研评估报告

视角：产品经理
渠道：天猫排行榜对标 + 1688供应链
产品线：保护膜 + 防窥挂板
数据周期：2025-2026年
报告日期：2026-07-31

执行摘要
中国电脑屏幕防护市场2026年预计规模达38.52亿元，同比增长8.9%。

1. 行业概览与市场机会
1.1 市场规模与增长趋势

核心指标：

| 指标 | 数值 |
|---|---|
| 2026E市场规模 | 38.52亿元 |
| 2026年同比增长率 | 8.9% |
| 防窥膜销量增速（2025） | 19.7% |

1.3 PESTEL宏观环境分析

| 维度 | 关键因素 | 影响 |
|---|---|---|
| P 政策 | GB/T 44287-2025强制标准 | 合规门槛显著提升 |
| E 经济 | 单张均价28.4元逐年上升 | 高端化趋势带来利润空间 |
| S 社会 | 防蓝光膜18-35岁用户渗透率41.7% | 消费者从基础防护向三维价值跃迁 |
| T 技术 | 微棱镜+纳米镀膜复合工艺规模化 | 技术迭代驱动产品升级 |
| E 环境 | 再生PET原料退税比例提至70% | ESG合规能力成为新竞争维度 |
| L 法律 | 2025年防窥膜专项抽检不合格率19.4% | 市场规范化加速 |

2. 竞争格局与头部玩家
2.1 头部品牌市场份额排名

| 排名 | 品牌 | 电脑屏保膜市占率 | 防窥膜市占率 | 定位特征 |
|---|---|---|---|---|
| 1 | 亿色（ESR） | 14.3% | 17.5% | 高端技术卡位，绑定华为生态 |
| 2 | 邦克仕（Benks） | 11.7% | 13.7% | 英特尔EVO认证 |
| 3 | 绿联（UGREEN） | 9.8% | 12.5% | 全场景配件协同 |

2.2 波特五力分析

| 竞争力量 | 强度 | 关键依据 |
|---|---|---|
| 供应商议价能力 | 中偏高 | PET基膜三家占76.5% |
| 买家议价能力 | 中低端高/高端低 | 高端品牌防窥膜均价86-133元仍有稳定需求 |
| 新进入者威胁 | 低端高/高端低 | 2025年新增412家但超六成集中低端 |
| 替代品威胁 | 中等 | 设备内置软件防窥功能迭代 |
| 现有竞争强度 | 高 | 超3000家活跃企业 |

5. 供应链寻源调研（1688平台）
5.1 1688供应商分布与资质

防窥挂板类·1688核心供应商

| 供应商 | 产地 | 批发价 | 资质亮点 |
|---|---|---|---|
| 东莞市义思新材料 | 东莞 | ¥14.25起 | 10年老店，复购率37% |
| 深圳市新异精密电子 | 深圳 | ¥17.13 | 超级工厂，11年 |
| 深圳市创力泓实业 | 深圳 | ¥17.13 | 回头率56% |
`;

const result = parseProductResearchMarkdown(reportMarkdown, { fileName: "report.md", importedAt: new Date().toISOString() });

const p = result.product;
console.log("产品名称:", p.name);
console.log("researchDepth:", p.researchDepth);
console.log("阻断问题:", result.issues.filter(i => i.severity === "blocking").length);
console.log("市场概览:", !!p.marketOverview, "PESTEL:", p.marketOverview?.pestel?.length, "门槛:", p.marketOverview?.entryBarriers?.length);
console.log("竞争格局:", !!p.competitiveLandscape, "品牌数:", p.competitiveLandscape?.topBrandRanking?.rows?.length, "五力:", p.competitiveLandscape?.porterFiveForces?.length);
console.log("供应链:", !!p.supplyChainFindings, Object.keys(p.supplyChainFindings ?? {}));
if (p.supplyChainFindings?.boardSuppliers) {
  console.log("  挂板供应商表头:", p.supplyChainFindings.boardSuppliers.headers);
  console.log("  挂板供应商行数:", p.supplyChainFindings.boardSuppliers.rows.length);
}
