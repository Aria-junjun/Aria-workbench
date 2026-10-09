import { describe, expect, it } from "vitest";
import { buildJuneJuyingInboundSnapshots } from "@/features/workbench/june-supplier-test-data";

describe("6月聚赢采购测试数据", () => {
  it("按产品族和规格生成12条合并后的入仓结算事实", () => {
    const families = ["静电哑光墙贴", "无胶白板贴小纸管"];
    const skus = [[0, "45*2"], [0, "45*3"], [0, "45*5"], [0, "45*10"], [0, "60*2"], [0, "60*3"], [1, "45*5"], [1, "60*2"], [1, "90*2"], [1, "90*5"], [1, "120*2"], [1, "120*5"]] as const;
    const skuRows = skus.map(([familyIndex, specification], i) => ({
      id: `s${i}`, internalSkuCode: `Y-${i}`, productName: families[familyIndex], productFamilyKey: families[familyIndex], specification: familyIndex === 1 ? `${Number(specification.split("*")[0]) / 100}*${specification.split("*")[1]}m*1` : specification,
      status: "ready" as const, source: "manual" as const, importedAt: "now"
    }));
    const result = buildJuneJuyingInboundSnapshots(skuRows, "now");
    expect(result.missing).toHaveLength(0);
    expect(result.snapshots).toHaveLength(12);
    expect(result.snapshots.reduce((sum, row) => sum + (row.receivedQuantity ?? 0), 0)).toBe(2400);
    expect(result.snapshots.reduce((sum, row) => sum + (row.settlementAmount ?? 0), 0)).toBe(8362);
  });
});
