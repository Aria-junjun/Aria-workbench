import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("whiteboard sticker example copy", () => {
  it("uses the approved reusable whiteboard sticker examples in the document intake", () => {
    const source = readFileSync("src/components/workbench/demand-exploration/demand-intake-form.tsx", "utf8");
    expect(source).toContain("会议结束后擦除白板贴上的内容，下一次可继续使用");
    expect(source).toContain("擦除后容易残留涂写痕迹，影响后续书写");
    expect(source).toContain("确认“不留痕迹”是否是用户必须具备的需求");
    expect(source).not.toContain("撕除");
    expect(source).not.toContain("残胶");
    expect(source).toContain("给这次需求探索取一个便于识别的名称");
    expect(source).toContain("明确谁会使用这个产品");
    expect(source).toContain("描述问题实际发生的时间、地点和行为");
    expect(source).toContain("先描述事实和困扰，不要直接写解决方案");
    expect(source).toContain("说明这次希望通过研究确认什么");
    expect(source).toContain("填写需求最初来自哪里");
    expect(source).not.toContain("示例：示例：");
  });

  it("uses the same example vocabulary for demand items and KANO questions", () => {
    const itemSource = readFileSync("src/components/workbench/demand-exploration/demand-item-editor.tsx", "utf8");
    const questionSource = readFileSync("src/components/workbench/demand-exploration/kano-question-form.tsx", "utf8");
    expect(itemSource).toContain("擦除后不残留明显涂写痕迹，能够继续书写");
    expect(itemSource).toContain("白板贴上的内容擦除后完全不留痕");
    expect(itemSource).toContain("一次只描述一个可以独立判断的需求");
    expect(questionSource).toContain("擦除后不留明显痕迹");
    expect(questionSource).not.toContain("撕除后不残胶");
  });
});
