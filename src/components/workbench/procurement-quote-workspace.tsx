"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BusinessRecordDialog,
  BusinessSection,
  businessInput,
  businessPrimary,
  businessSecondary,
} from "./business-record-dialog";
import {
  ProcurementLineFacts,
  ProcurementLineFields,
  ProductLink,
  procurementTable,
  validProductUrl,
} from "./procurement-line-details";
import { ProcurementSkuComparison } from "./procurement-sku-comparison";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import {
  addQuoteCandidate,
  adoptCatalogOfferSku,
  finalizeQuote,
  fulfillmentForQuote,
  normalizeLineItems,
  procurementSourceChain,
  reviewQuote,
  saveQuoteOffer,
  type ProcurementLineItem,
  type ProcurementRecord,
  type QuoteOffer,
  type SupplierCandidate,
} from "@/features/workbench/procurement";
import { fulfillmentProgress } from "@/features/workbench/procurement-fulfillment";

const statusLabels: Record<string, string> = {
  draft: "草稿",
  completed: "已完成",
};
const emptyOffer = {
  sourceOfferId: "",
  sourceOfferSkuId: "",
  productUnitPrice: "",
  freight: "",
  comprehensiveCost: "",
  afterSalesCost: "",
  taxRate: "",
  moq: "",
  leadTime: "",
  note: "",
  productUrl: "",
  selected: false,
  selectionReason: "",
};
const emptyCandidate = {
  name: "",
  contact: "",
  phone: "",
  platform: "",
  candidateReason: "",
};

function quoteStatus(records: ProcurementRecord[], quote: ProcurementRecord) {
  const fulfillment = fulfillmentForQuote(records, quote);
  if (fulfillment) return fulfillmentProgress(fulfillment).stage;
  if (quote.quoteReview?.status === "pending") return "待运营验收";
  if (quote.quoteReview?.status === "approved") return "验收通过";
  if (quote.quoteReview?.status === "changes_requested") return "已退回补充";
  return statusLabels[quote.status] || quote.status;
}

