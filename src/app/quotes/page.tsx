"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { loadLocalWorkbenchData, saveLocalWorkbenchData, type LocalOffer, type OfferSku } from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Package,
  Pencil,
  Scale,
  TrendingDown,
  Truck,
  X
} from "lucide-react";

export default function QuotesComparePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-muted">加载对比数据...</div>}>
      <QuotesCompareContent />
    </Suspense>
  );
}

/* ---------- 数值格式化 ---------- */

function formatNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("zh-CN");
}

function numMin(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && !isNaN(v));
  return valid.length > 0 ? Math.min(...valid) : null;
}

function numMax(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && !isNaN(v));
  return valid.length > 0 ? Math.max(...valid) : null;
}

/* ---------- 可编辑单元格 ---------- */

function EditableCell({
  offerId,
  fieldKey,
  value,
  isName,
  isHighlight,
  best,
  onSaved
}: {
  offerId: string;
  fieldKey: string;
  value: string | undefined;
  isName?: boolean;
  isHighlight?: boolean;
  best?: "best" | "worst" | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  const isEmpty = !value || value.trim().length === 0;

  function save() {
    if (draft.trim() === (value || "").trim()) {
      setEditing(false);
      return;
    }
    const data = loadLocalWorkbenchData();
    saveLocalWorkbenchData({
      ...data,
      offers: data.offers.map((o) =>
        o.id === offerId ? { ...o, [fieldKey]: draft.trim() } : o
      )
    });
    setEditing(false);
    onSaved();
  }

  function cancel() {
    setDraft(value || "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          className="min-w-0 flex-1 rounded-md border border-action bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-action"
          onBlur={() => {
            setTimeout(() => {
              if (document.activeElement?.tagName !== "BUTTON") save();
            }, 150);
          }}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          value={draft}
        />
        <button
          className="rounded bg-success px-1.5 py-0.5 text-[10px] text-white"
          onClick={save}
          type="button"
        >
          保存
        </button>
      </div>
    );
  }

  const content = isEmpty ? (
    <button
      className="flex w-full items-center gap-1 rounded-md border border-dashed border-line px-2 py-1 text-xs text-muted hover:border-action hover:text-action transition-colors"
      onClick={() => setEditing(true)}
      title="点击补充"
      type="button"
    >
      <Pencil className="h-3 w-3" />
      补充
    </button>
  ) : isName ? (
    <Link className="text-action hover:underline" href={`/offers/${offerId}`}>
      {value}
    </Link>
  ) : (
    <span className="text-slate-700">
      {value}
    </span>
  );

  return (
    <div
      className={`group flex items-center gap-1.5 ${isEmpty ? "" : "cursor-text"}`}
      onClick={() => !isEmpty && setEditing(true)}
      role="button"
      tabIndex={0}
    >
      {best === "best" ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-white">
          <Check className="h-2.5 w-2.5" />
        </span>
      ) : null}
      {content}
      {!isEmpty ? (
        <Pencil className="h-3 w-3 shrink-0 opacity-0 text-muted transition-opacity group-hover:opacity-60" />
      ) : null}
    </div>
  );
}

/* ---------- 对比组 ---------- */

type CompareGroup = {
  title: string;
  icon: React.ReactNode;
  rows: {
    label: string;
    key: keyof LocalOffer;
    numKey?: keyof LocalOffer;
    highlight?: boolean;
    lowerBetter?: boolean;
  }[];
};

