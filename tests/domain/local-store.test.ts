import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTaskFromKnowledgeAction,
  addDecisionCycle,
  applicationVersions,
  createDecisionCase,
  deleteKnowledgeBook,
  saveAnalyzedKnowledgeApplication,
  saveKnowledgeApplication,
  saveKnowledgeApplicationVersion,
  savePlainKnowledgeApplication,
  deleteLocalItem,
  exportLocalWorkbenchData,
  importLocalWorkbenchData,
  loadLocalWorkbenchData,
  loadDecisionCases,
  mergeSuppliers,
  repairKnowledgeBookFromRawText,
  saveDraftToLocalWorkbench,
  saveBookPackage,
  saveLocalWorkbenchData,
  saveSupplierEvaluation,
  saveSkuOperatingSnapshot,
  saveMonthlyInboundSnapshots,
  archiveSkuMaster,
  saveSupplierOfferDecision,
  saveSupplierDecisionRecord,
  completeSupplierDecisionRecord,
  updateLocalItem,
  type LocalWorkbenchData,
  type LocalSupplier
} from "@/features/workbench/local-store";
import { parseBookPackage } from "@/features/workbench/knowledge-library";
import { parseProductResearchMarkdown } from "@/features/workbench/product-research-parser";
import type { ParsedProductResearch } from "@/features/workbench/product-research-parser";
import {
  deleteProductImportDraft,
  loadProductImportDraft,
  saveProductImportDraft,
  saveProductKnowledge,
  updateProductImportDraft
} from "@/features/workbench/product-import-store";
import type { ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    }
  });
});

