import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("需求探索导航和首页", () => {
  it("exposes an independent navigation entry and route", () => {
    const shell = fs.readFileSync(path.join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/demand-exploration/page.tsx"), "utf8");
    const home = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/demand-exploration/exploration-home.tsx"), "utf8");

    expect(shell).toContain('href: "/demand-exploration"');
    expect(shell).toContain('label: "需求探索"');
    expect(page).toContain("ExplorationHome");
    expect(home).toContain("需求探索");
    expect(home).toContain("提出需求");
    expect(home).toContain("KANO");
    expect(home).toContain("后续开放");
  });
});
