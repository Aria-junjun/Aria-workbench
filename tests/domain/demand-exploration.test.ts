import { describe, expect, it } from "vitest";
import {
  calculateKanoScores,
  calculateQuadrantPosition,
  classifyKanoResponse,
  summarizeKanoResponses,
  type KanoResponse
} from "@/features/workbench/demand-exploration";

describe("KANO 需求探索规则", () => {
  it("maps the functional and dysfunctional answer pair to the course category", () => {
    expect(classifyKanoResponse("like", "dislike")).toBe("A");
    expect(classifyKanoResponse("must", "dislike")).toBe("O");
    expect(classifyKanoResponse("dislike", "must")).toBe("R");
    expect(classifyKanoResponse("neutral", "neutral")).toBe("I");
    expect(classifyKanoResponse("like", "like")).toBe("Q");
  });

  it("counts response categories without losing R or Q", () => {
    const responses: KanoResponse[] = [
      { functional: "like", dysfunctional: "dislike" },
      { functional: "must", dysfunctional: "dislike" },
      { functional: "dislike", dysfunctional: "must" },
      { functional: "neutral", dysfunctional: "neutral" },
      { functional: "like", dysfunctional: "like" }
    ];

    expect(summarizeKanoResponses(responses)).toEqual({ A: 1, O: 1, M: 0, I: 1, R: 1, Q: 1 });
  });

  it("calculates SI and DSI from valid categories and excludes R/Q", () => {
    expect(calculateKanoScores({ A: 8, O: 12, M: 5, I: 3, R: 1, Q: 0 })).toEqual({
      denominator: 28,
      si: 20 / 28,
      dsi: -17 / 28
    });
  });

  it("returns null scores when there are no valid responses", () => {
    expect(calculateKanoScores({ A: 0, O: 0, M: 0, I: 0, R: 2, Q: 1 })).toEqual({
      denominator: 0,
      si: null,
      dsi: null
    });
  });

  it("places a scored demand in the four-quadrant comparison", () => {
    expect(calculateQuadrantPosition({ si: 0.7, dsi: -0.6 }, 0.5, -0.4)).toBe("priority");
    expect(calculateQuadrantPosition({ si: 0.3, dsi: -0.2 }, 0.5, -0.4)).toBe("low-impact");
  });
});