describe("local-store operations", () => {
  it("updates a local item", () => {
    saveLocalWorkbenchData(sampleData());

    updateLocalItem("suppliers", "supplier-1", { location: "义乌" });

    expect(loadLocalWorkbenchData().suppliers[0].location).toBe("义乌");
  });

  it("deletes a local item", () => {
    saveLocalWorkbenchData(sampleData());

    deleteLocalItem("offers", "offer-1");

    expect(loadLocalWorkbenchData().offers).toHaveLength(0);
  });

  it("exports and imports workbench data", () => {
    saveLocalWorkbenchData(sampleData());

    const backup = exportLocalWorkbenchData();
    storage.clear();
    importLocalWorkbenchData(backup);

    expect(loadLocalWorkbenchData().knowledgeCards[0].title).toBe("先不接受首次报价");
  });

  it("preserves monthly SKU operating snapshots across updates and backup restore", () => {
    saveLocalWorkbenchData(sampleData());
    saveSkuOperatingSnapshot("sku-1", "2026-08", { monthlySales: 12, salesAmount: 120, grossMarginRate: 25 });
    saveSkuOperatingSnapshot("sku-1", "2026-09", { monthlySales: 15, salesAmount: 150, grossMarginRate: 28 });

    const backup = exportLocalWorkbenchData();
    expect(JSON.parse(backup).skuOperatingSnapshots).toHaveLength(2);
    storage.clear();
    importLocalWorkbenchData(backup);

    expect(loadLocalWorkbenchData().skuOperatingSnapshots).toMatchObject([
      { skuMasterId: "sku-1", period: "2026-09", monthlySales: 15 },
      { skuMasterId: "sku-1", period: "2026-08", monthlySales: 12 }
    ]);
  });

  it("keeps inbound facts by month and replaces only the same SKU/month", () => {
    saveLocalWorkbenchData(sampleData());
    saveMonthlyInboundSnapshots([
      { skuMasterId: "sku-1", period: "2026-07", receivedQuantity: 500, sourceFileName: "july.xlsx", sourceSheetName: "Sheet1", importedAt: "now" },
      { skuMasterId: "sku-1", period: "2026-08", receivedQuantity: 300, sourceFileName: "august.xlsx", sourceSheetName: "Sheet1", importedAt: "now" }
    ]);
    saveMonthlyInboundSnapshots([
      { skuMasterId: "sku-1", period: "2026-08", receivedQuantity: 320, sourceFileName: "august-revised.xlsx", sourceSheetName: "Sheet1", importedAt: "later" }
    ]);

    expect(loadLocalWorkbenchData().monthlyInboundSnapshots).toMatchObject([
      { skuMasterId: "sku-1", period: "2026-08", receivedQuantity: 320, sourceFileName: "august-revised.xlsx" },
      { skuMasterId: "sku-1", period: "2026-07", receivedQuantity: 500, sourceFileName: "july.xlsx" }
    ]);
  });

  it("archives a SKU without deleting its operating snapshots or offer links", () => {
    const data = sampleData();
    data.skuMasters = [{
      id: "sku-1",
      internalSkuCode: "Y-01",
      productName: "商品A",
      specification: "规格1",
      status: "ready",
      source: "manual",
      importedAt: "2026-08-20"
    }];
    data.skuOperatingSnapshots = [{
      id: "snapshot-1",
      skuMasterId: "sku-1",
      period: "2026-08",
      monthlySales: 10,
      source: "manual",
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z"
    }];
    data.skuOfferLinks = [{
      id: "link-1",
      skuMasterId: "sku-1",
      offerId: "offer-1",
      status: "confirmed",
      confirmedAt: "2026-08-20T00:00:00.000Z"
    }];

    saveLocalWorkbenchData(data);
    archiveSkuMaster("sku-1");

    const saved = loadLocalWorkbenchData();
    expect(saved.skuMasters?.[0].status).toBe("archived");
    expect(saved.skuOperatingSnapshots).toHaveLength(1);
    expect(saved.skuOfferLinks).toHaveLength(1);
  });

  it("keeps supply decision history when a supplier decision changes", () => {
    saveLocalWorkbenchData(sampleData());
    saveSupplierOfferDecision({ productId: "product-1", skuMasterId: "sku-1", supplierId: "supplier-1", offerId: "offer-1", status: "candidate", reason: "先观察" });
    saveSupplierOfferDecision({ productId: "product-1", skuMasterId: "sku-1", supplierId: "supplier-1", offerId: "offer-1", status: "primary", reason: "价格和交期更稳定" });

    const saved = loadLocalWorkbenchData();
    expect(saved.supplierOfferDecisions?.[0].status).toBe("primary");
    expect(saved.supplierOfferDecisionHistory).toHaveLength(2);
    expect(saved.supplierOfferDecisionHistory?.map((item) => item.status)).toEqual(["candidate", "primary"]);
  });

  it("stores and completes a supplier decision record without changing source evidence", () => {
    saveLocalWorkbenchData(sampleData());

    const record = saveSupplierDecisionRecord({
      supplierId: "supplier-1",
      period: "2026-Q3",
      action: "review_split",
      reason: "同一产品族存在多个实际供货供应商",
      evidence: "7月实际入仓记录",
    });

    expect(loadLocalWorkbenchData().supplierDecisionRecords).toEqual([expect.objectContaining({
      id: record.id,
      supplierId: "supplier-1",
      action: "review_split",
      status: "open",
    })]);

    completeSupplierDecisionRecord(record.id);

    expect(loadLocalWorkbenchData().supplierDecisionRecords?.[0]).toMatchObject({
      id: record.id,
      status: "completed",
    });
    expect(loadLocalWorkbenchData().monthlyInboundSnapshots).toEqual(sampleData().monthlyInboundSnapshots ?? []);
  });

  it("normalizes legacy product backups before saving and exporting", () => {
    const imported = importLocalWorkbenchData(JSON.stringify({
      products: [
        {
          id: "legacy-backup-product",
          name: "亚克力留言板",
          materials: "3mm 亚克力板",
          costStructure: "板材和激光切割",
          createdAt: "2026-07-01T00:00:00.000Z"
        }
      ]
    }));

    expect(imported.products[0]).toMatchObject({
      schemaVersion: 2,
      costItems: [],
      hardCostStatus: "pending"
    });

    const exported = JSON.parse(exportLocalWorkbenchData()) as LocalWorkbenchData;
    expect(exported.products[0]).toMatchObject({
      schemaVersion: 2,
      materials: "3mm 亚克力板",
      legacyNotes: "板材和激光切割"
    });
  });

  it("preserves unknown raw document payloads in valid V2 exports", () => {
    const vendorPayload = { factoryReference: "F-2026", inspectionPhoto: "image-1" };
    storage.set(
      "personal-commercial-workbench",
      JSON.stringify({
        products: [
          {
            schemaVersion: 2,
            id: "v2-raw-document",
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
            rawDocument: { content: "供应商调研", vendorPayload },
            importIssues: [],
            createdAt: "2026-07-01T00:00:00.000Z"
          }
        ]
      })
    );

    const exported = JSON.parse(exportLocalWorkbenchData()) as LocalWorkbenchData;
    const product = exported.products[0];

    expect(product.rawDocument?.rawData).toMatchObject({ originalRecord: { rawDocument: { vendorPayload } } });
    expect(product.importIssues.filter((issue) => issue.field === "originalRecord")).toHaveLength(1);
  });

  it("rejects invalid backup JSON", () => {
    expect(() => importLocalWorkbenchData("{broken")).toThrow("备份文件不是有效的 JSON。");
  });

  it("normalizes older supplier records without array fields", () => {
    storage.set(
      "personal-commercial-workbench",
      JSON.stringify({
        suppliers: [
          {
            id: "legacy-supplier",
            name: "旧供应商",
            createdAt: "2026-07-09T00:00:00.000Z"
          }
        ]
      })
    );

    const supplier = loadLocalWorkbenchData().suppliers[0];

    expect(supplier.categories).toEqual([]);
    expect(supplier.riskTags).toEqual([]);
    expect(loadLocalWorkbenchData().knowledgeBooks).toEqual([]);
    expect(loadLocalWorkbenchData().decisionTools).toEqual([]);
    expect(loadLocalWorkbenchData().knowledgeApplications).toEqual([]);
  });

  it("migrates legacy product records when loading local data", () => {
    storage.set(
      "personal-commercial-workbench",
      JSON.stringify({
        products: [
          {
            id: "legacy-product",
            name: "亚克力留言板",
            materials: "3mm 亚克力板",
            costStructure: "板材和激光切割",
            keyParameters: "尺寸 20x30cm",
            createdAt: "2026-07-01T00:00:00.000Z"
          }
        ]
      })
    );

    const product = loadLocalWorkbenchData().products[0];

    expect(product).toMatchObject({
      schemaVersion: 2,
      costItems: [],
      hardCostStatus: "pending"
    });
    expect(product.specifications).toContainEqual(expect.objectContaining({ name: "旧版关键参数" }));
  });

  it("normalizes legacy books without a valid cover", () => {
    storage.set(
      "personal-commercial-workbench",
      JSON.stringify({
        knowledgeBooks: [
          {
            id: "legacy-book",
            title: "旧书籍",
            coverImage: 42,
            createdAt: "2026-07-09T00:00:00.000Z"
          }
        ]
      })
    );

    const book = loadLocalWorkbenchData().knowledgeBooks[0];

    expect(book.businessScenarios).toEqual([]);
    expect(book.coverImage).toBeUndefined();
  });

  it("saves one imported book and all of its tools together", () => {
    const parsed = parseBookPackage(`【书籍】
书名：《竞争战略》
作者：迈克尔·波特
主要解决的问题：选择竞争位置

【决策工具】
工具名称：替代品分析
解决的问题：判断替代产品的压力
触发信号：顾客在不同材料之间选择
诊断问题：顾客购买的任务是什么
行动建议：按用户任务重新分组
不适用情况：不存在替代关系
来源章节：替代品
关联标签：竞品、替代品

【决策工具】
工具名称：差异化判断
解决的问题：判断溢价是否成立
触发信号：消费者不理解价差
诊断问题：差异是否可以感知
行动建议：建立真实测试
不适用情况：差异无法验证
来源章节：差异化
关联标签：品牌、溢价`);

    parsed.book.coverImage = "data:image/webp;base64,cover";

    const saved = saveBookPackage(parsed);
    const data = loadLocalWorkbenchData();

    const savedBook = data.knowledgeBooks.find((book) => book.id === saved.book.id)!;
    expect(savedBook.coverImage).toBe("data:image/webp;base64,cover");
    const savedTools = data.decisionTools.filter((tool) => tool.bookId === saved.book.id);
    expect(savedTools).toHaveLength(2);

    updateLocalItem("knowledgeBooks", saved.book.id, { coverImage: "data:image/webp;base64,replacement" });
    expect(loadLocalWorkbenchData().knowledgeBooks[0].coverImage).toBe("data:image/webp;base64,replacement");

    updateLocalItem("knowledgeBooks", saved.book.id, { coverImage: undefined });
    expect(loadLocalWorkbenchData().knowledgeBooks[0].coverImage).toBeUndefined();
  });

  it("creates a task from one knowledge action", () => {
    const data = sampleData();
    data.decisionTools.push({
      id: "tool-1",
      bookId: "book-1",
      name: "差异化判断",
      triggers: [],
      diagnosticQuestions: [],
      actions: ["建立真实测试"],
      limitations: [],
      tags: [],
      status: "ready",
      createdAt: "2026-07-09T00:00:00.000Z"
    });
    saveLocalWorkbenchData(data);

    createTaskFromKnowledgeAction("tool-1", "建立真实测试");

    const task = loadLocalWorkbenchData().tasks[0];
    expect(task.title).toBe("差异化判断：建立真实测试");
    expect(task.type).toBe("knowledge_action");
  });

  it("saves a knowledge application for later review", () => {
    saveLocalWorkbenchData(sampleData());

    saveKnowledgeApplication({
      problem: "竞品价格更低，是否需要降价？",
      toolIds: ["tool-1"],
      diagnosis: "先确认消费者是否能感知差异",
      selectedActions: ["建立真实测试"]
    });

    const application = loadLocalWorkbenchData().knowledgeApplications[0];
    expect(application.problem).toBe("竞品价格更低，是否需要降价？");
    expect(application.selectedActions).toEqual(["建立真实测试"]);
    expect(application.status).toBe("open");
  });

  it("saves one application with multiple tools and action sources", () => {
    saveLocalWorkbenchData(sampleData());

    const application = saveKnowledgeApplication({
      problem: "是否降价",
      toolIds: ["tool-1", "tool-2"],
      diagnosis: "先判断差异价值",
      selectedActions: ["验证价格敏感度"],
      selectedActionSources: [
        { toolId: "tool-1", toolName: "竞争战略", action: "验证价格敏感度" }
      ]
    });

    expect(application.toolIds).toEqual(["tool-1", "tool-2"]);
    expect(application.selectedActionSources).toHaveLength(1);
  });

  it("normalizes old applications without action sources", () => {
    const data = sampleData();
    data.knowledgeApplications.push({
      id: "old",
      problem: "旧问题",
      toolIds: ["tool-1"],
      selectedActions: ["旧行动"],
      status: "open",
      createdAt: "2026-07-01T00:00:00.000Z"
    });
    saveLocalWorkbenchData(data);

    expect(loadLocalWorkbenchData().knowledgeApplications[0].selectedActionSources).toEqual([]);
  });

  it("keeps action sources while deduplicating legacy selected action text", () => {
    saveLocalWorkbenchData(sampleData());

    const application = saveKnowledgeApplication({
      problem: "是否降价",
      toolIds: ["tool-1", "tool-2"],
      selectedActions: ["验证需求", "验证需求"],
      selectedActionSources: [
        { toolId: "tool-1", toolName: "工具一", action: "验证需求" },
        { toolId: "tool-2", toolName: "工具二", action: "验证需求" }
      ]
    });

    expect(application.selectedActions).toEqual(["验证需求"]);
    expect(application.selectedActionSources).toHaveLength(2);
  });

  it("deletes a book and its tools while preserving application history", () => {
    const data = sampleData();
    data.knowledgeBooks.push({
      id: "book-1",
      title: "测试书籍",
      businessScenarios: [],
      createdAt: "2026-07-09T00:00:00.000Z"
    });
    data.decisionTools.push({
      id: "tool-1",
      bookId: "book-1",
      name: "测试工具",
      triggers: [],
      diagnosticQuestions: [],
      actions: [],
      limitations: [],
      tags: [],
      status: "ready",
      createdAt: "2026-07-09T00:00:00.000Z"
    });
    data.knowledgeApplications.push({
      id: "application-1",
      problem: "历史问题",
      toolIds: ["tool-1"],
      selectedActions: [],
      status: "open",
      createdAt: "2026-07-09T00:00:00.000Z"
    });
    saveLocalWorkbenchData(data);

    deleteKnowledgeBook("book-1");

    const saved = loadLocalWorkbenchData();
    expect(saved.knowledgeBooks).toEqual([]);
    expect(saved.decisionTools).toEqual([]);
    expect(saved.knowledgeApplications).toHaveLength(1);
  });

  it("repairs a book additively while preserving tool ids and application history", () => {
    const data = sampleData();
    data.knowledgeBooks.push({
      id: "book-1",
      title: "《审计测试》",
      businessScenarios: [],
      rawText: `【书籍】
书名：《审计测试》

【决策工具】
工具名称：市场判断
解决的问题：原始包中的问题
触发信号：需求增长；竞争者增加
诊断问题：需求是否真实；是否具备成本优势
行动建议：先做小规模测试；验证付费意愿
不适用情况：缺少基础数据；仅有短期波动
来源章节：市场进入
关联标签：市场；验证

【决策工具】
工具名称：退出判断
解决的问题：判断是否退出市场
触发信号：持续亏损
诊断问题：亏损是否可逆；资源能否转移
行动建议：计算退出成本；制定退出节奏
不适用情况：尚未验证改善方案；存在战略协同
来源章节：退出壁垒
关联标签：退出；风险`,
      createdAt: "2026-07-09T00:00:00.000Z"
    });
    data.decisionTools.push({
      id: "tool-1",
      bookId: "book-1",
      name: "市场判断",
      problem: "人工修改的问题",
      triggers: ["需求增长"],
      diagnosticQuestions: ["需求是否真实"],
      actions: ["人工补充动作"],
      limitations: ["缺少基础数据"],
      tags: ["市场"],
      status: "ready",
      createdAt: "2026-07-09T00:00:00.000Z"
    });
    data.knowledgeApplications.push({
      id: "application-1",
      problem: "历史问题",
      toolIds: ["tool-1"],
      selectedActions: ["人工补充动作"],
      status: "open",
      createdAt: "2026-07-09T00:00:00.000Z"
    });
    saveLocalWorkbenchData(data);

    const result = repairKnowledgeBookFromRawText("book-1");
    const saved = loadLocalWorkbenchData();
    const existingTool = saved.decisionTools.find((tool) => tool.id === "tool-1");

    expect(result).toEqual({ updatedTools: 1, addedTools: 1 });
    expect(existingTool?.problem).toBe("人工修改的问题");
    expect(existingTool?.triggers).toEqual(["需求增长", "竞争者增加"]);
    expect(existingTool?.diagnosticQuestions).toEqual(["需求是否真实", "是否具备成本优势"]);
    expect(existingTool?.actions).toEqual(["人工补充动作", "先做小规模测试", "验证付费意愿"]);
    expect(existingTool?.sourceChapter).toBe("市场进入");
    expect(saved.decisionTools.some((tool) => tool.bookId === "book-1" && tool.name === "退出判断")).toBe(true);
    expect(saved.knowledgeApplications[0]).toEqual({
      ...data.knowledgeApplications[0],
      selectedActionSources: []
    });
  });

  it("removes semantic duplicates caused by numbered legacy list items", () => {
    const data = sampleData();
    data.knowledgeBooks.push({
      id: "book-numbered",
      title: "《编号修复》",
      businessScenarios: [],
      rawText: `【书籍】
书名：《编号修复》

【决策工具】
工具名称：测试工具
解决的问题：测试编号兼容
触发信号：
1. 需求增长
诊断问题：
1. 是否真实
2. 是否持续
行动建议：
1. 先验证
2. 再扩大
不适用情况：
1. 缺少数据
来源章节：测试
关联标签：测试`,
      createdAt: "2026-07-09T00:00:00.000Z"
    });
    data.decisionTools.push({
      id: "tool-numbered",
      bookId: "book-numbered",
      name: "测试工具",
      problem: "测试编号兼容",
      triggers: ["1. 需求增长", "需求增长"],
      diagnosticQuestions: ["1. 是否真实", "是否真实"],
      actions: ["1. 先验证", "先验证"],
      limitations: ["1. 缺少数据", "缺少数据"],
      tags: ["测试"],
      status: "ready",
      createdAt: "2026-07-09T00:00:00.000Z"
    });
    saveLocalWorkbenchData(data);

    repairKnowledgeBookFromRawText("book-numbered");
    const tool = loadLocalWorkbenchData().decisionTools.find((item) => item.id === "tool-numbered");

    expect(tool?.triggers).toEqual(["需求增长"]);
    expect(tool?.diagnosticQuestions).toEqual(["是否真实", "是否持续"]);
    expect(tool?.actions).toEqual(["先验证", "再扩大"]);
    expect(tool?.limitations).toEqual(["缺少数据"]);
  });

  it("upserts a supplier and links the saved communication and offer by id", () => {
    saveLocalWorkbenchData(sampleData());
    saveDraftToLocalWorkbench(draft("测试供应商"));

    const data = loadLocalWorkbenchData();
    expect(data.suppliers).toHaveLength(1);
    expect(data.communications[0].supplierId).toBe("supplier-1");
    expect(data.offers[0].supplierId).toBe("supplier-1");
    expect(data.offers[0].communicationId).toBe(data.communications[0].id);
  });

  it("does not create the same open task twice for one supplier", () => {
    const before = loadLocalWorkbenchData().tasks.length;
    saveDraftToLocalWorkbench(draft("测试供应商"));
    const afterFirst = loadLocalWorkbenchData().tasks.length;
    saveDraftToLocalWorkbench(draft("测试供应商"));

    expect(afterFirst).toBe(before + 1);
    expect(loadLocalWorkbenchData().tasks).toHaveLength(afterFirst);
  });

  it("saves plain input without requesting analysis", () => {
    const application = savePlainKnowledgeApplication({
      rawInput: "供应商明天补报价，我需要跟进。"
    });

    expect(application).toMatchObject({
      problem: "供应商明天补报价，我需要跟进。",
      rawInput: "供应商明天补报价，我需要跟进。",
      analysisStatus: "not_requested",
      version: 1
    });
  });

  it("saves analyzed input with structured model sections", () => {
    const application = saveAnalyzedKnowledgeApplication({
      rawInput: "判断新品是否值得进入。",
      analysis: {
        summary: "需要判断目标客户和价值主张。",
        recommendedModelId: "business-model-canvas",
        modelSections: [{
          key: "customer-segments",
          label: "客户细分",
          value: "家庭用户",
          placeholder: "例如：目标客户"
        }],
        openQuestions: ["客户是否愿意付费？"],
        nextActions: ["做10单测试"]
      }
    });

    expect(application).toMatchObject({
      rawInput: "判断新品是否值得进入。",
      analysisStatus: "analyzed",
      modelId: "business-model-canvas",
      openQuestions: ["客户是否愿意付费？"],
      selectedActions: ["做10单测试"],
      version: 1
    });
    expect(application.modelSections?.[0].value).toBe("家庭用户");
  });

  it("creates immutable application versions", () => {
    const first = savePlainKnowledgeApplication({ rawInput: "先测试新品。" });
    const second = saveKnowledgeApplicationVersion(first.id, {
      diagnosis: "先做10单测试。"
    });

    expect(second).toMatchObject({
      version: 2,
      rootApplicationId: first.id,
      diagnosis: "先做10单测试。"
    });
    expect(applicationVersions(first.id).map((item) => item.version)).toEqual([2, 1]);
    expect(applicationVersions(first.id)[1].diagnosis).toBeUndefined();
  });

  it("migrates clearly identical old applications into one case with separate cycles", () => {
    const data = sampleData();
    data.decisionTools.push({
      id: "tool-a",
      name: "市场信号",
      triggers: [],
      diagnosticQuestions: [],
      actions: [],
      limitations: [],
      tags: [],
      status: "ready",
      createdAt: "2026-07-01T00:00:00.000Z"
    });
    data.knowledgeApplications = [
      { id: "a", problem: "是否进入新品？", toolIds: ["tool-a"], diagnosis: "先验证需求", selectedActions: [], status: "open", createdAt: "2026-07-01T00:00:00.000Z" },
      { id: "b", problem: " 是否进入新品 ", toolIds: [], selectedActions: [], status: "open", createdAt: "2026-07-02T00:00:00.000Z" }
    ];
    saveLocalWorkbenchData(data);

    const cases = loadDecisionCases();

    expect(cases).toHaveLength(1);
    expect(cases[0].cycles).toHaveLength(2);
    expect(cases[0].cycles[0].toolContributions[0]).toMatchObject({
      toolId: "tool-a",
      toolName: "市场信号",
      judgement: "先验证需求"
    });
  });

  it("does not merge uncertain old applications", () => {
    const data = sampleData();
    data.knowledgeApplications = [
      { id: "a", problem: "是否进入新品", toolIds: [], selectedActions: [], status: "open", createdAt: "2026-07-01T00:00:00.000Z" },
      { id: "b", problem: "新品是否值得备货", toolIds: [], selectedActions: [], status: "open", createdAt: "2026-07-02T00:00:00.000Z" }
    ];
    saveLocalWorkbenchData(data);

    expect(loadDecisionCases()).toHaveLength(2);
  });

  it("adds a new cycle without changing the previous cycle", () => {
    const caseItem = createDecisionCase({ title: "是否进入新品", rawInput: "首次判断" });
    const second = addDecisionCycle(caseItem.id, { title: "市场变化复评", rawInput: "新增竞品数据" });
    const saved = loadDecisionCases()[0];

    expect(second.cycleNumber).toBe(2);
    expect(saved.cycles[0].rawInput).toBe("首次判断");
    expect(saved.cycles[1].rawInput).toBe("新增竞品数据");
  });

  it("does not save legacy product knowledge from quick intake", () => {
    const beforeProducts = loadLocalWorkbenchData().products.length;
    const extraction = draft("测试供应商");
    (extraction as unknown as { productKnowledge: Array<{ name: string; materials: string }> }).productKnowledge = [{
      name: "不应入库的产品",
      materials: "测试材料"
    }];

    saveDraftToLocalWorkbench(extraction);

    expect(loadLocalWorkbenchData().products).toHaveLength(beforeProducts);
  });

  it("stores product import drafts separately from formal products", () => {
    const parsed = parsedProductResearch();
    const beforeProducts = loadLocalWorkbenchData().products.length;

    const draftId = saveProductImportDraft(parsed);

    expect(loadProductImportDraft(draftId)?.product).toMatchObject({
      id: parsed.product.id,
      name: parsed.product.name,
      schemaVersion: 2
    });
    expect(loadLocalWorkbenchData().products).toHaveLength(beforeProducts);
    expect(storage.has("personal-commercial-workbench-product-imports")).toBe(true);
  });

  it("confirms a product import into formal storage and removes its draft", () => {
    const draftId = saveProductImportDraft(parsedProductResearch());
    const draft = loadProductImportDraft(draftId)!;

    const saved = saveProductKnowledge(draft.product);
    deleteProductImportDraft(draftId);

    expect(loadLocalWorkbenchData().products).toContainEqual(saved);
    expect(saved.rawDocument).toEqual(draft.product.rawDocument);
    expect(loadProductImportDraft(draftId)).toBeUndefined();
  });

  it("updates and deletes a product import draft", () => {
    const draftId = saveProductImportDraft(parsedProductResearch());
    const updatedProduct = productKnowledge({ name: "更新产品" });

    updateProductImportDraft(draftId, updatedProduct);

    expect(loadProductImportDraft(draftId)?.product).toMatchObject({
      id: updatedProduct.id,
      name: "更新产品",
      schemaVersion: 2
    });

    deleteProductImportDraft(draftId);

    expect(loadProductImportDraft(draftId)).toBeUndefined();
  });

  it("preserves parser conflict and warning severities through draft update and formal reload", () => {
    const parsed = parseProductResearchMarkdown(`## 产品定位
产品名称：测试产品
产品品类：桌面文具
产品品类：礼品

## 材料与产品硬成本
`);
    const draftId = saveProductImportDraft(parsed);
    const draft = loadProductImportDraft(draftId)!;

    updateProductImportDraft(draftId, draft.product);
    const updatedDraft = loadProductImportDraft(draftId)!;
    saveProductKnowledge(updatedDraft.product);

    const reloaded = loadLocalWorkbenchData().products.find((product) => product.id === updatedDraft.product.id)!;

    expect(reloaded.importIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "conflict" }),
      expect.objectContaining({ severity: "warning" })
    ]));
  });

  it("preserves unknown top-level draft issue evidence through formal save and reload", () => {
    const unknownIssue = { id: "issue-future", severity: "future-severity", section: "future", message: "未来问题" };
    const parsed = {
      product: productKnowledge(),
      issues: [unknownIssue]
    } as unknown as ParsedProductResearch;
    const draftId = saveProductImportDraft(parsed);

    const draft = loadProductImportDraft(draftId)!;
    expect(draft.issues).toContainEqual(expect.objectContaining({ severity: "warning" }));
    expect(draft.product.importIssues).toContainEqual(expect.objectContaining({ field: "future", severity: "warning" }));
    expect(draft.product.rawDocument?.rawData).toMatchObject({ productResearchIssues: [unknownIssue] });

    updateProductImportDraft(draftId, draft.product);
    const updatedDraft = loadProductImportDraft(draftId)!;
    expect(updatedDraft.product.rawDocument?.rawData).toMatchObject({ productResearchIssues: [unknownIssue] });

    saveProductKnowledge(updatedDraft.product);
    const reloaded = loadLocalWorkbenchData().products[0];
    expect(reloaded.importIssues).toContainEqual(expect.objectContaining({ field: "future", severity: "warning" }));
    expect(reloaded.rawDocument?.rawData).toMatchObject({ productResearchIssues: [unknownIssue] });
  });

  it("migrates legacy error issues to blocking when drafts and products are reloaded", () => {
    const legacyProduct = {
      ...productKnowledge(),
      importIssues: [{ field: "产品定位", message: "缺少产品名称", severity: "error" as const }]
    };
    storage.set("personal-commercial-workbench-product-imports", JSON.stringify({
      "legacy-draft": {
        product: legacyProduct,
        issues: [{ id: "issue-1", severity: "error", section: "产品定位", message: "缺少产品名称" }]
      }
    }));

    const draft = loadProductImportDraft("legacy-draft")!;

    expect(draft.product.importIssues[0].severity).toBe("blocking");
    expect(() => saveProductKnowledge(draft.product)).toThrow("产品名称缺失，无法入库");

    updateProductImportDraft("legacy-draft", draft.product);
    expect(loadProductImportDraft("legacy-draft")?.product.importIssues[0].severity).toBe("blocking");

    storage.set("personal-commercial-workbench", JSON.stringify({ products: [legacyProduct] }));
    const reloadedProduct = loadLocalWorkbenchData().products[0];

    expect(reloadedProduct.importIssues[0].severity).toBe("blocking");
    expect(() => saveProductKnowledge(reloadedProduct)).toThrow("产品名称缺失，无法入库");
  });

  it("keeps unknown issue severity evidence through formal save and reload", () => {
    const unknownIssue = { field: "future", message: "未来问题", severity: "future-severity" };
    const product = productKnowledge({ importIssues: [unknownIssue] as unknown as ProductKnowledgeV2["importIssues"] });

    saveProductKnowledge(product);

    const reloaded = loadLocalWorkbenchData().products[0];
    expect(reloaded.importIssues).toContainEqual(expect.objectContaining({ field: "future", severity: "warning" }));
    expect(reloaded.rawDocument?.rawData).toMatchObject({ importIssues: [unknownIssue] });
  });

  it("saves a product formally with recalculated cost and updated time", () => {
    const product = productKnowledge({ hardCostTotal: 999, hardCostStatus: "pending" });

    const saved = saveProductKnowledge(product);

    expect(saved).toMatchObject({
      id: product.id,
      hardCostTotal: 6,
      hardCostStatus: "confirmed",
      rawDocument: product.rawDocument
    });
    expect(saved.updatedAt).toEqual(expect.any(String));
    expect(loadLocalWorkbenchData().products).toContainEqual(saved);
  });

  it("rejects formal save when a blocking import issue is present", () => {
    const product = productKnowledge({
      importIssues: [{ field: "产品定位", message: "缺少产品名称", severity: "blocking" }]
    });
    const beforeProducts = loadLocalWorkbenchData().products.length;

    expect(() => saveProductKnowledge(product)).toThrow("产品名称缺失，无法入库");
    expect(loadLocalWorkbenchData().products).toHaveLength(beforeProducts);
  });

  it("rejects formal save when the product fails the V2 schema", () => {
    const product = productKnowledge({ name: "" });
    const beforeProducts = loadLocalWorkbenchData().products.length;

    expect(() => saveProductKnowledge(product)).toThrow();
    expect(loadLocalWorkbenchData().products).toHaveLength(beforeProducts);
  });

  it("keeps warning and conflict records when saving formally", () => {
    const product = productKnowledge({
      importIssues: [
        { field: "材料", message: "待确认", severity: "warning" },
        { field: "产品定位", message: "存在冲突", severity: "conflict" }
      ]
    });

    const saved = saveProductKnowledge(product);

    expect(saved.importIssues).toEqual(product.importIssues);
  });
});

