import { DocumentWorkspace } from "@/components/workbench/demand-exploration/document-workspace";

export default async function DemandConfirmationDocumentPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  return <DocumentWorkspace documentId={analysisId} />;
}
