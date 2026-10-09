import { LegacyDemandRouteRedirect } from "@/components/workbench/demand-exploration/demand-document-route";

export default async function KanoResponsesPage({ params, searchParams }: { params: Promise<{ analysisId: string }>; searchParams: Promise<{ demandItemId?: string }> }) {
  const { analysisId } = await params;
  const { demandItemId } = await searchParams;
  return <LegacyDemandRouteRedirect documentId={analysisId} />;
}
