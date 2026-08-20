import { describe, it, expect } from "vitest";
import { parseProductResearchMarkdown } from "@/features/workbench/product-research-parser";
import { normalizeProductKnowledge, ProductKnowledgeV2Schema } from "@/features/workbench/product-knowledge";

const sampleReport = `# 电脑防窥防蓝光防反光保护膜及防窥挂板 - 品类调研评估报告

视角：产品经理
渠道：天猫排行榜对标 + 1688供应链
产品线：保护膜 + 防窥挂板
报告日期：2026-07-31

## 1. 行业概览与市场机会

### 1.1 市场规模与增长趋势
市场规模：约120亿元
同比增长：15%
细分趋势：防窥膜增速高于普通膜

### 1.2 PESTEL 分析
| 维度 | 因素 | 影响 |
| --- | --- | --- |
| 政治 | 环保法规 | 推动无胶膜需求 |
| 经济 | 消费电子增长 | 市场扩容 |
| 社会 | 办公护眼意识 | 需求增长 |
| 技术 | 防窥技术迭代 | 产品升级 |
| 环境 | 可回收要求 | 无胶趋势 |
| 法律 | 隐私保护法 | 防窥需求 |

### 1.3 进入门槛分析
| 门槛维度 | 级别 | 说明 |
| --- | --- | --- |
| 技术专利 | 高 | 防窥膜专利集中 |
| 渠道资源 | 中 | 需天猫运营能力 |
| 供应链整合 | 中 | 需稳定上游 |

## 2. 竞争格局与头部玩家

### 2.1 市场份额与品牌排名
| 排名 | 品牌 | 市占率 |
| --- | --- | --- |
| 1 | 3M | 25% |
| 2 | 绿联 | 15% |
| 3 | 闪魔 | 10% |

### 2.2 五力模型
| 力量 | 强度 | 依据 |
| --- | --- | --- |
| 供应商议价 | 中 | 上游分散 |
| 客户议价 | 高 | 品牌切换成本低 |

### 2.3 差异化策略
品牌主要靠技术和渠道壁垒形成差异化，头部品牌3M靠医用级认证建立高端形象。

## 3. 产品竞争与差异化

### 3.1 天猫保护膜排行榜
| 品牌 | 价格带 | 核心卖点 |
| --- | --- | --- |
| 3M | 高 | 医用级防蓝光 |
| 绿联 | 中 | 性价比 |

### 3.2 天猫挂板排行榜
| 品牌 | 价格带 | 形态 |
| --- | --- | --- |
| XX | 低 | 挂式 |
| YY | 中 | 立式 |

### 3.3 价格分层
| 分层 | 价格区间 | 代表 |
| --- | --- | --- |
| 高端 | 200+ | 3M |
| 中端 | 80-200 | 绿联 |

## 4. 用户需求与画像

### 4.1 用户画像
| 人群 | 核心需求 | 价格敏感度 |
| --- | --- | --- |
| 上班族 | 护眼 | 中 |
| 学生 | 防窥 | 高 |

### 4.2 购买决策因素
- 护眼效果
- 防窥角度
- 品牌口碑
- 价格

## 5. 供应链与寻源

### 5.1 1688 供应商（膜）
| 供应商 | 报价 | MOQ |
| --- | --- | --- |
| A厂 | 15元/张 | 100 |
| B厂 | 12元/张 | 200 |

### 5.2 1688 供应商（挂板）
| 供应商 | 报价 | MOQ |
| --- | --- | --- |
| C厂 | 25元/个 | 50 |
| D厂 | 22元/个 | 100 |

### 5.3 寻源步骤
1. 索要样品
2. 测试防窥角度
3. 确认大货价
`;

describe("full pipeline", () => {
  it("preserves category research data through normalization", () => {
    // Step 1: Parse
    const parsed = parseProductResearchMarkdown(sampleReport, { fileName: "report.md" });
    console.log("=== PARSER OUTPUT ===");
    console.log("name:", parsed.product.name);
    console.log("researchDepth:", parsed.product.researchDepth);
    console.log("marketOverview:", JSON.stringify(parsed.product.marketOverview, null, 2)?.slice(0, 500));
    console.log("competitiveLandscape:", JSON.stringify(parsed.product.competitiveLandscape, null, 2)?.slice(0, 500));
    console.log("productBenchmark:", JSON.stringify(parsed.product.productBenchmark, null, 2)?.slice(0, 500));
    console.log("userInsights:", JSON.stringify(parsed.product.userInsights, null, 2)?.slice(0, 500));
    console.log("supplyChainFindings:", JSON.stringify(parsed.product.supplyChainFindings, null, 2)?.slice(0, 500));

    expect(parsed.product.name).toBe("电脑防窥防蓝光防反光保护膜及防窥挂板");
    expect(parsed.product.researchDepth).toBe("category");

    // Step 2: Schema validation
    const schemaResult = ProductKnowledgeV2Schema.safeParse(parsed.product);
    console.log("\n=== SCHEMA VALIDATION ===");
    console.log("success:", schemaResult.success);
    if (!schemaResult.success) {
      console.log("errors:", JSON.stringify(schemaResult.error.flatten(), null, 2).slice(0, 1000));
    }

    // Step 3: Normalize
    const normalized = normalizeProductKnowledge(parsed.product);
    console.log("\n=== NORMALIZED OUTPUT ===");
    console.log("name:", normalized.name);
    console.log("researchDepth:", normalized.researchDepth);
    console.log("marketOverview:", JSON.stringify(normalized.marketOverview, null, 2)?.slice(0, 500));
    console.log("competitiveLandscape:", JSON.stringify(normalized.competitiveLandscape, null, 2)?.slice(0, 500));
    console.log("productBenchmark:", JSON.stringify(normalized.productBenchmark, null, 2)?.slice(0, 500));
    console.log("userInsights:", JSON.stringify(normalized.userInsights, null, 2)?.slice(0, 500));
    console.log("supplyChainFindings:", JSON.stringify(normalized.supplyChainFindings, null, 2)?.slice(0, 500));

    // Verify data survived
    expect(normalized.name).toBe("电脑防窥防蓝光防反光保护膜及防窥挂板");
    expect(normalized.researchDepth).toBe("category");
    expect(normalized.marketOverview?.marketSize).toBe("约120亿元");
    expect(normalized.marketOverview?.yoyGrowth).toBe("15%");
    expect(normalized.marketOverview?.pestel).toHaveLength(6);
    expect(normalized.marketOverview?.entryBarriers).toHaveLength(3);
    expect(normalized.competitiveLandscape?.topBrandRanking?.rows).toHaveLength(3);
    expect(normalized.productBenchmark?.tmallProtectiveFilm?.rows).toHaveLength(2);
    expect(normalized.productBenchmark?.tmallHangingBoard?.rows).toHaveLength(2);
    expect(normalized.productBenchmark?.priceTiers?.rows).toHaveLength(2);
    expect(normalized.userInsights?.personas?.rows).toHaveLength(2);
    expect(normalized.userInsights?.purchasePriorities).toEqual(["护眼效果", "防窥角度", "品牌口碑", "价格"]);
    expect(normalized.supplyChainFindings?.filmSuppliers?.rows).toHaveLength(2);
    expect(normalized.supplyChainFindings?.boardSuppliers?.rows).toHaveLength(2);
    expect(normalized.supplyChainFindings?.sourcingPathSteps).toEqual(["索要样品", "测试防窥角度", "确认大货价"]);
  });
});
