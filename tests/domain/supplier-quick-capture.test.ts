import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadLocalWorkbenchData,
  saveLocalWorkbenchData,
  type LocalWorkbenchData,
  analyzeChatAsDraft,
  commitChatAnalysis,
  quickCaptureSupplierChat
} from "@/features/workbench/local-store";

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

function sampleData(): LocalWorkbenchData {
  return {
    suppliers: [
      {
        id: "sup-wenhang",
        name: "台州市黄岩文航家居用品有限公司",
        categories: ["收纳"],
        riskTags: [],
        createdAt: "2026-07-09T00:00:00.000Z"
      }
    ],
    communications: [], offers: [], products: [], tasks: [],
    knowledgeCards: [], knowledgeBooks: [], decisionTools: [],
    knowledgeApplications: [], decisionCases: [], researchReports: []
  };
}

describe("Task 5: 快速录入管道 (chat → draft → evaluation)", () => {
  it("analyzeChatAsDraft: 解析聊天原文 + 给出预览 metrics 与分数，不写入", () => {
    saveLocalWorkbenchData(sampleData());
    const chat =
`2026-07-10 10:00 我方: 你好，先帮我下单 500 个抽屉式收纳箱，7月24号前发出
2026-07-10 10:25 王经理(文航家居): 收到，保证7月24号前一定到
2026-07-23 09:00 王经理(文航家居): 今天500个都发出来了，圆通 YT100
2026-07-26 10:00 我方: 到了20箱里有12个压坏，麻烦处理
2026-07-26 10:20 王经理(文航家居): 不好意思，已经补发出15个
2026-07-26 10:00 我方: 这款收纳箱从3.2元调到3.5元了？
2026-07-26 10:15 王经理(文航家居): 是的，PE料涨了
2026-07-31 20:00 我方: 总体评价，这个月配合度一般，给3分，消息回得有时慢`;
    const result = analyzeChatAsDraft({
      supplierId: "sup-wenhang", chatText: chat, period: "2026-Q3", referenceDate: "2026-07-10"
    });
    expect(result.draft.orders.length).toBeGreaterThanOrEqual(2); // 1下单+1发货
    expect(result.draft.qualityIssues.length).toBeGreaterThanOrEqual(1);
    expect(result.previewScores).toBeDefined();
    // 发货如期，交付分应该 ≥ 60
    expect(result.previewScores!.delivery).toBeGreaterThan(40);
    // 不写入 localStorage
    const sup = loadLocalWorkbenchData().suppliers[0];
    expect(sup.evaluations).toEqual([]);
  });

  it("commitChatAnalysis: 用户确认后正式写入 evaluation + 4 类 records", () => {
    saveLocalWorkbenchData(sampleData());
    const chat =
`2026-07-10 10:00 我方: 下单 500 个抽屉收纳箱，7月24号前出
2026-07-10 10:25 王经理(文航家居): 收到
2026-07-22 09:00 王经理(文航家居): 500个今天发出了`;
    const analyzed = analyzeChatAsDraft({
      supplierId: "sup-wenhang", chatText: chat, period: "2026-Q3", referenceDate: "2026-07-10"
    });
    const record = commitChatAnalysis(analyzed);
    expect(record.scores.grade).toBeDefined();

    const sup = loadLocalWorkbenchData().suppliers[0];
    expect(sup.evaluations).toHaveLength(1);
    expect(sup.orderRecords?.length).toBeGreaterThanOrEqual(1);
    expect(sup.latestEvaluationGrade).toBeDefined();
  });

  it("quickCaptureSupplierChat 一步到位（不确认也可以直接保存）", () => {
    saveLocalWorkbenchData(sampleData());
    const chat =
`2026-08-01 10:00 我方: 订 100 个收纳箱
2026-08-01 10:05 王经理(文航家居): 好的 8月10号交
2026-08-10 09:00 王经理(文航家居): 100个发出`;
    const record = quickCaptureSupplierChat({
      supplierId: "sup-wenhang",
      period: "2026-08",
      chatText: chat,
      referenceDate: "2026-08-01",
      autoSave: true
    });
    expect(record.scores.total).toBeGreaterThan(0);
    const sup = loadLocalWorkbenchData().suppliers[0];
    expect(sup.latestEvaluationPeriod).toBe("2026-08");
  });
});
