import { DocumentWorkspace } from "@/components/workbench/demand-exploration/document-workspace";

export default async function DemandConfirmationDocumentPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return <DocumentWorkspace documentId={documentId} />;
}