const compareGroups: CompareGroup[] = [
  {
    title: "基础信息",
    icon: <Package className="h-4 w-4" />,
    rows: [
      { label: "货盘名称", key: "name" },
      { label: "供应商", key: "supplierName" },
      { label: "品类", key: "category" },
      { label: "关键规格", key: "keySpecs" },
      { label: "尺寸", key: "dimensions" },
    ]
  },
  {
    title: "价格对比",
    icon: <Scale className="h-4 w-4" />,
    rows: [
      { label: "报价", key: "quotedPrice", numKey: "quotedPriceNum", highlight: true, lowerBetter: true },
      { label: "未税单价", key: "untaxedUnitPrice", numKey: "untaxedUnitPriceNum", highlight: true, lowerBetter: true },
      { label: "含税单价", key: "taxedUnitPrice", numKey: "taxedUnitPriceNum", highlight: true, lowerBetter: true },
      { label: "调价规则", key: "priceAdjustmentRule" },
    ]
  },
  {
    title: "供应条件",
    icon: <Truck className="h-4 w-4" />,
    rows: [
      { label: "MOQ", key: "moq", numKey: "moqNum", lowerBetter: true },
      { label: "交期", key: "leadTime", numKey: "leadTimeDays", lowerBetter: true },
      { label: "计价单位", key: "pricingUnit" },
      { label: "包装单位", key: "packageUnit" },
      { label: "是否含运费", key: "freightIncluded" },
      { label: "样品情况", key: "sampleStatus" },
    ]
  },
  {
    title: "评估判断",
    icon: <TrendingDown className="h-4 w-4" />,
    rows: [
      { label: "材质等级", key: "materialGrade" },
      { label: "适合渠道", key: "channelFit" },
      { label: "优势", key: "advantages" },
      { label: "风险", key: "risks" },
      { label: "备注", key: "notes" },
    ]
  }
];

/* ---------- 主组件 ---------- */

