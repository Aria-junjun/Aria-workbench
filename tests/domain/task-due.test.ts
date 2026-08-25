import { describe, expect, it } from "vitest";
import { getTaskDueState } from "@/features/workbench/task-due";

const today = new Date(2026, 7, 25, 12);

describe("getTaskDueState", () => {
  it("classifies overdue, today, soon, normal and empty dates", () => {
    expect(getTaskDueState({ status: "open", dueDate: "2026-08-24" }, today)).toBe("overdue");
    expect(getTaskDueState({ status: "open", dueDate: "2026-08-25" }, today)).toBe("due_today");
    expect(getTaskDueState({ status: "open", dueDate: "2026-08-27" }, today)).toBe("due_soon");
    expect(getTaskDueState({ status: "open", dueDate: "2026-09-01" }, today)).toBe("normal");
    expect(getTaskDueState({ status: "open" }, today)).toBe("none");
  });

  it("does not remind for completed tasks", () => {
    expect(getTaskDueState({ status: "done", dueDate: "2026-08-20" }, today)).toBe("none");
  });
});
