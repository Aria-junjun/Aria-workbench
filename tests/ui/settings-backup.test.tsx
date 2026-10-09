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
  it("offers manual cloud backup and requires local export plus a second confirmation before cloud restore", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/settings/page.tsx"), "utf8");
    expect(source).toContain("备份到云端");
    expect(source).toContain("从云端恢复");
    expect(source).toContain("readCloudSnapshotForRestore");
    expect(source).toContain("exportBackup();");
    expect(source).toContain("检查下载完成");
  });
});