function QuotesCompareContent() {
  const searchParams = useSearchParams();
  const offerIdsParam = searchParams.get("offerIds") || "";
  const offerIds = offerIdsParam.split(",").filter(Boolean);
  const [refreshKey, setRefreshKey] = useState(0);
  const [skuExpanded, setSkuExpanded] = useState(true);

  const data = useWorkbenchData();
  const offers = offerIds
    .map((id) => data.offers.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => o != null);

  function triggerRefresh() {
    setRefreshKey((k) => k + 1);
  }

  /* 预计算每个数值字段的最优值 */
  const bestValues = useMemo(() => {
    const map = new Map<string, { min: number | null; max: number | null; lowerBetter: boolean }>();
    for (const group of compareGroups) {
      for (const row of group.rows) {
        if (row.numKey) {
          const nk = row.numKey;
          const values = offers.map((o) => o[nk] as number | null | undefined);
          map.set(row.key, {
            min: numMin(values),
            max: numMax(values),
            lowerBetter: row.lowerBetter ?? false
          });
        }
      }
    }
    return map;
  }, [offers, refreshKey]);

  function isBest(offer: LocalOffer, key: string): "best" | "worst" | null {
    const info = bestValues.get(key);
    if (!info || info.min == null || info.max == null || info.min === info.max) return null;
    const val = (offer as Record<string, unknown>)[key] as number | null | undefined;
    if (val == null) return null;
    if (info.lowerBetter) {
      if (val === info.min) return "best";
      if (val === info.max) return "worst";
    } else {
      if (val === info.max) return "best";
      if (val === info.min) return "worst";
    }
    return null;
  }

  /* 统计有值的字段数 */
  function filledCount(offer: LocalOffer): number {
    return compareGroups.reduce((count, group) =>
      count + group.rows.filter((row) => {
        const v = offer[row.key];
        return typeof v === "string" && v.trim().length > 0;
      }).length, 0);
  }

  const totalFields = compareGroups.reduce((s, g) => s + g.rows.length, 0);

  if (offers.length === 0) {
    return (
      <div className="space-y-5">
        <Link className="inline-flex items-center gap-2 text-sm text-action" href="/offers">
          <ArrowLeft className="h-4 w-4" />
          返回货盘库
        </Link>
        <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
          <Scale className="mx-auto mb-3 h-10 w-10 text-muted-light" />
          <p className="font-medium">没有选择货盘进行对比</p>
          <p className="mt-1 text-sm text-muted">请先返回货盘库，勾选要对比的货盘后点击「生成对比表」。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" key={refreshKey}>
      {/* 顶部导航 */}
      <Link className="inline-flex items-center gap-1 text-sm text-action" href="/offers">
        <ChevronRight className="h-4 w-4 rotate-180" />
        返回货盘库
      </Link>

      {/* 页面标题 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-action-soft border border-action/15">
            <Scale className="h-5 w-5 text-action" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">货盘对比</h1>
            <p className="text-sm text-muted">对比 {offers.length} 个货盘的关键指标</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded-full bg-success" />
            最优
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded-full bg-danger" />
            最高
          </div>
          {offers.length >= 2 ? (
            <div className="ml-2 flex items-center gap-1 rounded-lg bg-paper-warm px-2 py-1">
              <ArrowDownUp className="h-3 w-3" />
              价格/MOQ/交期自动标注最优项
            </div>
          ) : null}
        </div>
      </div>

      {/* 货盘卡片概览 */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(offers.length, 4)}, minmax(0, 1fr))` }}>
        {offers.map((offer) => (
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card" key={offer.id}>
            <div className="flex items-start justify-between gap-2">
              <Link className="font-semibold text-action hover:underline line-clamp-2" href={`/offers/${offer.id}`}>
                {offer.name}
              </Link>
              <span className="shrink-0 text-xs text-muted">{filledCount(offer)}/{totalFields}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{offer.supplierName || "未关联供应商"}</p>
            {offer.quotedPrice ? (
              <div className="mt-3 rounded-lg bg-paper-warm px-3 py-2">
                <span className="text-xs text-muted">报价</span>
                <span className="ml-2 font-semibold text-ink">{offer.quotedPrice}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* 分组对比表 */}

      {/* SKU 规格明细对比 */}
      <SkuCompareSection expanded={skuExpanded} offers={offers} onToggle={() => setSkuExpanded(!skuExpanded)} />

      {compareGroups.map((group) => (
        <section className="rounded-3xl border border-line bg-surface shadow-card overflow-hidden" key={group.title}>
          {/* 组标题 */}
          <div className="flex items-center gap-2 border-b border-line bg-paper-warm px-5 py-3">
            <span className="text-action">{group.icon}</span>
            <h2 className="font-semibold">{group.title}</h2>
          </div>

          {/* 对比表格 */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface">
                  <th className="sticky left-0 z-10 min-w-[100px] border-r border-line bg-paper-warm px-4 py-3 text-left text-xs font-medium text-muted">
                    指标
                  </th>
                  {offers.map((offer) => (
                    <th className="min-w-[180px] border-r border-line px-4 py-3 text-left" key={offer.id}>
                      <Link className="text-xs font-medium text-action hover:underline" href={`/offers/${offer.id}`}>
                        {offer.name.length > 12 ? offer.name.slice(0, 12) + "..." : offer.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, rowIndex) => (
                  <tr className={`border-b border-line ${rowIndex % 2 === 1 ? "bg-paper/40" : ""}`} key={row.key}>
                    <td className={`sticky left-0 z-10 border-r border-line px-4 py-3 text-xs font-medium ${
                      row.highlight ? "text-action bg-action-soft/20" : "text-muted bg-white"
                    }`}>
                      {row.label}
                    </td>
                    {offers.map((offer) => {
                      const best = isBest(offer, row.key);
                      const cellValue = offer[row.key] as string | undefined;
                      const numValue = row.numKey ? (offer[row.numKey] as number | null | undefined) : null;
                      return (
                        <td className={`border-r border-line px-4 py-3 ${best === "best" ? "bg-success-soft/30" : best === "worst" ? "bg-danger-soft/15" : ""}`} key={offer.id}>
                          <EditableCell
                            best={best}
                            fieldKey={row.key}
                            isHighlight={row.highlight}
                            isName={row.key === "name"}
                            offerId={offer.id}
                            onSaved={triggerRefresh}
                            value={cellValue}
                          />
                          {/* 数值小标签：仅当原始文本不含该数字时才展示 */}
                          {numValue != null && row.numKey && !String(cellValue).includes(String(numValue)) ? (
                            <span className="mt-0.5 block text-xs text-muted">{formatNum(numValue)}</span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* 底部操作 */}
      <div className="flex flex-wrap gap-3 pb-6">
        <Link
          className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-paper-warm"
          href="/offers"
        >
          <ArrowLeft className="h-4 w-4" />
          返回货盘库
        </Link>
        <Link
          className="inline-flex items-center gap-2 rounded-xl bg-action px-4 py-2.5 text-sm text-white hover:shadow-card-hover"
          href="/intake"
        >
          录入新货盘
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

/* ---------- SKU 规格明细对比区域 ---------- */

function SkuCompareSection({
  offers,
  expanded,
  onToggle
}: {
  offers: LocalOffer[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasSkus = offers.some((o) => o.skus && o.skus.length > 0);
  if (!hasSkus) return null;

  // 收集所有货盘的全部规格名（去重 + 保持顺序），按名称匹配而非按索引对齐
  const allSpecNames: string[] = [];
  const seen = new Set<string>();
  for (const offer of offers) {
    for (const sku of offer.skus ?? []) {
      const name = sku.specName.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        allSpecNames.push(name);
      }
    }
  }

  // 为每个货盘建立 specName → sku 的快速查找表
  const skuMapByOffer = offers.map((offer) => {
    const map = new Map<string, OfferSku>();
    for (const sku of offer.skus ?? []) {
      if (sku.specName) map.set(sku.specName.trim(), sku);
    }
    return map;
  });

  return (
    <section className="rounded-3xl border border-line bg-surface shadow-card overflow-hidden">
      <button
        className="flex w-full items-center gap-2 border-b border-line bg-paper-warm px-5 py-3 text-left"
        onClick={onToggle}
        type="button"
      >
        <Package className="h-4 w-4 text-action" />
        <h2 className="font-semibold">规格明细对比</h2>
        <span className="text-xs text-muted">共 {allSpecNames.length} 个规格</span>
        <span className="ml-auto text-xs text-muted">{expanded ? "收起" : "展开"}</span>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-line bg-surface">
                <th className="sticky left-0 z-10 min-w-[140px] border-r border-line bg-paper-warm px-3 py-2 text-left font-medium text-muted">
                  规格
                </th>
                {offers.map((offer) => (
                  <th className="min-w-[100px] border-r border-line px-3 py-2 text-left font-medium" key={offer.id}>
                    <span className="text-action">{offer.supplierName || offer.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allSpecNames.map((specName) => {
                // 按名称查找每个货盘的 SKU（skuMapByOffer 是数组，索引与 offers 对齐）
                const matchedSkus = offers.map((_, idx) => skuMapByOffer[idx]?.get(specName));
                const prices = matchedSkus.map((sku) => sku?.unitPrice);
                const validPrices = prices.filter((p): p is number => p != null && !isNaN(p));
                const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
                const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : null;
                const hasMatch = matchedSkus.some(Boolean);

                return (
                  <tr className={`border-b border-line last:border-0 hover:bg-action-soft/20 transition-colors ${!hasMatch ? "opacity-40" : ""}`} key={specName}>
                    <td className="sticky left-0 z-10 border-r border-line bg-white px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                      {specName}
                    </td>
                    {offers.map((offer, offerIdx) => {
                      const sku = matchedSkus[offerIdx];
                      const price = sku?.unitPrice;
                      const isBest = price != null && minPrice != null && maxPrice != null && price === minPrice && validPrices.length >= 2 && minPrice !== maxPrice;

                      return (
                        <td className={`border-r border-line px-3 py-2 whitespace-nowrap ${isBest ? "bg-success-soft/30" : ""}`} key={offer.id}>
                          {sku ? (
                            <div className="flex items-center gap-1">
                              {isBest ? (
                                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-success text-white">
                                  <Check className="h-2 w-2" />
                                </span>
                              ) : null}
                              <span className={price != null ? "font-medium" : "text-muted"}>
                                {sku.unitPriceStr || (price != null ? `¥${price.toFixed(2)}` : "—")}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
