"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Target,
  Calendar,
  Sparkles
} from "lucide-react";

interface DailyInsight {
  id: string;
  dayOfWeek: number;
  title: string;
  emoji: string;
  category: "supply_chain" | "product" | "market" | "risk" | "strategy";
  summary: string;
  points: string[];
  workbenchTip: string;
  tags: string[];
}

const categoryConfig: Record<string, { label: string; color: string; soft: string; text: string; border: string }> = {
  supply_chain: { label: "供应链", color: "bg-blue-500", soft: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  product: { label: "产品", color: "bg-purple-500", soft: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  market: { label: "市场", color: "bg-emerald-500", soft: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  risk: { label: "风险", color: "bg-red-500", soft: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  strategy: { label: "战略", color: "bg-amber-500", soft: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" }
};

const dailyInsights: DailyInsight[] = [
  {
    id: "insight-kano",
    dayOfWeek: 0,
    title: "Kano 模型",
    emoji: "💡",
    category: "product",
    summary: "用户需求分三类，决定产品差异化方向",
    points: [
      "基本型：没有就不满，有了也觉得理所当然",
      "期望型：做得越好越满意，与投入成正比",
      "兴奋型：没有无所谓，有了会惊喜，是差异化关键"
    ],
    workbenchTip: "产品定义阶段锁定规格时，先满足基本型需求，再用兴奋型需求做差异化。",
    tags: ["产品定义", "需求分析"]
  },
  {
    id: "inspect-sourcing",
    dayOfWeek: 1,
    title: "供应商金字塔",
    emoji: "🏭",
    category: "supply_chain",
    summary: "按战略价值分层管理供应商",
    points: [
      "战略型：高价值高风险，深度绑定联合开发",
      "优选型：稳定合作，年度续约与量价谈判",
      "普通型：比价竞争，降本空间最大",
      "交易型：一次性采购，无长期承诺"
    ],
    workbenchTip: "供应商档案中标记合作层级，不同层级对应不同跟进频率和谈判策略。",
    tags: ["供应商管理", "采购策略"]
  },
  {
    id: "inspect-competitor",
    dayOfWeek: 2,
    title: "竞品拆解放射图",
    emoji: "🎯",
    category: "market",
    summary: "多维度拆解竞品，找到差异化突破口",
    points: [
      "价格带：竞品在不同价位的分布密度",
      "卖点组合：核心卖点+辅助卖点的搭配逻辑",
      "渠道策略：线上线下占比与专属SKU",
      "用户评价：差评集中点即改进机会"
    ],
    workbenchTip: "产品调研时，对标拆解TOP3竞品，记录价格、卖点、差评三维数据。",
    tags: ["竞品分析", "市场调研"]
  },
  {
    id: "inspect-moq",
    dayOfWeek: 3,
    title: "MOQ 与库存周转",
    emoji: "📦",
    category: "supply_chain",
    summary: "起订量直接影响现金流与库存风险",
    points: [
      "MOQ 越低，试错成本越小，但单价可能偏高",
      "周转率 = 年销量 / 平均库存，目标 > 8 次/年",
      "安全库存 = 日均销量 × lead time × (1+变异系数)",
      "季节性产品需提前 30-45 天备货"
    ],
    workbenchTip: "确认新供应商时必谈 MOQ 和阶梯价，用年量换取更低单价。",
    tags: ["采购", "库存", "谈判"]
  },
  {
    id: "inspect-pricing",
    dayOfWeek: 4,
    title: "价值定价法",
    emoji: "💰",
    category: "strategy",
    summary: "用户感知价值 > 成本加成，才有溢价空间",
    points: [
      "成本加成：简单但忽略市场承受力",
      "竞争定价：跟随头部，适合标品",
      "价值定价：基于用户痛点强度定价，利润最高",
      "锚定效应：展示高价版本衬托当前性价比"
    ],
    workbenchTip: "产品定价时，先测算用户痛点强度（重要性×不满足度），再倒推价格带。",
    tags: ["定价", "利润", "商业化"]
  },
  {
    id: "inspect-risk",
    dayOfWeek: 5,
    title: "质量风险前置识别",
    emoji: "⚠️",
    category: "risk",
    summary: "在供应锁定前识别所有合规与质量红线",
    points: [
      "合规认证：CE/FCC/质检报告是否齐全有效",
      "材质安全：食品接触/母婴用品需额外检测",
      "工艺风险：新工艺的良率和一致性数据",
      "售后成本：预估返修率和客诉处理量"
    ],
    workbenchTip: "供应锁定阶段，先做质量风险评估清单，不合格项一票否决。",
    tags: ["质量管理", "合规", "风控"]
  },
  {
    id: "inspect-weekly",
    dayOfWeek: 6,
    title: "周度复盘框架",
    emoji: "📋",
    category: "strategy",
    summary: "用结构化复盘替代零散工作汇报",
    points: [
      "本周做了什么：3-5 件关键推进",
      "数据指标变化：转化率/客单价/库存周转",
      "遇到了什么问题：卡点及待决策事项",
      "下周计划：优先级排序 + 责任人和时间点"
    ],
    workbenchTip: "每周日花 30 分钟复盘：产品阶段进展 + 供应商跟进 + 风险预警。",
    tags: ["复盘", "时间管理", "效率"]
  }
];

const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function KnowledgeCalendar() {
  const today = new Date();
  const [selectedOffset, setSelectedOffset] = useState(0);

  const selectedDate = new Date(today);
  selectedDate.setDate(today.getDate() + selectedOffset);

  const selectedInsight = useMemo(() => {
    const dow = selectedDate.getDay();
    return dailyInsights.find((i) => i.dayOfWeek === dow) ?? dailyInsights[0];
  }, [selectedOffset, selectedDate]);

  const cfg = categoryConfig[selectedInsight.category];

  function prev() { setSelectedOffset((o) => o - 1); }
  function next() { setSelectedOffset((o) => o + 1); }
  function reset() { setSelectedOffset(0); }

  const dateStr = `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 · ${dayNames[selectedDate.getDay()]}`;
  const isToday = selectedOffset === 0;

  const otherInsights = dailyInsights.filter((i) => i.id !== selectedInsight.id);
  const displayInsights = otherInsights.slice(0, 4);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card transition-all">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-action-soft">
            <Calendar className="h-4 w-4 text-action" />
          </div>
          <span className="text-[11px] text-muted">供应链 · 产品思维模型</span>
        </div>
        {!isToday && (
          <button onClick={reset} className="text-[11px] text-action hover:text-action-strong transition-colors">
            回到今天
          </button>
        )}
      </div>

      {/* Date navigation - centered */}
      <div className="mb-5 flex items-center justify-center gap-4">
        <button
          onClick={prev}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-paper-warm hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center min-w-[140px]">
          <div className="text-sm font-semibold text-ink">{dateStr}</div>
          {isToday && (
            <span className="mt-0.5 inline-block rounded-full bg-action-soft px-2 py-0.5 text-[10px] font-medium text-action">
              今天
            </span>
          )}
        </div>
        <button
          onClick={next}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-paper-warm hover:text-ink"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Two-column layout: 今日洞察 (left) + 更多思维模型 (right) */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Left: Today's insight */}
        <div className="rounded-xl border border-line-soft bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted">今日洞察</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cfg.soft} ${cfg.text}`}>
              {cfg.label}
            </span>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">{selectedInsight.emoji}</span>
            <h3 className="text-base font-semibold text-ink">{selectedInsight.title}</h3>
          </div>

          <p className="mb-3 text-xs text-slate-600 leading-relaxed">{selectedInsight.summary}</p>

          <ul className="mb-3 space-y-1.5">
            {selectedInsight.points.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                <span className={`mt-1 h-1 w-1 shrink-0 rounded-full ${cfg.color}`} />
                {point}
              </li>
            ))}
          </ul>

          <div className={`rounded-lg border ${cfg.border} ${cfg.soft} p-3`}>
            <div className="mb-1 flex items-center gap-1.5">
              <Target className={`h-3.5 w-3.5 ${cfg.text}`} />
              <span className={`text-[11px] font-semibold ${cfg.text}`}>用在你的工作台</span>
            </div>
            <p className="text-xs text-ink leading-relaxed">{selectedInsight.workbenchTip}</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {selectedInsight.tags.map((tag) => (
              <span key={tag} className="rounded bg-paper-warm px-2 py-0.5 text-[10px] text-muted">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Right: More thinking models (4 items, symmetric with left) */}
        <div className="rounded-xl border border-line-soft bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-action" />
              <span className="text-[11px] font-medium text-muted">更多思维模型</span>
            </div>
          </div>
          <div className="space-y-2">
            {displayInsights.map((insight) => {
              const ic = categoryConfig[insight.category];
              return (
                <div
                  key={insight.id}
                  className="flex items-center gap-3 rounded-lg bg-paper-warm/50 px-3 py-2.5 transition-all hover:bg-paper-warm cursor-pointer"
                >
                  <span className="text-lg shrink-0">{insight.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink truncate">{insight.title}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${ic.soft} ${ic.text}`}>
                        {ic.label}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted mt-0.5">{insight.summary}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
