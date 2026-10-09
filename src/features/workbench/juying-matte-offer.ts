import type { LocalOffer } from "./local-store";

export const JUYING_SUPPLIER_ID = "d9c07b8f-9115-4b64-aac8-57096e752644";
export const JUYING_MATTE_OFFER_NAME = "聚赢 - 哑光墙贴/静电保护膜（哑面款）";

const pricedSpecs = [
  ["45*2", 1.7], ["45*3", 2.2], ["45*5", 3], ["45*10", 5],
  ["60*2", 2.1], ["60*3", 2.6], ["60*5", 3.6], ["60*10", 5.8],
  ["90*2", 3.4], ["90*3", 4.1], ["90*5", 5.5], ["90*10", 8.4],
  ["120*2", 4.8], ["120*3", 5.7], ["120*5", 8.4], ["120*10", 13]
] as const;

export function buildJuyingMatteOffer(id: string, createdAt: string): LocalOffer {
  const skus = pricedSpecs.map(([specName, unitPrice], index) => ({
    id: `${id}-sku-${index + 1}`,
    specName,
    specCode: specName,
    unitPrice,
    unitPriceStr: String(unitPrice),
    pricingUnit: "元",
    width: `${specName.split("*")[0]}cm`,
    length: `${specName.split("*")[1]}m`
  }));

  return {
    id,
    supplierId: JUYING_SUPPLIER_ID,
    supplierName: "聚赢",
    name: JUYING_MATTE_OFFER_NAME,
    productName: "静电哑光墙贴",
    category: "哑光墙贴/静电保护膜",
    quotedPrice: "¥1.70 - ¥13.00",
    priceDetails: "截图录入；45*1未标价，未纳入可比价规格",
    skus,
    skuCount: skus.length,
    minPrice: 1.7,
    maxPrice: 13,
    quotedPriceNum: 1.7,
    createdAt
  };
}
