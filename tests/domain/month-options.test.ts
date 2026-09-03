import { describe, expect, it } from "vitest";
import { buildMonthOptions } from "@/features/workbench/month-options";

describe("month options", () => {
  it("includes every month from the earliest imported period through the current month", () => {
    expect(buildMonthOptions(["2026-07"], "2026-09")).toEqual(["2026-09", "2026-08", "2026-07"]);
  });
});
