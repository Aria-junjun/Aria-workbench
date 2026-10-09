import { notFound } from 'next/navigation';
import { ProcurementWorkspace } from '@/components/workbench/procurement-workspace';
import type { ProcurementSection } from '@/features/workbench/procurement';

const sections: ProcurementSection[] = ['request', 'pool', 'task', 'quote', 'fulfillment'];
export default async function ProcurementSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section as ProcurementSection)) notFound();
  return <ProcurementWorkspace section={section as ProcurementSection} />;
}
