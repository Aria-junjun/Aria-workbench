import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEvidenceSourceProjects } from "@/features/workbench/evidence-sources";
import { createEvidenceReference } from "@/features/workbench/evidence-references";
import { findEvidenceConflicts } from "@/features/workbench/evidence-conflicts";
import { createIndustryInsightProject } from "@/features/workbench/industry-insight";
import { createDemandConfirmationDocument } from "@/features/workbench/demand-confirmation";
import { createProductDecompositionProject } from "@/features/workbench/product-decomposition";
import { loadLocalWorkbenchData, saveLocalWorkbenchData } from "@/features/workbench/local-store";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("window", { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } });
});

describe("静电白板贴证据闭环", () => {
  it("保留确认门槛，并支持行业洞察到需求再到产品拆解的两段引用", () => {
    const industry = createIndustryInsightProject({ title: "白板贴行业洞察" });
    industry.decisionQuestion = "是否优先验证可重复擦除体验？";
    const demand = createDemandConfirmationDocument({ title: "白板贴需求探索", productName: "白板贴" });
    const decomposition = createProductDecompositionProject({ title: "白板贴产品拆解", centralQuestion: "是否优先验证可重复擦除体验？" });
    const data = loadLocalWorkbenchData();
    saveLocalWorkbenchData({
      ...data,
      industryInsightProjects: [industry],
      demandConfirmationDocuments: [demand],
      productDecompositionProjects: [decomposition],
      evidenceFieldConfirmations: [{ module: "industry-insight", projectId: industry.id, path: "decisionQuestion", snapshot: industry.decisionQuestion, confirmedAt: new Date().toISOString() }],
    });

    const confirmedSource = buildEvidenceSourceProjects(loadLocalWorkbenchData()).find((item) => item.projectId === industry.id)?.fields.find((item) => item.path === "decisionQuestion");
    expect(confirmedSource?.status).toBe("confirmed");

    const firstHop = createEvidenceReference({
      targetModule: "demand-exploration",
      targetProjectId: demand.id,
      targetFieldPath: "problem",
      targetFieldLabel: "用户问题",
      sourceModule: "industry-insight",
      sourceProjectId: industry.id,
      sourceProjectTitle: industry.title,
      sourceFieldPath: "decisionQuestion",
      sourceFieldLabel: "决策问题",
      snapshot: industry.decisionQuestion,
      status: "confirmed",
    });
    saveLocalWorkbenchData({ ...loadLocalWorkbenchData(), evidenceReferences: [firstHop] });

    const demandSource = buildEvidenceSourceProjects(loadLocalWorkbenchData()).find((item) => item.projectId === demand.id)?.fields.find((item) => item.path === `evidenceReferences.${firstHop.id}`);
    expect(demandSource?.status).toBe("confirmed");

    const secondHop = createEvidenceReference({
      targetModule: "product-decomposition",
      targetProjectId: decomposition.id,
      targetFieldPath: "centralQuestion",
      targetFieldLabel: "中心问题",
      sourceModule: "demand-exploration",
      sourceProjectId: demand.id,
      sourceProjectTitle: demand.title,
      sourceFieldPath: `evidenceReferences.${firstHop.id}`,
      sourceFieldLabel: "引用副本·决策问题",
      snapshot: demandSource?.snapshot ?? "",
      status: "confirmed",
    });
    saveLocalWorkbenchData({ ...loadLocalWorkbenchData(), evidenceReferences: [firstHop, secondHop] });

    const reloaded = buildEvidenceSourceProjects(loadLocalWorkbenchData()).find((item) => item.projectId === decomposition.id);
    expect(reloaded?.fields.find((item) => item.path === `evidenceReferences.${secondHop.id}`)?.status).toBe("confirmed");
    expect(loadLocalWorkbenchData().evidenceReferences).toHaveLength(2);
    expect(findEvidenceConflicts([
      { ...firstHop, targetModule: "product-decomposition", targetProjectId: decomposition.id, targetFieldPath: "centralQuestion", snapshot: "事实：擦除方便" },
      { ...secondHop, targetProjectId: decomposition.id, targetFieldPath: "centralQuestion", snapshot: "事实：擦除不稳定" },
    ])).toHaveLength(1);
  });
});