function sampleSupplier(overrides: Partial<{ id: string; name: string; categories: string[]; createdAt: string; supplierType: LocalSupplier["supplierType"] }> = {}) {
  return {
    supplierType: overrides.supplierType ?? "factory",
    id: overrides.id ?? "supplier-1",
    name: overrides.name ?? "测试供应商",
    categories: overrides.categories ?? ["包装"],
    riskTags: [] as string[],
    createdAt: overrides.createdAt ?? "2026-07-09T00:00:00.000Z"
  };
}

function sampleData(): LocalWorkbenchData {
  return {
    suppliers: [sampleSupplier()],
    communications: [],
    offers: [
      {
        id: "offer-1",
        supplierName: "测试供应商",
        name: "包装袋货盘",
        createdAt: "2026-07-09T00:00:00.000Z"
      }
    ],
    products: [],
    tasks: [],
    knowledgeBooks: [],
    decisionTools: [],
    knowledgeApplications: [],
    decisionCases: [],
    knowledgeCards: [
      {
        id: "card-1",
        title: "先不接受首次报价",
        applicableScenarios: ["首次报价"],
        steps: [],
        scripts: [],
        risks: [],
        tags: ["谈判"],
        createdAt: "2026-07-09T00:00:00.000Z"
      }
    ],
    researchReports: []
  };
}

