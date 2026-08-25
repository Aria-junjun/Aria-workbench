import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("supplier detail links", () => {
  it("resolves legacy inbound rows that only have a supplier name", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/page.tsx"), "utf8");
    expect(source).toContain("supplierIdByName");
    expect(source).toContain("supplierId: snapshot.supplierId ?? (");
    expect(source).toContain("supplierIdByName.get");
  });
});
