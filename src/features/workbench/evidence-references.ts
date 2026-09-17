import { randomId } from "@/lib/random-id";

export type EvidenceReferenceStatus = "original" | "ai-draft" | "edited" | "confirmed" | "inference" | "to-verify";

export type EvidenceReferenceModule = "industry-insight" | "demand-exploration" | "competitor-analysis" | "product-decomposition";

export type EvidenceReference = {
  id: string;
  targetModule?: EvidenceReferenceModule;
  targetProjectId?: string;
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

export function isEvidenceReferenceDirectionAllowed(
  sourceModule: EvidenceReferenceModule,
  targetModule: EvidenceReferenceModule,
): boolean {
  return (sourceModule === "industry-insight" && (targetModule === "demand-exploration" || targetModule === "competitor-analysis"))
    || ((sourceModule === "demand-exploration" || sourceModule === "competitor-analysis") && targetModule === "product-decomposition");
}
