import type { EvidenceReference } from "./evidence-references";

export type EvidenceConflict = {
  fieldPath: string;
  fieldLabel: string;
  references: EvidenceReference[];
  reason: "value-mismatch" | "fact-mismatch" | "judgment-mismatch";
};

function targetFieldKey(reference: EvidenceReference): string {
  return [reference.targetModule ?? "", reference.targetProjectId ?? "", reference.sourceFieldPath].join("\u0000");
}

function conflictReason(references: EvidenceReference[]): EvidenceConflict["reason"] {
  const snapshots = references.map((reference) => reference.snapshot.trim());
  if (snapshots.every((snapshot) => snapshot.startsWith("事实："))) return "fact-mismatch";
  if (snapshots.every((snapshot) => snapshot.startsWith("判断：") || snapshot.startsWith("推断："))) return "judgment-mismatch";
  return "value-mismatch";
}

/** Finds differing saved copies for one target-project field without changing either source. */
export function findEvidenceConflicts(references: EvidenceReference[]): EvidenceConflict[] {
  const groups = new Map<string, EvidenceReference[]>();
  for (const reference of references) {
    if (!reference.snapshot.trim()) continue;
    const key = targetFieldKey(reference);
    groups.set(key, [...(groups.get(key) ?? []), reference]);
  }
  return [...groups.values()].flatMap((group) => {
    const snapshots = new Set(group.map((reference) => reference.snapshot.trim()));
    if (snapshots.size < 2) return [];
    return [{
      fieldPath: group[0].sourceFieldPath,
      fieldLabel: group[0].sourceFieldLabel,
      references: group,
      reason: conflictReason(group),
    }];
  });
}

/** Keeps every copy and snapshot, changing only the selected conflict's review status. */
export function markEvidenceConflictToVerify(references: EvidenceReference[], conflict: EvidenceConflict): EvidenceReference[] {
  const conflictIds = new Set(conflict.references.map((reference) => reference.id));
  return references.map((reference) => conflictIds.has(reference.id) ? { ...reference, status: "to-verify" } : reference);
}
