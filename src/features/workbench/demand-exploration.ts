export type KanoCategory = "A" | "O" | "M" | "I" | "R" | "Q";

export type KanoAnswer = "like" | "must" | "neutral" | "accept" | "dislike";

export type KanoResponse = {
  id?: string;
  functional: KanoAnswer;
  dysfunctional: KanoAnswer;
  respondentId?: string;
  respondentRole?: string;
  answeredAt?: string;
  source?: string;
  note?: string;
  deletedAt?: string;
  editedAt?: string;
};

export type KanoCounts = Record<KanoCategory, number>;

export type KanoScore = {
  denominator: number;
  si: number | null;
  dsi: number | null;
};

export type KanoQuadrant = "priority" | "satisfaction" | "risk" | "low-impact" | "unscored";

export type KanoDemandAnalysis = {
  id: string;
  title: string;
  productId?: string;
  productFamily?: string;
  userType: string;
  scenario: string;
  problem: string;
  goal: string;
  feature: string;
  functionalQuestion: string;
  dysfunctionalQuestion: string;
  responses: KanoResponse[];
  counts: KanoCounts;
  si: number | null;
  dsi: number | null;
  status: "draft" | "in_progress" | "completed";
  createdAt: string;
  updatedAt: string;
};

const answers: KanoAnswer[] = ["like", "must", "neutral", "accept", "dislike"];

// Rows are functional answers and columns are dysfunctional answers.
const kanoMatrix: Record<KanoAnswer, Record<KanoAnswer, KanoCategory>> = {
  like: { like: "Q", must: "A", neutral: "A", accept: "A", dislike: "A" },
  must: { like: "R", must: "I", neutral: "I", accept: "I", dislike: "O" },
  neutral: { like: "R", must: "I", neutral: "I", accept: "I", dislike: "O" },
  accept: { like: "R", must: "I", neutral: "I", accept: "I", dislike: "O" },
  dislike: { like: "R", must: "R", neutral: "R", accept: "R", dislike: "Q" }
};

export function classifyKanoResponse(functional: KanoAnswer, dysfunctional: KanoAnswer): KanoCategory {
  return kanoMatrix[functional][dysfunctional];
}

export function summarizeKanoResponses(responses: KanoResponse[]): KanoCounts {
  const counts: KanoCounts = { A: 0, O: 0, M: 0, I: 0, R: 0, Q: 0 };
  for (const response of responses) {
    if (response.deletedAt) continue;
    if (!answers.includes(response.functional) || !answers.includes(response.dysfunctional)) continue;
    counts[classifyKanoResponse(response.functional, response.dysfunctional)] += 1;
  }
  return counts;
}

export function calculateKanoScores(counts: KanoCounts): KanoScore {
  const denominator = counts.A + counts.O + counts.M + counts.I;
  if (denominator === 0) return { denominator, si: null, dsi: null };
  return {
    denominator,
    si: (counts.A + counts.O) / denominator,
    dsi: -(counts.M + counts.O) / denominator
  };
}

export function calculateQuadrantPosition(
  score: { si: number | null; dsi: number | null },
  meanSi: number,
  meanDsi: number
): KanoQuadrant {
  if (score.si === null || score.dsi === null) return "unscored";
  if (score.si >= meanSi && score.dsi <= meanDsi) return "priority";
  if (score.si >= meanSi && score.dsi > meanDsi) return "satisfaction";
  if (score.si < meanSi && score.dsi <= meanDsi) return "risk";
  return "low-impact";
}

export function createEmptyKanoCounts(): KanoCounts {
  return { A: 0, O: 0, M: 0, I: 0, R: 0, Q: 0 };
}

export function parseKanoResponseText(text: string): { responses: KanoResponse[]; invalidRows: string[] } {
  const responses: KanoResponse[] = [];
  const invalidRows: string[] = [];
  for (const rawRow of text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean)) {
    const [functional, dysfunctional] = rawRow.split(/\t|,|\s{2,}/).map((value) => value.trim());
    if (answers.includes(functional as KanoAnswer) && answers.includes(dysfunctional as KanoAnswer)) {
      responses.push({ functional: functional as KanoAnswer, dysfunctional: dysfunctional as KanoAnswer });
    } else {
      invalidRows.push(rawRow);
    }
  }
  return { responses, invalidRows };
}

export function validateKanoQuestionDraft(input: {
  feature: string;
  functionalQuestion: string;
  dysfunctionalQuestion: string;
}): Partial<Record<"feature" | "functionalQuestion" | "dysfunctionalQuestion" | "questionPair", string>> {
  const errors: Partial<Record<"feature" | "functionalQuestion" | "dysfunctionalQuestion" | "questionPair", string>> = {};
  if (!input.feature.trim()) errors.feature = "请填写一个可被用户感知的产品特性";
  if (!input.functionalQuestion.trim()) errors.functionalQuestion = "请填写正向问题";
  if (!input.dysfunctionalQuestion.trim()) errors.dysfunctionalQuestion = "请填写反向问题";
  if (input.functionalQuestion.trim() && input.functionalQuestion.trim() === input.dysfunctionalQuestion.trim()) {
    errors.questionPair = "正向问题和反向问题需要分别描述有/没有该特性";
  }
  return errors;
}
