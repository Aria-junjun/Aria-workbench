import { describe, expect, it } from "vitest";
import {
  auditKnowledgeBookImport,
  legacyCardToDecisionTool,
  matchDecisionTools,
  parseBookPackage
} from "@/features/workbench/knowledge-library";

const auditPackageText = `【书籍】
书名：《审计测试》

【决策工具】
工具名称：市场判断
解决的问题：判断是否进入市场
触发信号：需求增长；竞争者增加
诊断问题：需求是否真实；是否具备成本优势
行动建议：先做小规模测试；验证付费意愿
不适用情况：缺少基础数据；仅有短期波动
来源章节：市场进入
关联标签：市场；验证

【决策工具】
工具名称：退出判断
解决的问题：判断是否退出市场
触发信号：持续亏损
诊断问题：亏损是否可逆；资源能否转移
行动建议：计算退出成本；制定退出节奏
不适用情况：尚未验证改善方案；存在战略协同
来源章节：退出壁垒
关联标签：退出；风险`;

const packageText = `【书籍】
书名：《竞争战略》
作者：迈克尔·波特
主题：竞争定位、替代品与差异化
主要解决的问题：如何选择可持续的竞争位置
全书框架概览：行业结构、基本竞争战略和竞争对手分析
适合我的业务场景：竞品分析、产品定价、品牌差异化

【决策工具】
工具名称：替代品分析
解决的问题：不同材料但满足相同需求的产品如何影响我们的选择
触发信号：竞品材料不同但价格更低；顾客在两种产品之间二选一
诊断问题：顾客真正购买的任务是什么；替代品是否满足核心需求；转换成本有多高
行动建议：按用户任务重做竞品分组；验证可感知差异；调整价值表达
不适用情况：两类产品面向完全不同的用户
来源章节：替代产品的压力
关联标签：竞品、替代品、定价

【决策工具】
工具名称：差异化判断
解决的问题：产品是否具备支撑溢价的真实差异
触发信号：价格高于竞品；消费者不理解价差
诊断问题：差异是否真实；消费者是否能感知；差异是否值得付费
行动建议：建立对比测试；把参数翻译成使用结果；删除无感知成本
不适用情况：差异无法验证
来源章节：差异化战略
关联标签：品牌、溢价、产品
`;

describe("knowledge book package", () => {
  it("parses one book and repeated decision tools", () => {
    const result = parseBookPackage(packageText);

    expect(result.book.title).toBe("《竞争战略》");
    expect(result.book.author).toBe("迈克尔·波特");
    expect(result.tools).toHaveLength(2);
    expect(result.tools[0].diagnosticQuestions).toHaveLength(3);
    expect(result.tools[1].actions).toContain("建立对比测试");
    expect(result.rawText).toBe(packageText.trim());
  });

  it("rejects a package without a book title or usable tools", () => {
    expect(() => parseBookPackage("【书籍】\n作者：某作者")).toThrow("没有识别到书名");
    expect(() => parseBookPackage("【书籍】\n书名：只有书名")).toThrow("没有识别到可用的决策工具");
  });

  it("parses multiline numbered and bulleted tool fields", () => {
    const result = parseBookPackage(`【书籍】
书名：《多行测试》
作者：测试作者

【决策工具】
工具名称：市场判断
解决的问题：判断是否进入市场
触发信号：
- 市场快速增长
• 竞争对手增加
诊断问题：
1. 客户需求是否真实？
2、我们是否具备成本优势？
行动建议：
1) 先做小规模测试
* 验证客户付费意愿
不适用情况：
- 尚未取得基础数据
- 只有短期促销波动
来源章节：市场进入
关联标签：市场；验证`);

    expect(result.tools[0].triggers).toEqual(["市场快速增长", "竞争对手增加"]);
    expect(result.tools[0].diagnosticQuestions).toEqual(["客户需求是否真实？", "我们是否具备成本优势？"]);
    expect(result.tools[0].actions).toEqual(["先做小规模测试", "验证客户付费意愿"]);
    expect(result.tools[0].limitations).toEqual(["尚未取得基础数据", "只有短期促销波动"]);
    expect(result.tools[0].sourceChapter).toBe("市场进入");
  });
});

describe("decision tool matching", () => {
  it("ranks tools by the problem, triggers and tags", () => {
    const { tools } = parseBookPackage(packageText);
    const result = matchDecisionTools("竞品材料不同但是价格更低，顾客会选择替代品", tools);

    expect(result[0].tool.name).toBe("替代品分析");
    expect(result[0].score).toBeGreaterThan(0);
    expect(result[0].reasons.length).toBeGreaterThan(0);
  });

  it("returns no false recommendations when no meaningful word overlaps", () => {
    const { tools } = parseBookPackage(packageText);
    expect(matchDecisionTools("今天仓库已经打包完成", tools)).toEqual([]);
  });
});

