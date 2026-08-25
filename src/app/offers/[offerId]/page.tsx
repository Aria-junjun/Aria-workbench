"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Info, SectionActions, TextField } from "@/components/workbench/edit-fields";
import { deleteLocalItem, updateLocalItem, type LocalOffer, type LocalSkuOfferLink, type LocalSkuMaster, type OfferSku } from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import { randomId } from "@/lib/random-id";

/** 计算价格区间展示文本 */
function formatPriceRange(offer: LocalOffer): string | null {
  if (offer.minPrice != null && offer.maxPrice != null) {
    const min = Number(offer.minPrice);
    const max = Number(offer.maxPrice);
    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      return min === max ? `¥${min.toFixed(2)}` : `¥${min.toFixed(2)} - ¥${max.toFixed(2)}`;
    }
  }
  return null;
}

export default function OfferDetailPage() {
  const router = useRouter();
  const params = useParams();
  const offerId = Array.isArray(params.offerId) ? params.offerId[0] : params.offerId;
  const data = useWorkbenchData();
  const offer = data.offers.find((item) => item.id === offerId);
  const supplier = offer?.supplierId ? data.suppliers.find((s) => s.id === offer.supplierId) : null;
  const communications = data.communications.filter((item) => item.offerId === offerId);
  const tasks = data.tasks.filter((item) => item.offerId === offerId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LocalOffer | undefined>(offer);

  if (!offer || !draft) {
    return <div className="rounded-lg border border-line bg-white p-4 text-sm text-slate-600">没有找到这个货盘。</div>;
  }

  function save() {
    if (!draft) return;
    // 保存前根据 SKU 自动重算价格区间和规格数
    const validSkus = (draft.skus ?? []).filter((s) => s.unitPrice != null && !isNaN(s.unitPrice));
    const prices = validSkus.map((s) => s.unitPrice!);
    const recalculated: LocalOffer = {
      ...draft,
      skuCount: draft.skus?.length ?? 0,
      minPrice: prices.length > 0 ? Math.min(...prices) : undefined,
      maxPrice: prices.length > 0 ? Math.max(...prices) : undefined,
      quotedPrice: prices.length > 0
        ? `¥${Math.min(...prices).toFixed(2)} - ¥${Math.max(...prices).toFixed(2)}`
        : draft.quotedPrice
    };
    updateLocalItem("offers", recalculated.id, recalculated);
    setDraft(recalculated);
    setEditing(false);
  }

  function remove() {
    if (!draft) return;
    if (!window.confirm("确认删除这个货盘吗？")) return;
    deleteLocalItem("offers", draft.id);
    router.push("/offers");
  }

  return (
    <div className="space-y-5">
      <Link className="text-sm text-action" href="/offers">返回货盘库</Link>
      <section className="rounded-lg border border-line bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{offer.name}</h1>
            {(() => {
              const range = formatPriceRange(draft);
              return range ? (
                <div className="mt-1 text-lg font-medium text-action">{range}{(draft.skus?.length ?? draft.skuCount) ? ` (${draft.skus?.length ?? draft.skuCount}个规格)` : ""}</div>
              ) : null;
            })()}
          </div>
          <SectionActions editing={editing} onCancel={() => { setDraft(offer); setEditing(false); }} onDelete={remove} onEdit={() => setEditing(true)} onSave={save} />
        </div>

        {editing ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TextField label="货盘名称" onChange={(value) => setDraft({ ...draft, name: value })} value={draft.name} />
            <TextField label="供应商" onChange={(value) => setDraft({ ...draft, supplierName: value })} value={draft.supplierName || ""} />
            <TextField label="品类" onChange={(value) => setDraft({ ...draft, category: value })} value={draft.category || ""} />
            <TextField label="商品链接" onChange={(value) => setDraft({ ...draft, productUrl: value })} value={draft.productUrl || ""} />
            <TextField label="资料链接" onChange={(value) => setDraft({ ...draft, resourceUrl: value })} value={draft.resourceUrl || ""} />
            <TextField label="报价" onChange={(value) => setDraft({ ...draft, quotedPrice: value })} value={draft.quotedPrice || ""} />
            <TextField label="报价明细" multiline onChange={(value) => setDraft({ ...draft, priceDetails: value })} value={draft.priceDetails || ""} />

            {/* 规格明细（SKU）— 编辑模式下可直接修改 */}
            {draft.skus && draft.skus.length > 0 && (
              <SkuTable
                editing={editing}
                offerId={draft.id}
                skus={draft.skus}
                skuLinks={data.skuOfferLinks ?? []}
                skuMasters={data.skuMasters ?? []}
                onChange={(nextSkus) => setDraft({ ...draft, skus: nextSkus })}
              />
            )}
            <TextField label="未税单价" onChange={(value) => setDraft({ ...draft, untaxedUnitPrice: value })} value={draft.untaxedUnitPrice || ""} />
            <TextField label="未税版费" onChange={(value) => setDraft({ ...draft, untaxedPlateFee: value })} value={draft.untaxedPlateFee || ""} />
            <TextField label="含税单价" onChange={(value) => setDraft({ ...draft, taxedUnitPrice: value })} value={draft.taxedUnitPrice || ""} />
            <TextField label="含税版费" onChange={(value) => setDraft({ ...draft, taxedPlateFee: value })} value={draft.taxedPlateFee || ""} />
            <TextField label="开票/运费" onChange={(value) => setDraft({ ...draft, taxFreightTerms: value })} value={draft.taxFreightTerms || ""} />
            <TextField label="统一比价口径" multiline onChange={(value) => setDraft({ ...draft, comparisonBasis: value })} value={draft.comparisonBasis || ""} />
            <TextField label="折算单价" multiline onChange={(value) => setDraft({ ...draft, normalizedPriceDetails: value })} value={draft.normalizedPriceDetails || ""} />
            <TextField label="尺寸" onChange={(value) => setDraft({ ...draft, dimensions: value })} value={draft.dimensions || ""} />
            <TextField label="计价单位" onChange={(value) => setDraft({ ...draft, pricingUnit: value })} value={draft.pricingUnit || ""} />
            <TextField label="包装单位" onChange={(value) => setDraft({ ...draft, packageUnit: value })} value={draft.packageUnit || ""} />
            <TextField label="关键规格" multiline onChange={(value) => setDraft({ ...draft, keySpecs: value })} value={draft.keySpecs || ""} />
            <TextField label="材质等级" onChange={(value) => setDraft({ ...draft, materialGrade: value })} value={draft.materialGrade || ""} />
            <TextField label="宽度" onChange={(value) => setDraft({ ...draft, width: value })} value={draft.width || ""} />
            <TextField label="卷长" onChange={(value) => setDraft({ ...draft, rollLength: value })} value={draft.rollLength || ""} />
            <TextField label="克重选项" onChange={(value) => setDraft({ ...draft, gramWeightOptions: value })} value={draft.gramWeightOptions || ""} />
            <TextField label="单卷重量" onChange={(value) => setDraft({ ...draft, rollWeight: value })} value={draft.rollWeight || ""} />
            <TextField label="是否含运费" onChange={(value) => setDraft({ ...draft, freightIncluded: value })} value={draft.freightIncluded || ""} />
            <TextField label="调价规则" multiline onChange={(value) => setDraft({ ...draft, priceAdjustmentRule: value })} value={draft.priceAdjustmentRule || ""} />
            <TextField label="MOQ" onChange={(value) => setDraft({ ...draft, moq: value })} value={draft.moq || ""} />
            <TextField label="交期" onChange={(value) => setDraft({ ...draft, leadTime: value })} value={draft.leadTime || ""} />
            <TextField label="规格参数" multiline onChange={(value) => setDraft({ ...draft, specs: value })} value={draft.specs || ""} />
            <TextField label="包装信息" multiline onChange={(value) => setDraft({ ...draft, packaging: value })} value={draft.packaging || ""} />
            <TextField label="样品情况" onChange={(value) => setDraft({ ...draft, sampleStatus: value })} value={draft.sampleStatus || ""} />
            <TextField label="适合渠道" onChange={(value) => setDraft({ ...draft, channelFit: value })} value={draft.channelFit || ""} />
            <TextField label="优势说明" multiline onChange={(value) => setDraft({ ...draft, advantages: value })} value={draft.advantages || ""} />
            <TextField label="风险或疑点" multiline onChange={(value) => setDraft({ ...draft, risks: value })} value={draft.risks || ""} />
            <TextField label="备注" multiline onChange={(value) => setDraft({ ...draft, notes: value })} value={draft.notes || ""} />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="供应商" value={offer.supplierName} />
            <Info label="品类" value={offer.category} />
            <LinkInfo label="商品链接" value={offer.productUrl} />
            <LinkInfo label="资料链接" value={offer.resourceUrl} />
            {(() => {
              const range = formatPriceRange(offer);
              return range ? <Info label="价格区间" value={range} /> : <Info label="报价" value={offer.quotedPrice} />;
            })()}
            <Info label="报价明细" value={offer.priceDetails} />

            {/* 规格明细（SKU） */}
            {offer.skus && offer.skus.length > 0 && (
              <SkuTable
                editing={editing}
                offerId={offer.id}
                skus={offer.skus}
                skuLinks={data.skuOfferLinks ?? []}
                skuMasters={data.skuMasters ?? []}
                onChange={() => {}}
              />
            )}
            <Info label="未税单价" value={offer.untaxedUnitPrice} />
            <Info label="未税版费" value={offer.untaxedPlateFee} />
            <Info label="含税单价" value={offer.taxedUnitPrice} />
            <Info label="含税版费" value={offer.taxedPlateFee} />
            <Info label="开票/运费" value={offer.taxFreightTerms} />
            {offer.comparisonBasis ? <Info label="统一比价口径" value={offer.comparisonBasis} /> : null}
            {offer.normalizedPriceDetails ? <Info label="折算单价" value={offer.normalizedPriceDetails} /> : null}
            <Info label="尺寸" value={offer.dimensions} />
            <Info label="计价单位" value={offer.pricingUnit} />
            <Info label="包装单位" value={offer.packageUnit} />
            <Info label="关键规格" value={offer.keySpecs} />
            <Info label="材质等级" value={offer.materialGrade} />
            <Info label="宽度" value={offer.width} />
            <Info label="卷长" value={offer.rollLength} />
            <Info label="克重选项" value={offer.gramWeightOptions} />
            <Info label="单卷重量" value={offer.rollWeight} />
            <Info label="是否含运费" value={offer.freightIncluded} />
            <Info label="调价规则" value={offer.priceAdjustmentRule} />
            <Info label="MOQ" value={offer.moq} />
            <Info label="交期" value={offer.leadTime} />
            <Info label="规格参数" value={offer.specs} />
            <Info label="包装信息" value={offer.packaging} />
            <Info label="样品情况" value={offer.sampleStatus} />
            <Info label="适合渠道" value={offer.channelFit} />
            <Info label="优势说明" value={offer.advantages} />
            <Info label="风险或疑点" value={offer.risks} />
            <Info label="备注" value={offer.notes} />
          </div>
        )}
      </section>
      <p className="text-xs text-slate-500">规格匹配不等于主供关系；实际供应商以有效期内的供应关系或实际入仓证据为准。</p>

      {/* 关联信息 */}
      {supplier ? (
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-semibold">供应商</h2>
          <Link className="mt-2 block rounded-md border border-line p-3 text-sm hover:border-action" href={`/suppliers/${supplier.id}`}>
            <div className="font-medium">{supplier.name}</div>
            <div className="mt-1 text-xs text-muted">{supplier.categories.join("、")}</div>
          </Link>
        </section>
      ) : null}

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">关联沟通记录</h2>
        {communications.length > 0 ? (
          <div className="mt-3 space-y-3">
            {communications.map((item) => (
              <article className="border-l-2 border-action pl-3 text-sm" key={item.id}>
                <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
                <div className="mt-1 font-medium">{item.summary || "未填写沟通摘要"}</div>
                {item.promises.length > 0 && <div className="mt-1 text-slate-600">承诺：{item.promises.join("；")}</div>}
                {item.risks.length > 0 && <div className="mt-1 text-red-700">风险：{item.risks.join("；")}</div>}
                {item.nextActions.length > 0 && <div className="mt-1 text-action">下一步：{item.nextActions.join("；")}</div>}
              </article>
            ))}
          </div>
        ) : <div className="mt-3 text-sm text-slate-600">暂无关联沟通记录。</div>}
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">关联待办</h2>
        {tasks.length > 0 ? (
          <div className="mt-3 space-y-2">
            {tasks.map((task) => (
              <div className={`flex items-center gap-2 text-sm ${task.status === "done" ? "line-through text-slate-400" : ""}`} key={task.id}>
                <span className={`inline-block h-2 w-2 rounded-full ${
                  task.priority === "high" ? "bg-danger" : task.priority === "medium" ? "bg-warning" : "bg-success"
                }`} />
                <span>{task.title}</span>
                {task.dueText ? <span className="text-xs text-muted">{task.dueText}</span> : null}
              </div>
            ))}
          </div>
        ) : <div className="mt-3 text-sm text-slate-600">暂无关联待办。</div>}
      </section>

      {offer.productId ? (
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-semibold">关联产品知识</h2>
          <Link className="mt-2 block rounded-md border border-line p-3 text-sm hover:border-action" href={`/products/${offer.productId}`}>
            <div className="font-medium">{offer.productName || "查看产品知识"}</div>
          </Link>
        </section>
      ) : null}
    </div>
  );
}