function draft(name: string) {
  return {
    supplier: { name, categories: ["包装"], riskTags: [], location: "义乌", supplierType: "factory" as const, businessModel: "inbound" as const },
    communication: { summary: "供应商报价", promises: ["七天交货"], questions: [], risks: [], nextActions: ["确认运费"] },
    offers: [{ name: "包装袋货盘", quotedPrice: "10元", skus: [] }],
    productKnowledge: [],
    tasks: [{ title: "确认运费", priority: "high" as const, type: "confirm_quote" as const }],
    knowledgeCards: [],
    uncertaintyNotes: []
  };
}

function parsedProductResearch() {
  return {
    product: productKnowledge(),
    issues: []
  };
}

function productKnowledge(overrides: Partial<ProductKnowledgeV2> = {}): ProductKnowledgeV2 {
  return {
    schemaVersion: 2,
    id: "product-research-test",
    name: "测试产品",
    useScenarios: [],
    specifications: [],
    procurementQuotes: [],
    materialStructures: [],
    machinery: [],
    qualityControls: [],
    industryClusters: [],
    costItems: [{
      id: "cost-1",
      category: "材料",
      name: "测试材料",
      quantity: 2,
      unit: "个",
      unitCost: 3,
      subtotal: 6,
      currency: "CNY",
      included: true,
      source: "research"
    }],
    hardCostTotal: 6,
    hardCostStatus: "confirmed",
    manufacturing: { processes: [] },
    optimizationOptions: [],
    risks: { quality: [], supply: [], compliance: [], other: [] },
    opportunities: [],
    decision: { status: "undecided" },
    rawDocument: { content: "raw product research" },
    importIssues: [],
    createdAt: "2026-07-16T00:00:00.000Z",
    ...overrides
  };
}

