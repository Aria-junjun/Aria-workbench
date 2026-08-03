import { describe, expect, it } from "vitest";
import { parseProductResearchMarkdown } from "@/features/workbench/product-research-parser";
import { PRODUCT_RESEARCH_PROMPT } from "@/features/workbench/product-research-prompt";

const STANDARD_MARKDOWN = `## 产品定位
产品名称：亚克力留言板
产品品类：桌面文具
核心用途：记录提醒和展示留言
目标用户：学生与办公人群
使用场景：书桌；教室
默认计量单位：个

## 关键规格
| 影响说明 | 单位 | 参数 | 数值 |
| --- | --- | --- | --- |
| 影响材料用量和强度 | mm | 厚度 | 3 |
| 适配桌面摆放 | cm | 尺寸 | 20 x 30 |

## 材料与产品硬成本
| 小计 | 名称 | 单价 | 类别 | 货币 | 计价单位 | 规格或用量 | 来源 | 日期 | 地区 | 可信程度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 8 | 亚克力板 | 8 | 主材 | CNY | 个 | 1 | 厂家报价 | 2026-07-15 | 浙江 | 高 |
| 2 | 激光切割 | 2 | 加工 | CNY | 个 | 1 | 厂家报价 | 2026-07-15 | 浙江 | 高 |
产品硬成本合计：10

## 制造方式
核心工艺：激光切割；丝印
所需机器：激光切割机
生产难点：边缘易有毛刺
质量控制点：检查厚度和边缘
主要产业带：浙江金华

## 替代与优化
| 是否建议打样 | 质量影响 | 替代方案 | 替代对象 | 成本变化方向 | 风险 |
| --- | --- | --- | --- | --- | --- |
| 是 | 耐刮性下降 | PVC 板 | 亚克力板 | 降低 | 易变形 |

## 风险与缺陷
产品缺陷：表面易划伤
原材料风险：板材色差
工艺风险：丝印偏位
使用风险：尖角可能划伤

## 延伸机会
可延伸场景：婚礼签到
可开发规格：磁吸款
可搭配产品：白板笔

## 决策摘要
最大成本驱动因素：亚克力板材
核心竞争点：可定制图案
当前缺失信息：批量价格
是否值得继续询价或打样：是
下一步行动：向两家工厂询价`;

