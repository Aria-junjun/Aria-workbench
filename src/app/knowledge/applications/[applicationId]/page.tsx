"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  applicationVersions,
  loadDecisionCases,
  saveKnowledgeApplicationVersion,
  type LocalKnowledgeApplication
} from "@/features/workbench/local-store";

export default function KnowledgeApplicationPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const router = useRouter();
  const [applicationId, setApplicationId] = useState("");
  const [versions, setVersions] = useState<LocalKnowledgeApplication[]>([]);
  const [draft, setDraft] = useState<LocalKnowledgeApplication>();
  const [message, setMessage] = useState("");

  useEffect(() => {
    params.then(({ applicationId: id }) => {
      const migrated = loadDecisionCases().find((caseItem) =>
        caseItem.cycles.some((cycle) => cycle.id === `legacy-cycle:${id}`)
      );
      if (migrated) {
        router.replace(`/knowledge/cases/${encodeURIComponent(migrated.id)}`);
        return;
      }
      const records = applicationVersions(id);
      setApplicationId(id);
      setVersions(records);
      setDraft(records[0]);
    });
  }, [params, router]);

  if (!draft) return <div className="text-sm text-slate-500">正在读取应用记录...</div>;

  function saveVersion() {
    if (!draft) return;
    const saved = saveKnowledgeApplicationVersion(applicationId, {
      problem: draft.problem,
      diagnosis: draft.diagnosis,
      selectedActions: draft.selectedActions,
      modelSections: draft.modelSections
    });
    const records = applicationVersions(saved.id);
    setApplicationId(saved.id);
    setVersions(records);
    setDraft(records[0]);
    setMessage(`已保存版本 ${saved.version}`);
  }

  return (
    <div className="space-y-5">
      <Link className="text-sm text-action" href="/knowledge">返回商业知识</Link>
      <div>
        <h1 className="text-2xl font-semibold">应用记录</h1>
        <p className="mt-1 text-sm text-slate-600">修改后会新增版本，原记录不会被覆盖。</p>
      </div>

      <section className="space-y-4 rounded-md border border-line bg-white p-4">
        <label className="block text-sm font-medium">
          问题摘要
          <textarea className="mt-2 min-h-20 w-full rounded-md border border-line px-3 py-2" onChange={(event) => setDraft({ ...draft, problem: event.target.value })} value={draft.problem} />
        </label>
        <label className="block text-sm font-medium">
          我的判断
          <textarea className="mt-2 min-h-20 w-full rounded-md border border-line px-3 py-2" onChange={(event) => setDraft({ ...draft, diagnosis: event.target.value })} value={draft.diagnosis ?? ""} />
        </label>
        {draft.modelSections?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {draft.modelSections.map((section, index) => (
              <label className="block text-sm font-medium" key={section.key}>
                {section.label}
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border border-line px-3 py-2"
                  onChange={(event) => setDraft({
                    ...draft,
                    modelSections: draft.modelSections?.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, value: event.target.value } : item
                    )
                  })}
                  placeholder={section.placeholder}
                  value={section.value}
                />
              </label>
            ))}
          </div>
        ) : null}
        <label className="block text-sm font-medium">
          下一步行动（每行一项）
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border border-line px-3 py-2"
            onChange={(event) => setDraft({ ...draft, selectedActions: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })}
            value={draft.selectedActions.join("\n")}
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-600">{message}</span>
          <button className="rounded-md bg-action px-4 py-2 text-sm text-white" onClick={saveVersion} type="button">保存新版本</button>
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-4">
        <h2 className="font-medium">原始输入</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{draft.rawInput || draft.problem}</p>
      </section>

      <section>
        <h2 className="font-medium">版本历史</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {versions.map((version) => (
            <button className="rounded-md border border-line px-3 py-2 text-sm" key={version.id} onClick={() => setDraft(version)} type="button">
              版本 {version.version ?? 1}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
