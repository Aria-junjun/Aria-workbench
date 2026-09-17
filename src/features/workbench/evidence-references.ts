import { randomId } from "@/lib/random-id";

export type EvidenceReferenceStatus = "original" | "ai-draft" | "edited" | "confirmed" | "inference" | "to-verify";

export type EvidenceReferenceModule = "industry-insight" | "demand-exploration" | "competitor-analysis" | "product-decomposition";

export type EvidenceReference = {
  id: string;
  sourceModule: EvidenceReferenceModule;
  sourceProjectId: string;
  sourceProjectTitle: string;
  sourceFieldPath: string;
  sourceFieldLabel: string;
  snapshot: string;
  status: EvidenceReferenceStatus;
  referencedAt: string;
};

export function createEvidenceReference(
  input: Omit<EvidenceReference, "id" | "referencedAt">
): EvidenceReference {
  return {
    ...input,
    id: randomId(),
    referencedAt: new Date().toISOString(),
  };
}

export function canReferenceEvidence(status: EvidenceReferenceStatus): boolean {
  return status === "confirmed";
}
