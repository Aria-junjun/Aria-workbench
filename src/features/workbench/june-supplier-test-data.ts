import type { LocalMonthlyInboundSnapshot, LocalSkuMaster } from "./local-store";

type JuneRow = { family: "静电哑光墙贴" | "无胶白板贴小纸管"; spec: string; quantity: number; amount: number };

export const JUNE_SUPPLIER_TEST_PERIOD = "2026-06";
export const JUYING_SUPPLIER_ID = "d9c07b8f-9115-4b64-aac8-57096e752644";

const rows: JuneRow[] = [
  { family: "静电哑光墙贴", spec: "45*2", quantity: 160, amount: 272 },
  { family: "静电哑光墙贴", spec: "45*3", quantity: 160, amount: 352 },
  { family: "静电哑光墙贴", spec: "45*5", quantity: 70, amount: 210 },
  { family: "静电哑光墙贴", spec: "45*10", quantity: 120, amount: 600 },
  { family: "静电哑光墙贴", spec: "60*2", quantity: 160, amount: 336 },
  { family: "静电哑光墙贴", spec: "60*3", quantity: 160, amount: 416 },
  { family: "无胶白板贴小纸管", spec: "45*5", quantity: 70, amount: 224 },
  { family: "无胶白板贴小纸管", spec: "60*2", quantity: 240, amount: 576 },
  { family: "无胶白板贴小纸管", spec: "90*2", quantity: 720, amount: 2448 },
  { family: "无胶白板贴小纸管", spec: "90*5", quantity: 70, amount: 399 },
  { family: "无胶白板贴小纸管", spec: "120*2", quantity: 400, amount: 1920 },
  { family: "无胶白板贴小纸管", spec: "120*5", quantity: 70, amount: 609 }
];

function sameSpec(left: string, right: string) {
  const a = left.match(/\d+(?:\.\d+)?/g) ?? [];
  const b = right.match(/\d+(?:\.\d+)?/g) ?? [];
  if (a.length < 2 || b.length < 2) return false;
  const normalizeWidth = (value: string) => {
    const number = Number(value);
    return number > 0 && number < 10 ? number * 100 : number;
  };
  return normalizeWidth(a[0]!) === normalizeWidth(b[0]!) && Number(a[1]) === Number(b[1]);
}

export function buildJuneJuyingInboundSnapshots(skus: LocalSkuMaster[], importedAt: string) {
  const snapshots: Array<Omit<LocalMonthlyInboundSnapshot, "id"> & { id: string }> = [];
  const missing: string[] = [];
  for (const row of rows) {
    const familyCandidates = skus.filter((candidate) => {
      const family = candidate.productFamilyKey || candidate.productName;
      return family.includes(row.family) && sameSpec(candidate.specification, row.spec);
    });
    const sku = familyCandidates.sort((left, right) => Number(/-8$/.test(left.internalSkuCode)) - Number(/-8$/.test(right.internalSkuCode)))[0];
    if (!sku) {
      missing.push(`${row.family} ${row.spec}`);
      continue;
    }
    snapshots.push({
      id: `juying-june-${sku.id}`,
      skuMasterId: sku.id,
      productFamilyKey: row.family,
      mappingLevel: "sku",
      period: JUNE_SUPPLIER_TEST_PERIOD,
      receivedQuantity: row.quantity,
      settlementAmount: row.amount,
      settlementUnitPrice: row.amount / row.quantity,
      supplierId: JUYING_SUPPLIER_ID,
      supplierName: "聚赢",
      sourceFileName: "聚赢2026年6月采购对账单-截图录入",
      sourceSheetName: "6月采购单",
      importedAt
    });
  }
  return { snapshots, missing };
}
