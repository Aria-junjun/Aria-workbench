import { describe, expect, it } from "vitest";
import { groupOffersByProduct, groupOffersBySupplier } from "@/components/workbench/offer-aggregate-views";

const offer = (name: string, supplierName: string) => ({
  id: `${name}-${supplierName}`,
  name,
  supplierName,
  createdAt: "2026-08-20T00:00:00.000Z"
});

describe("offer aggregates", () => {
  it("groups repeated product names so suppliers can be compared", () => {
    const groups = groupOffersByProduct([offer("防撞条", "供应商A"), offer("防撞条", "供应商B")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].offers).toHaveLength(2);
    expect(groups[0].inferred).toBe(true);
  });

  it("groups offers by supplier", () => {
    const groups = groupOffersBySupplier([offer("A", "供应商A"), offer("B", "供应商A")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].offers).toHaveLength(2);
  });
});
