const DEFAULT_SELECTION_COUNT = 2;
const MAX_SELECTION_COUNT = 3;

export function defaultSelectedToolIds(toolIds: string[]) {
  return toolIds.slice(0, DEFAULT_SELECTION_COUNT);
}

export function toggleSelectedToolId(current: string[], toolId: string, limit = MAX_SELECTION_COUNT) {
  if (current.includes(toolId)) {
    return { ids: current.filter((id) => id !== toolId), limitReached: false };
  }
  if (current.length >= limit) return { ids: current, limitReached: true };
  return { ids: [...current, toolId], limitReached: false };
}

export function parseSelectedToolIds(value: string | null, validIds: string[]) {
  const valid = new Set(validIds);
  return [...new Set((value || "").split(",").filter((id) => valid.has(id)))].slice(0, MAX_SELECTION_COUNT);
}

export function buildKnowledgeReturnHref(problem: string) {
  return `/knowledge?problem=${encodeURIComponent(problem.trim())}`;
}

export function buildCombinedSolveHref(problem: string, toolIds: string[]) {
  return `/knowledge/solve?problem=${encodeURIComponent(problem.trim())}&toolIds=${encodeURIComponent(toolIds.join(","))}`;
}
