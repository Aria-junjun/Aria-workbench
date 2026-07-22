import { describe, expect, it } from "vitest";
import { labelPriority, labelSupplierType, labelTaskType } from "@/features/workbench/display-labels";

describe("display labels", () => {
  it("translates internal workbench codes into Chinese", () => {
    expect(labelSupplierType("factory")).toBe("工厂");
    expect(labelSupplierType("unknown")).toBe("尚未判断");
    expect(labelPriority("medium")).toBe("中");
    expect(labelTaskType("follow_sample")).toBe("跟进样品");
    expect(labelTaskType("knowledge_action")).toBe("知识应用");
  });
});
