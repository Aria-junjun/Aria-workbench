import {
  calculateKanoScores,
  createEmptyKanoCounts,
  summarizeKanoResponses,
  type KanoResponse,
} from "@/features/workbench/demand-exploration";
import type { AiTaskDraft } from "./ai-task-protocol";

export type DemandDocumentStatus = "draft" | "in_progress" | "completed" | "archived";
export type DemandItemStatus = "pending" | "questions_ready" | "sampling" | "completed" | "needs_evidence" | "archived";
export type DemandQuestionKind = "exploration" | "functional" | "dysfunctional";

export type DemandQuestion = {
  id: string;
  text: string;
  kind: DemandQuestionKind;
  required: boolean;
};

export type DemandEvidence = {
  id: string;
  source: string;
  statement: string;
  note?: string;
};

export type DemandSection = {
  id: string;
  name: string;
  itemIds: string[];
};

export type DemandItem = {
  id: string;
  sectionId: string;
  subFeature: string;
  needStatement: string;
  questions: DemandQuestion[];
  evidence: DemandEvidence[];
  functionalQuestion: string;
  dysfunctionalQuestion: string;
  responses: KanoResponse[];
  counts: ReturnType<typeof createEmptyKanoCounts>;
  si: number | null;
  dsi: number | null;
  status: DemandItemStatus;
  createdAt: string;
  updatedAt: string;
};

