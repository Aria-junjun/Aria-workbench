import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { AiTaskDraft } from "@/features/workbench/ai-task-protocol";

const stateSlots: unknown[] = [];
let stateCursor = 0;

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  globalThis.React = actual;
  return {
    ...actual,
    useState: <T,>(initial: T) => {
      const slot = stateCursor++;
      if (!(slot in stateSlots)) stateSlots[slot] = initial;
      return [stateSlots[slot] as T, (next: T | ((current: T) => T)) => {
        stateSlots[slot] = typeof next === "function" ? (next as (current: T) => T)(stateSlots[slot] as T) : next;
      }] as const;
    },
  };
});

const { ExternalAiTaskPanel } = await import("@/components/workbench/external-ai-task-panel");

type TaskProps = Parameters<typeof ExternalAiTaskPanel>[0];
type TestElement = ReactElement<{ children?: ReactNode; [key: string]: any }>;

function renderPanel(props: TaskProps): TestElement {
  stateCursor = 0;
  return ExternalAiTaskPanel(props) as TestElement;
}

function walk(node: ReactNode, visit: (element: TestElement) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  const element = node as TestElement;
  if (typeof element.type === "string") {
    visit(element);
  }
  walk(element.props.children, visit);
}

function findByText(root: TestElement, text: string): TestElement {
  let found: TestElement | undefined;
  walk(root, (element) => {
    if (!found && textContent(element.props.children) === text) found = element;
  });
  if (!found) throw new Error(`未找到文本：${text}`);
  return found;
}

function findTextContaining(root: TestElement, text: string): TestElement {
  let found: TestElement | undefined;
  walk(root, (element) => {
    if (!found && textContent(element.props.children).includes(text)) found = element;
  });
  if (!found) throw new Error(`未找到包含文本：${text}`);
  return found;
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (!node || typeof node !== "object") return "";
  return textContent((node as TestElement).props.children);
}

function findByLabel(root: TestElement, label: string): TestElement {
  let found: TestElement | undefined;
  walk(root, (element) => {
    if (!found && element.props["aria-label"] === label) found = element;
  });
  if (!found) throw new Error(`未找到控件：${label}`);
  return found;
}

const task: TaskProps["task"] = {
  module: "competitor-analysis",
  projectId: "project-1",
  prompt: "任务包",
  allowedFields: [{ path: "summary", label: "分析结论", guidance: "" }],
};

describe("外部 GPT 任务包面板", () => {
  it("通过真实交互持久化修改稿、确认稿，并保留历史和原始内容", () => {
    stateSlots.length = 0;
    const savedDrafts: TaskProps["savedDrafts"] = [];
    const onSaveDraft = vi.fn((draft: AiTaskDraft) => savedDrafts.push(draft));
    const props = { task, onSaveDraft, savedDrafts };
    let panel = renderPanel(props);

    findByLabel(panel, "AI 初稿导入内容").props.onChange({ target: { value: "summary：原始结论\nunknown.field：保留" } });
    panel = renderPanel(props);
    findByText(panel, "导入识别").props.onClick();
    panel = renderPanel(props);
    expect(findByText(panel, "原始 AI 初稿")).toBeDefined();
    expect(findTextContaining(panel, "未识别内容：")).toBeDefined();

    findByText(panel, "修改").props.onClick();
    panel = renderPanel(props);
    findByLabel(panel, "修改分析结论").props.onChange({ target: { value: "人工修改结论" } });
    panel = renderPanel(props);
    findByText(panel, "保存修改").props.onClick();
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onSaveDraft.mock.calls[0][0]).toMatchObject({
      rawText: "summary：原始结论\nunknown.field：保留",
      recognizedFields: { summary: "人工修改结论" },
      unrecognizedLines: ["unknown.field：保留"],
    });

    panel = renderPanel({ ...props, savedDrafts });
    expect(findByText(panel, "历史 AI 初稿（1）")).toBeDefined();
    findByText(panel, "确认保存 AI 初稿").props.onClick();
    expect(onSaveDraft).toHaveBeenCalledTimes(2);

    panel = renderPanel({ ...props, savedDrafts });
    expect(findByText(panel, "历史 AI 初稿（2）")).toBeDefined();
    expect(findByText(panel, "原始 AI 初稿")).toBeDefined();
  });
});
