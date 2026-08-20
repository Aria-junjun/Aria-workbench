import { describe, expect, it } from "vitest";
import {
  buildCombinedSolveHref,
  buildKnowledgeReturnHref,
  defaultSelectedToolIds,
  parseSelectedToolIds,
  toggleSelectedToolId
} from "@/features/workbench/knowledge-solve";

describe("knowledge solve selection", () => {
  it("selects the first two recommendations by default", () => {
    expect(defaultSelectedToolIds(["a", "b", "c"])).toEqual(["a", "b"]);
  });

  it("prevents selecting more than three tools", () => {
    expect(toggleSelectedToolId(["a", "b", "c"], "d")).toEqual({
      ids: ["a", "b", "c"],
      limitReached: true
    });
  });

  it("removes invalid and duplicate URL ids", () => {
    expect(parseSelectedToolIds("a,missing,a,b", ["a", "b"])).toEqual(["a", "b"]);
  });

  it("preserves the problem in the return URL", () => {
    expect(buildKnowledgeReturnHref("是否降价？"))
      .toBe("/knowledge?problem=%E6%98%AF%E5%90%A6%E9%99%8D%E4%BB%B7%EF%BC%9F");
  });

  it("builds a combined solve URL", () => {
    expect(buildCombinedSolveHref("是否降价？", ["a", "b"]))
      .toBe("/knowledge/solve?problem=%E6%98%AF%E5%90%A6%E9%99%8D%E4%BB%B7%EF%BC%9F&toolIds=a%2Cb");
  });
});
