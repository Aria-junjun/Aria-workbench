import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canReferenceEvidence,
  createEvidenceReference,
  type EvidenceReference,
} from "@/features/workbench/evidence-references";
import { loadLocalWorkbenchData, saveLocalWorkbenchData, type LocalWorkbenchData } from "@/features/workbench/local-store";

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

describe("evidence references", () => {
  it("only allows confirmed evidence to be referenced", () => {
    expect(canReferenceEvidence("confirmed")).toBe(true);
    expect(canReferenceEvidence("confirmed", false)).toBe(false);
    expect(canReferenceEvidence("confirmed", undefined)).toBe(true);
    expect(canReferenceEvidence("original")).toBe(false);
    expect(canReferenceEvidence("ai-draft")).toBe(false);
    expect(canReferenceEvidence("edited")).toBe(false);
    expect(canReferenceEvidence("inference")).toBe(false);
    expect(canReferenceEvidence("to-verify")).toBe(false);
  });

  it("creates a complete reference snapshot with an id and timestamp", () => {
    const input: Omit<EvidenceReference, "id" | "referencedAt"> = {
      sourceModule: "industry-insight",
      sourceProjectId: "industry-1",
      sourceProjectTitle: "白板贴行业洞察",
      sourceFieldPath: "dimensions.trend.evidence",
      sourceFieldLabel: "趋势证据",
      snapshot: "家庭办公场景正在增长。",
      status: "confirmed",
    };

    expect(createEvidenceReference(input)).toMatchObject({
      ...input,
      id: expect.any(String),
      referencedAt: expect.any(String),
    });
  });

  it("loads legacy persisted data with an empty reference list", () => {
    storage.set("personal-commercial-workbench", JSON.stringify({
      suppliers: [], communications: [], offers: [], products: [], tasks: [],
      knowledgeCards: [], knowledgeBooks: [], decisionTools: [], knowledgeApplications: [],
      decisionCases: [], researchReports: [],
    }));

    expect(loadLocalWorkbenchData().evidenceReferences).toEqual([]);
  });

  it("persists and reloads evidence references", () => {
    const reference = createEvidenceReference({
      sourceModule: "demand-exploration",
      sourceProjectId: "demand-1",
      sourceProjectTitle: "需求探索",
      sourceFieldPath: "problem",
      sourceFieldLabel: "用户问题",
      snapshot: "擦除后留痕。",
      status: "confirmed",
    });
    const data = loadLocalWorkbenchData();

    saveLocalWorkbenchData({ ...data, evidenceReferences: [reference] } as LocalWorkbenchData);

    expect(loadLocalWorkbenchData().evidenceReferences).toEqual([reference]);
  });
});
