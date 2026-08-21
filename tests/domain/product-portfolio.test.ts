import { describe, expect, it } from "vitest";
import { normalizeProductPortfolioFields } from "@/features/workbench/product-portfolio";

describe("product portfolio classification", () => {
  it("keeps ambiguous legacy records out of automated decisions", () => {
    expect(normalizeProductPortfolioFields({})).toMatchObject({
      recordKind: "unclassified",
      productMode: "inbound",
      portfolioStatus: "observe"
    });
  });

  it("preserves an existing product classification and status", () => {
    expect(normalizeProductPortfolioFields({
      recordKind: "existing",
      productMode: "inbound",
      portfolioStatus: "active",
      internalProductCode: "Y-01BBT"
    })).toMatchObject({
      recordKind: "existing",
      productMode: "inbound",
      portfolioStatus: "active",
      internalProductCode: "Y-01BBT"
    });
  });

  it("allows an observation product without a formal warehouse code", () => {
    expect(normalizeProductPortfolioFields({
      recordKind: "observation",
      productMode: "dropship",
      observationCode: "DS-2026-001"
    })).toMatchObject({
      recordKind: "observation",
      productMode: "dropship",
      observationCode: "DS-2026-001"
    });
  });
});
