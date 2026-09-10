"use client";

import { useState } from "react";
import { updateFiveLayerAnalysis, type CompetitorAnalysisProject, type FiveLayerKey, type EvidenceTag } from "@/features/workbench/competitor-analysis";

export const layerNames: Record<FiveLayerKey, { label: string; prompt: string }> = {
  strategy: { label: "战略层", prompt: "它服务谁、解决什么核心问题，为什么用户会持续使用？" },
  scope: { label: "范围层", prompt: "它提供哪些核心、次级和特色能力？" },
  structure: { label: "结构层", prompt: "它如何组织模块、信息和核心业务链路？" },
  framework: { label: "框架层", prompt: "用户如何进入、操作、保存、回看和完成目标？" },
  presentation: { label: "表现层", prompt: "布局、信息密度和视觉设计如何帮助用户理解和行动？" },
};

export function FiveLayerStep({ project, onChange }: { project: CompetitorAnalysisProject; onChange: (project: CompetitorAnalysisProject) => void }) {
  const [competitorId, setCompetitorId] = useState(project.competitors[0]?.id ?? "");
  if (project.competitors.length === 0) return <div className="rounded-xl border border-dashed border-line bg-paper p-6 text-sm text-muted">请先在“竞品确认”中添加至少一个竞品。</div>;
  const layers = project.layerAnalyses[competitorId];
  function save(layer: FiveLayerKey, patch: { observation: string; implication: string; inspiration: string; tag: EvidenceTag }) { onChange(updateFiveLayerAnalysis(project, competitorId, layer, patch)); }
  return <div className="space-y-5"><div className="rounded-xl border border-action/20 bg-action-soft/30 p-4 text-sm leading-6 text-muted"><p className="font-semibold text-ink">不要只记录“竞品长什么样”</p><p className="mt-1">白板贴案例：看到某个竞品详情页突出“擦除后不留痕”，先记录页面事实，再思考它在帮助用户解决什么决策问题，最后写出对我们白板贴产品的启发。</p></div><label className="block text-sm font-semibold text-ink">当前拆解竞品<select value={competitorId} onChange={(event) => setCompetitorId(event.target.value)} className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-normal">{project.competitors.map((competitor) => <option key={competitor.id} value={competitor.id}>{competitor.name}</option>)}</select></label><div className="space-y-4">{(Object.keys(layerNames) as FiveLayerKey[]).map((layer) => <LayerCard key={layer} layer={layer} record={layers?.[layer]} onSave={save} />)}</div></div>;
}

function LayerCard({ layer, record, onSave }: { layer: FiveLayerKey; record?: { observation: string; implication: string; inspiration: string; tag: EvidenceTag }; onSave: (layer: FiveLayerKey, patch: { observation: string; implication: string; inspiration: string; tag: EvidenceTag }) => void }) {
  const [observation, setObservation] = useState(record?.observation ?? "");
  const [implication, setImplication] = useState(record?.implication ?? "");
  const [inspiration, setInspiration] = useState(record?.inspiration ?? "");
  const [tag, setTag] = useState<EvidenceTag>(record?.tag ?? "fact");
  return <section className="rounded-xl border border-line bg-paper p-4"><div><h3 className="font-semibold text-ink">{layerNames[layer].label}</h3><p className="mt-1 text-xs leading-5 text-muted">{layerNames[layer].prompt}</p></div><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-sm font-semibold text-ink">观察事实<textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder={layer === "strategy" ? "例如：竞品把白板贴定位为可反复书写、擦除的家庭/教学展示面" : layer === "scope" ? "例如：包含卷材尺寸、书写、擦除、安装和重复使用说明" : "例如：详情页先展示擦除前后对比，再说明使用步骤"} className="mt-2 min-h-20 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal placeholder:text-muted-light" /><span className="mt-1 block text-xs font-normal text-muted">先写你实际看到或体验到的内容。</span></label><label className="text-sm font-semibold text-ink">产品含义<textarea value={implication} onChange={(event) => setImplication(event.target.value)} placeholder="例如：用户购买前最担心擦除残留，因此页面先降低这个疑虑" className="mt-2 min-h-20 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal placeholder:text-muted-light" /><span className="mt-1 block text-xs font-normal text-muted">这说明它在解决什么用户问题？</span></label><label className="text-sm font-semibold text-ink">对白板贴的启发<textarea value={inspiration} onChange={(event) => setInspiration(event.target.value)} placeholder="例如：先验证擦除后不留痕，再决定是否优化详情页表达" className="mt-2 min-h-20 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal placeholder:text-muted-light" /><span className="mt-1 block text-xs font-normal text-muted">不要直接写“照搬”，写清楚白板贴可以借鉴的原则。</span></label><label className="text-sm font-semibold text-ink">当前判断<select value={tag} onChange={(event) => setTag(event.target.value as EvidenceTag)} className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal"><option value="fact">事实</option><option value="inference">推断</option><option value="unverified">待验证</option><option value="strategy">策略建议</option></select><span className="mt-1 block text-xs font-normal text-muted">事实和推断分开，避免报告过度确定。</span></label></div><div className="mt-3 flex justify-end"><button type="button" onClick={() => onSave(layer, { observation, implication, inspiration, tag })} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink">保存{layerNames[layer].label}</button></div></section>;
}
