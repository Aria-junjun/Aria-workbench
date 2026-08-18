"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DraftExtraction } from "@/features/workbench/schemas";
import { loadLocalWorkbenchData, saveDraftToLocalWorkbench } from "@/features/workbench/local-store";
import { getExtractionNotice } from "@/features/workbench/extraction-status";
import { labelPriority, labelSupplierType, labelTaskType } from "@/features/workbench/display-labels";

export default function ReviewPage({ params }: { params: Promise<{ draftId: string }> }) {
  const router = useRouter();
  const [draftId, setDraftId] = useState("");
  const [extraction, setExtraction] = useState<DraftExtraction | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    params.then(({ draftId }) => {
      setDraftId(draftId);
      const stored = sessionStorage.getItem(`draft:${draftId}`);
      if (stored) setExtraction(JSON.parse(stored) as DraftExtraction);
    });
  }, [params]);

  async function confirm() {
    if (!extraction || !draftId) return;
    setIsSaving(true);
    let useCloud = false;
    try {
      const response = await fetch(`/api/drafts/${draftId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extraction)
      });
      useCloud = response.ok;
    } catch {
      // 云端保存失败时走本地兜底，不抛错
    }

    // 无论云端是否保存成功，都必须写入本地 localStorage：
    // 当前前端 /suppliers 等页面的数据源就是本地 workbench_data 大 JSON，
    // 只有写入本地才能在页面上看到新供应商。
    saveDraftToLocalWorkbench(extraction);

    router.push("/suppliers");
  }

  if (!extraction) {
    return <div className="text-sm text-slate-600">没有找到整理草稿，请返回快速录入重新生成。</div>;
  }

  const supplier = extraction.supplier;
  const relatedCards = findRelatedKnowledgeCards(extraction);
  const extractionNotice = getExtractionNotice(extraction.uncertaintyNotes);

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">确认整理结果</h1>
          <p className="mt-1 text-sm text-slate-600">确认前先检查字段。当前 MVP 会优先保存到本地浏览器。</p>
        </div>
        <button
          className="rounded-md bg-action px-4 py-2 text-sm text-white disabled:opacity-60"
          disabled={isSaving}
          onClick={confirm}
          type="button"
        >
          {isSaving ? "保存中" : "确认入库"}
        </button>
      </div>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">供应商</h2>
        {supplier ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <EditableInfo label="名称" value={supplier.name} onChange={(name) => setExtraction({ ...extraction, supplier: { ...supplier, name } })} />
            <EditableInfo label="主营产品" value={supplier.categories.join(" / ")} onChange={(value) => setExtraction({ ...extraction, supplier: { ...supplier, categories: splitEditedList(value) } })} />
            <EditableInfo label="地区" value={supplier.location} onChange={(location) => setExtraction({ ...extraction, supplier: { ...supplier, location } })} />
            <EditableInfo label="店铺链接" value={supplier.storeUrl} onChange={(storeUrl) => setExtraction({ ...extraction, supplier: { ...supplier, storeUrl } })} />
            <Info label="来源平台" value={supplier.sourcePlatform} />
            <Info label="联系方式" value={supplier.contactMethod} />
            <Info label="类型" value={labelSupplierType(supplier.supplierType)} />
            <Info label="联系人" value={supplier.contactName} />
            <Info label="配合度" value={supplier.cooperationLevel} />
            <Info label="风险标签" value={supplier.riskTags.join(" / ")} />
            <Info label="备注" value={supplier.notes} />
          </div>
        ) : (
          <EmptyLine text="没有识别到供应商信息。" />
        )}
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">沟通记录</h2>
        <div className="mt-3"><EditableInfo label="沟通摘要" multiline value={extraction.communication.summary} onChange={(summary) => setExtraction({ ...extraction, communication: { ...extraction.communication, summary } })} /></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ListInfo label="供应商承诺" values={extraction.communication.promises} />
          <ListInfo label="疑点" values={extraction.communication.questions} />
          <ListInfo label="风险点" values={extraction.communication.risks} />
          <ListInfo label="下一步动作" values={extraction.communication.nextActions} />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">货盘</h2>
        {extraction.offers.length > 0 ? extraction.offers.map((offer, index) => (
          <div className="mt-3 grid gap-3 rounded-md border border-line p-3 sm:grid-cols-2" key={`${offer.name}-${index}`}>
            <div className="sm:col-span-2 flex justify-end"><RemoveButton onClick={() => setExtraction({ ...extraction, offers: extraction.offers.filter((_, itemIndex) => itemIndex !== index) })} /></div>
            <OfferFields offer={offer} onChange={(patch) => setExtraction({ ...extraction, offers: extraction.offers.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })} />
          </div>
        )) : (
          <EmptyLine text="没有识别到货盘信息。" />
        )}
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">待办</h2>
        {extraction.tasks.length > 0 ? extraction.tasks.map((task, index) => (
          <div className="mt-3 grid gap-3 rounded-md border border-line p-3 sm:grid-cols-2" key={`${task.title}-${index}`}>
            <div className="sm:col-span-2 flex justify-end"><RemoveButton onClick={() => setExtraction({ ...extraction, tasks: extraction.tasks.filter((_, itemIndex) => itemIndex !== index) })} /></div>
            <EditableInfo label="事项" value={task.title} onChange={(title) => setExtraction({ ...extraction, tasks: extraction.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, title } : item) })} />
            <Info label="截止时间" value={task.dueText} />
            <Info label="优先级" value={labelPriority(task.priority)} />
            <Info label="类型" value={labelTaskType(task.type)} />
          </div>
        )) : (
          <EmptyLine text="没有识别到待办。" />
        )}
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">知识卡</h2>
        {extraction.knowledgeCards.length > 0 ? extraction.knowledgeCards.map((knowledgeCard, index) => (
          <div className="mt-3 grid gap-3 rounded-md border border-line p-3 sm:grid-cols-2" key={`${knowledgeCard.title}-${index}`}>
            <div className="sm:col-span-2 flex justify-end"><RemoveButton onClick={() => setExtraction({ ...extraction, knowledgeCards: extraction.knowledgeCards.filter((_, itemIndex) => itemIndex !== index) })} /></div>
            <EditableInfo label="名称" value={knowledgeCard.title} onChange={(title) => setExtraction({ ...extraction, knowledgeCards: extraction.knowledgeCards.map((item, itemIndex) => itemIndex === index ? { ...item, title } : item) })} />
            <Info label="来源" value={knowledgeCard.source} />
            <Info label="核心观点" value={knowledgeCard.summary} />
            <ListInfo label="适用场景" values={knowledgeCard.applicableScenarios} />
            <ListInfo label="操作步骤" values={knowledgeCard.steps} />
            <ListInfo label="参考话术" values={knowledgeCard.scripts} />
            <ListInfo label="风险提醒" values={knowledgeCard.risks} />
            <ListInfo label="标签" values={knowledgeCard.tags} />
          </div>
        )) : (
          <EmptyLine text="没有识别到知识卡。" />
        )}
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">不确定项</h2>
        {extractionNotice ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-sm font-medium text-amber-900">{extractionNotice.title}</div>
            <div className="mt-1 text-sm text-amber-800">{extractionNotice.message}</div>
          </div>
        ) : null}
        <ListInfo
          label="需要确认"
          values={extraction.uncertaintyNotes.filter(
            (note) => !note.includes("AI 未完成整理") && !note.includes("AI 调用失败")
          )}
        />
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">相关知识提醒</h2>
        {relatedCards.length > 0 ? (
          <div className="mt-3 grid gap-3">
            {relatedCards.map((card) => (
              <div className="rounded-md bg-paper p-3" key={card.id}>
                <div className="font-medium">{card.title}</div>
                <div className="mt-1 text-sm text-slate-600">{card.summary || "未记录核心观点"}</div>
                {card.applicableScenarios.length > 0 ? (
                  <div className="mt-2 text-xs text-slate-500">适用场景：{card.applicableScenarios.join(" / ")}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-md bg-paper px-3 py-2 text-sm text-slate-600">没有匹配到知识卡。后续录入谈判方法、商业模式后，这里会提示可用策略。</div>
        )}
      </section>
    </div>
  );
}

function findRelatedKnowledgeCards(extraction: DraftExtraction) {
  const cards = loadLocalWorkbenchData().knowledgeCards;
  const text = [
    extraction.communication.summary,
    extraction.communication.questions.join(" "),
    extraction.communication.risks.join(" "),
    extraction.communication.nextActions.join(" "),
    extraction.offers.map((offer) => [offer.name, offer.quotedPrice, offer.moq, offer.leadTime, offer.risks].join(" ")).join(" ")
  ]
    .join(" ")
    .toLowerCase();

  const triggerWords = ["报价", "最低价", "不能少", "moq", "起订量", "交期", "样品费", "定金", "付款", "谈判"];

  return cards
    .filter((card) => {
      const cardWords = [...card.tags, ...card.applicableScenarios, card.title].join(" ").toLowerCase();
      return triggerWords.some((word) => text.includes(word.toLowerCase()) && cardWords.includes(word.toLowerCase()));
    })
    .slice(0, 3);
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 min-h-6 rounded-md bg-paper px-3 py-2 text-sm">{value || "未记录"}</div>
    </div>
  );
}

function EditableInfo({ label, value, multiline = false, onChange }: { label: string; value?: string; multiline?: boolean; onChange: (value: string) => void }) {
  const className = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm";
  return <label><span className="text-xs text-slate-500">{label}</span>{multiline ? <textarea className={className} onChange={(event) => onChange(event.target.value)} rows={4} value={value || ""} /> : <input className={className} onChange={(event) => onChange(event.target.value)} value={value || ""} />}</label>;
}

type Offer = DraftExtraction["offers"][number];
const editableOfferFields: Array<{ key: string; label: string; multiline?: boolean }> = [
  { key: "name", label: "名称" }, { key: "category", label: "品类" },
  { key: "quotedPrice", label: "报价" }, { key: "priceDetails", label: "报价明细", multiline: true },
  { key: "untaxedUnitPrice", label: "未税单价" }, { key: "untaxedPlateFee", label: "未税版费" },
  { key: "taxedUnitPrice", label: "含税单价" }, { key: "taxedPlateFee", label: "含税版费" },
  { key: "taxFreightTerms", label: "开票/运费" }, { key: "dimensions", label: "尺寸" },
  { key: "moq", label: "MOQ" }, { key: "leadTime", label: "交期" },
  { key: "keySpecs", label: "关键规格", multiline: true }, { key: "materialGrade", label: "材质等级" },
  { key: "pricingUnit", label: "计价单位" }, { key: "packageUnit", label: "包装单位" },
  { key: "freightIncluded", label: "是否含运费" }, { key: "specs", label: "规格", multiline: true },
  { key: "packaging", label: "包装" }, { key: "advantages", label: "优势", multiline: true },
  { key: "risks", label: "风险", multiline: true }, { key: "notes", label: "备注", multiline: true }
];

function OfferFields({ offer, onChange }: { offer: Offer; onChange: (patch: Partial<Offer>) => void }) {
  return <>{editableOfferFields.map((field) => <EditableInfo key={field.key} label={field.label} multiline={field.multiline} value={offer[field.key as keyof Offer] as string | undefined} onChange={(value) => onChange({ [field.key]: value } as Partial<Offer>)} />)}</>;
}

function splitEditedList(value: string) {
  return value.split(/[、/，,；;\n]/).map((item) => item.trim()).filter(Boolean);
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return <button className="text-xs text-red-700 hover:underline" onClick={onClick} type="button">不入库此项</button>;
}

function ListInfo({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      {values.length > 0 ? (
        <ul className="mt-1 rounded-md bg-paper px-3 py-2 text-sm">
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 rounded-md bg-paper px-3 py-2 text-sm">未记录</div>
      )}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="mt-3 rounded-md bg-paper px-3 py-2 text-sm text-slate-600">{text}</div>;
}
