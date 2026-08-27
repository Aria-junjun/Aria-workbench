export type ProductFamilyAttentionInput = {
  pendingSkuCount: number;
  returnRate?: number;
  currentSales?: number;
  previousSales?: number;
  hasCurrentData: boolean;
};

export function isCompositeSalesSku(productName: string): boolean {
  return /\+|＋|组合装|套装|礼盒|件套/.test(productName);
}

type OperatingSkuCode = { internalSkuCode: string };

export function deriveOperatingProductCode(skus: OperatingSkuCode[]): string | undefined {
  const codes = new Set(skus.map((sku) => sku.internalSkuCode.trim()).filter(Boolean));
  const baseCodes = [...codes].filter((code) => [...codes].some((candidate) => candidate !== code && candidate.startsWith(`${code}-`)));
  return baseCodes.sort((left, right) => left.length - right.length || left.localeCompare(right))[0] ?? [...codes].sort()[0];
}

export function getSkuOperatingRole(skuCode: string, operatingCode?: string): "采购/供货 SKU" | "销售变体" | "普通 SKU" {
  if (!operatingCode) return "普通 SKU";
  if (skuCode === operatingCode) return "采购/供货 SKU";
  if (skuCode.startsWith(`${operatingCode}-`)) return "销售变体";
  return "普通 SKU";
}

export function getProductFamilyAttention(input: ProductFamilyAttentionInput): string[] {
  const messages: string[] = [];
  if (input.pendingSkuCount > 0) messages.push("供应覆盖待补");
  if (input.returnRate !== undefined && input.returnRate >= 5) messages.push("退货率需复核");
  if (
    input.currentSales !== undefined &&
    input.previousSales !== undefined &&
    input.currentSales < input.previousSales
  ) {
    messages.push("实发较上月下降");
  }
  if (messages.length === 0 && !input.hasCurrentData) messages.push("经营数据待补");
  return messages.length > 0 ? messages.slice(0, 2) : ["当前无明显异常"];
}
