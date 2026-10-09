import { LegacyDemandRouteRedirect } from "@/components/workbench/demand-exploration/demand-document-route";

export default async function KanoMatrixPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  return <LegacyDemandRouteRedirect documentId={analysisId} />;
}
