import { describe, expect, it } from "vitest";
import { findSupplierCapabilityMatches, type SupplierCapabilityMatchInput } from "@/features/workbench/supplier-capability";

const baseInput = (): SupplierCapabilityMatchInput => ({
  productFamilyKey: "无胶白板贴小纸管",
  processNames: ["涂布"],
  materialNames: ["PET"],
  equipmentNames: ["涂布机"],
  capabilities: [
    {
      id: "cap-a",
      supplierId: "supplier-a",
      productFamilyKey: "无胶白板贴小纸管",
      processNames: ["涂布"],
      materialNames: ["PET"],
      equipmentNames: ["涂布机"],
      sourceRecordIds: ["offer-a"],
      sourceType: "offer",
      status: "verified",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  ],
});

describe("supplier capability matching", () => {
  it("returns a verified match when all declared capability dimensions match", () => {
    const [match] = findSupplierCapabilityMatches(baseInput());

    expect(match.supplierId).toBe("supplier-a");
    expect(match.matchedDimensions).toEqual(["产品族", "工艺", "原材料", "设备"]);
    expect(match.status).toBe("verified");
  });

  it("requires review when only the product family matches", () => {
    const input = baseInput();
    input.capabilities[0].processNames = [];
    input.capabilities[0].materialNames = [];
    input.capabilities[0].equipmentNames = [];

    const [match] = findSupplierCapabilityMatches(input);

    expect(match.matchedDimensions).toEqual(["产品族"]);
    expect(match.status).toBe("needs_review");
  });

  it("does not use similar names as product-family evidence", () => {
    const input = baseInput();
    input.capabilities[0].productFamilyKey = "白板贴";

    const [match] = findSupplierCapabilityMatches(input);

    expect(match.matchedDimensions).not.toContain("产品族");
    expect(match.status).toBe("needs_review");
  });
});
