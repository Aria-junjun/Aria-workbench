import type { LocalSkuComposition } from "@/features/workbench/local-store";

export function SkuCompositionPanel({ salesSkuCodes, compositions }: { salesSkuCodes: string[]; compositions: LocalSkuComposition[] }) {
  const rows = compositions.filter((item) => salesSkuCodes.includes(item.salesSkuCode));
  if (!rows.length) return null;
  return (
    <div className="mt-3 rounded-lg border border-line bg-paper-warm/40 px-3 py-2 text-xs">
      <div className="font-medium text-slate-700">已确认的组合 SKU 关系</div>
      <div className="mt-1 space-y-1 text-slate-600">
        {rows.map((row) => <div key={row.id}>{row.salesSkuCode} → {row.componentSkuCode} × {row.componentQuantity}{row.relationStatus === "pending" ? "（待确认）" : ""}</div>)}
      </div>
    </div>
  );
}