describe("knowledge import integrity audit", () => {
  it("treats numbered and unnumbered list items as the same knowledge", () => {
    const rawText = `【书籍】
书名：《编号审计》

【决策工具】
工具名称：测试工具
解决的问题：测试编号兼容
触发信号：
1. 需求增长
诊断问题：
1. 是否真实
2. 是否持续
行动建议：
1. 先验证
2. 再扩大
不适用情况：
1. 缺少数据
来源章节：测试
关联标签：测试`;

    const audit = auditKnowledgeBookImport(rawText, [{
      id: "tool-numbered",
      name: "测试工具",
      problem: "测试编号兼容",
      triggers: ["1. 需求增长"],
      diagnosticQuestions: ["1. 是否真实"],
      actions: ["1. 先验证"],
      limitations: ["1. 缺少数据"],
      tags: ["测试"],
      status: "ready"
    }]);

    expect(audit.tools[0].additions.triggers).toEqual([]);
    expect(audit.tools[0].additions.diagnosticQuestions).toEqual(["是否持续"]);
    expect(audit.tools[0].additions.actions).toEqual(["再扩大"]);
    expect(audit.tools[0].additions.limitations).toEqual([]);
  });

  it("reports numbered semantic duplicates as recoverable cleanup", () => {
    const rawText = `【书籍】
书名：《重复审计》

【决策工具】
工具名称：测试工具
解决的问题：测试重复清理
触发信号：需求增长
诊断问题：是否真实
行动建议：先验证
不适用情况：缺少数据
来源章节：测试
关联标签：测试`;

    const audit = auditKnowledgeBookImport(rawText, [{
      id: "tool-duplicated",
      name: "测试工具",
      problem: "测试重复清理",
      triggers: ["1. 需求增长", "需求增长"],
      diagnosticQuestions: ["1. 是否真实", "是否真实"],
      actions: ["1. 先验证", "先验证"],
      limitations: ["1. 缺少数据", "缺少数据"],
      sourceChapter: "测试",
      tags: ["测试"],
      status: "ready"
    }]);

    expect(audit.status).toBe("recoverable");
    expect(audit.recoverableItemCount).toBe(0);
    expect(audit.cleanupItemCount).toBe(4);
  });

  it("finds recoverable additions and raw-only tools", () => {
    const audit = auditKnowledgeBookImport(auditPackageText, [
      {
        id: "tool-1",
        name: "市场判断",
        problem: "判断是否进入市场",
        triggers: ["需求增长"],
        diagnosticQuestions: ["需求是否真实"],
        actions: ["人工补充动作"],
        limitations: ["缺少基础数据"],
        tags: ["市场"],
        status: "ready"
      }
    ]);

    expect(audit.status).toBe("recoverable");
    expect(audit.currentToolCount).toBe(1);
    expect(audit.parsedToolCount).toBe(2);
    expect(audit.newToolCount).toBe(1);
    expect(audit.tools[0].additions.triggers).toEqual(["竞争者增加"]);
    expect(audit.tools[0].additions.diagnosticQuestions).toEqual(["是否具备成本优势"]);
    expect(audit.tools[0].additions.actions).toEqual(["先做小规模测试", "验证付费意愿"]);
    expect(audit.tools[1].isNewTool).toBe(true);
  });

  it("reports identical content when all parsed information is stored", () => {
    const parsed = parseBookPackage(auditPackageText);
    const audit = auditKnowledgeBookImport(auditPackageText, parsed.tools);

    expect(audit.status).toBe("identical");
    expect(audit.recoverableItemCount).toBe(0);
    expect(audit.sourceInsufficientToolNames).toEqual([]);
  });

  it("reports source insufficiency without inventing additions", () => {
    const rawText = `【书籍】
书名：《信息不足》

【决策工具】
工具名称：单薄工具
解决的问题：判断问题
触发信号：出现风险
诊断问题：是否有风险
行动建议：继续观察
不适用情况：信息不足
关联标签：风险`;
    const parsed = parseBookPackage(rawText);
    const audit = auditKnowledgeBookImport(rawText, parsed.tools);

    expect(audit.status).toBe("source_insufficient");
    expect(audit.sourceInsufficientToolNames).toEqual(["单薄工具"]);
    expect(audit.recoverableItemCount).toBe(0);
  });
});

describe("legacy knowledge conversion", () => {
  it("maps old scenarios, steps and risks to a pending decision tool", () => {
    const tool = legacyCardToDecisionTool({
      id: "legacy-1",
      title: "先不接受首次报价",
      source: "《优势谈判》",
      summary: "首次报价通常保留了谈判空间",
      applicableScenarios: ["供应商首次报价"],
      steps: ["询问报价依据"],
      scripts: ["我需要看完整条件"],
      risks: ["不要无条件压价"],
      tags: ["谈判", "报价"]
    });

    expect(tool.name).toBe("先不接受首次报价");
    expect(tool.triggers).toEqual(["供应商首次报价"]);
    expect(tool.actions).toEqual(["询问报价依据"]);
    expect(tool.limitations).toEqual(["不要无条件压价"]);
    expect(tool.status).toBe("needs_review");
    expect(tool.legacyCardId).toBe("legacy-1");
  });
});
