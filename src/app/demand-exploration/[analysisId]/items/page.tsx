import { DemandItemEditor } from "@/components/workbench/demand-exploration/demand-item-editor";

export default async function DemandItemsPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  return <div className="mx-auto max-w-5xl"><DemandItemEditor documentId={analysisId} /></div>;
}
