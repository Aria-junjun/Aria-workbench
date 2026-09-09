import { DocumentEditForm } from "@/components/workbench/demand-exploration/document-edit-form";

export default async function DemandConfirmationEditPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  return <div className="mx-auto max-w-5xl"><DocumentEditForm documentId={analysisId} /></div>;
}
