import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { validateKanoQuestionDraft } from "@/features/workbench/demand-exploration";

describe("需求探索问题设计", () => {
  it("allows learning to be skipped while requiring two questions before formal analysis", () => {
    const form = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/demand-exploration/kano-question-form.tsx"), "utf8");
    const learning = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/demand-exploration/learning-panel.tsx"), "utf8");
    expect(learning).toContain("查看模型说明");
    expect(form).toContain("跳过");
    expect(form).toContain("functionalQuestion");
    expect(form).toContain("dysfunctionalQuestion");
    expect(validateKanoQuestionDraft({ feature: "撕除后不残胶", functionalQuestion: "", dysfunctionalQuestion: "" })).toEqual({
      functionalQuestion: "请填写正向问题",
      dysfunctionalQuestion: "请填写反向问题"
    });
  });

  it("warns when the feature is empty or the two questions are the same", () => {
    expect(validateKanoQuestionDraft({ feature: "", functionalQuestion: "同一个问题", dysfunctionalQuestion: "同一个问题" })).toEqual({
      feature: "请填写一个可被用户感知的产品特性",
      questionPair: "正向问题和反向问题需要分别描述有/没有该特性"
    });
  });
});
