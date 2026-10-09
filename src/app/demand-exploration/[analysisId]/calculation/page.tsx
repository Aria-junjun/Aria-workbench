import { LegacyDemandRouteRedirect } from "@/components/workbench/demand-exploration/demand-document-route";

export default async function KanoCalculationPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  return <LegacyDemandRouteRedirect documentId={analysisId} />;
}