export function ProcurementQuoteWorkspace({
  records,
  onCommit,
  onView,
}: {
  records: ProcurementRecord[];
  onCommit: (records: ProcurementRecord[]) => void;
  onView: (record: ProcurementRecord) => void;
}) {
  const data = useWorkbenchData();
  const quotes = records.filter((record) => record.section === "quote");
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [supplierMode, setSupplierMode] = useState<
    "master" | "temporary" | "edit" | null
  >(null);
  const [masterSupplierId, setMasterSupplierId] = useState("");
  const [editingCandidate, setEditingCandidate] =
    useState<SupplierCandidate | null>(null);
  const [candidateDraft, setCandidateDraft] = useState(emptyCandidate);
  const [editingLine, setEditingLine] = useState<ProcurementLineItem | null>(
    null,
  );
  const [decision, setDecision] = useState<{
    lineId: string;
    candidateId: string;
    reason: string;
  } | null>(null);
  const [offerTarget, setOfferTarget] = useState<{
    candidateId: string;
    lineId: string;
  } | null>(null);
  const [offer, setOffer] = useState(emptyOffer);
  const [review, setReview] = useState<{
    decision: "approved" | "changes_requested";
    reviewer: string;
    comment: string;
  } | null>(null);
  const [error, setError] = useState("");
  const quote = quotes.find((record) => record.id === selectedQuoteId);
  const lineItems = quote ? normalizeLineItems(quote) : [];
  const candidates = quote?.supplierCandidates || [];
  const fulfillmentExists = !!(quote && fulfillmentForQuote(records, quote));

  function openSupplier(
    mode: "master" | "temporary" | "edit",
    candidate?: SupplierCandidate,
  ) {
    setError("");
    setMasterSupplierId("");
    setEditingCandidate(candidate || null);
    setCandidateDraft(
      candidate
        ? {
            name: candidate.name,
            contact: candidate.contact || "",
            phone: candidate.phone || "",
            platform: candidate.platform || "",
            candidateReason: candidate.candidateReason || "",
          }
        : emptyCandidate,
    );
    setSupplierMode(mode);
  }

  function saveCandidate() {
    if (!quote) return;
    const master =
      supplierMode === "master"
        ? data.suppliers.find((item) => item.id === masterSupplierId)
        : undefined;
    if (supplierMode === "master" && !master) {
      setError("请选择历史供应商");
      return;
    }
    if (!master && !candidateDraft.name.trim()) {
      setError("请填写供应商名称");
      return;
    }
    if (
      !editingCandidate &&
      candidates.some(
        (item) => item.name === (master?.name || candidateDraft.name.trim()),
      )
    ) {
      setError("此供应商已加入本次询价，请编辑已有记录");
      return;
    }
    if (!candidateDraft.candidateReason.trim()) {
      setError("请填写候选原因，便于团队了解邀请依据");
      return;
    }
    const candidate: SupplierCandidate = {
      ...editingCandidate,
      id: editingCandidate?.id || crypto.randomUUID(),
      supplierId: master?.id || editingCandidate?.supplierId,
      ...candidateDraft,
      name: master?.name || candidateDraft.name.trim(),
      contact: master ? master.contactName : candidateDraft.contact,
      phone: master ? master.contactMethod : candidateDraft.phone,
      platform: master ? master.sourcePlatform : candidateDraft.platform,
      source: master ? "master" : editingCandidate?.source || "new",
      status: editingCandidate?.status || "candidate",
    };
    // Editing preserves identity, row order and all linked SKU quotes.
    onCommit(
      editingCandidate
        ? records.map((record) =>
            record.id === quote.id
              ? {
                  ...record,
                  supplierCandidates: candidates.map((item) =>
                    item.id === candidate.id ? candidate : item,
                  ),
                }
              : record,
          )
        : addQuoteCandidate(records, quote.id, candidate),
    );
    setSupplierMode(null);
    setError("");
  }

  function openOffer(candidateId: string, lineId: string) {
    const saved = quote?.quoteOffers?.find(
      (item) =>
        item.supplierCandidateId === candidateId && item.lineItemId === lineId,
    );
    setOffer({
      ...emptyOffer,
      ...saved,
      productUnitPrice: saved?.productUnitPrice || saved?.unitPrice || "",
    });
    setOfferTarget({ candidateId, lineId });
    setError("");
  }

  function saveOffer() {
    if (!quote || !offerTarget || fulfillmentExists) return;
    if (!validProductUrl(offer.productUrl)) {
      setError("商品链接须为完整的 http:// 或 https:// 地址");
      return;
    }
    if (offer.selected && !offer.selectionReason.trim()) {
      setError("请记录本 SKU 的最终选择原因");
      return;
    }
    const previous = quote.quoteOffers?.find(
      (item) =>
        item.supplierCandidateId === offerTarget.candidateId &&
        item.lineItemId === offerTarget.lineId,
    );
    const nextOffer: QuoteOffer = {
      ...previous,
      ...offer,
      id: previous?.id || crypto.randomUUID(),
      supplierCandidateId: offerTarget.candidateId,
      lineItemId: offerTarget.lineId,
      unitPrice: offer.productUnitPrice,
    };
    onCommit(saveQuoteOffer(records, quote.id, nextOffer));
    setOfferTarget(null);
    setError("");
  }

  function finalize() {
    if (!quote || fulfillmentExists) return;
    const selected = lineItems.map((line) =>
      quote.quoteOffers?.find(
        (item) =>
          item.lineItemId === line.id &&
          item.selected &&
          item.selectionReason?.trim() &&
          candidates.some(
            (candidate) => candidate.id === item.supplierCandidateId,
          ),
      ),
    );
    if (selected.some((item) => !item)) {
      setError("请在每个 SKU 对比表下方确定最终选用，并填写选用原因");
      return;
    }
    onCommit(
      finalizeQuote(records, quote.id, [
        ...new Set(selected.map((item) => item!.supplierCandidateId)),
      ]),
    );
    setError("");
  }

  if (!quote)
    return (
      <section className="w-full py-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">询价项目</h2>
            <p className="mt-1 text-sm text-muted">共 {quotes.length} 个项目</p>
          </div>
          <Link className={businessSecondary} href="/procurement/task">
            查看采购任务
          </Link>
        </div>
        {!quotes.length ? (
          <div className="py-16 text-center">
            <p className="font-medium">暂无询价项目</p>
            <p className="mt-2 text-sm text-muted">
              在采购任务中点击“发起询价”后，项目会显示在这里。
            </p>
            <Link
              className={`${businessPrimary} mt-5`}
              href="/procurement/task"
            >
              前往采购任务
            </Link>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className={`${procurementTable} min-w-[900px] table-fixed`}>
              <thead>
                <tr>
                  <th className="w-[24%]">询价项目</th>
                  <th className="w-[20%]">来源采购任务</th>
                  <th className="w-[20%]">产品范围</th>
                  <th className="w-[9%]">SKU数</th>
                  <th className="w-[11%]">候选供应商</th>
                  <th className="w-[8%]">状态</th>
                  <th className="w-[8%]">操作</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">
                      {item.title || "未命名询价项目"}
                    </td>
                    <td>
                      {records.find((record) => record.id === item.sourceId)
                        ?.title || "来源任务缺失"}
                    </td>
                    <td>{item.productName || "未填写"}</td>
                    <td>{normalizeLineItems(item).length}</td>
                    <td>{item.supplierCandidates?.length || 0}</td>
                    <td>{quoteStatus(records, item)}</td>
                    <td>
                      <button
                        className="text-action hover:underline"
                        onClick={() => {
                          setSelectedQuoteId(item.id);
                          setError("");
                        }}
                        type="button"
                      >
                        打开项目
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );

  const sourceChain = procurementSourceChain(records, quote).filter(
    (item) => item.id !== quote.id,
  );
  return (
    <section className="w-full py-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <h2 className="text-xl font-semibold">{quote.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="rounded-full bg-action-soft px-2.5 py-1 text-action">
              {quoteStatus(records, quote)}
            </span>
            <span>
              {lineItems.length} 个 SKU · {candidates.length} 家候选供应商
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className={businessSecondary}
            onClick={() => onView(quote)}
            type="button"
          >
            查看详情
          </button>
          <button
            className={businessSecondary}
            onClick={() => {
              setSelectedQuoteId("");
              setError("");
            }}
            type="button"
          >
            返回项目列表
          </button>
        </div>
      </div>
      <BusinessSection
        title="本次采购明细"
        action={
          <span className="text-xs text-muted">{lineItems.length} 个 SKU</span>
        }
      >
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
          {sourceChain.length ? (
            sourceChain.map((item) => (
              <span key={item.id}>
                {item.section === "request" ? "需求来源" : "采购任务"}：
                <button
                  className="text-action hover:underline"
                  onClick={() => onView(item)}
                  type="button"
                >
                  {item.title}
                </button>
              </span>
            ))
          ) : (
            <span>需求来源：未关联</span>
          )}
        </div>
        <div className="w-full overflow-x-auto">
          <table className={`${procurementTable} min-w-[880px] table-fixed`}>
            <thead>
              <tr>
                <th className="w-[24%]">产品 / SKU</th>
                <th className="w-[24%]">规格型号</th>
                <th className="w-[10%]">单位</th>
                <th className="w-[10%] text-right">数量</th>
                <th className="w-[16%]">期望到货</th>
                <th className="w-[16%]">采购要求</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line) => (
                <React.Fragment key={line.id}>
                  <tr>
                    <td>
                      <p className="font-medium">{line.productName}</p>
                      <p className="mt-1 text-xs text-muted">
                        {line.sku || "暂无 SKU"} ·{" "}
                        {line.productType || "属性待确认"}
                      </p>
                    </td>
                    <td>{line.specification || "—"}</td>
                    <td>{line.unit || "—"}</td>
                    <td className="text-right tabular-nums">
                      {line.quantity || "未定"}
                    </td>
                    <td>{line.expectedDate || "未定"}</td>
                    <td>
                      <button
                        className="text-action hover:underline"
                        onClick={() => {
                          setEditingLine({ ...line });
                          setError("");
                        }}
                        type="button"
                      >
                        {fulfillmentExists ? "查看要求" : "编辑要求"}
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6}>
                      <details>
                        <summary className="cursor-pointer text-xs text-muted">
                          {line.requirements
                            ? `关键要求：${line.requirements.slice(0, 70)}${line.requirements.length > 70 ? "…" : ""}`
                            : "参考链接、验收标准与收货信息"}
                        </summary>
                        <div className="pt-4">
                          <ProcurementLineFacts item={line} />
                        </div>
                      </details>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </BusinessSection>
      <BusinessSection
        title="本次供应商"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              className={businessSecondary}
              onClick={() => openSupplier("master")}
              type="button"
            >
              添加历史供应商
            </button>
            <button
              className={businessSecondary}
              onClick={() => openSupplier("temporary")}
              type="button"
            >
              新增临时供应商
            </button>
          </div>
        }
      >
        <div className="w-full overflow-x-auto">
          <table className={`${procurementTable} min-w-[1040px] table-fixed`}>
            <thead>
              <tr>
                <th className="w-[20%]">供应商名称</th>
                <th className="w-[8%]">属性</th>
                <th className="w-[10%]">联系人</th>
                <th className="w-[15%]">联系方式</th>
                <th className="w-[10%]">归属平台</th>
                <th className="w-[29%]">候选原因</th>
                <th className="w-[8%]">操作</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length ? (
                candidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td className="font-medium">{candidate.name}</td>
                    <td>
                      <span
                        className={`whitespace-nowrap rounded px-2 py-1 text-xs ${candidate.source === "new" ? "bg-amber-50 text-amber-700" : "bg-action-soft text-action"}`}
                      >
                        {candidate.source === "new" ? "临时" : "档案"}
                      </span>
                    </td>
                    <td>{candidate.contact || "—"}</td>
                    <td>{candidate.phone || "—"}</td>
                    <td>{candidate.platform || "待补充"}</td>
                    <td className="whitespace-pre-wrap">
                      {candidate.candidateReason || (
                        <span className="text-muted">待补充</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="text-action hover:underline"
                        onClick={() => openSupplier("edit", candidate)}
                        type="button"
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center text-muted">
                    尚未选择本次供应商
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BusinessSection>
      <BusinessSection
        title="按 SKU 比价"
        action={
          <button
            className={businessPrimary}
            disabled={
              !candidates.length ||
              !quote.quoteOffers?.length ||
              fulfillmentExists ||
              quote.status === "completed"
            }
            onClick={finalize}
            type="button"
          >
            {quote.status === "completed"
              ? "已形成比价结果"
              : "形成当前比价结果"}
          </button>
        }
      >
        {error &&
          !decision &&
          !supplierMode &&
          !offerTarget &&
          !editingLine && (
            <p role="alert" className="mb-3 text-sm text-red-600">
              {error}
            </p>
          )}
        {fulfillmentExists && (
          <p className="mb-3 text-xs text-muted">
            已生成履约单，报价与选用结果已锁定。
          </p>
        )}
        {!candidates.length ? (
          <p className="border border-line bg-surface py-8 text-center text-sm text-muted">
            请先添加本次供应商
          </p>
        ) : (
          lineItems.map((line) => (
            <ProcurementSkuComparison
              key={line.id}
              line={line}
              candidates={candidates}
              offers={quote.quoteOffers || []}
              locked={fulfillmentExists}
              onEditOffer={openOffer}
              onSelect={(lineId) => {
                const selected = quote.quoteOffers?.find(
                  (item) => item.lineItemId === lineId && item.selected,
                );
                setDecision({
                  lineId,
                  candidateId: selected?.supplierCandidateId || "",
                  reason: selected?.selectionReason || "",
                });
                setError("");
              }}
            />
          ))
        )}
      </BusinessSection>
      <BusinessSection
        title="运营验收"
        action={
          quote.quoteReview?.status === "pending" ? (
            <div className="flex gap-2">
              <button className={businessSecondary} onClick={() => setReview({ decision: "changes_requested", reviewer: quote.quoteReview?.reviewer || "", comment: "" })} type="button">退回补充</button>
              <button className={businessPrimary} onClick={() => setReview({ decision: "approved", reviewer: quote.quoteReview?.reviewer || "", comment: "" })} type="button">验收通过</button>
            </div>
          ) : undefined
        }
      >
        <div className="grid gap-4 border border-line bg-surface p-4 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted">运营对接人</p><p className="mt-1 font-medium">{procurementSourceChain(records, quote)[0]?.management?.operator || "待配置"}</p></div>
          <div><p className="text-xs text-muted">验收人</p><p className="mt-1 font-medium">{quote.quoteReview?.reviewer || procurementSourceChain(records, quote)[0]?.management?.reviewer || "待配置"}</p></div>
          <div><p className="text-xs text-muted">验收状态</p><p className="mt-1 font-medium">{quote.quoteReview?.status === "pending" ? "待验收" : quote.quoteReview?.status === "approved" ? "已通过" : quote.quoteReview?.status === "changes_requested" ? "已退回" : "尚未提交"}</p></div>
          {quote.quoteReview?.comment && <div className="sm:col-span-3"><p className="text-xs text-muted">验收意见</p><p className="mt-1">{quote.quoteReview.comment}</p></div>}
        </div>
      </BusinessSection>
      {supplierMode && (
        <BusinessRecordDialog
          title={
            supplierMode === "master"
              ? "添加历史供应商"
              : supplierMode === "temporary"
                ? "新增临时供应商"
                : "编辑本次供应商"
          }
          onClose={() => setSupplierMode(null)}
          footer={
            <>
              <button
                className={businessSecondary}
                onClick={() => setSupplierMode(null)}
                type="button"
              >
                取消
              </button>
              <button
                className={businessPrimary}
                onClick={saveCandidate}
                type="button"
              >
                {supplierMode === "edit" ? "保存供应商" : "加入本次询价"}
              </button>
            </>
          }
        >
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            {supplierMode === "master" ? (
              <label className="sm:col-span-2">
                选择系统供应商
                <select
                  className={businessInput}
                  value={masterSupplierId}
                  onChange={(e) => setMasterSupplierId(e.target.value)}
                >
                  <option value="">请选择</option>
                  {data.suppliers
                    .filter(
                      (supplier) =>
                        !candidates.some(
                          (candidate) => candidate.supplierId === supplier.id,
                        ),
                    )
                    .map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <>
                {(["name", "contact", "phone"] as const).map((key, index) => (
                  <label key={key}>
                    {["供应商名称 *", "联系人", "联系方式"][index]}
                    <input
                      className={businessInput}
                      value={candidateDraft[key]}
                      onChange={(e) =>
                        setCandidateDraft({
                          ...candidateDraft,
                          [key]: e.target.value,
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  归属平台
                  <input
                    className={businessInput}
                    list="quote-platforms"
                    value={candidateDraft.platform}
                    onChange={(e) =>
                      setCandidateDraft({
                        ...candidateDraft,
                        platform: e.target.value,
                      })
                    }
                  />
                  <datalist id="quote-platforms">
                    {["1688", "聚水潭", "线下", "其他"].map((platform) => (
                      <option key={platform} value={platform} />
                    ))}
                  </datalist>
                </label>
              </>
            )}
            <label className="sm:col-span-2">
              候选原因 *
              <textarea
                rows={3}
                className={businessInput}
                placeholder="说明为什么邀请这家供应商，例如匹配产品、历史合作表现或交期优势"
                value={candidateDraft.candidateReason}
                onChange={(e) =>
                  setCandidateDraft({
                    ...candidateDraft,
                    candidateReason: e.target.value,
                  })
                }
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </BusinessRecordDialog>
      )}
      {editingLine && (
        <BusinessRecordDialog
          title={`采购要求 · ${editingLine.productName}`}
          onClose={() => setEditingLine(null)}
          footer={
            <>
              <button
                className={businessSecondary}
                onClick={() => setEditingLine(null)}
                type="button"
              >
                关闭
              </button>
              {!fulfillmentExists && (
                <button
                  className={businessPrimary}
                  onClick={() => {
                    if (!validProductUrl(editingLine.referenceUrl || "")) {
                      setError("参考链接须为完整的 http:// 或 https:// 地址");
                      return;
                    }
                    onCommit(
                      records.map((record) =>
                        record.id === quote.id
                          ? {
                              ...record,
                              lineItems: lineItems.map((line) =>
                                line.id === editingLine.id ? editingLine : line,
                              ),
                            }
                          : record,
                      ),
                    );
                    setEditingLine(null);
                    setError("");
                  }}
                  type="button"
                >
                  保存要求
                </button>
              )}
            </>
          }
        >
          {fulfillmentExists ? (
            <ProcurementLineFacts item={editingLine} />
          ) : (
            <>
              <p className="mb-4 text-xs text-muted">
                补充本次询价的采购要求，来源需求保留原始记录。
              </p>
              <ProcurementLineFields
                item={editingLine}
                onChange={setEditingLine}
              />
            </>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </BusinessRecordDialog>
      )}
      {decision && (
        <BusinessRecordDialog
          title={`最终选用 · ${lineItems.find((line) => line.id === decision.lineId)?.productName || ""}`}
          onClose={() => {
            setDecision(null);
            setError("");
          }}
          footer={
            <>
              <button
                className={businessSecondary}
                onClick={() => {
                  setDecision(null);
                  setError("");
                }}
                type="button"
              >
                取消
              </button>
              <button
                className={businessPrimary}
                onClick={() => {
                  const selected = quote.quoteOffers?.find(
                    (item) =>
                      item.lineItemId === decision.lineId &&
                      item.supplierCandidateId === decision.candidateId,
                  );
                  if (
                    !selected ||
                    !candidates.some(
                      (candidate) => candidate.id === decision.candidateId,
                    )
                  ) {
                    setError("请选择已录入报价的供应商");
                    return;
                  }
                  if (!decision.reason.trim()) {
                    setError("请填写选用原因");
                    return;
                  }
                  if (fulfillmentExists) return;
                  onCommit(
                    saveQuoteOffer(records, quote.id, {
                      ...selected,
                      selected: true,
                      selectionReason: decision.reason.trim(),
                    }),
                  );
                  setDecision(null);
                  setError("");
                }}
                type="button"
              >
                保存选用
              </button>
            </>
          }
        >
          <div className="space-y-5 text-sm">
            <label className="block">
              最终选用供应商
              <select
                className={businessInput}
                value={decision.candidateId}
                onChange={(e) =>
                  setDecision({ ...decision, candidateId: e.target.value })
                }
              >
                <option value="">请选择已报价供应商</option>
                {candidates
                  .filter((candidate) =>
                    quote.quoteOffers?.some(
                      (item) =>
                        item.lineItemId === decision.lineId &&
                        item.supplierCandidateId === candidate.id,
                    ),
                  )
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block">
              选用原因 *
              <textarea
                className={businessInput}
                rows={4}
                value={decision.reason}
                onChange={(e) =>
                  setDecision({ ...decision, reason: e.target.value })
                }
                placeholder="说明成本、交期、样品或质量等决策依据"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </BusinessRecordDialog>
      )}
      {offerTarget && (
        <BusinessRecordDialog
          title="录入 SKU 报价"
          onClose={() => setOfferTarget(null)}
          footer={
            <>
              <button
                className={businessSecondary}
                onClick={() => setOfferTarget(null)}
                type="button"
              >
                取消
              </button>
              <button
                className={businessPrimary}
                onClick={saveOffer}
                type="button"
              >
                保存报价
              </button>
            </>
          }
        >
          <p className="mb-5 rounded-md bg-action-soft/50 px-4 py-3 text-sm font-medium">
            {
              lineItems.find((line) => line.id === offerTarget.lineId)
                ?.productName
            }{" "}
            ·{" "}
            {
              candidates.find(
                (candidate) => candidate.id === offerTarget.candidateId,
              )?.name
            }
          </p>
          {(() => {
            const supplierId = candidates.find(candidate => candidate.id === offerTarget.candidateId)?.supplierId;
            const catalog = data.offers.filter(item => supplierId && item.supplierId === supplierId && item.skus?.some(sku => sku.unitPrice !== undefined));
            return <label className="mb-4 block text-sm">引用已有报价单的具体 SKU
              <select className={businessInput} value={offer.sourceOfferId && offer.sourceOfferSkuId ? `${offer.sourceOfferId}::${offer.sourceOfferSkuId}` : ""} onChange={event => {
                if (!event.target.value) { setOffer({ ...offer, sourceOfferId: "", sourceOfferSkuId: "" }); return; }
                const [offerId, skuId] = event.target.value.split("::");
                const source = catalog.find(item => item.id === offerId);
                const sku = source?.skus?.find(item => item.id === skuId);
                if (!source || !sku) return;
                try {
                  const adopted = adoptCatalogOfferSku({ id: "", supplierCandidateId: offerTarget.candidateId, lineItemId: offerTarget.lineId, ...offer }, source, sku, lineItems.find(line => line.id === offerTarget.lineId)?.unit);
                  setOffer({ ...offer, ...adopted, sourceOfferId: source.id, sourceOfferSkuId: sku.id });
                  setError("");
                } catch (reason) { setError(reason instanceof Error ? reason.message : "请核对报价单位"); }
              }}><option value="">手工录入报价（不关联货盘）</option>{catalog.flatMap(item => item.skus?.filter(sku => sku.unitPrice !== undefined).map(sku => <option key={`${item.id}::${sku.id}`} value={`${item.id}::${sku.id}`}>{item.name} · {sku.specName} · ¥{sku.unitPrice}{sku.pricingUnit ? `/${sku.pricingUnit}` : ''}</option>) ?? [])}</select>
              {!supplierId && <span className="mt-1 block text-xs text-muted">先关联正式供应商档案，才能选用该供应商的历史报价。</span>}
            </label>;
          })()}
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <label className="sm:col-span-2">
              供应商商品链接
              <input
                type="url"
                placeholder="https://"
                className={businessInput}
                value={offer.productUrl}
                onChange={(e) =>
                  setOffer({ ...offer, productUrl: e.target.value })
                }
              />
            </label>
            {(
              [
                "productUnitPrice",
                "freight",
                "comprehensiveCost",
                "afterSalesCost",
                "taxRate",
                "moq",
                "leadTime",
                "note",
              ] as const
            ).map((key, index) => (
              <label key={key}>
                {
                  [
                    "产品单价",
                    "邮费",
                    "综合成本",
                    "售后成本（代发退货，可选）",
                    "税点",
                    "起订量",
                    "交期",
                    "备注",
                  ][index]
                }
                <input
                  className={businessInput}
                  value={offer[key]}
                  onChange={(e) =>
                    setOffer(key === "productUnitPrice" ? { ...offer, [key]: e.target.value, sourceOfferId: "", sourceOfferSkuId: "" } : { ...offer, [key]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </BusinessRecordDialog>
      )}
      {review && (
        <BusinessRecordDialog
          title={review.decision === "approved" ? "验收询价结果" : "退回补充询价"}
          onClose={() => setReview(null)}
          footer={<><button className={businessSecondary} onClick={() => setReview(null)} type="button">取消</button><button className={businessPrimary} onClick={() => { if (!review.reviewer.trim()) { setError("请填写验收人"); return; } if (review.decision === "changes_requested" && !review.comment.trim()) { setError("退回时必须填写补充意见"); return; } onCommit(reviewQuote(records, quote.id, review.decision, review.reviewer, review.comment)); setReview(null); setError(""); }} type="button">确认</button></>}
        >
          <div className="space-y-4 text-sm"><label className="block">验收人 *<input className={businessInput} value={review.reviewer} onChange={(e) => setReview({ ...review, reviewer: e.target.value })} /></label><label className="block">验收意见{review.decision === "changes_requested" ? " *" : ""}<textarea className={businessInput} rows={4} value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} /></label></div>
          {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        </BusinessRecordDialog>
      )}
    </section>
  );
}