describe("product research Markdown parser", () => {
  it("parses production intelligence and actual 1688 procurement quotes", () => {
    const parsed = parseProductResearchMarkdown(`## 产品与规格
产品名称：亚克力留言板
产品品类：书写板
核心用途：计划记录
使用场景：冰箱
默认计量单位：套

## 关键规格
| 参数 | 数值 | 单位 | 影响说明 |
| --- | --- | --- | --- |
| 厚度 | 2 | mm | 影响挺度 |

## 1688采购参考
| 来源 | 对应规格 | 批发报价 | MOQ | 运费口径 | 报价时间 |
| --- | --- | --- | --- | --- | --- |
| 1688 | 20×30cm | 12元/套 | 10套 | 不含运费 | 2026-07-20 |

## 原料与结构
| 原料或结构 | 作用 | 关键参数 | 已知弊端 |
| --- | --- | --- | --- |
| 亚克力板 | 主体板材 | 厚度、透光率 | 易划伤 |

## 生产流程与设备
核心工艺：激光切割；UV打印
所需机器：激光切割机；UV打印机
质量控制点：检查板材平整度；检查印刷附着力
主要产业带：浙江台州

## 缺陷与风险
产品缺陷：容易划伤

## 成熟替代与优化
| 优化对象 | 具体方案 | 改善目标 | 保持效果的依据 | 实现条件 | 新风险 | 验证方法 |
| --- | --- | --- | --- | --- | --- | --- |
| 板材 | 使用硬化亚克力 | 降低划伤 | 透明度相近 | 供应商可加工 | 成本上升 | 耐刮测试 |

## 采购与验证
必须确认：板材实际厚度；印刷附着力
打样重点：擦写测试；跌落测试
是否值得继续：是`);

    expect(parsed.product.name).toBe("亚克力留言板");
    expect(parsed.product.procurementQuotes).toEqual([
      expect.objectContaining({ source: "1688", specification: "20×30cm", price: "12元/套", moq: "10套" })
    ]);
    expect(parsed.product.materialStructures).toEqual([
      expect.objectContaining({ name: "亚克力板", role: "主体板材", weaknesses: "易划伤" })
    ]);
    expect(parsed.product.machinery).toEqual(["激光切割机", "UV打印机"]);
    expect(parsed.product.qualityControls).toEqual(["检查板材平整度", "检查印刷附着力"]);
    expect(parsed.product.industryClusters).toEqual(["浙江台州"]);
    expect(parsed.product.costItems).toEqual([]);
    expect(parsed.product.hardCostStatus).toBe("pending");
  });

  it("parses the standard eight-section document by Chinese column name", () => {
    const parsed = parseProductResearchMarkdown(STANDARD_MARKDOWN, {
      fileName: "亚克力留言板.md",
      importedAt: "2026-07-16T00:00:00.000Z"
    });

    expect(parsed.product.name).toBe("亚克力留言板");
    expect(parsed.product.specifications).toContainEqual(expect.objectContaining({ name: "厚度", value: "3", unit: "mm" }));
    expect(parsed.product.costItems).toHaveLength(2);
    expect(parsed.product.rawDocument?.content).toBe(STANDARD_MARKDOWN);
    expect(parsed.product.rawDocument).toMatchObject({ sourceName: "亚克力留言板.md", capturedAt: "2026-07-16T00:00:00.000Z" });
    expect(parsed.issues).toEqual([]);
  });

  it("preserves executable optimization evidence in the existing option fields", () => {
    const markdown = STANDARD_MARKDOWN.replace(
      "| 是否建议打样 | 质量影响 | 替代方案 | 替代对象 | 成本变化方向 | 风险 |\n| --- | --- | --- | --- | --- | --- |\n| 是 | 耐刮性下降 | PVC 板 | 亚克力板 | 降低 | 易变形 |",
      "| 优化对象 | 具体方案 | 降本或改善目标 | 保持效果的依据 | 预计成本变化 | 可实现性 | 新风险 | 验证方法 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| 包装 | E瓦邮政盒加四角护角 | 降低包装成本和货损 | 保护受力集中在四角 | 预计下降10%-20% | 高 | 板面可能划伤 | 跌落测试 |"
    );

    const option = parseProductResearchMarkdown(markdown).product.optimizationOptions[0];

    expect(option.name).toBe("E瓦邮政盒加四角护角");
    expect(option.description).toContain("保持效果的依据：保护受力集中在四角");
    expect(option.description).toContain("可实现性：高");
    expect(option.description).toContain("验证方法：跌落测试");
    expect(option.impact).toContain("预计成本变化：预计下降10%-20%");
  });

  it("reports a blocking issue when the product name is missing", () => {
    const parsed = parseProductResearchMarkdown(STANDARD_MARKDOWN.replace("产品名称：亚克力留言板\n", ""));

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "blocking", section: "产品定位" }));
  });

  it("reports a warning when a cost row has no subtotal", () => {
    const parsed = parseProductResearchMarkdown(STANDARD_MARKDOWN.replace("| 2 | 激光切割", "| 待确认 | 激光切割"));

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "warning", section: "材料与产品硬成本" }));
  });

  it("preserves warning and conflict severity in the product model issues", () => {
    const parsed = parseProductResearchMarkdown(STANDARD_MARKDOWN
      .replace("产品品类：桌面文具", "产品品类：桌面文具\n产品品类：礼品")
      .replace("| 2 | 激光切割", "| 待确认 | 激光切割"));

    expect(parsed.product.importIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "conflict" }),
      expect.objectContaining({ severity: "warning" })
    ]));
  });

  it.each([
    ["规格或用量", STANDARD_MARKDOWN.replace("| CNY | 个 | 1 |", "| CNY | 个 | 待确认 |")],
    ["单价", STANDARD_MARKDOWN.replace("| 亚克力板 | 8 | 主材", "| 亚克力板 | 待确认 | 主材")],
    ["计价单位", STANDARD_MARKDOWN.replace("| CNY | 个 | 1 |", "| CNY | 待确认 | 1 |")],
    ["来源", STANDARD_MARKDOWN.replace("| 1 | 厂家报价 |", "| 1 | 待确认 |")],
    ["地区", STANDARD_MARKDOWN.replace("| 2026-07-15 | 浙江 | 高", "| 2026-07-15 | 待确认 | 高")],
    ["日期", STANDARD_MARKDOWN.replace("| 厂家报价 | 2026-07-15 |", "| 厂家报价 | 待确认 |")],
    ["可信程度", STANDARD_MARKDOWN.replace("| 浙江 | 高", "| 浙江 | 待确认")]
  ])("warns and leaves hard costs pending when %s is missing", (_field, rawText) => {
    const parsed = parseProductResearchMarkdown(rawText);

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "warning", section: "材料与产品硬成本" }));
    expect(parsed.product.hardCostStatus).toBe("pending");
    expect(parsed.product.hardCostTotal).toBeUndefined();
  });

  it("does not invent CNY when a cost row has no currency", () => {
    const rawText = STANDARD_MARKDOWN
      .replace("| 小计 | 名称 | 单价 | 类别 | 货币 | 计价单位", "| 小计 | 名称 | 单价 | 类别 | 计价单位")
      .replace("| --- | --- | --- | --- | --- | --- |", "| --- | --- | --- | --- | --- |")
      .replace("| 8 | 亚克力板 | 8 | 主材 | CNY | 个 |", "| 8 | 亚克力板 | 8 | 主材 | 个 |")
      .replace("| 2 | 激光切割 | 2 | 加工 | CNY | 个 |", "| 2 | 激光切割 | 2 | 加工 | 个 |");
    const parsed = parseProductResearchMarkdown(rawText);

    expect(parsed.product.costItems).toEqual([]);
    expect((parsed.product.rawDocument?.rawData as { invalidRows?: unknown[] } | undefined)?.invalidRows)
      .toEqual(expect.arrayContaining([expect.objectContaining({ reason: "缺少必需列：货币" })]));
    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "warning", section: "材料与产品硬成本" }));
    expect(parsed.product.hardCostStatus).toBe("pending");
    expect(parsed.product.hardCostTotal).toBeUndefined();
  });

  it("reports a conflict when the declared cost total differs from cost rows", () => {
    const parsed = parseProductResearchMarkdown(STANDARD_MARKDOWN.replace("产品硬成本合计：10", "产品硬成本合计：12"));

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "conflict", section: "材料与产品硬成本" }));
  });

  it("retains custom unknown sections in the raw document", () => {
    const rawText = `${STANDARD_MARKDOWN}\n\n## 自定义备注\n产品名称：不应覆盖标准名称\n仅供内部评审。`;
    const parsed = parseProductResearchMarkdown(rawText);

    expect(parsed.product.rawDocument?.content).toBe(rawText);
    expect(parsed.product.name).toBe("亚克力留言板");
  });

  it("reports conflicting positioning fields and retains all distinct candidates", () => {
    const parsed = parseProductResearchMarkdown(STANDARD_MARKDOWN.replace("产品品类：桌面文具", "产品品类：桌面文具\n产品品类：礼品"));

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "conflict", section: "产品定位" }));
    expect(parsed.product.rawDocument?.rawData).toMatchObject({ fieldConflicts: { "产品定位.产品品类": ["桌面文具", "礼品"] } });
  });

  it("reports conflicting manufacturing fields and retains all distinct candidates", () => {
    const parsed = parseProductResearchMarkdown(STANDARD_MARKDOWN.replace("核心工艺：激光切割；丝印", "核心工艺：激光切割；丝印\n核心工艺：注塑"));

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "conflict", section: "制造方式" }));
    expect(parsed.product.rawDocument?.rawData).toMatchObject({ fieldConflicts: { "制造方式.核心工艺": ["激光切割；丝印", "注塑"] } });
  });

  it("reports duplicate table headers with different values and retains all candidates", () => {
    const rawText = STANDARD_MARKDOWN
      .replace("| 小计 | 名称 | 单价 | 类别 |", "| 小计 | 名称 | 单价 | 单价 | 类别 |")
      .replace("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
      .replace("| 8 | 亚克力板 | 8 | 主材 |", "| 8 | 亚克力板 | 8 | 9 | 主材 |")
      .replace("| 2 | 激光切割 | 2 | 加工 |", "| 2 | 激光切割 | 2 | 3 | 加工 |");
    const parsed = parseProductResearchMarkdown(rawText);

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "conflict", section: "材料与产品硬成本" }));
    expect(parsed.product.rawDocument?.rawData).toMatchObject({ fieldConflicts: { "材料与产品硬成本.表头单价": ["8", "9", "2", "3"] } });
  });

  it("deduplicates duplicate table headers when every row repeats the same value", () => {
    const rawText = STANDARD_MARKDOWN
      .replace("| 小计 | 名称 | 单价 | 类别 |", "| 小计 | 名称 | 单价 | 单价 | 类别 |")
      .replace("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
      .replace("| 8 | 亚克力板 | 8 | 主材 |", "| 8 | 亚克力板 | 8 | 8 | 主材 |")
      .replace("| 2 | 激光切割 | 2 | 加工 |", "| 2 | 激光切割 | 2 | 2 | 加工 |");
    const parsed = parseProductResearchMarkdown(rawText);

    expect(parsed.issues).not.toContainEqual(expect.objectContaining({ severity: "conflict", section: "材料与产品硬成本" }));
    expect(parsed.product.rawDocument?.rawData).toBeUndefined();
  });

  it("deduplicates repeated fields with the same value", () => {
    const parsed = parseProductResearchMarkdown(STANDARD_MARKDOWN.replace("产品品类：桌面文具", "产品品类：桌面文具\n产品品类：桌面文具"));

    expect(parsed.issues).not.toContainEqual(expect.objectContaining({ severity: "conflict", section: "产品定位" }));
    expect(parsed.product.rawDocument?.rawData).toBeUndefined();
  });

  it.each([
    ["缺少名称", completeCostRow({ 名称: "待确认" })],
    ["列数不匹配", ["主材", "亚克力板", "1", "8"]]
  ])("warns and preserves a non-empty cost row with %s", (_caseName, row) => {
    const parsed = parseProductResearchMarkdown(researchDocument({ costRows: [completeCostRow(), row] }));

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "warning", section: "材料与产品硬成本" }));
    expect(parsed.product.hardCostStatus).toBe("pending");
    expect(parsed.product.hardCostTotal).toBeUndefined();
    expect(parsed.product.rawDocument?.rawData).toMatchObject({ invalidRows: [expect.objectContaining({ section: "材料与产品硬成本", raw: expect.stringContaining("|") })] });
  });

  it("warns and preserves cost rows when a required table column is absent", () => {
    const headers = COST_HEADERS.filter((header) => header !== "来源");
    const row = headers.map((header) => completeCostRowByHeader()[header]);
    const parsed = parseProductResearchMarkdown(researchDocument({ costHeaders: headers, costRows: [row] }));

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "warning", section: "材料与产品硬成本" }));
    expect(parsed.product.hardCostStatus).toBe("pending");
    expect(parsed.product.rawDocument?.rawData).toMatchObject({ invalidRows: [expect.objectContaining({ cells: row })] });
  });

  it.each([
    ["without a cost table", researchDocument({ includeCostTable: false })],
    ["with only cost-table headers", researchDocument({ costRows: [] })]
  ])("warns once and leaves hard costs pending %s", (_caseName, rawText) => {
    const parsed = parseProductResearchMarkdown(rawText);

    expect(costSectionWarnings(parsed)).toHaveLength(1);
    expect(parsed.product.hardCostStatus).toBe("pending");
    expect(parsed.product.hardCostTotal).toBeUndefined();
  });

  it("warns once for missing cost headers while retaining every invalid row", () => {
    const headers = COST_HEADERS.filter((header) => header !== "来源");
    const row = headers.map((header) => completeCostRowByHeader()[header]);
    const parsed = parseProductResearchMarkdown(researchDocument({ costHeaders: headers, costRows: [row, row] }));

    expect(costSectionWarnings(parsed)).toHaveLength(1);
    expect(parsed.product.rawDocument?.rawData).toMatchObject({ invalidRows: [
      expect.objectContaining({ cells: row }),
      expect.objectContaining({ cells: row })
    ] });
    expect(parsed.product.hardCostStatus).toBe("pending");
    expect(parsed.product.hardCostTotal).toBeUndefined();
  });

  it("warns when the key-specification table is empty", () => {
    const parsed = parseProductResearchMarkdown(researchDocument({ specificationRows: [] }));

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "warning", section: "关键规格" }));
  });

  it.each([
    ["参数", ["待确认", "3", "mm", "影响材料用量"]],
    ["数值", ["厚度", "待确认", "mm", "影响材料用量"]]
  ])("warns when a specification row lacks %s", (_field, specificationRow) => {
    const parsed = parseProductResearchMarkdown(researchDocument({ specificationRows: [specificationRow] }));

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "warning", section: "关键规格" }));
  });

  it("aggregates conflicting specifications by normalized parameter name", () => {
    const parsed = parseProductResearchMarkdown(researchDocument({ specificationRows: [
      ["厚度", "3", "mm", "影响材料用量"],
      [" 厚度 ", "5", "mm", "影响材料用量"]
    ] }));

    expect(parsed.product.specifications).toEqual([expect.objectContaining({ id: "spec-厚度", name: "厚度", value: "3", unit: "mm" })]);
    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "conflict", section: "关键规格" }));
    expect(parsed.product.rawDocument?.rawData).toMatchObject({ fieldConflicts: { "关键规格.参数厚度": ["3 mm", "5 mm"] } });
  });

  it("deduplicates equivalent specifications with a unique id", () => {
    const parsed = parseProductResearchMarkdown(researchDocument({ specificationRows: [
      ["厚度", "3", "mm", "影响材料用量"],
      [" 厚度 ", "3", "mm", "影响材料用量"]
    ] }));

    expect(parsed.product.specifications).toEqual([expect.objectContaining({ id: "spec-厚度", name: "厚度", value: "3", unit: "mm" })]);
    expect(parsed.issues).not.toContainEqual(expect.objectContaining({ severity: "conflict", section: "关键规格" }));
  });

  it("marks an included row with an inconsistent quantity, unit price, and subtotal as a conflict", () => {
    const parsed = parseProductResearchMarkdown(researchDocument({ costRows: [completeCostRow({ 小计: "9" })], declaredTotal: "9" }));

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "conflict", section: "材料与产品硬成本" }));
    expect(parsed.product.hardCostStatus).toBe("pending");
    expect(parsed.product.hardCostTotal).toBeUndefined();
  });

  it("does not let incomplete excluded rows block complete included hard costs", () => {
    const parsed = parseProductResearchMarkdown(researchDocument({ costRows: [
      completeCostRow(),
      completeCostRow({ 名称: "不计入样品", 单价: "待确认", 来源: "待确认", 是否计入: "否" })
    ] }));

    expect(parsed.issues).toContainEqual(expect.objectContaining({ severity: "warning", section: "材料与产品硬成本" }));
    expect(parsed.product.hardCostStatus).toBe("confirmed");
    expect(parsed.product.hardCostTotal).toBe(8);
  });

  it("instructs research to ask for gaps, avoid price guesses, and output only the fixed Markdown template", () => {
    expect(PRODUCT_RESEARCH_PROMPT).toContain("每轮最多 5 个");
    expect(PRODUCT_RESEARCH_PROMPT).toContain("不得猜测价格");
    expect(PRODUCT_RESEARCH_PROMPT).toContain("对应规格、MOQ、运费口径和报价时间");
    expect(PRODUCT_RESEARCH_PROMPT).toContain("不得输出 JSON");
    expect(PRODUCT_RESEARCH_PROMPT).toContain("不得增加章节");
  });

  it("parses category research report with Markdown heading prefixes", () => {
    const report = `# 电脑防窥防蓝光防反光保护膜及防窥挂板 - 品类调研评估报告

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
| 渠道资源 | 中 | 需天猫运营能力 |

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
3. 确认大货价`;

    const parsed = parseProductResearchMarkdown(report, { fileName: "report.md" });

    expect(parsed.product.name).toBe("电脑防窥防蓝光防反光保护膜及防窥挂板");
    expect(parsed.product.researchDepth).toBe("category");
    expect(parsed.product.marketOverview).toMatchObject({
      marketSize: "约120亿元",
      yoyGrowth: "15%",
      pestel: expect.arrayContaining([
        expect.objectContaining({ dimension: "政治", factor: "环保法规", impact: "推动无胶膜需求" })
      ]),
      entryBarriers: expect.arrayContaining([
        expect.objectContaining({ name: "技术专利", level: "高", analysis: "防窥膜专利集中" })
      ])
    });
    expect(parsed.product.competitiveLandscape?.topBrandRanking?.rows).toHaveLength(2);
    expect(parsed.product.productBenchmark?.tmallProtectiveFilm?.rows).toHaveLength(2);
    expect(parsed.product.productBenchmark?.tmallHangingBoard?.rows).toHaveLength(2);
    expect(parsed.product.productBenchmark?.priceTiers?.rows).toHaveLength(2);
    expect(parsed.product.userInsights?.personas?.rows).toHaveLength(2);
    expect(parsed.product.userInsights?.purchasePriorities).toEqual(["护眼效果", "防窥角度", "品牌口碑"]);
    expect(parsed.product.supplyChainFindings?.filmSuppliers?.rows).toHaveLength(2);
    expect(parsed.product.supplyChainFindings?.boardSuppliers?.rows).toHaveLength(2);
    expect(parsed.product.supplyChainFindings?.sourcingPathSteps).toEqual(["索要样品", "测试防窥角度", "确认大货价"]);
  });
});

