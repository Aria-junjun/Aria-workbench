import { z } from "zod";
import { DecisionModelSectionSchema } from "./decision-analysis";

export const ToolContributionSchema = z.object({
  id: z.string(),
  toolId: z.string(),
  toolName: z.string(),
  sourceBook: z.string().optional(),
  judgement: z.string().default(""),
  actions: z.array(z.string()).default([]),
  acceptedActionIds: z.array(z.string()).optional(),
  createdAt: z.string()
});

export const DecisionCycleSchema = z.object({
  id: z.string(),
  cycleNumber: z.number().int().positive(),
  title: z.string(),
  rawInput: z.string(),
  newInformation: z.string().optional(),
  initialJudgement: z.string().optional(),
  toolContributions: z.array(ToolContributionSchema).default([]),
  modelId: z.literal("business-model-canvas").optional(),
  modelSections: z.array(DecisionModelSectionSchema).default([]),
  conclusion: z.string().optional(),
  nextActions: z.array(z.object({
    action: z.string(),
    sourceToolIds: z.array(z.string()).default([])
  })).default([]),
  outcome: z.string().optional(),
  review: z.string().optional(),
  status: z.enum(["judging", "pending_action", "validating", "completed", "paused"]).default("judging"),
  version: z.number().int().positive().default(1),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const DecisionCaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  normalizedProblemKey: z.string(),
  objective: z.string().optional(),
  cycles: z.array(DecisionCycleSchema).default([]),
  supplierIds: z.array(z.string()).default([]),
  offerIds: z.array(z.string()).default([]),
  productIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type ToolContribution = z.infer<typeof ToolContributionSchema>;
export type DecisionCycle = z.infer<typeof DecisionCycleSchema>;
export type DecisionCase = z.infer<typeof DecisionCaseSchema>;

export function normalizeProblemKey(problem: string) {
  return problem
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s，。！？、；：,.!?;:'"“”‘’（）()【】\[\]]+/g, "");
}

export function latestDecisionCycle(caseItem: DecisionCase) {
  return [...caseItem.cycles].sort((a, b) => b.cycleNumber - a.cycleNumber)[0];
}

export function mergeActionSources(
  contributions: Array<Pick<ToolContribution, "toolId" | "actions"> & Partial<ToolContribution>>
) {
  const actions = new Map<string, { action: string; sourceToolIds: string[] }>();
  for (const contribution of contributions) {
    for (const rawAction of contribution.actions) {
      const action = rawAction.trim();
      if (!action) continue;
      const key = normalizeProblemKey(action);
      const current = actions.get(key) ?? { action, sourceToolIds: [] };
      if (!current.sourceToolIds.includes(contribution.toolId)) current.sourceToolIds.push(contribution.toolId);
      actions.set(key, current);
    }
  }
  return [...actions.values()];
}
