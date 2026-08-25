export type ProductFamilyAttentionInput = {
  pendingSkuCount: number;
  returnRate?: number;
  currentSales?: number;
  previousSales?: number;
  hasCurrentData: boolean;
};

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
