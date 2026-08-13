"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Circle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  SkipForward,
  PlayCircle,
  Calendar,
  Plus,
  Trash2,
  Lock,
  Unlock,
  FileText,
  X,
  Pause,
  Ban
} from "lucide-react";
import {
  getStageMeta,
  getDefaultChecklist,
  getNextStage,
  getAllStages,
  getStageIndex
} from "@/features/workbench/stage-checklist-template";
import {
  type ProductKnowledgeV2,
  type ProductLifecycleStage,
  type StageProgress,
  type StageChecklistProgress,
  type StageDecisionRecord
} from "@/features/workbench/product-knowledge";
import { labelLifecycleStage } from "@/features/workbench/display-labels";
import { randomId } from "@/lib/random-id";

interface StageProcessCardProps {
  product: ProductKnowledgeV2;
  onUpdate: (updater: (product: ProductKnowledgeV2) => ProductKnowledgeV2) => void;
  onAddTask: (title: string, priority: "high" | "medium" | "low", productId: string, productName: string, stage: ProductLifecycleStage) => void;
}

const stageColors: Record<string, { bg: string; text: string; border: string; hex: string; soft: string }> = {
  signal: { bg: "bg-slate-400", text: "text-slate-600", border: "border-slate-300", hex: "#94a3b8", soft: "bg-slate-100" },
  validated: { bg: "bg-blue-400", text: "text-blue-600", border: "border-blue-300", hex: "#60a5fa", soft: "bg-blue-50" },
  defined: { bg: "bg-indigo-400", text: "text-indigo-600", border: "border-indigo-300", hex: "#818cf8", soft: "bg-indigo-50" },
  supply_locked: { bg: "bg-amber-400", text: "text-amber-600", border: "border-amber-300", hex: "#fbbf24", soft: "bg-amber-50" },
  listing: { bg: "bg-emerald-400", text: "text-emerald-600", border: "border-emerald-300", hex: "#34d399", soft: "bg-emerald-50" },
  evaluating: { bg: "bg-purple-400", text: "text-purple-600", border: "border-purple-300", hex: "#c084fc", soft: "bg-purple-50" },
  archived: { bg: "bg-green-500", text: "text-green-600", border: "border-green-300", hex: "#22c55e", soft: "bg-green-50" },
  discontinued: { bg: "bg-red-400", text: "text-red-600", border: "border-red-300", hex: "#f87171", soft: "bg-red-50" }
};

