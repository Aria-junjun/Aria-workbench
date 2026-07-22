import fs from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";

export type ProgramBackupFile = {
  relativePath: string;
  absolutePath: string;
};

const excludedDirectories = new Set([
  ".git", ".next", ".worktrees", "node_modules", "output", "tmp", ".tmp-competitor-analysis"
]);

export function collectProgramBackupFiles(root: string): ProgramBackupFile[] {
  const files: ProgramBackupFile[] = [];
  walk(root, "", files);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  function walk(current: string, relativeDirectory: string, output: ProgramBackupFile[]) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const relativePath = path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name);
      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) walk(path.join(current, entry.name), relativePath, output);
        continue;
      }
      if (!entry.isFile() || shouldExcludeFile(entry.name)) continue;
      output.push({ relativePath, absolutePath: path.join(current, entry.name) });
    }
  }
}

export function createProgramBackupArchive(root: string, businessData: string, productDrafts = "{}") {
  JSON.parse(businessData);
  JSON.parse(productDrafts);
  const files = collectProgramBackupFiles(root);
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[file.relativePath] = new Uint8Array(fs.readFileSync(file.absolutePath));

  const exportedAt = new Date().toISOString();
  entries["backup/业务数据.json"] = strToU8(businessData);
  entries["backup/产品录入草稿.json"] = strToU8(productDrafts);
  entries["备份说明.json"] = strToU8(JSON.stringify({
    format: "personal-commercial-workbench-complete-backup",
    version: 1,
    exportedAt,
    sourceFiles: files.length,
    pageFiles: files.filter((file) => /(^|\/)page\.tsx$|(^|\/)layout\.tsx$/.test(file.relativePath)).length,
    businessDataFile: "backup/业务数据.json",
    productDraftsFile: "backup/产品录入草稿.json",
    restore: ["解压程序文件", "运行 npm install", "运行 npm run dev", "在设置页导入 backup/业务数据.json"]
  }, null, 2));

  return {
    buffer: Buffer.from(zipSync(entries, { level: 6 })),
    entries: Object.keys(entries).sort()
  };
}

function shouldExcludeFile(name: string) {
  return name === ".env" || name.startsWith(".env.") || name.endsWith(".log") ||
    name.endsWith(".tsbuildinfo") || name.endsWith(".zip");
}
