// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DemandIntakeForm } from "@/components/workbench/demand-exploration/demand-intake-form";
import { loadDemandConfirmationDocuments } from "@/features/workbench/local-store";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("React", React);
  push.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: null }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("需求确认文档创建反馈", () => {
  it("创建后显示保存成功反馈并跳转到新文档", () => {
    render(<DemandIntakeForm />);
    fireEvent.change(screen.getByPlaceholderText("示例：围绕一个具体问题建立一份需求确认文档"), { target: { value: "家具膜需求调查" } });
    fireEvent.change(screen.getByPlaceholderText("示例：白板贴"), { target: { value: "家居保护膜" } });
    fireEvent.change(screen.getByPlaceholderText("示例：需要反复记录和擦除内容的办公室、教室使用者"), { target: { value: "家庭用户" } });
    fireEvent.change(screen.getByPlaceholderText("示例：会议结束后擦除白板贴上的内容，下一次可继续使用"), { target: { value: "家具表面保护" } });
    fireEvent.change(screen.getByPlaceholderText("示例：擦除后容易残留涂写痕迹，影响后续书写"), { target: { value: "销售下滑" } });
    fireEvent.change(screen.getByPlaceholderText("示例：确认“不留痕迹”是否是用户必须具备的需求"), { target: { value: "确认问题来源" } });
    fireEvent.submit(screen.getByRole("button", { name: "创建需求确认文档" }).closest("form")!);

    expect(screen.getByRole("status").textContent).toContain("已创建需求确认文档，正在打开");
    expect(loadDemandConfirmationDocuments()).toHaveLength(1);
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/demand-exploration\/demand-document-.+\/items$/));
  });
});
