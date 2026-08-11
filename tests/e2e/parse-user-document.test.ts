/**
 * 端到端测试：模拟用户实际导入流程
 */
import { describe, expect, it } from "vitest";
import { parseProductResearchMarkdown } from "@/features/workbench/product-research-parser";
import { normalizeProductKnowledge } from "@/features/workbench/product-knowledge";

const userDocumentText = `# 衣柜防滑分层隔板

## 产品定位
- 名称：衣柜防滑分层隔板
- 品类：家居收纳 / 衣柜配件
- 核心用途：增加衣柜分层，提升收纳利用率
- 目标用户：小户型租房党、衣物较多的用户
- 使用场景：衣柜内部整理、衣物分区收纳

## 关键规格
- 材质：PP食品级塑料
- 长度：50-120cm（可自由裁剪）
- 宽度：约50cm
- 承重：5-10kg（取决于长度）
- 表面：防滑条纹设计
- 颜色：透明磨砂/白色可选

## 1688采购参考
- 规格：50*50cm | 价格：¥3.5 | 起订量：100件 | 运费：¥0 | 厂家直销
- 规格：80*50cm | 价格：¥5.8 | 起订量：100件 | 运费：¥0 | 厂家直销
- 规格：120*50cm | 价格：¥8.5 | 起订量：50件 | 运费：¥0 | 厂家直销

## 决策摘要
### 功能需求
- 核心功能：衣柜分层、防滑
- 辅助功能：可裁剪、易清洁
### 性能要求
- 承重：≥5kg
- 耐温：-20℃~60℃
### 采购建议
- 优先：PP材质、厚度≥1mm
- 备选：PET材质
### 风险评估
- 质量风险：薄款易变形
- 供应链风险：旺季缺货`;

describe("用户文档端到端解析", () => {
  it("能解析衣柜防滑分层隔板的完整数据", () => {
    const result = parseProductResearchMarkdown(userDocumentText);
    const parsed = result.product;

    // 基础元数据
    expect(parsed.name).toBe("衣柜防滑分层隔板");
    expect(parsed.category).toBe("家居收纳 / 衣柜配件");
    expect(parsed.coreUse).toBe("增加衣柜分层，提升收纳利用率");

    // 关键规格（纯文本格式）
    expect(parsed.specifications.length).toBeGreaterThanOrEqual(5);
    const specNames = parsed.specifications.map((s) => s.name);
    expect(specNames).toContain("材质");
    expect(specNames).toContain("长度");
    expect(specNames).toContain("宽度");
    expect(specNames).toContain("承重");

    // 采购参考（管道式格式）
    expect(parsed.procurementQuotes.length).toBeGreaterThanOrEqual(3);
    const firstQuote = parsed.procurementQuotes[0];
    expect(firstQuote.source).toBeTruthy();
    expect(firstQuote.price).toBeTruthy();

    // 决策摘要（嵌套分组格式）
    expect(parsed.decision).toBeDefined();
    expect(parsed.decision.summary).toBeTruthy();
  });

  it("规范化后数据不丢失", () => {
    const result = parseProductResearchMarkdown(userDocumentText);
    const normalized = normalizeProductKnowledge(result.product);

    expect(normalized.specifications.length).toBeGreaterThanOrEqual(5);
    expect(normalized.procurementQuotes.length).toBeGreaterThanOrEqual(3);
    expect(normalized.decision).toBeDefined();
  });
});
