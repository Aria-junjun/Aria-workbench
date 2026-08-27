import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("decision field explanations contract", () => {
  it("defines an accessible reusable help hint", () => {
    const source = read("src/components/workbench/help-hint.tsx");

    expect(source).toContain("aria-label={`${label}说明`}");
    expect(source).toContain("title={description}");
    expect(source).toContain("type=\"button\"");
  });

  it("keeps product page explanations compact and decision-focused", () => {
    const source = read("src/app/product-master/page.tsx");

    expect(source).toContain("数据口径");
    expect(source).toContain("HelpHint");
    expect(source).toContain('label="实际入仓"');
    expect(source).not.toContain("<SourceNote");
    expect(source).not.toContain("使用右上角统计月份导入并保存；只写入能匹配内部编码的 SKU。");
    expect(source).not.toContain("库存 / 可售");
  });

  it("keeps supplier evidence visible with compact explanations", () => {
    const source = read("src/app/suppliers/page.tsx");

    expect(source).toContain("数据口径");
    expect(source).toContain("HelpHint");
    expect(source).toContain('label="退货率信号"');
    expect(source).not.toContain("交付、服务等无来源数据不补分");
  });
});
