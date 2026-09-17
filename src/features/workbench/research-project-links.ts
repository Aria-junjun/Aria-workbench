export function setOpportunityProductLink<T extends { opportunityProductId?: string }>(project: T, opportunityProductId?: string): T {
  const next = { ...project };
  if (opportunityProductId) next.opportunityProductId = opportunityProductId;
  else delete next.opportunityProductId;
  return next;
}
