import type { ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";

export type ProductComparisonRow = {
  label: string;
  values: string[];
};

export type ProductComparison = {
  products: ProductKnowledgeV2[];
  rows: ProductComparisonRow[];
  unitWarning?: string;
};

export function buildProductComparison(products: ProductKnowledgeV2[]): ProductComparison {
  const specificationNames = unique(products.flatMap((product) => product.specifications.map((item) => item.name)));

  return {
    products,
    rows: [
      row("品类", products.map((product) => product.category)),
      row("核心用途", products.map((product) => product.coreUse)),
      row("目标用户", products.map((product) => product.targetUsers)),
      row("使用场景", products.map((product) => product.useScenarios.join("、"))),
      row("计量单位", products.map((product) => product.defaultUnit)),
      row("采购报价", products.map(formatProcurementQuotes)),
      ...specificationNames.map((name) => row(name, products.map((product) => {
        const item = product.specifications.find((specification) => specification.name === name);
        return item ? `${item.value}${item.unit ? ` ${item.unit}` : ""}` : undefined;
      }))),
      row("核心工艺", products.map((product) => product.manufacturing.processes.join("、"))),
      row("原料与结构", products.map((product) => product.materialStructures.map((item) => `${item.name}${item.role ? `（${item.role}）` : ""}`).join("、"))),
      row("所需机器", products.map((product) => product.machinery.join("、"))),
      row("质量控制点", products.map((product) => product.qualityControls.join("、"))),
      row("主要产业带", products.map((product) => product.industryClusters.join("、"))),
      row("生产周期", products.map((product) => product.manufacturing.leadTime)),
      row("最小起订量", products.map((product) => product.manufacturing.minimumOrderQuantity)),
      row("质量风险", products.map((product) => product.risks.quality.join("、"))),
      row("供应风险", products.map((product) => product.risks.supply.join("、"))),
      row("成熟替代", products.map((product) => product.optimizationOptions.map((item) => item.name).join("、"))),
      row("决策建议", products.map((product) => product.decision.recommendation))
    ]
  };
}

function row(label: string, values: Array<string | undefined>): ProductComparisonRow {
  return { label, values: values.map((value) => value || "未记录") };
}

function formatProcurementQuotes(product: ProductKnowledgeV2): string {
  return product.procurementQuotes
    .map((quote) => [quote.source, quote.specification, quote.price].join("｜"))
    .join("；") || "待询价";
}

function unique(values: string[]) {
  return [...new Set(values)];
}
