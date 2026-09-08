export type KanoCategory = "A" | "O" | "M" | "I" | "R" | "Q";

export type KanoAnswer = "like" | "must" | "neutral" | "accept" | "dislike";

export type KanoResponse = {
  functional: KanoAnswer;
  dysfunctional: KanoAnswer;
  respondentId?: string;
  respondentRole?: string;
  answeredAt?: string;
  source?: string;
  note?: string;
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
