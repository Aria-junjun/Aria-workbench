import { describe, expect, it } from "vitest";
import { parseSupplierChat } from "@/features/workbench/supplier-chat-parser";

describe("supplier-chat-parser", () => {
  it("空文本返回空结构", () => {
    const result = parseSupplierChat("");
    expect(result.orders).toEqual([]);
    expect(result.qualityIssues).toEqual([]);
    expect(result.serviceEvents).toEqual([]);
  });

  it("解析基础说话人时间戳并统计响应时长", () => {
    const result = parseSupplierChat(`2026-07-15 10:00 我方: 你好，这款有货吗？
2026-07-15 10:25 王经理(文航家居): 有的，亲`);
    // 响应时长事件：10:00 → 10:25 = 25min = 0.417h
    const responseEv = result.serviceEvents.filter((e) => e.type === "response");
    expect(responseEv.length).toBeGreaterThan(0);
    expect(responseEv[0].responseHours).toBeGreaterThan(0.4);
    expect(responseEv[0].responseHours).toBeLessThan(0.5);
    expect(result.suppliersMentioned).toEqual(expect.arrayContaining(["文航家居"]));
  });

  it("解析一条订货记录（含数量 + 交期）", () => {
    const result = parseSupplierChat(`2026-07-15 10:00 我方: 帮我下单 500 个抽屉式收纳箱，下周三交，也就是 7 月 24 号前发出
2026-07-15 10:10 王经理(文航家居): 收到`);
    expect(result.orders.length).toBeGreaterThanOrEqual(1);
    const order = result.orders[0];
    expect(order.orderQuantity).toBe(500);
    expect(order.productName).toContain("收纳箱");
    expect(order.promisedDeliveryAt).toBe("2026-07-24");
    expect(order.supplierNameGuess).toBe("文航家居");
  });

  it("解析实际发货（履约）作为 actualDeliveryAt", () => {
    const result = parseSupplierChat(`2026-07-22 14:00 王经理(文航家居): 500个收纳箱今天已经发出，注意查收 圆通 YT123456789`);
    const shipment = result.orders.find((o) => o.actualDeliveryAt);
    expect(shipment?.actualDeliveryAt).toBe("2026-07-22");
    expect(shipment?.deliveredQuantity).toBe(500);
  });

  it("解析质量问题（含数量和描述）", () => {
    const result = parseSupplierChat(`2026-07-25 10:00 我方: 昨天到的 20 箱里发现了 12 个压坏的，有裂纹，批次 B20260725
2026-07-25 10:30 王经理(文航家居): 抱歉我们补发 15 个给你`);
    expect(result.qualityIssues.length).toBeGreaterThanOrEqual(1);
    const q = result.qualityIssues[0];
    expect(q.issueCount).toBe(12);
    expect(q.issueDescription).toMatch(/压坏|裂纹/);
    expect(q.totalBatchSize).toBe(20);
  });

  it("解析承诺 + 实际兑现作为 service promise 事件", () => {
    const result = parseSupplierChat(`2026-07-10 10:00 王经理(文航家居): 我保证 7月20号前一定交货
2026-07-20 08:00 王经理(文航家居): 货今天发出了`);
    const promises = result.serviceEvents.filter((e) => e.type === "promise");
    expect(promises.length).toBeGreaterThan(0);
    const first = promises[0];
    expect(first.content).toContain("保证");
    expect(first.expectedAt).toBe("2026-07-20");
    expect(first.fulfilled).toBe(true);
  });

  it("解析价格变动（涨价/降价）", () => {
    const result = parseSupplierChat(`2026-07-20 09:00 王经理(文航家居): PE原材料涨了，这款收纳箱要从 3.2 元调到 3.5 元，下周一开始执行`);
    const pc = result.serviceEvents.filter((e) => e.type === "price_change");
    expect(pc.length).toBeGreaterThan(0);
    expect(pc[0].priceBefore).toBe(3.2);
    expect(pc[0].priceAfter).toBe(3.5);
    expect(pc[0].marketPriceChangedAt).toBe("2026-07-20");
  });

  it("解析配合度打分（口语化评价）", () => {
    const result = parseSupplierChat(`2026-07-30 20:00 我方: 综合评价一下，文航这个月配合度一般吧，给 3 分，态度还行但有时消息回得慢`);
    const coop = result.serviceEvents.filter((e) => e.type === "cooperation_rating");
    expect(coop.length).toBeGreaterThan(0);
    expect(coop[0].cooperationScore).toBe(3);
  });

  it("自动归一化日期（无年份补今年，中文日期 本周三/下周一 解析）", () => {
    const result = parseSupplierChat(
      "2026-07-15 10:00 我方: 本周三前 300 个收纳箱先发掉\n2026-07-15 10:05 王经理: 没问题",
      { referenceDate: "2026-07-15" }
    );
    expect(result.orders[0].promisedDeliveryAt).toBe("2026-07-15");
  });

  it("多条订单 + 质量问题聚合到同一个草稿，互不干扰", () => {
    const result = parseSupplierChat(`2026-07-01 09:00 我方: 下单 100 个 A 款收纳箱
2026-07-02 09:00 我方: 再订 200 个 B 款
2026-07-05 18:00 我方: 到了 10 个 A 款破了，请处理`);
    expect(result.orders.length).toBeGreaterThanOrEqual(2);
    expect(result.qualityIssues.length).toBeGreaterThanOrEqual(1);
    expect(result.suppliersMentioned.length).toBeGreaterThanOrEqual(0);
  });
});
