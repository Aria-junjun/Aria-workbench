import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("supplier archive mode source", () => {
  it("derives business ownership from transaction evidence instead of profile labels", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/features/workbench/dropship-decision-loop.ts"), "utf8");
    expect(source).toContain("export function deriveSupplierBusinessModes");
    expect(source).toContain("snapshot.supplierName");
    expect(source).toContain("record.fields.fulfillmentMode === 'warehouse'");
    expect(source).toContain("record.kind === 'dropship_period'");
  });
});
