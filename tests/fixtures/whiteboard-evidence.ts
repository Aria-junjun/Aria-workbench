import data from "@/data/workbench-data.json";
import { createIndustryInsightProject } from "@/features/workbench/industry-insight";
import { createDemandConfirmationDocument } from "@/features/workbench/demand-confirmation";
import { createWhiteboardCompetitorAnalysisProject } from "@/features/workbench/competitor-analysis";
import { createProductDecompositionProject } from "@/features/workbench/product-decomposition";
import { normalizeWorkbenchData } from "@/features/workbench/local-store";

// Reuse the repository's current whiteboard operating record, without seeding references.
export function whiteboardEvidenceFixture() {
  const record = data.knowledgeApplications.find((item) => item.problem.includes("断点式的白板贴"))!;
  const industry = createIndustryInsightProject({ title: "白板贴行业洞察", productName: "白板贴", decisionQuestion: record.problem });
  const demand = createDemandConfirmationDocument({ title: "白板贴需求确认", productName: "白板贴", problem: record.problem });
  const competitor = createWhiteboardCompetitorAnalysisProject({ title: "白板贴竞品分析", targetUsers: "教育场景用户", analysisTheme: "白板贴", decisionQuestion: record.problem, expectedAction: "验证场景", productStage: "验证期" });
  const decomposition = createProductDecompositionProject({ title: "白板贴产品拆解", centralQuestion: record.problem });
  return { record, industry, demand, competitor, decomposition, data: normalizeWorkbenchData({ industryInsightProjects: [industry], demandConfirmationDocuments: [demand], competitorAnalysisProjects: [competitor], productDecompositionProjects: [decomposition], evidenceReferences: [] }) };
}
