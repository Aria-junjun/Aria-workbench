import type { ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";

export type ProductBrief = {
  title: string;
  subtitle: string;
  facts: Array<[string, string]>;
  sections: Array<{ title: string; items: string[] }>;
};

export function buildProductBrief(product: ProductKnowledgeV2): ProductBrief {
  const risks = [...product.risks.quality, ...product.risks.supply, ...product.risks.compliance, ...product.risks.other];

  return {
    title: product.name,
    subtitle: [product.category, product.coreUse].filter(Boolean).join(" · "),
    facts: [
      ["目标用户", product.targetUsers || "未记录"],
      ["使用场景", product.useScenarios.join("、") || "未记录"],
      ["采购报价", formatProcurementQuotes(product)],
      ["当前建议", product.decision.recommendation || "未记录"]
    ],
    sections: [
      {
        title: "关键规格",
        items: product.specifications.map((item) => `${item.name}：${item.value}${item.unit ? ` ${item.unit}` : ""}`)
      },
      {
        title: "原料与结构",
        items: [
          ...product.materialStructures.map((item) => `${item.name}${item.role ? `｜${item.role}` : ""}${item.weaknesses ? `｜弊端：${item.weaknesses}` : ""}`)
        ]
      },
      {
        title: "生产流程与设备",
        items: [
          ...product.manufacturing.processes.map((item) => `工艺：${item}`),
          ...product.machinery.map((item) => `设备：${item}`),
          ...product.qualityControls.map((item) => `质控：${item}`)
        ]
      },
      {
        title: "成熟替代与优化",
        items: product.optimizationOptions.map((item) => `${item.name}${item.impact ? `：${item.impact}` : ""}`)
      },
      {
        title: "缺陷与采购验证",
        items: [...risks, product.decision.rationale].filter((item): item is string => Boolean(item))
      }
    ]
  };
}

function formatProcurementQuotes(product: ProductKnowledgeV2) {
  return product.procurementQuotes
    .map((quote) => [quote.source, quote.specification, quote.price].join("｜"))
    .join("；") || "待询价";
}
