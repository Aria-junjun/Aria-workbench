export type ResearchInput = {
  knownMaterials: string;
  personalObservations: string;
  initialHypotheses: string;
  focusQuestions: string;
  excludedDirections: string;
};

export type NeutralResearchSummary = {
  summary: string;
  keyObservations: string;
  informationGaps: string;
  sourceSection: string;
};

export const emptyResearchInput = (): ResearchInput => ({
  knownMaterials: "",
  personalObservations: "",
  initialHypotheses: "",
  focusQuestions: "",
  excludedDirections: "",
});

export const emptyNeutralResearchSummary = (): NeutralResearchSummary => ({
  summary: "",
  keyObservations: "",
  informationGaps: "",
  sourceSection: "",
});