export function StageProcessCard({ product, onUpdate, onAddTask }: StageProcessCardProps) {
  const [editingStage, setEditingStage] = useState<ProductLifecycleStage | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [viewingStage, setViewingStage] = useState<ProductLifecycleStage | null>(null);
  const [unlockedStage, setUnlockedStage] = useState<ProductLifecycleStage | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [pendingDecision, setPendingDecision] = useState<null | "go" | "conditional_go" | "hold" | "cancel">(null);
  const [decisionReason, setDecisionReason] = useState("");

  const currentStage = product.lifecycleStage ?? "signal";
  const stageProgresses = product.stageProgress ?? [];
  const allStages = getAllStages();
  const currentIdx = getStageIndex(currentStage);
  const nextStage = getNextStage(currentStage);

  const activeStage = viewingStage ?? currentStage;
  const activeProgress = stageProgresses.find((sp) => sp.stage === activeStage);
  const checklist = activeProgress?.checklist ?? initializeChecklist(activeStage, stageProgresses);

  const isViewingPast = getStageIndex(activeStage) < currentIdx;
  const isViewingFuture = getStageIndex(activeStage) > currentIdx;
  const isLocked = (isViewingPast || !!activeProgress?.completedAt) && unlockedStage !== activeStage;

  const completedCount = checklist.filter((c) => c.checked).length;
  const requiredCount = checklist.filter((c) => c.priority === "required").length;
  const completedRequired = checklist.filter((c) => c.priority === "required" && c.checked).length;
  const progressPercent = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;
  const canGoToNext = completedRequired >= requiredCount && activeStage === currentStage;
  const missingRequired = checklist.filter((c) => c.priority === "required" && !c.checked);

  const decisions = activeProgress?.decisions ?? [];

  const hints = useMemo(() => buildHints(product, activeStage), [product, activeStage]);

  function initializeChecklist(stage: ProductLifecycleStage, existingProgresses: StageProgress[]): StageChecklistProgress[] {
    const existing = existingProgresses.find((sp) => sp.stage === stage);
    if (existing) return existing.checklist;
    const defaults = getDefaultChecklist(stage);
    return defaults.map((d) => ({ ...d, checked: false }));
  }

  function toggleUnlock() {
    setUnlockedStage((prev) => (prev === activeStage ? null : activeStage));
  }

  function updateChecklist(itemId: string, checked: boolean) {
    if (isLocked || isViewingFuture) return;
    onUpdate((p) => {
      const now = new Date().toISOString();
      const progress = getOrCreateProgress(p, activeStage);
      const updatedChecklist = progress.checklist.map((c) =>
        c.id === itemId ? { ...c, checked, checkedAt: checked ? now : c.checkedAt } : c
      );
      const updatedProgress = { ...progress, checklist: updatedChecklist };
      return upsertProgress(p, updatedProgress);
    });
    // 勾上强制项时，弹备注输入（只有在新建note的情况下，已有note不覆盖）
    if (checked) {
      const item = checklist.find((c) => c.id === itemId);
      if (item && !item.note) {
        setEditingNoteId(itemId);
        setEditingNoteText("");
      }
    }
  }

  function saveNote() {
    if (!editingNoteId) return;
    const text = editingNoteText.trim();
    onUpdate((p) => {
      const progress = getOrCreateProgress(p, activeStage);
      const updatedChecklist = progress.checklist.map((c) =>
        c.id === editingNoteId ? { ...c, note: text || undefined } : c
      );
      return upsertProgress(p, { ...progress, checklist: updatedChecklist });
    });
    setEditingNoteId(null);
    setEditingNoteText("");
  }

  function openNoteEditor(item: StageChecklistProgress) {
    if (isLocked || isViewingFuture) return;
    setEditingNoteId(item.id);
    setEditingNoteText(item.note ?? "");
  }

  function addCustomItem() {
    if (!newItemLabel.trim() || isLocked || isViewingFuture) return;
    const newItem: StageChecklistProgress = {
      id: `custom-${randomId()}`,
      label: newItemLabel.trim(),
      priority: "recommended",
      reason: "自定义检查项",
      checked: false
    };
    onUpdate((p) => {
      const progress = getOrCreateProgress(p, activeStage);
      const updatedProgress = { ...progress, checklist: [...progress.checklist, newItem] };
      return upsertProgress(p, updatedProgress);
    });
    setNewItemLabel("");
    setShowAddItem(false);
  }

  function removeItem(itemId: string) {
    if (isLocked) return;
    onUpdate((p) => {
      const progress = getOrCreateProgress(p, activeStage);
      const updatedProgress = { ...progress, checklist: progress.checklist.filter((c) => c.id !== itemId) };
      return upsertProgress(p, updatedProgress);
    });
  }

  function confirmDecision() {
    if (!pendingDecision) return;
    const reason = decisionReason.trim();
    if (!reason) return;

    if (pendingDecision === "go" || pendingDecision === "conditional_go") {
      markGO(reason, pendingDecision === "conditional_go");
    } else if (pendingDecision === "hold") {
      markHold(reason);
    } else if (pendingDecision === "cancel") {
      markCancel(reason);
    }
    setPendingDecision(null);
    setDecisionReason("");
  }

  function openDecisionDialog(kind: "go" | "conditional_go" | "hold" | "cancel") {
    setPendingDecision(kind);
    if (kind === "go") {
      setDecisionReason(`检查项已全部完成，推进到「${nextStage ? getStageMeta(nextStage).title : "下一阶段"}」。\n`);
    } else if (kind === "conditional_go") {
      setDecisionReason(
        `【条件GO】允许带风险推进。\n` +
        `缺失强制项：${missingRequired.map((m) => m.label).join("、")}\n` +
        `请说明为什么可以带风险推进，以及后续怎么补：`
      );
    } else if (kind === "hold") {
      setDecisionReason("暂时搁置，需要重新评估：");
    } else if (kind === "cancel") {
      setDecisionReason("决定放弃这个方向，原因：");
    }
  }

  function markGO(reason: string, conditional: boolean) {
    const snapshot = checklist.map((c) => ({ ...c }));
    const decision: StageDecisionRecord = {
      id: randomId(),
      stage: currentStage,
      decision: "go",
      reason: reason || (conditional ? "条件GO推进" : "检查项已全部完成，推进到下一阶段"),
      decidedAt: new Date().toISOString(),
      missingItems: conditional ? missingRequired.map((m) => m.label) : undefined,
      checklistSnapshot: snapshot
    };
    onUpdate((p) => {
      const now = new Date().toISOString();
      const progress = getOrCreateProgress(p, currentStage);
      const completedProgress = { ...progress, completedAt: now, decisions: [...progress.decisions, decision] };
      const updated = upsertProgress({ ...p, stageProgress: (p.stageProgress ?? []).filter((sp) => sp.stage !== currentStage) }, completedProgress);
      if (nextStage) {
        const nextProgress = getOrCreateProgressDirect(updated, nextStage);
        const withNext = upsertProgress(updated, nextProgress);
        return { ...withNext, lifecycleStage: nextStage, currentStageIndex: getStageIndex(nextStage) };
      }
      return { ...updated, lifecycleStage: undefined, currentStageIndex: undefined };
    });

    if (nextStage) {
      const nextMeta = getStageMeta(nextStage);
      onAddTask(`推进到「${nextMeta.title}」阶段`, "high", product.id, product.name, nextStage);
    }
    setViewingStage(null);
  }

  function markHold(reason: string) {
    const snapshot = checklist.map((c) => ({ ...c }));
    const decision: StageDecisionRecord = {
      id: randomId(),
      stage: currentStage,
      decision: "hold",
      reason: reason || "暂时搁置",
      decidedAt: new Date().toISOString(),
      checklistSnapshot: snapshot
    };
    onUpdate((p) => {
      const progress = getOrCreateProgress(p, currentStage);
      const updatedProgress = { ...progress, decisions: [...progress.decisions, decision] };
      return upsertProgress(p, updatedProgress);
    });
  }

  function markCancel(reason: string) {
    const snapshot = checklist.map((c) => ({ ...c }));
    const decision: StageDecisionRecord = {
      id: randomId(),
      stage: currentStage,
      decision: "cancel",
      reason: reason || "决定放弃",
      decidedAt: new Date().toISOString(),
      checklistSnapshot: snapshot
    };
    onUpdate((p) => {
      const progress = getOrCreateProgress(p, currentStage);
      const updatedProgress = { ...progress, decisions: [...progress.decisions, decision] };
      const updated = upsertProgress(p, updatedProgress);
      return { ...updated, lifecycleStage: "discontinued", currentStageIndex: getStageIndex("discontinued") };
    });
  }

  const colors = stageColors[activeStage] ?? stageColors.signal;
  const meta = getStageMeta(activeStage);

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-card">
      {/* Stage funnel visualization — clickable to switch viewing stage */}
      <div className="flex items-center gap-1 px-4 pt-4 pb-2 overflow-x-auto">
        {allStages.map((stage, i) => {
          const stageColor = stageColors[stage];
          const isCurrent = stage === currentStage;
          const isPast = i < currentIdx;
          const isFuture = i > currentIdx;
          const isViewing = stage === activeStage;
          const hasProgress = stageProgresses.some((sp) => sp.stage === stage && sp.checklist.some((c) => c.checked));
          const hasCompleted = !!stageProgresses.find((sp) => sp.stage === stage && sp.completedAt);
          return (
            <div key={stage} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => { setViewingStage(isViewing ? null : stage); setUnlockedStage(null); }}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-all ${
                  isViewing
                    ? `${stageColor.bg} text-white shadow-sm ring-2 ring-offset-1 ring-action/40`
                    : isCurrent
                      ? `${stageColor.bg} text-white shadow-sm`
                      : isPast
                        ? `${stageColor.soft} ${stageColor.text} hover:brightness-95`
                        : isFuture
                          ? "bg-paper-warm text-muted-light hover:bg-line"
                          : ""
                }`}
                title={isCurrent ? "当前阶段" : isPast ? "点击回看此阶段检查清单" : isFuture ? "点击预览下一阶段清单（不可编辑）" : ""}
              >
                <span className={`h-2 w-2 rounded-full ${isViewing || isCurrent ? "bg-white" : isPast ? stageColor.bg : "bg-muted-light"}`} />
                {getStageMeta(stage).title}
                {hasCompleted && !isCurrent && (
                  <Check className="h-3 w-3" />
                )}
                {!hasCompleted && hasProgress && !isCurrent && (
                  <span className="h-2 w-2 rounded-full bg-white/80 border border-white" />
                )}
                {isCurrent && <span className="ml-0.5 text-[9px] opacity-80">· 当前</span>}
              </button>
              {i < allStages.length - 1 && (
                <span className={`w-3 h-px ${isPast ? stageColor.bg : "bg-line"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Viewing banner */}
      {(viewingStage && viewingStage !== currentStage) && (
        <div className="mx-4 mb-2 flex items-center justify-between rounded-lg bg-action-soft/50 px-3 py-2 text-[12px] text-action-strong">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            <span>
              正在查看「{getStageMeta(viewingStage).title}」阶段检查清单
              {isViewingPast && <span className="ml-1">· 历史快照</span>}
              {isViewingFuture && <span className="ml-1">· 未来阶段预览</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isViewingPast && (
              <button
                onClick={toggleUnlock}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
                  unlockedStage === viewingStage
                    ? "bg-warning-soft text-warning hover:bg-warning-soft/80"
                    : "bg-white text-muted hover:bg-paper-warm"
                }`}
              >
                {unlockedStage === viewingStage ? (<><Unlock className="h-3 w-3" />已解锁，可编辑</>) : (<><Lock className="h-3 w-3" />点击解锁编辑</>)}
              </button>
            )}
            <button
              onClick={() => { setViewingStage(null); setUnlockedStage(null); }}
              className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] text-muted hover:bg-paper-warm"
            >
              <X className="h-3 w-3" /> 返回当前
            </button>
          </div>
        </div>
      )}

      {/* Active stage header */}
      <div className={`flex items-center justify-between px-4 py-3 border-t border-line ${colors.soft}/50`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors.bg} text-white`}>
            <PlayCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">{meta.title}</h3>
            <p className="text-xs text-muted">{meta.description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-ink">{progressPercent}%</div>
          <div className="text-[11px] text-muted">
            {completedCount}/{checklist.length} 完成
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-paper-warm">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colors.bg}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {activeStage === currentStage && !canGoToNext && missingRequired.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-danger-soft/30 px-2 py-1">
            <AlertTriangle className="h-3.5 w-3.5 text-danger" />
            <span className="text-[11px] text-danger font-medium">
              缺 {missingRequired.length} 项强制项：{missingRequired.map((m) => m.label).join("、")}
            </span>
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wide">检查清单</h4>
          {!isLocked && !isViewingFuture && activeStage === currentStage && (
            <button
              className="text-xs text-action hover:text-action-strong flex items-center gap-1"
              onClick={() => setShowAddItem(!showAddItem)}
            >
              <Plus className="h-3 w-3" />
              自定义
            </button>
          )}
        </div>

        {showAddItem && (
          <div className="mb-2 flex items-center gap-2">
            <input
              className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-action/30"
              placeholder="添加自定义检查项..."
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
            />
            <button
              className="rounded-lg bg-action px-3 py-1.5 text-xs text-white"
              onClick={addCustomItem}
            >
              添加
            </button>
            <button
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted"
              onClick={() => { setShowAddItem(false); setNewItemLabel(""); }}
            >
              取消
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          {checklist.map((item) => {
            const hint = hints[item.id];
            return (
              <div
                key={item.id}
                className={`group rounded-lg px-2.5 py-2 transition-all ${
                  item.checked ? "bg-success-soft/30" : "bg-paper-warm/40 hover:bg-paper-warm"
                } ${(isLocked || isViewingFuture) ? "opacity-95" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => updateChecklist(item.id, !item.checked)}
                    disabled={isLocked || isViewingFuture}
                    className={`shrink-0 mt-0.5 ${(isLocked || isViewingFuture) ? "cursor-not-allowed" : ""}`}
                  >
                    {item.checked ? (
                      <div className={`flex h-4 w-4 items-center justify-center rounded ${isLocked ? "bg-success/70" : "bg-success"}`}>
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    ) : (
                      <Circle className={`h-4 w-4 ${(isLocked || isViewingFuture) ? "text-muted-light/60" : "text-muted-light"}`} />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm ${item.checked ? "text-muted line-through" : "text-ink"}`}>
                        {item.label}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          item.priority === "required"
                            ? "bg-danger-soft text-danger border border-danger/20"
                            : "bg-paper-warm text-muted-light border border-line-soft"
                        }`}
                      >
                        {item.priority === "required" ? "强制" : "建议"}
                      </span>
                      {hint && (
                        <span className="rounded bg-action-soft/40 px-1.5 py-0.5 text-[10px] font-medium text-action-strong border border-action/20">
                          💡 {hint}
                        </span>
                      )}
                      {item.checkedAt && (
                        <span className="text-[10px] text-muted-light">
                          {new Date(item.checkedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-light mt-0.5">{item.reason}</p>

                    {/* Note */}
                    {editingNoteId === item.id ? (
                      <div className="mt-2 flex gap-2 items-start">
                        <textarea
                          autoFocus
                          className="flex-1 rounded-md border border-line px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-action/30 min-h-[60px]"
                          placeholder="写下你是如何确认的？（如：规格表已填，包含3款尺寸；或已对比3家供应商报价）"
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={saveNote}
                            className="rounded-md bg-action px-2 py-1 text-[11px] text-white"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => { setEditingNoteId(null); setEditingNoteText(""); }}
                            className="rounded-md border border-line px-2 py-1 text-[11px] text-muted"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : item.note ? (
                      <div className="mt-1.5 flex items-start gap-1 rounded-md bg-action-soft/40 px-2 py-1.5">
                        <FileText className="h-3 w-3 text-action-strong shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-action-strong whitespace-pre-wrap">{item.note}</p>
                        </div>
                        {!isLocked && !isViewingFuture && (
                          <button
                            onClick={() => openNoteEditor(item)}
                            className="shrink-0 text-[10px] text-action hover:underline"
                          >
                            编辑
                          </button>
                        )}
                      </div>
                    ) : null}

                    {/* Note edit trigger (only when not showing note already) */}
                    {editingNoteId !== item.id && !item.note && !isLocked && !isViewingFuture && (
                      <button
                        onClick={() => openNoteEditor(item)}
                        className="mt-1 flex items-center gap-1 text-[10px] text-action/70 hover:text-action opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <FileText className="h-2.5 w-2.5" />
                        {item.checked ? "补写确认依据/备注" : "先写备注再确认"}
                      </button>
                    )}
                  </div>
                  {item.id.startsWith("custom-") && !isLocked && (
                    <button
                      className="opacity-0 group-hover:opacity-100 text-muted-light hover:text-danger shrink-0 mt-1"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Decisions (for active viewing stage) */}
      {decisions.length > 0 && (
        <div className="px-4 pb-3 border-t border-line pt-3">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">阶段决策</h4>
          <div className="space-y-2">
            {decisions.map((d) => (
              <div key={d.id} className="rounded-lg bg-paper-warm/60 px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                      d.decision === "go"
                        ? "bg-success-soft text-success"
                        : d.decision === "hold"
                          ? "bg-warning-soft text-warning"
                          : "bg-danger-soft text-danger"
                    }`}
                  >
                    {d.decision === "go" ? "GO" : d.decision === "hold" ? "HOLD" : "CANCEL"}
                  </span>
                  <span className="text-muted text-[11px]">
                    {new Date(d.decidedAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-ink mt-1 whitespace-pre-wrap">{d.reason}</p>
                {d.missingItems && d.missingItems.length > 0 && (
                  <p className="text-[11px] text-warning mt-1">
                    ⚠ 缺失强制项：{d.missingItems.join("、")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons — only on current stage */}
      {activeStage === currentStage && (
        <div className="px-4 py-3 border-t border-line bg-paper-warm/30 rounded-b-2xl">
          <div className="flex flex-wrap gap-2 items-center">
            {nextStage ? (
              canGoToNext ? (
                <button
                  onClick={() => openDecisionDialog("go")}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-success to-success/80 px-4 py-2 text-sm font-semibold text-white shadow-card hover:-translate-y-0.5 transition-all"
                >
                  <SkipForward className="h-4 w-4" />
                  GO → 推进到「{getStageMeta(nextStage).title}」
                </button>
              ) : (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <button
                    onClick={() => openDecisionDialog("conditional_go")}
                    className="flex items-center gap-1.5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-2 text-sm font-semibold text-warning hover:bg-warning-soft/80 transition-all"
                  >
                    <SkipForward className="h-4 w-4" />
                    条件GO
                  </button>
                  <span className="text-[11px] text-muted self-center max-w-xs">
                    {missingRequired.length > 0
                      ? `将带 ${missingRequired.length} 项缺失记录`
                      : "仅建议项未完成，可安全推进"}
                  </span>
                </div>
              )
            ) : null}

            <button
              onClick={() => openDecisionDialog("hold")}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-muted hover:bg-paper-warm transition-all"
            >
              <Pause className="h-3.5 w-3.5" />
              HOLD
            </button>

            {currentStage !== "archived" && currentStage !== "discontinued" && (
              <button
                onClick={() => openDecisionDialog("cancel")}
                className="flex items-center gap-1.5 rounded-xl border border-danger/30 bg-white px-3 py-2 text-sm font-medium text-danger hover:bg-danger-soft/30 transition-all"
              >
                <Ban className="h-3.5 w-3.5" />
                取消
              </button>
            )}
          </div>
        </div>
      )}

      {/* Decision confirmation modal */}
      {pendingDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface shadow-2xl border border-line overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="font-semibold text-ink flex items-center gap-2">
                {pendingDecision === "go" && (<><span className="rounded bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">GO 推进</span>确认推进到下一阶段</>)}
                {pendingDecision === "conditional_go" && (<><span className="rounded bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">条件GO</span>带风险推进确认</>)}
                {pendingDecision === "hold" && (<><span className="rounded bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">HOLD 搁置</span>搁置本阶段</>)}
                {pendingDecision === "cancel" && (<><span className="rounded bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">CANCEL 取消</span>放弃该产品方向</>)}
              </h3>
              <button
                onClick={() => { setPendingDecision(null); setDecisionReason(""); }}
                className="text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {(pendingDecision === "conditional_go") && (
                <div className="rounded-lg bg-warning-soft/30 border border-warning/30 px-3 py-2">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[12px] font-semibold text-warning">推进前请确认已知悉以下 {missingRequired.length} 项强制项缺失：</p>
                      <ul className="mt-1 space-y-0.5">
                        {missingRequired.map((m) => (
                          <li key={m.id} className="text-[11px] text-warning-strong">· {m.label}{m.reason ? `（${m.reason}）` : ""}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Checklist summary */}
              <div className="rounded-lg bg-paper-warm border border-line p-3">
                <p className="text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-wide">检查清单快照（{completedCount}/{checklist.length}）</p>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {checklist.map((c) => (
                    <div key={c.id} className="flex items-start gap-1.5">
                      {c.checked ? (
                        <Check className="h-3 w-3 text-success mt-0.5 shrink-0" />
                      ) : (
                        <Circle className={`h-3 w-3 mt-0.5 shrink-0 ${c.priority === "required" ? "text-danger/60" : "text-muted-light"}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`text-[11px] ${c.checked ? "text-muted" : "text-ink"}`}>{c.label}</span>
                          <span className={`text-[9px] px-1 rounded ${c.priority === "required" ? "bg-danger-soft text-danger" : "bg-line text-muted-light"}`}>
                            {c.priority === "required" ? "强制" : "建议"}
                          </span>
                        </div>
                        {c.note && <p className="text-[10px] text-action-strong mt-0.5 whitespace-pre-wrap">📝 {c.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">
                  决策依据 / 备注 / 下一步提醒 <span className="text-danger">*</span>
                </label>
                <textarea
                  autoFocus
                  className="w-full min-h-[90px] rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action/30"
                  placeholder="不填不让确认。写下：为什么做这个决策？你确认了什么？要提醒自己接下来做什么？"
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-line bg-paper-warm/40 px-4 py-3">
              <button
                onClick={() => { setPendingDecision(null); setDecisionReason(""); }}
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-muted hover:bg-paper-warm"
              >
                取消
              </button>
              <button
                onClick={confirmDecision}
                disabled={!decisionReason.trim()}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                  pendingDecision === "cancel"
                    ? "bg-danger hover:bg-danger/90"
                    : pendingDecision === "hold"
                      ? "bg-warning hover:bg-warning/90"
                      : pendingDecision === "conditional_go"
                        ? "bg-warning hover:bg-warning/90"
                        : "bg-success hover:bg-success/90"
                }`}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildHints(product: ProductKnowledgeV2, stage: ProductLifecycleStage): Record<string, string> {
  const hints: Record<string, string> = {};
  try {
    const quoteCount = (product.procurementQuotes ?? []).length;
    const specCount = (product.specifications ?? []).length;
    const costItemCount = (product.costItems ?? []).length;
    const materialsArr = (product.materialStructures ?? []).map((m) => m.name).filter(Boolean);
    const riskArr = product.risks;

    if (stage === "signal") {
      if (product.name?.trim()) hints["sig-1"] = "已填名称";
      if (quoteCount >= 1) hints["sig-2"] = `已录 ${quoteCount} 条采购报价`;
      if (product.category?.trim()) hints["sig-3"] = "已填品类";
      if (materialsArr.length >= 1) hints["sig-4"] = `已识别 ${materialsArr.length} 种原料`;
    }
    if (stage === "validated") {
      let filledFields = 0;
      if (product.name?.trim()) filledFields++;
      if (product.category?.trim()) filledFields++;
      if (product.coreUse?.trim()) filledFields++;
      filledFields += Math.min(materialsArr.length, 2);
      const qCount = (riskArr?.quality ?? []).length + (riskArr?.supply ?? []).length + (riskArr?.compliance ?? []).length;
      filledFields += Math.min(qCount, 2);
      if (filledFields >= 4) hints["val-1"] = `知识卡填充度较高 (${filledFields})`;
      if (quoteCount >= 2) hints["val-2"] = `${quoteCount} 条报价可对比`;
      if (costItemCount >= 2 || product.hardCostTotal != null) hints["val-3"] = "已有成本结构数据";
      if (qCount >= 1) hints["val-4"] = `已记录 ${qCount} 项风险`;
      const hasUsers = product.targetUsers?.trim() && product.targetUsers.trim().length > 0;
      const hasScenarios = (product.useScenarios ?? []).length >= 1;
      if (hasUsers && hasScenarios) hints["val-5"] = "用户与场景已填";
    }
    if (stage === "defined") {
      const hasSpecs = specCount >= 1 && (product.specifications ?? []).some(
        (s) => (s.name?.trim() ?? "") && (s.value?.trim() ?? "")
      );
      if (hasSpecs) hints["def-1"] = `已填 ${specCount} 条规格`;
      if ((product.manufacturing?.processes ?? []).length >= 1) {
        hints["def-2"] = `已录 ${product.manufacturing!.processes!.length} 道工序`;
      }
      if ((product.relatedSupplierIds ?? []).length >= 1 || product.supplierId) {
        hints["def-3"] = `已关联 ${(product.relatedSupplierIds ?? []).length + (product.supplierId ? 1 : 0)} 家供应商`;
      }
      if (product.hardCostStatus === "confirmed" || product.hardCostTotal != null) {
        hints["def-4"] = product.hardCostStatus === "confirmed" ? "硬成本已确认" : "硬成本已有测算";
      }
      const riskLen = (riskArr?.quality?.length ?? 0) + (riskArr?.supply?.length ?? 0) + (riskArr?.compliance?.length ?? 0);
      if (riskLen >= 2) hints["def-5"] = `已记录 ${riskLen} 项风险`;
    }
    if (stage === "supply_locked") {
      if (product.hardCostStatus === "confirmed") hints["sup-1"] = "硬成本已锁定";
      const withUnitCost = (product.costItems ?? []).filter((c) => typeof c.unitCost === "number" || typeof c.subtotal === "number").length;
      if (costItemCount >= 3) hints["sup-2"] = `已列 ${costItemCount} 项成本`;
      if (product.hardCostTotal != null && withUnitCost >= 2) hints["sup-3"] = "成本总额已测算";
      if ((product.qualityControls ?? []).length >= 1) hints["sup-4"] = `已填 ${product.qualityControls!.length} 项质控`;
    }
    if (stage === "listing") {
      if ((product.relatedOfferIds ?? []).length >= 1) hints["lst-1"] = `已关联 ${product.relatedOfferIds!.length} 个货盘`;
    }
    if (stage === "evaluating") {
      if (product.decision?.summary?.trim()) hints["eva-1"] = "已写决策汇总";
      if (product.decision?.recommendation) hints["eva-2"] = `建议：${product.decision.recommendation}`;
    }
  } catch {
    // ignore errors, hints are advisory only
  }
  return hints;
}

function getOrCreateProgress(product: ProductKnowledgeV2, stage: ProductLifecycleStage): StageProgress {
  const existing = (product.stageProgress ?? []).find((sp) => sp.stage === stage);
  if (existing) return existing;
  const defaults = getDefaultChecklist(stage);
  const now = new Date().toISOString();
  return {
    stage,
    enteredAt: now,
    checklist: defaults.map((d) => ({ ...d, checked: false })),
    decisions: []
  };
}

function getOrCreateProgressDirect(product: ProductKnowledgeV2, stage: ProductLifecycleStage): StageProgress {
  return getOrCreateProgress(product, stage);
}

function upsertProgress(product: ProductKnowledgeV2, progress: StageProgress): ProductKnowledgeV2 {
  const existing = product.stageProgress ?? [];
  const idx = existing.findIndex((sp) => sp.stage === progress.stage);
  const updated = [...existing];
  if (idx >= 0) {
    updated[idx] = progress;
  } else {
    updated.push(progress);
  }
  return { ...product, stageProgress: updated };
}