/** SKU 规格明细表格 — 支持展示全部字段和编辑 */
function SkuTable({
  skus,
  editing,
  offerId,
  skuLinks,
  skuMasters,
  onChange
}: {
  skus: OfferSku[];
  editing: boolean;
  offerId: string;
  skuLinks: LocalSkuOfferLink[];
  skuMasters: LocalSkuMaster[];
  onChange: (next: OfferSku[]) => void;
}) {
  const showScroll = skus.length > 10;

  function updateSku(index: number, patch: Partial<OfferSku>) {
    const next = skus.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  }

  function removeSku(index: number) {
    const next = skus.filter((_, i) => i !== index);
    onChange(next);
  }

  function addSku() {
    const next: OfferSku[] = [
      ...skus,
      {
        id: randomId(),
        specName: "",
        specCode: "",
        width: "",
        length: "",
        thickness: "",
        unitPrice: undefined,
        unitPriceStr: "",
        pricingUnit: "",
        moq: "",
        notes: "",
        priceHistory: []
      }
    ];
    onChange(next);
  }

  const th = "px-3 py-2 text-left font-medium whitespace-nowrap text-xs text-slate-600";
  const td = "px-3 py-1.5 whitespace-nowrap";

  return (
    <div className="sm:col-span-2 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          规格明细（共 {skus.length} 个）
        </h3>
        {editing && (
          <button
            className="text-xs rounded-lg bg-action-soft px-3 py-1.5 text-action font-medium hover:bg-action-soft/70 transition-colors"
            onClick={addSku}
            type="button"
          >
            + 添加规格
          </button>
        )}
      </div>
      {editing && (
        <p className="text-xs text-muted">
          可直接修改下方表格中的字段，空值会显示为"—"占位，方便后续补充。
        </p>
      )}
      <div
        className={`bg-white border border-line rounded-2xl overflow-hidden ${
          showScroll ? "max-h-96 overflow-y-auto" : ""
        }`}
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-paper-warm">
              <th className={th}>规格名</th>
              <th className={th}>规格编码</th>
              <th className={th}>内部产品编码</th>
              <th className={`${th} text-right`}>单价</th>
              <th className={th}>计价单位</th>
              <th className={th}>宽度</th>
              <th className={th}>长度</th>
              <th className={th}>厚度</th>
              <th className={th}>MOQ</th>
              <th className={th}>备注</th>
              {editing && <th className={th}>操作</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {skus.map((sku, idx) => (
              <tr key={sku.id} className="hover:bg-action-soft/30 transition-colors">
                <td className={td}>
                  {editing ? (
                    <input
                      className="w-full rounded-lg border border-line bg-white px-2 py-1 text-sm focus:border-action focus:outline-none focus:ring-1 focus:ring-action/30"
                      onChange={(e) => updateSku(idx, { specName: e.target.value })}
                      value={sku.specName}
                    />
                  ) : (
                    sku.specName || "—"
                  )}
                </td>
                <td className={td}>
                  {editing ? (
                    <input
                      className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-sm focus:border-action focus:outline-none focus:ring-1 focus:ring-action/30"
                      onChange={(e) => updateSku(idx, { specCode: e.target.value })}
                      value={sku.specCode || ""}
                    />
                  ) : (
                    <span className="text-muted">{sku.specCode || "—"}</span>
                  )}
                </td>
                <td className={td}>
                  {(() => {
                    const link = skuLinks.find((item) => item.status === "confirmed" && item.offerId === offerId && item.offerSkuId === sku.id);
                    const master = link ? skuMasters.find((item) => item.id === link.skuMasterId) : undefined;
                    return master ? <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700" title={master.specification || "规格待补充"}>{master.internalSkuCode}</span> : <Link className="text-xs text-action hover:underline" href="/sku-master/import">去关联</Link>;
                  })()}
                </td>
                <td className={`${td} text-right`}>
                  {editing ? (
                    <div className="flex items-center gap-1 justify-end">
                      <input
                        className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-sm text-right focus:border-action focus:outline-none focus:ring-1 focus:ring-action/30"
                        onChange={(e) => {
                          const val = e.target.value;
                          const num = parseFloat(val);
                          updateSku(idx, {
                            unitPriceStr: val,
                            unitPrice: isNaN(num) ? undefined : num
                          });
                        }}
                        value={sku.unitPriceStr || ""}
                      />
                    </div>
                  ) : (
                    <span className="font-medium text-action">
                      {sku.unitPriceStr || (sku.unitPrice != null ? `¥${sku.unitPrice.toFixed(2)}` : "—")}
                    </span>
                  )}
                </td>
                <td className={td}>
                  {editing ? (
                    <input
                      className="w-16 rounded-lg border border-line bg-white px-2 py-1 text-sm focus:border-action focus:outline-none focus:ring-1 focus:ring-action/30"
                      onChange={(e) => updateSku(idx, { pricingUnit: e.target.value })}
                      value={sku.pricingUnit || ""}
                    />
                  ) : (
                    <span className="text-muted">{sku.pricingUnit || "—"}</span>
                  )}
                </td>
                <td className={td}>
                  {editing ? (
                    <input
                      className="w-16 rounded-lg border border-line bg-white px-2 py-1 text-sm focus:border-action focus:outline-none focus:ring-1 focus:ring-action/30"
                      onChange={(e) => updateSku(idx, { width: e.target.value })}
                      value={sku.width || ""}
                    />
                  ) : (
                    sku.width || "—"
                  )}
                </td>
                <td className={td}>
                  {editing ? (
                    <input
                      className="w-16 rounded-lg border border-line bg-white px-2 py-1 text-sm focus:border-action focus:outline-none focus:ring-1 focus:ring-action/30"
                      onChange={(e) => updateSku(idx, { length: e.target.value })}
                      value={sku.length || ""}
                    />
                  ) : (
                    sku.length || "—"
                  )}
                </td>
                <td className={td}>
                  {editing ? (
                    <input
                      className="w-16 rounded-lg border border-line bg-white px-2 py-1 text-sm focus:border-action focus:outline-none focus:ring-1 focus:ring-action/30"
                      onChange={(e) => updateSku(idx, { thickness: e.target.value })}
                      value={sku.thickness || ""}
                    />
                  ) : (
                    sku.thickness || "—"
                  )}
                </td>
                <td className={td}>
                  {editing ? (
                    <input
                      className="w-16 rounded-lg border border-line bg-white px-2 py-1 text-sm focus:border-action focus:outline-none focus:ring-1 focus:ring-action/30"
                      onChange={(e) => updateSku(idx, { moq: e.target.value })}
                      value={sku.moq || ""}
                    />
                  ) : (
                    sku.moq || "—"
                  )}
                </td>
                <td className={td}>
                  {editing ? (
                    <input
                      className="w-28 rounded-lg border border-line bg-white px-2 py-1 text-sm focus:border-action focus:outline-none focus:ring-1 focus:ring-action/30"
                      onChange={(e) => updateSku(idx, { notes: e.target.value })}
                      value={sku.notes || ""}
                    />
                  ) : (
                    <span className="text-muted max-w-[160px] truncate block">{sku.notes || "—"}</span>
                  )}
                </td>
                {editing && (
                  <td className={td}>
                    <button
                      className="text-xs text-danger hover:text-danger/70 px-2 py-1 rounded hover:bg-danger/10 transition-colors"
                      onClick={() => removeSku(idx)}
                      type="button"
                    >
                      删除
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LinkInfo({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 rounded-md bg-paper px-3 py-2 text-sm">
        {value ? (
          <a className="break-all text-action hover:underline" href={value} rel="noreferrer" target="_blank">
            {value}
          </a>
        ) : (
          "未记录"
        )}
      </div>
    </div>
  );
}
