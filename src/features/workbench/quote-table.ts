import type { LocalOffer } from "./local-store";

export const quoteTableHeaders = [
  "供应商",
  "产品/货盘",
  "品类",
  "报价",
  "报价明细",
  "统一比价口径",
  "折算单价",
  "尺寸",
  "计价单位",
  "包装单位",
  "关键规格",
  "材质等级",
  "宽度",
  "卷长",
  "克重选项",
  "是否含运费",
  "MOQ",
  "交期",
  "规格",
  "包装",
  "样品",
  "优势",
  "风险",
  "备注"
];

export function buildQuoteRows(offers: LocalOffer[]) {
  return offers.map(buildAllColumnRow);
}

export function buildVisibleQuoteTable(offers: LocalOffer[]) {
  const visibleColumns = quoteColumns.filter((column) => column.always || offers.some((offer) => hasValue(column.value(offer))));
  return {
    headers: visibleColumns.map((column) => column.header),
    rows: offers.map((offer) => visibleColumns.map((column) => display(column.value(offer))))
  };
}

export function buildQuoteClipboardText(rows: string[][], headers = quoteTableHeaders) {
  return [headers, ...rows].map((row) => row.join("\t")).join("\n");
}

const quoteColumns: Array<{ header: string; always?: boolean; value: (offer: LocalOffer) => string | undefined }> = [
  { header: "供应商", always: true, value: (offer) => offer.supplierName },
  { header: "产品/货盘", always: true, value: (offer) => offer.name },
  { header: "品类", always: true, value: (offer) => offer.category },
  { header: "报价", always: true, value: (offer) => offer.quotedPrice },
  { header: "报价明细", value: (offer) => offer.priceDetails },
  { header: "未税单价", value: (offer) => offer.untaxedUnitPrice },
  { header: "未税版费", value: (offer) => offer.untaxedPlateFee },
  { header: "含税单价", value: (offer) => offer.taxedUnitPrice },
  { header: "含税版费", value: (offer) => offer.taxedPlateFee },
  { header: "开票/运费", value: (offer) => offer.taxFreightTerms },
  { header: "统一比价口径", value: (offer) => offer.comparisonBasis },
  { header: "折算单价", value: (offer) => offer.normalizedPriceDetails },
  { header: "尺寸", value: (offer) => offer.dimensions },
  { header: "计价单位", value: (offer) => offer.pricingUnit },
  { header: "包装单位", value: (offer) => offer.packageUnit },
  { header: "关键规格", value: (offer) => offer.keySpecs },
  { header: "材质等级", value: (offer) => offer.materialGrade },
  { header: "宽度", value: (offer) => offer.width },
  { header: "卷长", value: (offer) => offer.rollLength },
  { header: "克重选项", value: (offer) => offer.gramWeightOptions },
  { header: "是否含运费", value: (offer) => offer.freightIncluded },
  { header: "MOQ", always: true, value: (offer) => offer.moq },
  { header: "交期", always: true, value: (offer) => offer.leadTime },
  { header: "规格", value: (offer) => offer.specs },
  { header: "包装", value: (offer) => offer.packaging },
  { header: "样品", value: (offer) => offer.sampleStatus },
  { header: "优势", value: (offer) => offer.advantages },
  { header: "风险", value: (offer) => offer.risks },
  { header: "备注", value: (offer) => offer.notes }
];

function display(value?: string) {
  const normalized = value?.trim();
  return normalized || "未记录";
}

function hasValue(value?: string) {
  return Boolean(value?.trim());
}

/*
 Keep the legacy row shape for existing tests and callers that expect all columns.
 New comparison UI should use buildVisibleQuoteTable().
*/
function buildAllColumnRow(offer: LocalOffer) {
  return [
    display(offer.supplierName),
    display(offer.name),
    display(offer.category),
    display(offer.quotedPrice),
    display(offer.priceDetails),
    display(offer.comparisonBasis),
    display(offer.normalizedPriceDetails),
    display(offer.dimensions),
    display(offer.pricingUnit),
    display(offer.packageUnit),
    display(offer.keySpecs),
    display(offer.materialGrade),
    display(offer.width),
    display(offer.rollLength),
    display(offer.gramWeightOptions),
    display(offer.freightIncluded),
    display(offer.moq),
    display(offer.leadTime),
    display(offer.specs),
    display(offer.packaging),
    display(offer.sampleStatus),
    display(offer.advantages),
    display(offer.risks),
    display(offer.notes)
  ];
}
