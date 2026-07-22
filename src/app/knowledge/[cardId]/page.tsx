"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Info, ListField, SectionActions, TextField } from "@/components/workbench/edit-fields";
import { deleteLocalItem, loadLocalWorkbenchData, updateLocalItem, type LocalKnowledgeCard } from "@/features/workbench/local-store";

export default function KnowledgeCardDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cardId = Array.isArray(params.cardId) ? params.cardId[0] : params.cardId;
  const card = loadLocalWorkbenchData().knowledgeCards.find((item) => item.id === cardId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LocalKnowledgeCard | undefined>(card);

  if (!card || !draft) {
    return <div className="rounded-lg border border-line bg-white p-4 text-sm text-slate-600">没有找到这张知识卡。</div>;
  }

  function save() {
    if (!draft) return;
    updateLocalItem("knowledgeCards", draft.id, draft);
    setEditing(false);
  }

  function remove() {
    if (!draft) return;
    if (!window.confirm("确认删除这张知识卡吗？")) return;
    deleteLocalItem("knowledgeCards", draft.id);
    router.push("/knowledge");
  }

  return (
    <div className="space-y-5">
      <Link className="text-sm text-action" href="/knowledge">返回商业知识卡</Link>
      <section className="rounded-lg border border-line bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{card.title}</h1>
            <div className="mt-2 text-sm text-slate-500">{card.source || "未记录来源"}</div>
          </div>
          <SectionActions editing={editing} onCancel={() => { setDraft(card); setEditing(false); }} onDelete={remove} onEdit={() => setEditing(true)} onSave={save} />
        </div>

        {editing ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TextField label="名称" onChange={(value) => setDraft({ ...draft, title: value })} value={draft.title} />
            <TextField label="来源" onChange={(value) => setDraft({ ...draft, source: value })} value={draft.source || ""} />
            <TextField label="核心观点" multiline onChange={(value) => setDraft({ ...draft, summary: value })} value={draft.summary || ""} />
            <ListField label="适用场景，每行一个" onChange={(values) => setDraft({ ...draft, applicableScenarios: values })} values={draft.applicableScenarios} />
            <ListField label="操作步骤，每行一个" onChange={(values) => setDraft({ ...draft, steps: values })} values={draft.steps} />
            <ListField label="参考话术，每行一个" onChange={(values) => setDraft({ ...draft, scripts: values })} values={draft.scripts} />
            <ListField label="风险提醒，每行一个" onChange={(values) => setDraft({ ...draft, risks: values })} values={draft.risks} />
            <ListField label="标签，每行一个" onChange={(values) => setDraft({ ...draft, tags: values })} values={draft.tags} />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="核心观点" value={card.summary} />
            <Info label="适用场景" value={card.applicableScenarios} />
            <Info label="操作步骤" value={card.steps} />
            <Info label="参考话术" value={card.scripts} />
            <Info label="风险提醒" value={card.risks} />
            <Info label="关联标签" value={card.tags} />
          </div>
        )}
      </section>
    </div>
  );
}
