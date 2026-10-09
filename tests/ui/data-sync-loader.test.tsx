import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("data sync loader", () => {
  it("does not trigger unguarded cloud writes or reads on mount", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/data-sync-loader.tsx"), "utf8");
    expect(source).not.toContain('setInterval(sync, 30000)');
    expect(source).not.toContain('saveWorkbenchData(loadLocalWorkbenchData())');
    expect(source).toContain('prepareCloudBackup');
  });
});
