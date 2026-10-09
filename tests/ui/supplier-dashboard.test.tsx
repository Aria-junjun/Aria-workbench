import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/suppliers/page.tsx", "utf8");

describe("supplier archive directory UI contract", () => {
  it("keeps the archive focused on supplier identity and directory actions", () => {
    expect(page).toContain("供应商档案");
    expect(page).toContain("搜索供应商名称、简称或品类");
    expect(page).toContain("实际业务归属");
    expect(page).toContain("查看档案");
    expect(page).toContain("管理总览");
    expect(page).not.toContain("供应商管理决策台账");
    expect(page).not.toContain("onManagementFactChange");
  });

  it("preserves add, duplicate-check, archive and restore actions", () => {
    expect(page).toContain("新增供应商");
    expect(page).toContain("检测重复");
    expect(page).toContain("停用供应商");
    expect(page).toContain("恢复供应商");
    expect(page).toContain("archiveSupplier");
    expect(page).toContain("restoreSupplier");
  });

  it("requires an archive reason, supports restoration, and keeps directory actions on one line", () => {
    expect(page).toContain("停用理由（必填）");
    expect(page).toContain("disabled={!archiveReason.trim()}");
    expect(page).toContain("whitespace-nowrap");
    expect(page).toContain("archiveReason");
    expect(page).toContain("恢复供应商");
  });

  it("provides an explicit low-activity view using the confirmed 30-day threshold", () => {
    expect(page).toContain("低活跃");
    expect(page).toContain("classifySupplierActivity");
    expect(page).toContain("低活跃 ${activityCounts.low}");
  });
});
