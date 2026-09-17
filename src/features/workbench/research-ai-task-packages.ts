import { buildAiTaskPackage, type AiTaskPackage } from "./ai-task-protocol";

type DemandTaskInput = {
  projectId: string;
  title: string;
  productName: string;
  userType: string;
  scenario: string;
  problem: string;
};

type CompetitorTaskInput = {
  projectId: string;
  title: string;
  productName: string;
  targetUsers: string;
  analysisTheme: string;
  decisionQuestion: string;
};

type DecompositionTaskInput = {
  projectId: string;
  title: string;
  targetUsers: string;
  scenario: string;
  centralQuestion: string;
  decisionGoal: string;
};

export function buildDemandExplorationTaskPackage(input: DemandTaskInput): AiTaskPackage {
  const task = buildAiTaskPackage({
    module: "demand-exploration",
    projectId: input.projectId,
    title: input.title,
    context: `产品：${input.productName}\n目标用户：${input.userType}\n使用场景：${input.scenario}\n当前问题：${input.problem}`,
    fields: [
      { path: "demand.problem", label: "需求问题", guidance: "明确用户在什么场景遇到什么问题" },
      { path: "demand.evidence", label: "需求证据", guidance: "整理用户回答、访谈原话或公开资料，并标明样本口径" },
      { path: "demand.kanoInterpretation", label: "KANO 解释", guidance: "只解释已有回答和计算结果，不补造样本" },
      { path: "demand.sampleLimitations", label: "样本限制", guidance: "说明样本量、来源偏差和不能外推的范围" },
      { path: "demand.gaps", label: "信息缺口", guidance: "列出还不能证明需求成立的部分" },
      { path: "demand.nextAction", label: "下一步动作", guidance: "给出下一项可执行的需求验证动作" },
    ],
  });
  return { ...task, prompt: `${task.prompt}\n\n研究重点：需求真实性、KANO 解释和样本限制。` };
}

export function buildCompetitorAnalysisTaskPackage(input: CompetitorTaskInput): AiTaskPackage {
  const task = buildAiTaskPackage({
    module: "competitor-analysis",
    projectId: input.projectId,
    title: input.title,
    context: `产品：${input.productName}\n目标用户：${input.targetUsers}\n分析主题：${input.analysisTheme}\n决策问题：${input.decisionQuestion}`,
    fields: [
      { path: "competitor.boundary", label: "竞品边界", guidance: "区分直接竞品、替代方案、参考产品和不纳入对象" },
      { path: "competitor.differences", label: "差异分析", guidance: "说明产品、用户场景和解决方式的可观察差异" },
      { path: "competitor.evidence", label: "竞品证据", guidance: "标明来源名称、时间、页面或体验范围" },
      { path: "competitor.risks", label: "竞争风险", guidance: "只写证据支持的风险和仍待验证的推断" },
      { path: "competitor.gaps", label: "信息缺口", guidance: "列出无法从公开资料确认的内容" },
      { path: "competitor.nextAction", label: "下一步动作", guidance: "给出下一项可执行的比较或验证动作" },
    ],
  });
  return { ...task, prompt: `${task.prompt}\n\n竞品边界必须先区分直接竞品、替代方案、参考产品；不得把所有相似产品都归为竞品。` };
}

export function buildProductDecompositionTaskPackage(input: DecompositionTaskInput): AiTaskPackage {
  const task = buildAiTaskPackage({
    module: "product-decomposition",
    projectId: input.projectId,
    title: input.title,
    context: `目标用户：${input.targetUsers}\n使用场景：${input.scenario}\n中心问题：${input.centralQuestion}\n决策目标：${input.decisionGoal}`,
    fields: [
      { path: "decomposition.causes", label: "原因拆解", guidance: "区分事实、推断和信息缺口，避免只写表面现象" },
      { path: "decomposition.solutions", label: "方案与优先级", guidance: "提供多个可比较的解决方向并说明依据" },
      { path: "decomposition.actions", label: "行动计划", guidance: "把方案转成可执行、可验收的验证动作" },
      { path: "decomposition.gaps", label: "信息缺口", guidance: "说明哪些原因或方案仍缺少证据" },
      { path: "decomposition.nextAction", label: "下一步动作", guidance: "明确下一步验证什么、产出什么" },
    ],
  });
  return { ...task, prompt: `${task.prompt}\n\n产品拆解只输出原因、方案和验证动作，不得把方案假设写成已验证需求。` };
}
