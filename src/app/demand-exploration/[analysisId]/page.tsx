import { DemandDocumentRoute } from "@/components/workbench/demand-exploration/demand-document-route";

export default async function DemandConfirmationDocumentPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  return <DemandDocumentRoute documentId={analysisId} />;
}