export type DemandConfirmationDocument = {
  id: string;
  title: string;
  productName: string;
  productId?: string;
  opportunityProductId?: string;
  aiDrafts?: AiTaskDraft[];
  userType: string;
  scenario: string;
  problem: string;
  goal: string;
  source?: string;
  sections: DemandSection[];
  demandItems: DemandItem[];
  status: DemandDocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type DemandDocumentSummary = {
  demandItemCount: number;
  scoredDemandItemCount: number;
  comparableDemandItems: DemandItem[];
  evidencePendingCount: number;
  completedDemandItemCount: number;
};

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function now(): string {
  return new Date().toISOString();
}

export function createDemandConfirmationDocument(input: {
  title: string;
  productName: string;
  productId?: string;
  userType?: string;
  scenario?: string;
  problem?: string;
  goal?: string;
  source?: string;
}): DemandConfirmationDocument {
  const timestamp = now();
  return {
    id: makeId("demand-document"),
    title: input.title.trim(),
    productName: input.productName.trim(),
    productId: input.productId,
    userType: input.userType?.trim() ?? "",
    scenario: input.scenario?.trim() ?? "",
    problem: input.problem?.trim() ?? "",
    goal: input.goal?.trim() ?? "",
    source: input.source?.trim(),
    sections: [],
    demandItems: [],
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function archiveDemandConfirmationDocument(document: DemandConfirmationDocument): DemandConfirmationDocument {
  return { ...document, status: "archived", updatedAt: now() };
}

export function restoreDemandConfirmationDocument(document: DemandConfirmationDocument): DemandConfirmationDocument {
  const activeItems = document.demandItems.filter((item) => item.status !== "archived");
  const status: DemandDocumentStatus = activeItems.length === 0
    ? "draft"
    : activeItems.every((item) => item.status === "completed")
      ? "completed"
      : "in_progress";
  return { ...document, status, updatedAt: now() };
}

export function addDemandItem(
  document: DemandConfirmationDocument,
  input: { sectionName: string; subFeature: string; needStatement: string },
): DemandConfirmationDocument {
  const timestamp = now();
  const sectionName = input.sectionName.trim();
  const existingSection = document.sections.find((section) => section.name === sectionName);
  const section = existingSection ?? { id: makeId("demand-section"), name: sectionName, itemIds: [] };
  const item: DemandItem = {
    id: makeId("demand-item"),
    sectionId: section.id,
    subFeature: input.subFeature.trim(),
    needStatement: input.needStatement.trim(),
    questions: [],
    evidence: [],
    functionalQuestion: "",
    dysfunctionalQuestion: "",
    responses: [],
    counts: createEmptyKanoCounts(),
    si: null,
    dsi: null,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const nextSection = { ...section, itemIds: [...section.itemIds, item.id] };
  return {
    ...document,
    sections: existingSection
      ? document.sections.map((candidate) => candidate.id === section.id ? nextSection : candidate)
      : [...document.sections, nextSection],
    demandItems: [...document.demandItems, item],
    status: "in_progress",
    updatedAt: timestamp,
  };
}

export function addDemandQuestion(
  document: DemandConfirmationDocument,
  demandItemId: string,
  input: { text: string; kind: DemandQuestionKind; required?: boolean },
): DemandConfirmationDocument {
  const timestamp = now();
  return updateDemandItem(document, demandItemId, (item) => ({
    ...item,
    questions: [...item.questions, { id: makeId("demand-question"), text: input.text.trim(), kind: input.kind, required: input.required ?? false }],
    updatedAt: timestamp,
  }));
}

export function appendDemandResponse(
  document: DemandConfirmationDocument,
  demandItemId: string,
  response: KanoResponse,
): DemandConfirmationDocument {
  const timestamp = now();
  return updateDemandItem(document, demandItemId, (item) => {
    const responses = [...item.responses, { ...response, id: response.id ?? makeId("demand-response"), deletedAt: undefined }];
    const counts = summarizeKanoResponses(responses);
    const scores = calculateKanoScores(counts);
    return {
      ...item,
      responses,
      counts,
      si: scores.si,
      dsi: scores.dsi,
      status: scores.si === null ? "sampling" : "completed",
      updatedAt: timestamp,
    };
  });
}

export function editDemandItem(
  document: DemandConfirmationDocument,
  demandItemId: string,
  patch: { subFeature?: string; needStatement?: string },
): DemandConfirmationDocument {
  return updateDemandItem(document, demandItemId, (item) => ({
    ...item,
    subFeature: patch.subFeature?.trim() || item.subFeature,
    needStatement: patch.needStatement?.trim() || item.needStatement,
    updatedAt: now(),
  }));
}

export function archiveDemandItem(document: DemandConfirmationDocument, demandItemId: string): DemandConfirmationDocument {
  return updateDemandItem(document, demandItemId, (item) => ({ ...item, status: "archived", updatedAt: now() }));
}

export function restoreDemandItem(document: DemandConfirmationDocument, demandItemId: string): DemandConfirmationDocument {
  return updateDemandItem(document, demandItemId, (item) => ({ ...item, status: item.responses.length > 0 ? "completed" : "pending", updatedAt: now() }));
}

export function editDemandResponse(
  document: DemandConfirmationDocument,
  demandItemId: string,
  responseIndex: number,
  patch: Partial<Pick<KanoResponse, "functional" | "dysfunctional" | "respondentId" | "respondentRole" | "source" | "note">>,
): DemandConfirmationDocument {
  return updateResponseAndRecalculate(document, demandItemId, responseIndex, (response) => ({ ...response, ...patch, editedAt: now() }));
}

export function archiveDemandResponse(document: DemandConfirmationDocument, demandItemId: string, responseIndex: number): DemandConfirmationDocument {
  return updateResponseAndRecalculate(document, demandItemId, responseIndex, (response) => ({ ...response, deletedAt: now() }));
}

function updateResponseAndRecalculate(
  document: DemandConfirmationDocument,
  demandItemId: string,
  responseIndex: number,
  update: (response: KanoResponse) => KanoResponse,
): DemandConfirmationDocument {
  return updateDemandItem(document, demandItemId, (item) => {
    const responses = item.responses.map((response, index) => index === responseIndex ? update(response) : response);
    const counts = summarizeKanoResponses(responses);
    const scores = calculateKanoScores(counts);
    return { ...item, responses, counts, si: scores.si, dsi: scores.dsi, status: item.status === "archived" ? "archived" : scores.si === null ? "sampling" : "completed", updatedAt: now() };
  });
}

export function updateDemandItem(
  document: DemandConfirmationDocument,
  demandItemId: string,
  updater: (item: DemandItem) => DemandItem,
): DemandConfirmationDocument {
  return {
    ...document,
    demandItems: document.demandItems.map((item) => item.id === demandItemId ? updater(item) : item),
    updatedAt: now(),
  };
}

export function summarizeDemandDocument(document: DemandConfirmationDocument): DemandDocumentSummary {
  const activeDemandItems = document.demandItems.filter((item) => item.status !== "archived");
  const comparableDemandItems = activeDemandItems.filter((item) => item.si !== null && item.dsi !== null);
  return {
    demandItemCount: activeDemandItems.length,
    scoredDemandItemCount: comparableDemandItems.length,
    comparableDemandItems,
    evidencePendingCount: activeDemandItems.filter((item) => item.evidence.length === 0).length,
    completedDemandItemCount: activeDemandItems.filter((item) => item.status === "completed").length,
  };
}
