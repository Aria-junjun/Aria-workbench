import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadLocalWorkbenchData,
  saveLocalWorkbenchData,
  saveProductSupplierAssignments,
  type LocalProductSupplierAssignment,
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

const record = (supplierName: string, effectiveFrom: string): Omit<LocalProductSupplierAssignment, "id"> => ({
  productFamilyKey: "无胶白板贴小纸管",
  supplierId: supplierName === "供应商A" ? "supplier-a" : "supplier-b",
  supplierName,
  role: "primary",
  effectiveFrom,
  status: "active",
  source: "manual",
  reason: "确认当前主供",
  evidence: "实际入仓记录",
});

describe("product supplier assignment storage", () => {
  it("persists a product-family primary supplier and reloads it", () => {
    saveLocalWorkbenchData(baseData());

    saveProductSupplierAssignments([record("供应商A", "2026-07")]);

    expect(loadLocalWorkbenchData().productSupplierAssignments).toHaveLength(1);
    expect(loadLocalWorkbenchData().productSupplierAssignments?.[0].supplierName).toBe("供应商A");
  });

  it("ends the previous active primary record instead of deleting it", () => {
    saveLocalWorkbenchData(baseData());

    saveProductSupplierAssignments([record("供应商A", "2026-07")]);
    saveProductSupplierAssignments([record("供应商B", "2026-08")]);

    const records = loadLocalWorkbenchData().productSupplierAssignments ?? [];
    expect(records.some((item) => item.supplierName === "供应商A" && item.status === "ended")).toBe(true);
    expect(records.some((item) => item.supplierName === "供应商B" && item.status === "active")).toBe(true);
  });
});
