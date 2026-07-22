import { describe, expect, it } from "vitest";
import { calculateHardCost, normalizeProductKnowledge, type ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";

describe("product knowledge v2", () => {
  it("migrates legacy text fields without inventing structured costs", () => {
    const product = normalizeProductKnowledge({
      id: "legacy-1",
      name: "亚克力留言板",
      materials: "3mm 亚克力板",
      costStructure: "板材和激光切割",
      keyParameters: "尺寸 20x30cm",
      createdAt: "2026-07-01T00:00:00.000Z"
    });

    expect(product.schemaVersion).toBe(2);
    expect(product.specifications).toContainEqual(expect.objectContaining({ name: "旧版关键参数" }));
    expect(product.costItems).toEqual([]);
    expect(product.hardCostStatus).toBe("pending");
    expect(product.legacyNotes).toContain("板材和激光切割");
  });

  it("returns pending when any included cost lacks a subtotal", () => {
    expect(calculateHardCost([
      { id: "1", category: "主材", name: "亚克力板", subtotal: 8, currency: "CNY" },
      { id: "2", category: "加工", name: "激光切割", currency: "CNY" }
    ])).toEqual({ status: "pending" });
  });

  it("sums complete hard-cost rows", () => {
    expect(calculateHardCost([
      { id: "1", category: "主材", name: "亚克力板", quantity: 1, unit: "个", unitCost: 8, subtotal: 8, currency: "CNY", source: "厂家报价；浙江；2026-07-15；高" },
      { id: "2", category: "加工", name: "激光切割", quantity: 1, unit: "个", unitCost: 2, subtotal: 2, currency: "CNY", source: "厂家报价；浙江；2026-07-15；高" }
    ])).toEqual({ total: 10, status: "confirmed" });
  });

  it("keeps hard costs pending without a confirmed currency or consistent currency", () => {
    const completeItem = { id: "1", category: "主材", name: "亚克力板", quantity: 1, unit: "个", unitCost: 8, subtotal: 8, source: "厂家报价；浙江；2026-07-15；高" };

    expect(calculateHardCost([completeItem])).toEqual({ status: "pending" });
    expect(calculateHardCost([{ ...completeItem, currency: "CNY" }, { ...completeItem, id: "2", currency: "USD" }])).toEqual({ status: "pending" });
  });

  it("preserves malformed structured values and records import issues", () => {
    const malformedCostItem = { id: 42, category: "加工", name: "激光切割", subtotal: 2 };
    const malformedRisks = { quality: ["易脆裂"], supply: "单一供应商" };
    const malformedDocument = { sourceName: 42, content: ["原始调研内容"] };

    const product = normalizeProductKnowledge({
      id: "partial-v2",
      name: "亚克力留言板",
      createdAt: "2026-07-01T00:00:00.000Z",
      costItems: [
        { id: "cost-1", category: "主材", name: "亚克力板", subtotal: 8, currency: "CNY" },
        malformedCostItem
      ],
      risks: malformedRisks,
      rawDocument: malformedDocument,
      opportunities: ["增加防刮膜", 42],
      oldLegacyField: { note: "保留这段旧数据" },
      schemaVersion: 7,
      pinned: "yes",
      updatedAt: 99,
      supplierId: []
    });

    expect(product.costItems).toEqual([
      { id: "cost-1", category: "主材", name: "亚克力板", subtotal: 8, currency: "CNY" }
    ]);
    expect(product.risks.quality).toEqual(["易脆裂"]);
    expect(product.rawDocument?.rawData).toMatchObject({
      costItems: [malformedCostItem],
      risks: malformedRisks,
      rawDocument: malformedDocument,
      opportunities: [42],
      oldLegacyField: { note: "保留这段旧数据" },
      schemaVersion: 7,
      pinned: "yes",
      updatedAt: 99,
      supplierId: []
    });
    expect(product.importIssues.map((issue) => issue.field)).toEqual(expect.arrayContaining([
      "costItems[1]",
      "risks",
      "rawDocument",
      "opportunities[1]",
      "oldLegacyField",
      "schemaVersion",
      "pinned",
      "updatedAt",
      "supplierId"
    ]));
  });

  it("marks generated identity fields instead of presenting them as legacy values", () => {
    const product = normalizeProductKnowledge({ materials: "3mm 亚克力板" });

    expect(product.id).toMatch(/^imported-/);
    expect(product.name).toMatch(/^导入记录-/);
    expect(product.createdAt).toBe("unknown");
    expect(product.importIssues.map((issue) => issue.field)).toEqual(expect.arrayContaining([
      "id",
      "name",
      "createdAt"
    ]));
  });

  it("preserves unverified V2 hard-cost totals outside the confirmed contract", () => {
    const product = normalizeProductKnowledge({
      schemaVersion: 2,
      id: "v2-pending-cost",
      name: "亚克力留言板",
      useScenarios: [],
      specifications: [],
      costItems: [{ id: "cost-1", category: "加工", name: "激光切割", currency: "CNY" }],
      hardCostTotal: 10,
      hardCostStatus: "confirmed",
      manufacturing: { processes: [] },
      optimizationOptions: [],
      risks: { quality: [], supply: [], compliance: [], other: [] },
      opportunities: [],
      decision: { status: "undecided" },
      importIssues: [],
      createdAt: "2026-07-01T00:00:00.000Z"
    });

    expect(product.hardCostTotal).toBeUndefined();
    expect(product.hardCostStatus).toBe("pending");
    expect(product.rawDocument?.rawData).toMatchObject({ hardCostTotal: 10, hardCostStatus: "confirmed" });
    expect(product.importIssues.map((issue) => issue.field)).toEqual(expect.arrayContaining([
      "hardCostTotal",
      "hardCostStatus"
    ]));
  });

  it("maps legacy error to blocking and preserves current issue severities", () => {
    const product = normalizeProductKnowledge(validV2Product({
      importIssues: [
        { field: "legacy", message: "旧阻断", severity: "error" },
        { field: "blocking", message: "阻断", severity: "blocking" },
        { field: "warning", message: "警告", severity: "warning" },
        { field: "conflict", message: "冲突", severity: "conflict" }
      ]
    }));

    expect(product.importIssues.map((issue) => issue.severity)).toEqual([
      "blocking",
      "blocking",
      "warning",
      "conflict"
    ]);
  });

  it("maps unknown issue severity to warning and preserves the raw evidence", () => {
    const unknownIssue = { field: "future", message: "未来问题", severity: "future-severity" };
    const product = normalizeProductKnowledge(validV2Product({ importIssues: [unknownIssue] }));

    expect(product.importIssues).toContainEqual({ field: "future", message: "未来问题", severity: "warning" });
    expect(product.rawDocument?.rawData).toMatchObject({ importIssues: [unknownIssue] });
  });

  it("treats a missing issue severity as warning and preserves the raw evidence", () => {
    const issueWithoutSeverity = { field: "future", message: "future issue" };
    const product = normalizeProductKnowledge(validV2Product({
      importIssues: [issueWithoutSeverity] as unknown as ProductKnowledgeV2["importIssues"]
    }));

    expect(product.importIssues).toContainEqual({ field: "future", message: "future issue", severity: "warning" });
    expect(product.rawDocument?.rawData).toMatchObject({ importIssues: [issueWithoutSeverity] });
  });

  it("records distinct raw-data field conflicts without replacing the existing value", () => {
    const input = validV2Product({
      costItems: [{ id: "cost-1", category: "processing", name: "Laser cutting", currency: "CNY" }],
      hardCostTotal: 10,
      hardCostStatus: "confirmed",
      rawDocument: {
        rawData: {
          hardCostTotal: 8,
          conflicts: { priorValue: ["keep"] }
        }
      }
    });

    const product = normalizeProductKnowledge(input);
    const rawData = product.rawDocument?.rawData as {
      hardCostTotal?: unknown;
      conflicts?: Record<string, unknown[]>;
    };

    expect(rawData).toMatchObject({
      hardCostTotal: 8,
      conflicts: {
        priorValue: ["keep"],
        hardCostTotal: [8, 10]
      }
    });

    const repeated = normalizeProductKnowledge(input);
    const repeatedRawData = repeated.rawDocument?.rawData as { conflicts?: Record<string, unknown[]> };
    expect(repeatedRawData.conflicts?.hardCostTotal).toEqual([8, 10]);
    expect(repeatedRawData.conflicts?.priorValue).toEqual(["keep"]);
  });

  it("preserves unknown top-level payloads from otherwise valid V2 records", () => {
    const vendorPayload = { supplierCode: "VENDOR-001", inspectionGrade: "A" };
    const product = normalizeProductKnowledge(validV2Product({ legacyVendorPayload: vendorPayload }));

    expect(product.rawDocument?.rawData).toMatchObject({ originalRecord: { legacyVendorPayload: vendorPayload } });
    expect(product.importIssues.filter((issue) => issue.field === "originalRecord")).toHaveLength(1);
  });

  it("captures unknown nested cost item data in one original-record snapshot", () => {
    const vendorPayload = { quoteReference: "Q-100", source: "factory" };
    const product = normalizeProductKnowledge(validV2Product({
      costItems: [{ id: "cost-1", category: "主材", name: "亚克力板", subtotal: 8, currency: "CNY", vendorPayload }],
      hardCostStatus: "confirmed"
    }));

    expect(product.rawDocument?.rawData).toMatchObject({
      originalRecord: { costItems: [expect.objectContaining({ vendorPayload })] }
    });
    expect(product.importIssues.filter((issue) => issue.field === "originalRecord")).toHaveLength(1);

    const normalizedAgain = normalizeProductKnowledge(product);
    expect(normalizedAgain.rawDocument?.rawData).toMatchObject({
      originalRecord: { costItems: [expect.objectContaining({ vendorPayload })] }
    });
    const rawData = normalizedAgain.rawDocument?.rawData as { originalRecord?: unknown } | undefined;
    expect(rawData?.originalRecord).not.toHaveProperty("rawData");
    expect(normalizedAgain.importIssues.filter((issue) => issue.field === "originalRecord")).toHaveLength(1);
  });

  it("captures unknown manufacturing and risk data in one original-record snapshot", () => {
    const product = normalizeProductKnowledge(validV2Product({
      manufacturing: { processes: ["激光切割"], vendorRoute: { factory: "A" } },
      risks: { quality: [], supply: [], compliance: [], other: [], vendorRating: "A" }
    }));

    expect(product.rawDocument?.rawData).toMatchObject({
      originalRecord: {
        manufacturing: expect.objectContaining({ vendorRoute: { factory: "A" } }),
        risks: expect.objectContaining({ vendorRating: "A" })
      }
    });
    expect(product.importIssues.filter((issue) => issue.field === "originalRecord")).toHaveLength(1);
  });

  it("preserves the complete legacy candidate when an invalid required field enters migration", () => {
    const vendorPayload = { quoteReference: "Q-200", source: "factory" };
    const product = normalizeProductKnowledge(validV2Product({
      id: 42,
      costItems: [{ id: "cost-1", category: "material", name: "Acrylic", subtotal: 8, currency: "CNY", vendorPayload }],
      risks: { quality: [], supply: [], compliance: [], other: [], vendorRating: "A" },
      rawDocument: {
        sourceName: "Vendor export",
        content: "Original research document",
        rawData: { importedAt: "2026-07-16" }
      }
    }));

    expect(product.rawDocument).toMatchObject({
      sourceName: "Vendor export",
      content: "Original research document",
      rawData: {
        importedAt: "2026-07-16",
        originalRecord: {
          id: 42,
          costItems: [expect.objectContaining({ vendorPayload })],
          risks: expect.objectContaining({ vendorRating: "A" })
        }
      }
    });
    expect(product.importIssues.filter((issue) => issue.field === "originalRecord")).toHaveLength(1);
  });

  it("appends distinct migration snapshots without replacing existing raw data or duplicate issues", () => {
    const existingOriginalRecord = { legacyProductId: "legacy-001" };
    const schemaSuccess = normalizeProductKnowledge(validV2Product({
      rawDocument: {
        sourceName: "Existing import",
        rawData: { originalRecord: existingOriginalRecord, retainedValue: "keep" }
      },
      legacyVendorPayload: { quoteReference: "Q-300" }
    }));
    const schemaSuccessRawData = schemaSuccess.rawDocument?.rawData as {
      originalRecord?: unknown;
      migrationRecords?: unknown[];
      retainedValue?: unknown;
    };

    expect(schemaSuccessRawData).toMatchObject({
      originalRecord: existingOriginalRecord,
      retainedValue: "keep",
      migrationRecords: [expect.objectContaining({ legacyVendorPayload: { quoteReference: "Q-300" } })]
    });

    const legacyInput = {
      ...schemaSuccess,
      id: 42,
      importIssues: [...schemaSuccess.importIssues, ...schemaSuccess.importIssues]
    };
    const migrated = normalizeProductKnowledge(legacyInput);
    const migratedRawData = migrated.rawDocument?.rawData as {
      originalRecord?: unknown;
      migrationRecords?: unknown[];
      retainedValue?: unknown;
    };

    expect(migratedRawData).toMatchObject({
      originalRecord: existingOriginalRecord,
      retainedValue: "keep",
      migrationRecords: [
        expect.objectContaining({ legacyVendorPayload: { quoteReference: "Q-300" } }),
        expect.objectContaining({ id: 42 })
      ]
    });
    expect(migratedRawData.migrationRecords).toHaveLength(2);
    expect(migratedRawData.migrationRecords?.every((record) => !Object.prototype.hasOwnProperty.call(record, "rawData"))).toBe(true);

    const migratedIssueKeys = migrated.importIssues.map((issue) => `${issue.severity}:${issue.field}:${issue.message}`);
    expect(new Set(migratedIssueKeys)).toHaveLength(migratedIssueKeys.length);

    const repeated = normalizeProductKnowledge(legacyInput);
    const repeatedRawData = repeated.rawDocument?.rawData as { migrationRecords?: unknown[] };
    expect(repeatedRawData.migrationRecords).toHaveLength(2);
    expect(repeated.importIssues).toEqual(migrated.importIssues);
  });

  it("stores production intelligence fields for procurement and manufacturing decisions", () => {
    const product = normalizeProductKnowledge(validV2Product({
      procurementQuotes: [{ source: "1688", specification: "20×30cm", price: "12元/套", moq: "10套" }],
      materialStructures: [{ name: "亚克力板", role: "主体板材", keyParameters: "厚度、透光率" }],
      machinery: ["激光切割机", "UV打印机"],
      qualityControls: ["检查板材平整度"],
      industryClusters: ["浙江台州"],
      technologyOutlook: {
        mainstream: ["激光切割+UV打印"],
        alternatives: [],
        emerging: [],
        replacementRisks: [],
        watchSignals: []
      }
    }));

    expect(product.procurementQuotes).toEqual([
      expect.objectContaining({ source: "1688", price: "12元/套", moq: "10套" })
    ]);
    expect(product.materialStructures).toEqual([
      expect.objectContaining({ name: "亚克力板", role: "主体板材" })
    ]);
    expect(product.machinery).toEqual(["激光切割机", "UV打印机"]);
    expect(product.qualityControls).toEqual(["检查板材平整度"]);
    expect(product.industryClusters).toEqual(["浙江台州"]);
    expect(product.technologyOutlook?.mainstream).toEqual(["激光切割+UV打印"]);
  });

  it("initializes production intelligence fields when reading an older product", () => {
    const product = normalizeProductKnowledge(validV2Product());

    expect(product.procurementQuotes).toEqual([]);
    expect(product.materialStructures).toEqual([]);
    expect(product.machinery).toEqual([]);
    expect(product.qualityControls).toEqual([]);
    expect(product.industryClusters).toEqual([]);
    expect(product.technologyOutlook).toBeUndefined();
  });
});

function validV2Product(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    id: "valid-v2-product",
    name: "亚克力留言板",
    useScenarios: [],
    specifications: [],
    costItems: [],
    hardCostStatus: "pending",
    manufacturing: { processes: [] },
    optimizationOptions: [],
    risks: { quality: [], supply: [], compliance: [], other: [] },
    opportunities: [],
    decision: { status: "undecided" },
    importIssues: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides
  };
}
