import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("settings backup controls", () => {
  it("offers both business-data and complete-program backups", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/settings/page.tsx"), "utf8");
    expect(source).toContain("导出全部业务数据");
    expect(source).toContain("导出完整程序备份");
    expect(source).toContain('fetch("/api/backup/program"');
    expect(source).toContain("exportProductImportDrafts");
  });
});