describe("supplier evaluation storage", () => {
  it("saveSupplierEvaluation appends evaluation and syncs cached total/grade", () => {
    saveLocalWorkbenchData({
      ...sampleData(),
      suppliers: [{ ...sampleSupplier(), id: "sup-1", name: "浙江xx厂" }]
    });

    const ev = saveSupplierEvaluation({
      supplierId: "sup-1",
      period: "2026-Q3",
      rawData: {
        orders: [{ id: "PO001", isPeak: false, ignored: false, currency: "CNY", source: "manual", orderQuantity: 100, promisedDeliveryAt: "2026-08-01", actualDeliveryAt: "2026-07-31" }],
        qualityIssues: [], serviceEvents: [], costReduction: []
      },
      metrics: { onTimeDeliveryRate: 90, incomingPassRate: 98, promiseFulfillmentRate: 90 },
      scores: { delivery: 90, cost: 82, quality: 95, service: 88, total: 90, grade: "A" },
      riskLabels: ["无风险"]
    });
    expect(ev.scores.grade).toBe("A");
    const loaded = loadLocalWorkbenchData().suppliers.find((s) => s.id === "sup-1")!;
    expect(loaded.latestEvaluationGrade).toBe("A");
    expect(loaded.latestEvaluationScore).toBeCloseTo(98.08, 2);
    expect(loaded.evaluations).toHaveLength(1);
    expect(loaded.evaluations?.[0].period).toBe("2026-Q3");
  });

  it("normalizes legacy suppliers (no evaluations/records) without crashing", () => {
    const legacy = { ...sampleSupplier(), id: "old-1", name: "老供应商" };
    saveLocalWorkbenchData({
      ...sampleData(),
      suppliers: [legacy]
    });
    const loaded = loadLocalWorkbenchData();
    const sup = loaded.suppliers.find((s) => s.id === "old-1")!;
    expect(Array.isArray(sup.evaluations)).toBe(true);
    expect(Array.isArray(sup.orderRecords)).toBe(true);
    expect(sup.latestEvaluationGrade).toBeUndefined();
  });

  it("mergeSuppliers aggregates evaluations and records", () => {
    saveLocalWorkbenchData({
      ...sampleData(),
      suppliers: [
        { ...sampleSupplier(), id: "a-1", name: "A厂", categories: ["x"],
          evaluations: [{ id: "ev-A", supplierId: "a-1", period: "2026-Q1", periodType: "quarter", businessModel: "inbound", rawMetrics: {}, scores: { delivery: 80, cost: 70, quality: 75, service: 75, total: 75, grade: "B" }, riskLabels: [], evaluatedAt: "2026-04-05" }],
          orderRecords: [{ id: "A-PO1", orderQuantity: 10 } as any]
        },
        { ...sampleSupplier(), id: "a-2", name: "A厂同主体", categories: ["y"],
          evaluations: [{ id: "ev-B", supplierId: "a-2", period: "2026-Q2", periodType: "quarter", businessModel: "inbound", rawMetrics: {}, scores: { delivery: 70, cost: 80, quality: 80, service: 70, total: 75, grade: "B" }, riskLabels: [], evaluatedAt: "2026-07-05" }],
          orderRecords: [{ id: "A-PO2", orderQuantity: 20 } as any]
        }
      ]
    });
    const merged = mergeSuppliers("a-1", "a-2");
    const t = merged.suppliers.find((s) => s.id === "a-1")!;
    expect(t.evaluations).toHaveLength(2);
    expect(t.orderRecords).toHaveLength(2);
    expect(t.categories).toEqual(expect.arrayContaining(["x", "y"]));
  });

  it("mergeSupplier (draft) preserves existing evaluations and records", () => {
    saveLocalWorkbenchData({
      ...sampleData(),
      suppliers: [{
        ...sampleSupplier(),
        id: "s1", name: "文航家居", categories: [],
        evaluations: [{ id: "ev-1", supplierId: "s1", period: "2026-Q2", periodType: "quarter", businessModel: "inbound", rawMetrics: {}, scores: { delivery: 80, cost: 70, quality: 75, service: 75, total: 75, grade: "B" }, riskLabels: [], evaluatedAt: "2026-07-01" }],
        orderRecords: [{ id: "PO-HISTORY", orderQuantity: 500 } as any]
      }]
    });
    saveDraftToLocalWorkbench({
      supplier: { supplierType: "factory", name: "文航家居", categories: ["收纳"], riskTags: [], location: "台州", businessModel: "inbound" },
      communication: { summary: "补充品类信息", promises: [], questions: [], risks: [], nextActions: [] },
      offers: [], tasks: [], knowledgeCards: [],
      productKnowledge: [],
      uncertaintyNotes: []
    });
    const loaded = loadLocalWorkbenchData().suppliers.find((s) => s.name === "文航家居")!;
    expect(loaded.evaluations).toHaveLength(1);
    expect(loaded.orderRecords?.[0]?.id).toBe("PO-HISTORY");
    expect(loaded.categories).toEqual(expect.arrayContaining(["收纳"]));
  });
});
