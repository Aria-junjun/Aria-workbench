import { describe, it, expect } from "vitest";
import { parseProductResearchMarkdown } from "@/features/workbench/product-research-parser";
import { normalizeProductKnowledge, ProductKnowledgeV2Schema } from "@/features/workbench/product-knowledge";
import { SupplierCapabilitySchema } from "@/features/workbench/schemas";

const sampleReport = `# 电脑防窥防蓝光防反光保护膜及防窥挂板 - 品类调研评估报告

视角：产品经理
渠道：天猫排行榜对标 + 1688供应链
产品线：保护膜 + 防窥挂板
报告日期：2026-07-31

## 1. 行业概览与市场机会

### 1.1 市场规模与增长趋势
市场规模：约120亿元
同比增长：15%

### 1.2 PESTEL 分析
| 维度 | 因素 | 影响 |
| --- | --- | --- |
| 政治 | 环保法规 | 推动无胶膜需求 |
| 经济 | 消费电子增长 | 市场扩容 |

### 1.3 进入门槛分析
| 门槛维度 | 级别 | 说明 |
| --- | --- | --- |
| 技术专利 | 高 | 防窥膜专利集中 |

## 2. 竞争格局与头部玩家

### 2.1 市场份额与品牌排名
| 排名 | 品牌 | 市占率 |
| --- | --- | --- |
| 1 | 3M | 25% |
| 2 | 绿联 | 15% |

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

## 4. 用户需求与画像

### 4.1 用户画像
| 人群 | 核心需求 | 价格敏感度 |
| --- | --- | --- |
| 上班族 | 护眼 | 中 |

### 4.2 购买决策因素
- 护眼效果
- 防窥角度

## 5. 供应链与寻源

### 5.1 1688 供应商（膜）
| 供应商 | 报价 | MOQ |
| --- | --- | --- |
| A厂 | 15元/张 | 100 |

### 5.2 寻源步骤
1. 索要样品
2. 测试防窥角度
`;

describe("save/load pipeline", () => {
  it("preserves supplier capability evidence through schema normalization", () => {
    const capability = SupplierCapabilitySchema.parse({
      id: "capability-1",
      supplierId: "supplier-1",
      productFamilyKey: "白板贴",
      processNames: ["分切"],
      materialNames: ["PET"],
      equipmentNames: ["复合机"],
      supportsSampling: true,
      supportsCustomization: false,
      moq: "100",
      leadTime: "7天",
      sourceRecordIds: ["offer-1"],
      sourceType: "offer",
      status: "verified",
      effectiveFrom: "2026-07",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    const roundTrip = SupplierCapabilitySchema.parse({ ...capability });

    expect(roundTrip.productFamilyKey).toBe("白板贴");
    expect(roundTrip.sourceRecordIds).toEqual(["offer-1"]);
    expect(roundTrip.status).toBe("verified");
  });

  it("preserves category research through double schema parse", () => {
    const parsed = parseProductResearchMarkdown(sampleReport, { fileName: "report.md" });
    const product = parsed.product;

    // Step 2: First schema parse (as in saveProductKnowledge)
    const step1 = ProductKnowledgeV2Schema.parse(product);

    // Step 3: Normalize (as in saveProductKnowledge)
    const step2 = normalizeProductKnowledge({ ...step1, updatedAt: new Date().toISOString() });

    // Step 4: Second schema parse (as in saveProductKnowledge)
    const step3 = ProductKnowledgeV2Schema.parse(step2);

    // Assert category research survived all steps
    expect(step3.researchDepth).toBe("category");
    expect(step3.marketOverview?.marketSize).toBe("约120亿元");
    expect(step3.marketOverview?.pestel).toHaveLength(2);
    expect(step3.marketOverview?.entryBarriers).toHaveLength(1);
    expect(step3.competitiveLandscape?.topBrandRanking?.rows).toHaveLength(2);
    expect(step3.productBenchmark?.tmallProtectiveFilm?.rows).toHaveLength(2);
    expect(step3.productBenchmark?.tmallHangingBoard?.rows).toHaveLength(1);
    expect(step3.userInsights?.personas?.rows).toHaveLength(1);
    expect(step3.userInsights?.purchasePriorities).toEqual(["护眼效果", "防窥角度"]);
    expect(step3.supplyChainFindings?.filmSuppliers?.rows).toHaveLength(1);
    expect(step3.supplyChainFindings?.sourcingPathSteps).toEqual(["索要样品", "测试防窥角度"]);
  });
});
