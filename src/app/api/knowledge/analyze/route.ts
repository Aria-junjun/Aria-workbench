import { NextResponse } from "next/server";
import { requireWorkbenchSession } from "@/features/auth/guard";
import { z } from "zod";
import { analyzeDecisionCycle } from "@/features/workbench/decision-analysis-ai";

const ToolContributionRequestSchema = z.object({
  id: z.string(),
  toolId: z.string(),
  toolName: z.string(),
  sourceBook: z.string().optional(),
  judgement: z.string(),
  actions: z.array(z.string()),
  acceptedActionIds: z.array(z.string()).optional(),
  createdAt: z.string()
});

const RequestSchema = z.object({
  caseId: z.string(),
  cycleId: z.string(),
  rawInput: z.string().trim().min(1).max(20000),
  initialJudgement: z.string().optional(),
  toolContributions: z.array(ToolContributionRequestSchema),
  currentActions: z.array(z.object({
    action: z.string(),
    sourceToolIds: z.array(z.string())
  })),
  previousCycleSummary: z.string().optional()
});

export async function POST(request: Request) {
  const authError = await requireWorkbenchSession(request);
  if (authError) return authError;
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "未配置 OpenAI API Key，暂时无法生成商业模式画布。" },
      { status: 503 }
    );
  }

  try {
    const body = RequestSchema.parse(await request.json());
    const { caseId, cycleId, ...input } = body;
    // caseId and cycleId are validated but not needed for analysis
    void caseId;
    void cycleId;
    return NextResponse.json(await analyzeDecisionCycle(input));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "当前决策周期资料不完整。" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "画布分析失败，请稍后再试。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
