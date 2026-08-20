import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectProgramBackupFiles, createProgramBackupArchive } from "@/features/workbench/program-backup";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("program backup", () => {
  it("includes every source page and restore file while excluding secrets and generated folders", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "workbench-backup-"));
    roots.push(root);
    write(root, "src/app/page.tsx", "home");
    write(root, "src/app/settings/page.tsx", "settings");
    write(root, "src/components/nav.tsx", "nav");
    write(root, "package.json", "{}");
    write(root, "package-lock.json", "{}");
    write(root, ".env.local", "OPENAI_API_KEY=secret");
    write(root, ".next/cache/file", "cache");
    write(root, "node_modules/pkg/index.js", "dependency");
    write(root, "dev-3000.log", "log");

    expect(collectProgramBackupFiles(root).map((file) => file.relativePath)).toEqual([
      "package-lock.json",
      "package.json",
      "src/app/page.tsx",
      "src/app/settings/page.tsx",
      "src/components/nav.tsx"
    ]);
  });

  it("adds current business data and a restore manifest to the zip", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "workbench-backup-"));
    roots.push(root);
    write(root, "src/app/page.tsx", "home");

    const archive = createProgramBackupArchive(root, '{"suppliers":[]}', '[{"id":"draft-1"}]');
    expect(archive.entries).toContain("src/app/page.tsx");
    expect(archive.entries).toContain("backup/业务数据.json");
    expect(archive.entries).toContain("backup/产品录入草稿.json");
    expect(archive.entries).toContain("备份说明.json");
    expect(archive.buffer.byteLength).toBeGreaterThan(0);
  });

  it("archives every page in the current workbench", () => {
    const expectedPages = collectProgramBackupFiles(process.cwd())
      .filter((file) => /(^|\/)page\.tsx$|(^|\/)layout\.tsx$/.test(file.relativePath));
    const archive = createProgramBackupArchive(process.cwd(), "{}", "{}");
    expect(expectedPages.length).toBeGreaterThanOrEqual(25);
    for (const page of expectedPages) expect(archive.entries).toContain(page.relativePath);
  });
});

function write(root: string, relativePath: string, content: string) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
