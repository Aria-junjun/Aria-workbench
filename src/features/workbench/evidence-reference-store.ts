import type { EvidenceReference, EvidenceReferenceModule } from "./evidence-references";
import { buildEvidenceSourceProjects } from "./evidence-sources";
import { loadLocalWorkbenchData, saveLocalWorkbenchData } from "./local-store";
import { setWorkbenchSnapshot } from "./workbench-store";

export function confirmWorkbenchEvidenceField(module: EvidenceReferenceModule, projectId: string, path: string, snapshot: string): void {
  const data = loadLocalWorkbenchData();
  const field = buildEvidenceSourceProjects(data).find((project) => project.module === module && project.projectId === projectId)?.fields.find((item) => item.path === path);
  if (!field || field.snapshot !== snapshot) throw new Error("字段已变化，请刷新后重新核对。");
  // Reference copies retain their own edited state; this action confirms native fields only.
  if (path.startsWith("evidenceReferences.")) throw new Error("引用副本不能作为原始字段确认。");
  const confirmations = (data.evidenceFieldConfirmations ?? []).filter((item) => !(item.module === module && item.projectId === projectId && item.path === path));
  saveLocalWorkbenchData({ ...data, evidenceFieldConfirmations: [...confirmations, { module, projectId, path, snapshot, confirmedAt: new Date().toISOString() }] });
  setWorkbenchSnapshot(loadLocalWorkbenchData());
}

function sameSourceTarget(a: EvidenceReference, b: EvidenceReference) {
  return a.targetModule === b.targetModule && a.targetProjectId === b.targetProjectId && a.sourceModule === b.sourceModule && a.sourceProjectId === b.sourceProjectId && a.sourceFieldPath === b.sourceFieldPath;
}

/** Merge only the caller's changed rows into fresh data, never replace a stale collection. */
export function saveEvidenceReferenceChanges(previous: EvidenceReference[], next: EvidenceReference[]): void {
  const data = loadLocalWorkbenchData();
  const references = [...(data.evidenceReferences ?? [])];
  for (const reference of next) {
    const before = previous.find((item) => item.id === reference.id);
    if (before && JSON.stringify(before) === JSON.stringify(reference)) continue;
    const index = references.findIndex((item) => item.id === reference.id);
    if (index >= 0) references[index] = reference;
    else if (!references.some((item) => sameSourceTarget(item, reference))) references.push(reference);
  }
  saveLocalWorkbenchData({ ...data, evidenceReferences: references });
  setWorkbenchSnapshot(loadLocalWorkbenchData());
}
