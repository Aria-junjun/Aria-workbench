import { AnalysisWorkspace } from "@/components/workbench/competitor-analysis/analysis-workspace";

export default async function CompetitorAnalysisWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <AnalysisWorkspace projectId={projectId} />;
}
