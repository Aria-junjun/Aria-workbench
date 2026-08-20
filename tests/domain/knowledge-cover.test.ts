import { describe, expect, it } from "vitest";
import {
  fitKnowledgeCoverDimensions,
  validateKnowledgeCover
} from "@/features/workbench/knowledge-cover";

describe("knowledge book cover", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s images", (type) => {
    expect(validateKnowledgeCover({ type, size: 1024 })).toBeUndefined();
  });

  it("rejects unsupported files and files larger than 10 MB", () => {
    expect(validateKnowledgeCover({ type: "application/pdf", size: 1024 })).toContain("JPG");
    expect(validateKnowledgeCover({ type: "image/jpeg", size: 10 * 1024 * 1024 + 1 })).toContain("10MB");
  });

  it("scales landscape covers to a maximum 720 px edge", () => {
    expect(fitKnowledgeCoverDimensions(1440, 960)).toEqual({ width: 720, height: 480 });
  });

  it("scales portrait covers to a maximum 720 px edge", () => {
    expect(fitKnowledgeCoverDimensions(800, 1200)).toEqual({ width: 480, height: 720 });
  });

  it("does not enlarge small covers", () => {
    expect(fitKnowledgeCoverDimensions(300, 450)).toEqual({ width: 300, height: 450 });
  });
});
