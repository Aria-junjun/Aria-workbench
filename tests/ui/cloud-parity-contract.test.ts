import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("cloud parity contract", () => {
  it("uses the lavender theme as the local default", () => {
    const source = fs.readFileSync(path.join(root, "src/lib/theme.ts"), "utf8");

    expect(source).toContain('export const defaultTheme = presetThemes.find((theme) => theme.id === "lavender") ?? presetThemes[0];');
  });

  it("keeps the desktop shell geometry aligned with the cloud reference", () => {
    const source = fs.readFileSync(path.join(root, "src/components/app-shell.tsx"), "utf8");

    expect(source).toContain('w-[clamp(256px,15vw,290px)]');
    expect(source).toContain('md:pl-[clamp(256px,15vw,290px)]');
    expect(source).toContain('md:px-8');
    expect(source).toContain('max-w-[1230px]');
  });

  it("ships the cloud backup collections as the offline fallback", () => {
    const data = JSON.parse(fs.readFileSync(path.join(root, "src/data/workbench-data.json"), "utf8")) as Record<string, unknown[]>;

    expect(data.suppliers).toHaveLength(18);
    expect(data.communications).toHaveLength(26);
    expect(data.offers).toHaveLength(32);
    expect(data.products).toHaveLength(11);
    expect(data.tasks).toHaveLength(45);
    expect(data.knowledgeBooks).toHaveLength(4);
    expect(data.decisionTools).toHaveLength(44);
    expect(data.knowledgeApplications).toHaveLength(2);
    expect(data.knowledgeCards).toHaveLength(14);
    expect(data.researchReports).toHaveLength(0);
  });

  it("avoids duplicate dashboard sync and bounds slow cloud reads", () => {
    const page = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
    const loader = fs.readFileSync(path.join(root, "src/components/data-sync-loader.tsx"), "utf8");
    const store = fs.readFileSync(path.join(root, "src/features/workbench/local-store.ts"), "utf8");

    expect(page).not.toContain("loadWorkbenchData");
    expect(loader).toContain("loadWorkbenchData");
    expect(store).toContain("SYNC_TIMEOUT_MS");
    expect(store).toContain("new AbortController()");
    expect(store).toContain("signal: controller.signal");
  });
});