const COST_HEADERS = ["类别", "名称", "规格或用量", "单价", "计价单位", "小计", "货币", "来源", "地区", "日期", "可信程度", "是否计入"];

function completeCostRow(overrides: Record<string, string> = {}): string[] {
  const values = { ...completeCostRowByHeader(), ...overrides };
  return COST_HEADERS.map((header) => values[header]);
}

function completeCostRowByHeader(): Record<string, string> {
  return {
    类别: "主材",
    名称: "亚克力板",
    "规格或用量": "1",
    单价: "8",
    计价单位: "个",
    小计: "8",
    货币: "CNY",
    来源: "厂家报价",
    地区: "浙江",
    日期: "2026-07-15",
    可信程度: "高",
    是否计入: "是"
  };
}

function researchDocument({
  specificationRows = [["厚度", "3", "mm", "影响材料用量"]],
  costHeaders = COST_HEADERS,
  costRows = [completeCostRow()],
  declaredTotal = "8",
  includeCostTable = true
}: {
  specificationRows?: string[][];
  costHeaders?: string[];
  costRows?: string[][];
  declaredTotal?: string;
  includeCostTable?: boolean;
} = {}): string {
  return [
    "## 产品定位",
    "产品名称：测试产品",
    "## 关键规格",
    markdownTable(["参数", "数值", "单位", "影响说明"], specificationRows),
    "## 材料与产品硬成本",
    ...(includeCostTable ? [markdownTable(costHeaders, costRows), `产品硬成本合计：${declaredTotal}`] : [])
  ].join("\n");
}

function costSectionWarnings(parsed: ReturnType<typeof parseProductResearchMarkdown>) {
  return parsed.issues.filter((issue) => issue.severity === "warning" && issue.section === "材料与产品硬成本");
}

function markdownTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}
