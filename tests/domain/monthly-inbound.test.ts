import { describe, expect, it } from "vitest";
import { aggregateMonthlyInbound } from "@/features/workbench/monthly-inbound";

describe("monthly inbound domain", () => {
  it("aggregates received quantities while preserving unavailable optional values", () => {
    expect(aggregateMonthlyInbound([
      { receivedQuantity: 500, actualStock: 120 },
      { receivedQuantity: 300, actualStock: 80, availableStock: 150, inTransitQuantity: 20 },
    ])).toEqual({
      receivedQuantity: 800,
      actualStock: 200,
      availableStock: 150,
      inventoryGap: 50,
      inTransitQuantity: 20,
    });
  });

  it("does not turn blank values into zero", () => {
    expect(aggregateMonthlyInbound([
      { receivedQuantity: 500 },
      { receivedQuantity: 300 },
    ])).toEqual({
      receivedQuantity: 800,
      actualStock: undefined,
      availableStock: undefined,
      inventoryGap: undefined,
      inTransitQuantity: undefined,
    });
  });
});
