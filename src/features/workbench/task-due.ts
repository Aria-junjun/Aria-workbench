import type { LocalTask } from "./local-store";

export type TaskDueState = "none" | "normal" | "due_today" | "due_soon" | "overdue";

function localDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function getTaskDueState(
  task: Pick<LocalTask, "dueDate" | "status">,
  today = new Date(),
): TaskDueState {
  if (task.status === "done") return "none";
  const dueDate = parseLocalDate(task.dueDate);
  if (!dueDate) return "none";

  const difference = Math.round((localDay(dueDate).getTime() - localDay(today).getTime()) / 86_400_000);
  if (difference < 0) return "overdue";
  if (difference === 0) return "due_today";
  if (difference <= 3) return "due_soon";
  return "normal";
}
