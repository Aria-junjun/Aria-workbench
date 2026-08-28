import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  invalidateSupplierCapability,
  loadLocalWorkbenchData,
  saveLocalWorkbenchData,
  saveSupplierCapabilities,
  type LocalSupplierCapability,
} from "@/features/workbench/local-store";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
});

const baseData = () => ({
  suppliers: [], communications: [], offers: [], products: [], tasks: [],
  knowledgeCards: [], knowledgeBooks: [], decisionTools: [], knowledgeApplications: [],
  decisionCases: [], researchReports: [],
});

const capability = (overrides: Partial<LocalSupplierCapability> = {}): Omit<LocalSupplierCapability, "id" | "createdAt" | "updatedAt"> => ({
  supplierId: "supplier-a",
  productFamilyKey: "无胶白板贴小纸管",
  processNames: ["涂布"],
  materialNames: ["PET"],
  equipmentNames: ["涂布机"],
  supportsSampling: true,
  supportsCustomization: false,
  sourceRecordIds: ["offer-a"],
  sourceType: "offer",
  status: "verified",
  effectiveFrom: "2026-07",
  ...overrides,
});

describe("supplier capability storage", () => {
  it("saves a capability and reloads it from local data", () => {
    saveLocalWorkbenchData(baseData());

    const saved = saveSupplierCapabilities([capability()]);

    expect(saved).toHaveLength(1);
    expect(loadLocalWorkbenchData().supplierCapabilities).toEqual(saved);
  });

  it("replaces the same supplier capability period without creating duplicates", () => {
    saveLocalWorkbenchData(baseData());

    const first = saveSupplierCapabilities([capability()])[0];
    const updated = saveSupplierCapabilities([capability({ leadTime: "7天" })]);

    expect(updated[0].id).toBe(first.id);
    expect(loadLocalWorkbenchData().supplierCapabilities).toHaveLength(1);
    expect(loadLocalWorkbenchData().supplierCapabilities?.[0].leadTime).toBe("7天");
  });

  it("invalidates a capability while preserving its history", () => {
    saveLocalWorkbenchData(baseData());
    const saved = saveSupplierCapabilities([capability()])[0];

    invalidateSupplierCapability(saved.id);

    expect(loadLocalWorkbenchData().supplierCapabilities?.[0].status).toBe("expired");
  });
});
