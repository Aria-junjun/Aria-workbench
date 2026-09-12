import { InsightWorkspace } from "@/components/workbench/industry-insight/insight-workspace";

export default async function IndustryInsightWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <InsightWorkspace projectId={projectId} />;
}
