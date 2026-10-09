import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("product master monthly inbound import contract", () => {
  const page = fs.readFileSync(path.join(process.cwd(), "src/app/product-master/page.tsx"), "utf8");
  const skuPage = fs.readFileSync(path.join(process.cwd(), "src/app/sku-master/import/page.tsx"), "utf8");
  const preview = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/supplier-inbound-import-preview.tsx"), "utf8");

  it("exposes a separate inbound import entry and only saves from confirmation", () => {
    expect(page).toContain("导入月度实际入仓表");
    expect(page).toContain("parseSupplierInboundRows");
    expect(page).toContain("saveInboundImport");
    expect(preview).toContain("确认保存");
    expect(preview).toContain("暂不关联");
  });

  it("keeps test seed data out of the production page and explains the operating snapshot action", () => {
    expect(page).not.toContain("录入6月聚赢测试数据");
    expect(page).toContain("保存本月经营指标");
    expect(page).toContain("月度销售、退货与成本指标");
  });

  it("persists confirmed supplier item mappings for future imports", () => {
    expect(page).toContain("saveSupplierInboundProductMappings");
    expect(preview).toContain("savedMappings");
    expect(preview).toContain("供应商商品名 + 规格");
  });

  it("assigns one stable batch identifier to each confirmed inbound workbook import", () => {
    expect(page).toContain("importBatchId");
    expect(page).toContain("grouped.map");
  });

  it("requires a supplier choice when the statement has no supplier name", () => {
    expect(preview).toContain("请选择供应商");
    expect(preview).toContain("!supplierFromFile && !supplierId");
  });

  it("explains when a saved relationship starts after the import period", () => {
    expect(preview).toContain("关系生效月份晚于本次导入月份");
    expect(preview).toContain("不会把未来关系倒灌到历史数据");
  });

  it("does not reset manual row selections on an unrelated rerender", () => {
    expect(preview).toContain("skuSignature");
    expect(preview).toContain("assignmentSignature");
  });

  it("exposes batch product-family supplier mapping and operating-code grouping", () => {
    expect(skuPage).toContain("批量归属产品族与供应商");
    expect(skuPage).toContain("saveProductSupplierAssignments");
    expect(skuPage).toContain("deriveOperatingProductCode");
  });

  it("keeps the encoding table focused and hides offer association tools by default", () => {
    expect(skuPage).toContain("产品族");
    expect(skuPage).toContain("SKU变量明细");
    expect(skuPage).toContain("需要处理的异常提示");
    expect(skuPage).toContain("showSecondaryAssociationTools && activeSkuMasters.length > 0 && matchSummary.results.some");
    expect(skuPage).toContain("showSecondaryAssociationTools && activeSkuMasters.length > 0 ? (");
    expect(skuPage).toContain("批量选择主供供应商");
    expect(skuPage).toContain("批量选择备供供应商");
    expect(skuPage).not.toContain(">候选货盘</div>");
  });
});
