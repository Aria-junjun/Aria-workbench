export const PRODUCT_RECORD_KINDS = ["opportunity", "existing", "observation", "archived", "unclassified"] as const;
export type ProductRecordKind = typeof PRODUCT_RECORD_KINDS[number];

export const PRODUCT_MODES = ["inbound", "dropship", "hybrid"] as const;
export type ProductMode = typeof PRODUCT_MODES[number];

export const PRODUCT_PORTFOLIO_STATUSES = ["active", "observe", "optimize", "paused", "discontinued"] as const;
export type ProductPortfolioStatus = typeof PRODUCT_PORTFOLIO_STATUSES[number];

export type ProductPortfolioFields = {
  recordKind: ProductRecordKind;
  productMode: ProductMode;
  portfolioStatus: ProductPortfolioStatus;
  internalProductCode?: string;
  observationCode?: string;
  productFamilyKey?: string;
};

export function normalizeProductPortfolioFields(input: Partial<ProductPortfolioFields>): ProductPortfolioFields {
  const recordKind = PRODUCT_RECORD_KINDS.includes(input.recordKind as ProductRecordKind)
    ? input.recordKind as ProductRecordKind
    : "unclassified";
  const productMode = PRODUCT_MODES.includes(input.productMode as ProductMode)
    ? input.productMode as ProductMode
    : "inbound";
  const defaultStatus: ProductPortfolioStatus = recordKind === "existing" ? "active" : "observe";
  const portfolioStatus = PRODUCT_PORTFOLIO_STATUSES.includes(input.portfolioStatus as ProductPortfolioStatus)
    ? input.portfolioStatus as ProductPortfolioStatus
    : defaultStatus;

  return {
    recordKind,
    productMode,
    portfolioStatus,
    ...(input.internalProductCode?.trim() ? { internalProductCode: input.internalProductCode.trim() } : {}),
    ...(input.observationCode?.trim() ? { observationCode: input.observationCode.trim() } : {}),
    ...(input.productFamilyKey?.trim() ? { productFamilyKey: input.productFamilyKey.trim() } : {})
  };
}
