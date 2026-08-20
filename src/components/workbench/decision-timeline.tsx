"use client";

import { useState } from "react";
import {
  CheckCircle,
  PauseCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Calendar,
  AlertTriangle,
  Check,
  Circle,
  FileText
} from "lucide-react";
import {
  type StageProgress,
  type StageDecisionRecord,
  type ProductLifecycleStage,
  type StageChecklistProgress
} from "@/features/workbench/product-knowledge";
import { getStageMeta } from "@/features/workbench/stage-checklist-template";

interface DecisionTimelineProps {
  stageProgresses: StageProgress[];
  currentStage: ProductLifecycleStage;
}

const decisionIcons = {
  go: CheckCircle,
  hold: PauseCircle,
  cancel: XCircle
};

const decisionColors = {
  go: { bg: "bg-success-soft", text: "text-success", border: "border-success/30", icon: "text-success" },
  hold: { bg: "bg-warning-soft", text: "text-warning", border: "border-warning/30", icon: "text-warning" },
  cancel: { bg: "bg-danger-soft", text: "text-danger", border: "border-danger/30", icon: "text-danger" }
};

export function DecisionTimeline({ stageProgresses, currentStage }: DecisionTimelineProps) {
  const [expandedStage, setExpandedStage] = useState<ProductLifecycleStage | null>(currentStage);

  const allDecisions: Array<{ stage: ProductLifecycleStage; decision: StageDecisionRecord }> = [];
  for (const sp of stageProgresses) {
    for (const d of sp.decisions) {
      allDecisions.push({ stage: sp.stage, decision: d });
    }
  }

  if (stageProgresses.length === 0 || allDecisions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-paper-warm/30 p-6 text-center">
        <Calendar className="mx-auto mb-2 h-6 w-6 text-muted-light" />
        <p className="text-sm text-muted">还没有决策记录</p>
        <p className="text-xs text-muted-light mt-1">完成检查项后，点击 GO 推进时会自动记录决策（含检查清单快照）</p>
      </div>
    );
  }

  const sortedByStage = stageProgresses
    .filter((sp) => sp.decisions.length > 0 || sp.stage === currentStage)
    .sort((a, b) => {
      const order = ["signal", "validated", "defined", "supply_locked", "listing", "evaluating", "archived", "discontinued"];
      return order.indexOf(a.stage) - order.indexOf(b.stage);
    });

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <h3 className="font-semibold text-ink flex items-center gap-2">
          <Calendar className="h-4 w-4 text-action" />
          决策历史
        </h3>
        <span className="text-xs text-muted">{allDecisions.length} 条记录</span>
      </div>

      <div className="p-4">
        <div className="space-y-3">
          {sortedByStage.map((sp) => {
            const stageDecisions = sp.decisions;
            const isExpanded = expandedStage === sp.stage;
            const meta = getStageMeta(sp.stage);
            const stageColor = {
              signal: "bg-slate-400",
              validated: "bg-blue-400",
              defined: "bg-indigo-400",
              supply_locked: "bg-amber-400",
              listing: "bg-emerald-400",
              evaluating: "bg-purple-400",
              archived: "bg-green-500",
              discontinued: "bg-red-400"
            }[sp.stage] ?? "bg-slate-400";
            const total = sp.checklist.length;
            const checked = sp.checklist.filter((c) => c.checked).length;

            return (
              <div key={sp.stage} className="rounded-xl border border-line bg-paper-warm/30 overflow-hidden">
                <button
                  onClick={() => setExpandedStage(isExpanded ? null : sp.stage)}
                  className="flex w-full items-center justify-between px-3 py-2.5 hover:bg-paper-warm/50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted" />
                    )}
                    <span className={`h-2 w-2 rounded-full ${stageColor}`} />
                    <span className="text-sm font-medium text-ink">{meta.title}</span>
                    <span className="text-xs text-muted">· {stageDecisions.length} 条决策</span>
                    {total > 0 && (
                      <span className="text-[11px] text-muted-light">· 检查清单 {checked}/{total}</span>
                    )}
                    {sp.stage === currentStage && (
                      <span className="rounded bg-action-soft px-1.5 py-0.5 text-[10px] font-semibold text-action">
                        当前阶段
                      </span>
                    )}
                    {sp.completedAt && (
                      <span className="text-[11px] text-muted-light">
                        完成于 {new Date(sp.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-line bg-white/50 p-3 space-y-3">
                    {/* Checklist snapshot summary for the stage (for all stages) */}
                    {sp.checklist.length > 0 && (
                      <div className="rounded-lg border border-line-soft bg-paper-warm/60 p-2.5">
                        <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <FileText className="h-3 w-3" /> 该阶段检查清单快照
                          <span className="ml-auto text-muted-light font-normal">{checked}/{total} 已勾选</span>
                        </p>
                        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                          {sp.checklist.map((c: StageChecklistProgress) => (
                            <div key={c.id} className="flex items-start gap-1.5">
                              {c.checked ? (
                                <Check className="h-3 w-3 text-success mt-0.5 shrink-0" />
                              ) : (
                                <Circle className={`h-3 w-3 mt-0.5 shrink-0 ${c.priority === "required" ? "text-danger/60" : "text-muted-light"}`} />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className={`text-[11px] ${c.checked ? "text-muted line-through" : "text-ink"}`}>
                                    {c.label}
                                  </span>
                                  <span className={`text-[9px] px-1 rounded ${
                                    c.priority === "required"
                                      ? "bg-danger-soft text-danger"
                                      : "bg-line text-muted-light"
                                  }`}>
                                    {c.priority === "required" ? "强制" : "建议"}
                                  </span>
                                  {c.checkedAt && (
                                    <span className="text-[9px] text-muted-light">
                                      {new Date(c.checkedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-light mt-0.5">{c.reason}</p>
                                {c.note && (
                                  <div className="mt-0.5 flex items-start gap-1 rounded bg-action-soft/40 px-1.5 py-1">
                                    <FileText className="h-2.5 w-2.5 text-action-strong shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-action-strong whitespace-pre-wrap">{c.note}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Decisions list */}
                    {stageDecisions.length === 0 ? (
                      <p className="text-xs text-muted italic py-2 text-center">暂无决策记录</p>
                    ) : (
                      stageDecisions.map((d) => {
                        const Icon = decisionIcons[d.decision];
                        const colors = decisionColors[d.decision];
                        return (
                          <div key={d.id} className="rounded-lg bg-white p-3 border border-line-soft">
                            <div className="flex items-start gap-2">
                              <div className={`shrink-0 rounded-lg ${colors.bg} p-1`}>
                                <Icon className={`h-4 w-4 ${colors.icon}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-semibold ${colors.text}`}>
                                    {d.decision === "go" ? "GO 推进" : d.decision === "hold" ? "HOLD 搁置" : "CANCEL 取消"}
                                  </span>
                                  <span className="text-[11px] text-muted-light">
                                    {new Date(d.decidedAt).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-sm text-ink mt-1 whitespace-pre-wrap">{d.reason}</p>
                                {d.missingItems && d.missingItems.length > 0 && (
                                  <div className="mt-1.5 flex items-start gap-1 rounded bg-warning-soft/30 px-2 py-1">
                                    <AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-warning">
                                      条件GO：缺失 {d.missingItems.length} 项 — {d.missingItems.join("、")}
                                    </p>
                                  </div>
                                )}
                                {/* Checklist snapshot inside decision if present */}
                                {d.checklistSnapshot && d.checklistSnapshot.length > 0 && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-[11px] text-action hover:underline">
                                      查看决策时的检查清单快照（{d.checklistSnapshot.filter((c) => c.checked).length}/{d.checklistSnapshot.length}）
                                    </summary>
                                    <div className="mt-1.5 space-y-0.5 rounded-md border border-line-soft bg-paper-warm/60 p-2 max-h-44 overflow-y-auto">
                                      {d.checklistSnapshot.map((c) => (
                                        <div key={c.id} className="flex items-start gap-1.5">
                                          {c.checked ? (
                                            <Check className="h-2.5 w-2.5 text-success mt-0.5 shrink-0" />
                                          ) : (
                                            <Circle className={`h-2.5 w-2.5 mt-0.5 shrink-0 ${c.priority === "required" ? "text-danger/50" : "text-muted-light"}`} />
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1 flex-wrap">
                                              <span className={`text-[10px] ${c.checked ? "text-muted" : "text-ink"}`}>{c.label}</span>
                                              <span className={`text-[8px] px-0.5 rounded ${c.priority === "required" ? "bg-danger-soft/60 text-danger" : "bg-line text-muted-light"}`}>
                                                {c.priority === "required" ? "强制" : "建议"}
                                              </span>
                                            </div>
                                            {c.note && (
                                              <p className="text-[9px] text-action-strong mt-0.5 whitespace-pre-wrap">📝 {c.note}</p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
