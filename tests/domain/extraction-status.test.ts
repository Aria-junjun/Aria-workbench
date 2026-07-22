import { describe, expect, it } from "vitest";
import { getExtractionNotice } from "@/features/workbench/extraction-status";

describe("getExtractionNotice", () => {
  it("condenses AI connection fallback details into a non-blocking notice", () => {
    const notice = getExtractionNotice([
      "AI 未完成整理，当前为本地兜底整理结果。",
      "AI 调用失败，已使用本地兜底：Connection error."
    ]);

    expect(notice).toEqual({
      title: "整理方式",
      message: "AI 当前不可用，已使用本地整理结果。已提取可识别的文字字段，复杂内容请在确认页复核。"
    });
    expect(notice?.message).not.toContain("Connection error");
  });

  it("does not create a notice for ordinary business uncertainties", () => {
    expect(getExtractionNotice(["需确认最终含税价"])).toBeNull();
  });
});
