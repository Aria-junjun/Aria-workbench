"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ListField, SectionActions, TextField } from "@/components/workbench/edit-fields";
import {
  analyzeChatAsDraft,
  commitChatAnalysis,
  deleteLocalItem,
  updateLocalItem,
  updateSupplierRecord,
  deleteSupplierRecord,
  addManualDeduction,
  updateManualDeduction,
  deleteManualDeduction,
  type LocalSupplier,
  type LocalOffer,
  type LocalCommunication,
  type LocalTask,
  type LocalProductKnowledge,
  type ChatAnalyzeResult,
} from "@/features/workbench/local-store";
import {
  getScoreBreakdown,
  getQcdsWeights,
  type SupplierEvaluationRecord,
  type SupplierGrade,
  type DimensionBreakdown,
  type SupplierOrderRecord,
  type SupplierQualityIssue,
  type SupplierServiceEvent,
  type SupplierCostReduction,
  type ManualDeduction,
  type SupplierBusinessModel,
} from "@/features/workbench/supplier-evaluation";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import { labelSupplierType } from "@/features/workbench/display-labels";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronRight,
  ClipboardList,
  FileText,
  Link as LinkIcon,
  MapPin,
  MessageSquare,
  Minus,
  Package,
  Phone,
  Scale,
  Tag,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";

type Tab = "overview" | "rawData" | "communications" | "costReduction" | "history";

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.supplierId as string;

  const workbenchData = useWorkbenchData();
  const data = workbenchData ?? {
    suppliers: [], communications: [], offers: [], products: [],
    skuMasters: [], monthlyInboundSnapshots: [],
    tasks: [], knowledgeCards: [], knowledgeBooks: [], decisionTools: [],
    knowledgeApplications: [], decisionCases: [],
  };

  const supplier = data.suppliers.find((s) => s.id === supplierId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LocalSupplier | undefined>(supplier);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // 聊天快速评估 state
  const [showChatEval, setShowChatEval] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatPeriod, setChatPeriod] = useState(defaultPeriod());
  const [chatPreview, setChatPreview] = useState<ChatAnalyzeResult | null>(null);
  const [chatSaving, setChatSaving] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  if (!supplier) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">未找到该供应商。</p>
        <Link className="mt-3 inline-block text-action hover:underline" href="/suppliers">返回供应商列表</Link>
      </div>
    );
  }

  // 关联数据
  const offers = data.offers.filter(
    (o) => o.supplierId === supplierId || o.supplierName === supplier.name
  );
  const communications = data.communications.filter(
    (c) => c.supplierId === supplierId || c.supplierName === supplier.name
  );
  const tasks = data.tasks.filter(
    (t) => t.supplierId === supplierId || t.supplierName === supplier.name
  );
  const inboundRows = (data.monthlyInboundSnapshots ?? []).filter(
    (row) => row.supplierId === supplierId || row.supplierName === supplier.name,
  );
  const latestInboundPeriod = [...new Set(inboundRows.map((row) => row.period))].sort().at(-1);
  const latestInbound = latestInboundPeriod
    ? inboundRows.filter((row) => row.period === latestInboundPeriod)
    : [];
  const actualInboundProducts = latestInbound.reduce<Array<{ skuCode: string; productName: string; specification: string; receivedQuantity: number }>>((result, row) => {
    const sku = data.skuMasters?.find((item) => item.id === row.skuMasterId);
    if (!sku) return result;
    const existing = result.find((item) => item.skuCode === sku.internalSkuCode);
    if (existing) {
      existing.receivedQuantity += row.receivedQuantity ?? 0;
    } else {
      result.push({ skuCode: sku.internalSkuCode, productName: sku.productName, specification: sku.specification, receivedQuantity: row.receivedQuantity ?? 0 });
    }
    return result;
  }, []);
  const actualInboundTotal = actualInboundProducts.reduce((sum, item) => sum + item.receivedQuantity, 0);
  // 通过货盘桥接的产品
  const linkedProducts = offers
    .filter((o) => o.productId)
    .map((o) => ({
      offer: o,
      product: data.products.find((p) => p.id === o.productId),
    }))
    .filter((x): x is { offer: LocalOffer; product: LocalProductKnowledge } => !!x.product);

  // 评估数据
  const evaluations = supplier.evaluations ?? [];
  const latestEval = evaluations.length > 0 ? evaluations[evaluations.length - 1] : undefined;
  const businessModel = supplier.businessModel ?? "inbound";
  const manualDeductions = supplier.manualDeductions ?? [];
  const scoreBreakdown = latestEval ? getScoreBreakdown(latestEval.rawMetrics, businessModel, manualDeductions) : null;

  const typeLabel = labelSupplierType(supplier.supplierType);
  const typeColor = supplier.supplierType === "factory" ? "text-success" : supplier.supplierType === "trader" ? "text-warning" : "text-muted";

  function save() {
    if (!draft) return;
    updateLocalItem("suppliers", draft.id, draft);
    setEditing(false);
  }

  function remove() {
    if (!draft) return;
    if (!window.confirm("确认删除这个供应商吗？")) return;
    deleteLocalItem("suppliers", draft.id);
    router.push("/suppliers");
  }

  function handleAnalyzeChat() {
    if (!chatText.trim() || !supplierId) return;
    setChatError(null);
    try {
      const result = analyzeChatAsDraft({ supplierId, chatText: chatText.trim(), period: chatPeriod });
      setChatPreview(result);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "解析失败");
      setChatPreview(null);
    }
  }

  function handleCommitChat() {
    if (!chatPreview) return;
    setChatSaving(true);
    setChatError(null);
    try {
      commitChatAnalysis(chatPreview);
      setChatPreview(null);
      setChatText("");
      setShowChatEval(false);
      router.refresh();
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setChatSaving(false);
    }
  }

  const orderRecords = supplier.orderRecords ?? [];
  const qualityRecords = supplier.qualityRecords ?? [];
  const serviceRecords = supplier.serviceRecords ?? [];
  const costReductionRecords = supplier.costReductionRecords ?? [];

  return (
    <div className="space-y-6">
      {/* 返回导航 */}
      <Link className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink" href="/suppliers">
        <ChevronRight className="h-4 w-4 rotate-180" />
        供应商列表
      </Link>

      {/* 供应商名片 - 去卡片化 */}
      <section className="pb-5 border-b border-line">
        {editing && draft ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="供应商名称" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
              <TextField label="地区" value={draft.location ?? ""} onChange={(v) => setDraft({ ...draft, location: v })} />
              <TextField label="店铺链接" value={draft.storeUrl ?? ""} onChange={(v) => setDraft({ ...draft, storeUrl: v })} />
              <TextField label="来源平台" value={draft.sourcePlatform ?? ""} onChange={(v) => setDraft({ ...draft, sourcePlatform: v })} />
              <TextField label="联系方式" value={draft.contactMethod ?? ""} onChange={(v) => setDraft({ ...draft, contactMethod: v })} />
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">供应商类型</label>
                <select
                  className="w-full border border-line bg-white px-3 py-2 text-sm"
                  value={draft.supplierType ?? "unknown"}
                  onChange={(e) => setDraft({ ...draft, supplierType: e.target.value })}
                >
                  <option value="factory">工厂</option>
                  <option value="trader">贸易商</option>
                  <option value="unknown">尚未判断</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">合作模式（影响评分公式）</label>
                <select
                  className="w-full border border-line bg-white px-3 py-2 text-sm"
                  value={draft.businessModel ?? "inbound"}
                  onChange={(e) => setDraft({ ...draft, businessModel: e.target.value as "inbound" | "dropship" | "hybrid" })}
                >
                  <option value="inbound">入仓型（标准公式）</option>
                  <option value="dropship">代发型（发货时效权重高）</option>
                  <option value="hybrid">综合型（平衡权重）</option>
                </select>
              </div>
              <TextField label="联系人" value={draft.contactName ?? ""} onChange={(v) => setDraft({ ...draft, contactName: v })} />
              <TextField label="合作等级" value={draft.cooperationLevel ?? ""} onChange={(v) => setDraft({ ...draft, cooperationLevel: v })} />
            </div>
            <ListField label="主营品类" values={draft.categories} onChange={(v) => setDraft({ ...draft, categories: v })} />
            <ListField label="风险标签" values={draft.riskTags} onChange={(v) => setDraft({ ...draft, riskTags: v })} />
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">备注</label>
              <textarea
                className="w-full border border-line bg-white p-3 text-sm min-h-[80px]"
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
            <SectionActions editing={true} onEdit={() => {}} onSave={save} onCancel={() => { setEditing(false); setDraft(supplier); }} onDelete={remove} />
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex items-center gap-3">
              {latestEval && scoreBreakdown ? (
                <GradeCircle grade={scoreBreakdown.grade} score={scoreBreakdown.total} />
              ) : latestEval ? (
                <GradeCircle grade={latestEval.scores.grade} score={latestEval.scores.total} />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-line bg-paper-warm">
                  <Building2 className="h-6 w-6 text-muted-light" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold">{supplier.name}</h1>
                  <span className={`text-xs font-semibold ${typeColor}`}>{typeLabel}</span>
                  <select
                    className="text-xs px-2 py-0.5 bg-action-soft text-action rounded border-0 cursor-pointer outline-none hover:bg-action-soft/80 focus:ring-2 focus:ring-action/30"
                    value={supplier.businessModel ?? "inbound"}
                    onChange={(e) => {
                      updateLocalItem("suppliers", supplier.id, {
                        businessModel: e.target.value as "inbound" | "dropship" | "hybrid",
                      });
                    }}
                    title="切换合作模式（影响评分权重）"
                  >
                    <option value="inbound">入仓型</option>
                    <option value="dropship">代发型</option>
                    <option value="hybrid">综合型</option>
                  </select>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {supplier.categories.length > 0 ? (
                    <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{supplier.categories.join(" / ")}</span>
                  ) : null}
                  {supplier.location ? (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{supplier.location}</span>
                  ) : null}
                  {supplier.sourcePlatform ? (
                    <span className="flex items-center gap-1"><LinkIcon className="h-3 w-3" />{supplier.sourcePlatform}</span>
                  ) : null}
                  {supplier.contactName ? (
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{supplier.contactName}</span>
                  ) : null}
                  {supplier.contactMethod ? (
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{supplier.contactMethod}</span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <button className="border border-line px-4 py-2 text-sm font-medium hover:bg-paper-warm transition-colors" onClick={() => setEditing(true)} type="button">
                编辑
              </button>
              <button
                className="inline-flex items-center gap-1.5 bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90 transition-colors"
                onClick={() => setShowChatEval((v) => !v)}
                type="button"
              >
                <ClipboardList className="h-4 w-4" />
                聊天快速评估
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 聊天快速评估面板 */}
      {showChatEval ? (
        <section className="border border-line p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-action" />
              <h2 className="font-semibold">聊天快速评估</h2>
            </div>
            <button className="px-2 py-1 text-xs text-muted hover:text-ink" onClick={() => { setShowChatEval(false); setChatPreview(null); setChatError(null); }} type="button">
              收起
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">评估周期</label>
              <input className="border border-line bg-white px-3 py-1.5 text-sm w-40" value={chatPeriod} onChange={(e) => setChatPeriod(e.target.value)} placeholder="如 2026-Q3" />
            </div>
            <textarea
              className="w-full border border-line bg-white p-3 text-sm min-h-[200px] font-mono"
              placeholder={"粘贴企业微信/微信聊天记录...\n\n例如：\n7月23日 20:13 我: 这种少量的你们发不了吗？\n7月23日 20:13 供应商: 发物流太贵了\n7月23日 20:14 我: 一箱运费多少\n7月23日 20:15 供应商: 按体积算，明天让物流报过来"}
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <button className="bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90 disabled:opacity-50" disabled={!chatText.trim() || chatSaving} onClick={handleAnalyzeChat} type="button">解析预览</button>
              {chatPreview ? (
                <button className="bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/90 disabled:opacity-50" disabled={chatSaving} onClick={handleCommitChat} type="button">
                  {chatSaving ? "保存中..." : "确认保存评估"}
                </button>
              ) : null}
            </div>
            {chatError ? (
              <div className="border border-danger/30 bg-danger-soft/20 px-4 py-3 text-sm text-danger">{chatError}</div>
            ) : null}
            {chatPreview ? <ChatPreviewPanel preview={chatPreview} /> : null}
          </div>
        </section>
      ) : null}

      {/* Tab 导航 - 扁平下划线式 */}
      <div className="flex items-center gap-0 border-b border-line">
        <TabButton tab="overview" activeTab={activeTab} onClick={setActiveTab} label="评估详情" />
        <TabButton tab="rawData" activeTab={activeTab} onClick={setActiveTab} label="原始数据" count={orderRecords.length + qualityRecords.length + serviceRecords.length} />
        <TabButton tab="communications" activeTab={activeTab} onClick={setActiveTab} label="沟通记录" count={communications.length} />
        <TabButton tab="costReduction" activeTab={activeTab} onClick={setActiveTab} label="降本记录" count={costReductionRecords.length} />
        <TabButton tab="history" activeTab={activeTab} onClick={setActiveTab} label="评估历史" count={evaluations.length} />
      </div>

      {/* Tab 内容 */}
      {activeTab === "overview" ? (
        <OverviewTab
          latestEval={latestEval}
          scoreBreakdown={scoreBreakdown}
          offers={offers}
          linkedProducts={linkedProducts}
          tasks={tasks}
          actualInboundProducts={actualInboundProducts}
          actualInboundPeriod={latestInboundPeriod}
          actualInboundTotal={actualInboundTotal}
          supplierId={supplierId}
          onGoToRawData={() => setActiveTab("rawData")}
        />
      ) : null}

      {activeTab === "rawData" ? (
        <RawDataTab
          orderRecords={orderRecords}
          qualityRecords={qualityRecords}
          serviceRecords={serviceRecords}
          manualDeductions={manualDeductions}
          supplierId={supplierId}
          period={latestEval?.period}
          latestEval={latestEval}
          businessModel={businessModel}
        />
      ) : null}

      {activeTab === "communications" ? (
        <CommunicationsTab communications={communications} />
      ) : null}

      {activeTab === "costReduction" ? (
        <CostReductionTab costReductionRecords={costReductionRecords} offers={offers} />
      ) : null}

      {activeTab === "history" ? (
        <HistoryTab evaluations={evaluations} />
      ) : null}
    </div>
  );
}

// ===== Tab 按钮 - 扁平下划线 =====
function TabButton({ tab, activeTab, onClick, label, count }: {
  tab: Tab; activeTab: Tab; onClick: (t: Tab) => void; label: string; count?: number;
}) {
  return (
    <button
      className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
        activeTab === tab ? "text-ink" : "text-muted hover:text-ink"
      }`}
      onClick={() => onClick(tab)}
      type="button"
    >
      {label}
      {count != null && count > 0 ? (
        <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === tab ? "bg-action/10 text-action" : "bg-paper-warm text-muted"}`}>{count}</span>
      ) : null}
      {activeTab === tab ? (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-action" />
      ) : null}
    </button>
  );
}

// ===== Tab 1: 评估详情 =====
function OverviewTab({ latestEval, scoreBreakdown, offers, linkedProducts, tasks, actualInboundProducts, actualInboundPeriod, actualInboundTotal, supplierId, onGoToRawData }: {
  latestEval?: SupplierEvaluationRecord;
  scoreBreakdown: ReturnType<typeof getScoreBreakdown> | null;
  offers: LocalOffer[];
  linkedProducts: { offer: LocalOffer; product: LocalProductKnowledge }[];
  tasks: LocalTask[];
  actualInboundProducts: { skuCode: string; productName: string; specification: string; receivedQuantity: number }[];
  actualInboundPeriod?: string;
  actualInboundTotal: number;
  supplierId: string;
  onGoToRawData?: () => void;
}) {
  if (!latestEval || !scoreBreakdown) {
    return (
      <div className="space-y-6">
        <div className="border border-line p-8 text-center">
          <Zap className="mx-auto h-8 w-8 text-muted-light" />
          <p className="mt-2 text-sm text-muted">暂无评估数据</p>
          <p className="mt-1 text-xs text-muted-light">使用「聊天快速评估」功能，粘贴聊天记录即可自动算分</p>
        </div>
        {/* 关联资源概览 */}
        <ActualInboundOverview products={actualInboundProducts} period={actualInboundPeriod} total={actualInboundTotal} />
        <ResourceOverview offers={offers} linkedProducts={linkedProducts} tasks={tasks} supplierId={supplierId} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 综合得分 + 公式 + 4维度 - 去卡片化 */}
      <section>
        <div className="flex items-center gap-5 mb-6">
          <GradeCircle grade={scoreBreakdown.grade} score={scoreBreakdown.total} size="lg" />
          <div className="flex-1">
            <div className="text-xs text-muted">综合评分 · {Math.round(scoreBreakdown.total)}分 / {scoreBreakdown.grade}级</div>
            <div className="mt-1 text-sm text-slate-600 font-mono">{scoreBreakdown.totalFormulaText}</div>
          </div>
        </div>

        {/* 4 维度概览 - 扁平无卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 pb-6 border-b border-line">
          {scoreBreakdown.dimensions.map((dim) => (
            <DimensionHeader key={dim.dimension} dim={dim} />
          ))}
        </div>

        {/* 风险触发原因 - 扁平 */}
        {scoreBreakdown.riskTriggers.length > 0 ? (
          <div className="pt-5 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-danger mb-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              自动触发风险标签
            </div>
            <div className="space-y-1">
              {scoreBreakdown.riskTriggers.map((trigger, i) => (
                <div key={i} className="text-xs text-slate-700 flex items-center gap-2">
                  <span className="text-danger font-medium">{trigger.label}</span>
                  <span className="text-muted">| {trigger.reason}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="pt-5 pb-2 flex items-center gap-1.5 text-sm text-success">
            <AlertCircle className="h-4 w-4" />
            无风险标签
          </div>
        )}

        {/* 扣分项快速入口 */}
        <div className="pt-3 pb-2">
          <button
            className="inline-flex items-center gap-2 bg-warning-soft/20 border border-warning/30 px-4 py-2 text-sm hover:bg-warning-soft/30 transition-colors"
            onClick={onGoToRawData}
            type="button"
          >
            <ClipboardList className="h-4 w-4 text-warning" />
            查看扣分项详情并调整
            <span className="text-xs text-muted">→</span>
          </button>
        </div>

        {latestEval.note ? (
          <p className="mt-3 text-xs text-muted whitespace-pre-wrap">{latestEval.note}</p>
        ) : null}
      </section>

      {/* 4 维度详细公式 - 默认全部展开，无折叠 */}
      <div className="space-y-6">
        {scoreBreakdown.dimensions.map((dim) => (
          <DimensionDetail key={dim.dimension} dim={dim} />
        ))}
      </div>

      {/* 关联资源概览 */}
      <ActualInboundOverview products={actualInboundProducts} period={actualInboundPeriod} total={actualInboundTotal} />
      <ResourceOverview offers={offers} linkedProducts={linkedProducts} tasks={tasks} supplierId={supplierId} />
    </div>
  );
}

// 4维度头部 - 扁平
function DimensionHeader({ dim }: { dim: DimensionBreakdown }) {
  const colorMap: Record<string, string> = {
    delivery: "text-action",
    cost: "text-warning",
    quality: "text-success",
    service: "text-muted",
  };
  return (
    <div>
      <div className="text-[11px] text-muted">{dim.label} · 权重 {Math.round(dim.weight * 100)}%</div>
      <div className={`mt-1 text-3xl font-bold ${colorMap[dim.dimension]}`}>{Math.round(dim.score)}</div>
      <div className="mt-2 h-1 bg-paper-warm overflow-hidden">
        <div className={`h-full ${colorMap[dim.dimension].replace("text-", "bg-")}`} style={{ width: `${Math.min(100, dim.score)}%` }} />
      </div>
    </div>
  );
}

// 维度详情 - 默认全部展开（无折叠）
function DimensionDetail({ dim }: { dim: DimensionBreakdown }) {
  const scoreColor = dim.score >= 85 ? "text-success" : dim.score >= 70 ? "text-action" : dim.score >= 60 ? "text-warning" : "text-danger";

  return (
    <section className="border-b border-line pb-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-base font-semibold">{dim.label}</span>
        <span className="text-xs text-muted">权重 {Math.round(dim.weight * 100)}%</span>
        <span className={`text-2xl font-bold ${scoreColor} ml-auto`}>{Math.round(dim.score)}</span>
      </div>

      {/* 子指标列表 - 扁平表格感 */}
      <div className="space-y-0 mb-3">
        {dim.subMetrics.map((sub, idx) => (
          <div key={sub.key} className={`flex items-start gap-4 py-2.5 ${idx < dim.subMetrics.length - 1 ? "border-b border-line-soft" : ""}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{sub.label}</span>
                <span className="text-[10px] text-muted">权重 {Math.round(sub.weight * 100)}%</span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-2 flex-wrap">
                <span className="text-base font-semibold">{sub.displayValue}</span>
                <span className="text-[10px] text-muted font-mono">= {sub.formula}</span>
              </div>
              <div className="text-[10px] text-muted-light mt-0.5">← {sub.source}</div>
            </div>
            <div className="text-right shrink-0 pt-1">
              <div className="text-[10px] text-muted">贡献</div>
              <div className="text-sm font-semibold text-slate-700">{Math.round(sub.weightedScore)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 text-xs font-mono text-slate-600 bg-paper-warm/60">
        {dim.formulaText}
      </div>
    </section>
  );
}

// ===== Tab 2: 原始数据 - 带原文依据和手动调整 =====
function RawDataTab({ orderRecords, qualityRecords, serviceRecords, manualDeductions, supplierId, period, latestEval, businessModel = "inbound" }: {
  orderRecords: SupplierOrderRecord[];
  qualityRecords: SupplierQualityIssue[];
  serviceRecords: SupplierServiceEvent[];
  manualDeductions: ManualDeduction[];
  supplierId: string;
  period?: string;
  latestEval?: SupplierEvaluationRecord;
  businessModel?: SupplierBusinessModel;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingPatch, setEditingPatch] = useState<Record<string, any>>({});
  const [showAddDeduction, setShowAddDeduction] = useState(false);
  const [newDeduction, setNewDeduction] = useState({ dimension: "service" as ManualDeduction["dimension"], type: "deduction" as ManualDeduction["type"], description: "", points: 5 });
  const [editingDeductionId, setEditingDeductionId] = useState<string | null>(null);
  const [editingDeductionPoints, setEditingDeductionPoints] = useState(5);
  const [ignoreReason, setIgnoreReason] = useState<Record<string, string>>({});

  function handleSave(type: "order" | "quality" | "service", id: string) {
    const patch = editingPatch[id];
    if (!patch) return;
    try {
      updateSupplierRecord(supplierId, type, id, patch, period);
      setEditingPatch((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setExpandedId(null);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("保存失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function handleIgnore(type: "order" | "quality" | "service", id: string) {
    const reason = ignoreReason[id];
    if (!reason) {
      const input = window.prompt("请输入忽略原因（如：AI识别错误、数据异常）：");
      if (!input) return;
      setIgnoreReason((prev) => ({ ...prev, [id]: input }));
    }
    try {
      updateSupplierRecord(supplierId, type, id, { ignored: true, ignoreReason: reason || ignoreReason[id] }, period);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("忽略失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function handleUnignore(type: "order" | "quality" | "service", id: string) {
    try {
      updateSupplierRecord(supplierId, type, id, { ignored: false, ignoreReason: undefined }, period);
      setIgnoreReason((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("恢复失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function handleDelete(type: "order" | "quality" | "service", id: string) {
    if (!window.confirm("确认删除这条记录？删除后会自动重新算分。")) return;
    try {
      deleteSupplierRecord(supplierId, type, id, period);
      setExpandedId(null);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("删除失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function handleToggleDeduction(deductionId: string, currentlyIgnored: boolean) {
    try {
      updateManualDeduction(supplierId, deductionId, { ignored: !currentlyIgnored }, period);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("操作失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function handleDeleteDeduction(deductionId: string) {
    if (!window.confirm("确认删除这条记录？删除后对应维度分数会恢复。")) return;
    try {
      deleteManualDeduction(supplierId, deductionId, period);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("删除失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function handleSaveDeductionPoints(deductionId: string) {
    try {
      updateManualDeduction(supplierId, deductionId, { points: Math.abs(editingDeductionPoints) }, period);
      setEditingDeductionId(null);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("保存失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function handleAddDeduction2() {
    if (!newDeduction.description.trim()) {
      alert("请填写描述");
      return;
    }
    try {
      addManualDeduction(supplierId, newDeduction, period);
      setNewDeduction({ dimension: "service", type: "deduction", description: "", points: 5 });
      setShowAddDeduction(false);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("添加失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // 分离有效记录和已忽略记录
  const activeOrders = orderRecords.filter((o) => !o.ignored);
  const ignoredOrders = orderRecords.filter((o) => o.ignored);
  const activeQuality = qualityRecords.filter((q) => !q.ignored);
  const ignoredQuality = qualityRecords.filter((q) => q.ignored);
  const activeService = serviceRecords.filter((s) => !s.ignored);
  const ignoredService = serviceRecords.filter((s) => s.ignored);

  // 扣分项分析
  const deductionAnalysis = analyzeDeductions(
    activeOrders as SupplierOrderRecord[],
    activeQuality as SupplierQualityIssue[],
    activeService as SupplierServiceEvent[]
  );

  // 手动扣分项
  const activeManualDeductions = manualDeductions.filter((d) => !d.ignored);
  const hasNoIssues = deductionAnalysis.deductions.length === 0 && activeManualDeductions.length === 0;

  if (orderRecords.length === 0 && qualityRecords.length === 0 && serviceRecords.length === 0 && manualDeductions.length === 0) {
    return <EmptyTabContent label="暂无原始数据" tip="通过「聊天快速评估」或手动录入添加订单、质量、服务记录" />;
  }

  return (
    <div className="space-y-8">
      {/* 评分公式总览：满分100 - 扣分项 = 最终得分 */}
      <ScoreFormulaPanel
        latestEval={latestEval}
        autoDeductions={deductionAnalysis.deductions}
        manualDeductions={activeManualDeductions}
        hasNoIssues={hasNoIssues}
        businessModel={businessModel}
      />

      {/* 添加手动评分项 */}
      <section className="border border-line p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">手动添加评分项</span>
          </div>
          <button
            className="text-xs bg-action text-white px-3 py-1.5 hover:opacity-80"
            onClick={() => setShowAddDeduction(!showAddDeduction)}
            type="button"
          >
            {showAddDeduction ? "收起" : "+ 添加评分"}
          </button>
        </div>
        {showAddDeduction ? (
          <div className="space-y-3 bg-paper-warm/50 p-3">
            {/* 类型切换 */}
            <div className="flex gap-2">
              <button
                className={`flex-1 px-3 py-2 text-sm border ${newDeduction.type === "deduction" ? "border-danger bg-danger-soft/20 text-danger" : "border-line text-muted"}`}
                onClick={() => setNewDeduction({ ...newDeduction, type: "deduction" })}
                type="button"
              >
                ➖ 扣分
              </button>
              <button
                className={`flex-1 px-3 py-2 text-sm border ${newDeduction.type === "bonus" ? "border-success bg-success-soft/20 text-success" : "border-line text-muted"}`}
                onClick={() => setNewDeduction({ ...newDeduction, type: "bonus" })}
                type="button"
              >
                ➕ 加分
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">{newDeduction.type === "bonus" ? "加分维度" : "扣分维度"}</label>
                <select
                  className="w-full border border-line px-2 py-1.5 text-sm"
                  value={newDeduction.dimension}
                  onChange={(e) => setNewDeduction({ ...newDeduction, dimension: e.target.value as ManualDeduction["dimension"] })}
                >
                  <option value="delivery">交付</option>
                  <option value="cost">成本</option>
                  <option value="quality">质量</option>
                  <option value="service">服务</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">{newDeduction.type === "bonus" ? "加分分值" : "扣分分值"}</label>
                <input
                  type="number"
                  className="w-full border border-line px-2 py-1.5 text-sm"
                  value={newDeduction.points}
                  onChange={(e) => setNewDeduction({ ...newDeduction, points: Number(e.target.value) })}
                  min={1}
                  max={30}
                />
              </div>
              <div className="flex items-end">
                <button
                  className={`text-white px-4 py-1.5 text-sm hover:opacity-80 ${newDeduction.type === "bonus" ? "bg-success" : "bg-danger"}`}
                  onClick={handleAddDeduction2}
                  type="button"
                >
                  确认{newDeduction.type === "bonus" ? "加分" : "扣分"}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">
                {newDeduction.type === "bonus"
                  ? "加分描述（如：税点低、账期长、订货灵活等超出预期表现）"
                  : "扣分描述（如：少量补货，供应商拒绝发货，无解决方案）"}
              </label>
              <textarea
                className="w-full border border-line px-2 py-1.5 text-sm"
                rows={2}
                placeholder="描述具体情况..."
                value={newDeduction.description}
                onChange={(e) => setNewDeduction({ ...newDeduction, description: e.target.value })}
              />
            </div>
            <div className="text-xs text-muted bg-paper-warm p-2">
              💡 加分项会让该维度分数溢出（上限120分），扣分项从对应维度扣除
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted">
            如果供应商有超出预期的表现（如税点低、账期长）或未识别到的问题，可手动添加评分项。加分可使对应维度溢出上限120分。
          </div>
        )}
      </section>

      {/* 手动评分项列表 */}
      {manualDeductions.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold mb-3">手动评分项（{manualDeductions.length}）</h3>
          <div className="space-y-2">
            {manualDeductions.map((d) => {
              const isBonus = d.type === "bonus";
              return (
                <div
                  key={d.id}
                  className={`flex items-start gap-3 p-3 border ${
                    d.ignored
                      ? "border-line-soft opacity-50"
                      : isBonus
                      ? "border-success/30 bg-success-soft/5"
                      : "border-danger/30 bg-danger-soft/5"
                  }`}
                >
                  <span
                    className={`text-[10px] shrink-0 px-1.5 py-0.5 font-medium ${
                      isBonus ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                    }`}
                  >
                    {d.dimension === "delivery"
                      ? "交付"
                      : d.dimension === "cost"
                      ? "成本"
                      : d.dimension === "quality"
                      ? "质量"
                      : "服务"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-700">{d.description}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {isBonus ? "加" : "扣"} {d.points} 分 · {isBonus ? "加分项" : "扣分项"} · {d.source === "manual" ? "手动添加" : "AI建议"}
                      {d.ignored ? " · 已忽略" : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {editingDeductionId === d.id ? (
                      <div className="flex items-center gap-1 mr-2">
                        <input
                          type="number"
                          className="w-16 border border-line px-2 py-1 text-sm text-right"
                          value={editingDeductionPoints}
                          onChange={(e) => setEditingDeductionPoints(Number(e.target.value))}
                          min={1}
                          max={30}
                          autoFocus
                        />
                        <button
                          className="text-xs text-action hover:underline"
                          onClick={() => handleSaveDeductionPoints(d.id)}
                          type="button"
                        >
                          保存
                        </button>
                        <button
                          className="text-xs text-muted hover:underline"
                          onClick={() => setEditingDeductionId(null)}
                          type="button"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          className={`text-sm font-medium mr-3 ${
                            isBonus ? "text-success" : "text-danger"
                          }`}
                        >
                          {isBonus ? "+" : "-"}
                          {d.points}
                        </span>
                        <button
                          className="text-xs text-action hover:underline mr-2"
                          onClick={() => {
                            setEditingDeductionId(d.id);
                            setEditingDeductionPoints(d.points);
                          }}
                          type="button"
                          title="修改分值"
                        >
                          编辑
                        </button>
                        <button
                          className="text-xs text-action hover:underline mr-2"
                          onClick={() => handleToggleDeduction(d.id, !!d.ignored)}
                          type="button"
                        >
                          {d.ignored ? "恢复" : "忽略"}
                        </button>
                        <button
                          className="text-xs text-danger hover:underline"
                          onClick={() => handleDeleteDeduction(d.id)}
                          type="button"
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 已忽略记录提醒 */}
      {(ignoredOrders.length > 0 || ignoredQuality.length > 0 || ignoredService.length > 0) ? (
        <section className="border border-warning/30 bg-warning-soft/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-warning">已忽略 {ignoredOrders.length + ignoredQuality.length + ignoredService.length} 条记录（不计入评分）</span>
          </div>
          <div className="space-y-1 text-xs">
            {ignoredOrders.map((o) => (
              <div key={o.id} className="flex items-center gap-2 text-slate-600">
                <span className="text-muted">订单</span>
                <span>{o.productName || "—"} · {o.ignoreReason || "无原因"}</span>
                <button className="ml-auto text-action hover:underline" onClick={() => handleUnignore("order", o.id)}>恢复</button>
              </div>
            ))}
            {ignoredQuality.map((q) => (
              <div key={q.id} className="flex items-center gap-2 text-slate-600">
                <span className="text-muted">质量</span>
                <span>{q.issueDescription || "—"} · {q.ignoreReason || "无原因"}</span>
                <button className="ml-auto text-action hover:underline" onClick={() => handleUnignore("quality", q.id)}>恢复</button>
              </div>
            ))}
            {ignoredService.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-slate-600">
                <span className="text-muted">服务</span>
                <span>{s.content.slice(0, 30)} · {s.ignoreReason || "无原因"}</span>
                <button className="ml-auto text-action hover:underline" onClick={() => handleUnignore("service", s.id)}>恢复</button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 订单记录 */}
      {activeOrders.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold mb-3">订单记录（{activeOrders.length}）</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-4 text-left font-medium">产品</th>
                  <th className="py-2 px-4 text-right font-medium">下单量</th>
                  <th className="py-2 px-4 text-right font-medium">到货量</th>
                  <th className="py-2 px-4 text-left font-medium">承诺交期</th>
                  <th className="py-2 px-4 text-left font-medium">实际到货</th>
                  <th className="py-2 px-4 text-center font-medium">旺季</th>
                  <th className="py-2 pl-4 text-left font-medium">状态</th>
                  <th className="py-2 pl-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((o, i) => (
                  <>
                    <tr key={o.id} className="border-b border-line-soft">
                      <td className="py-2 pr-4">{o.productName || "—"}</td>
                      <td className="py-2 px-4 text-right">{o.orderQuantity ?? "—"}</td>
                      <td className="py-2 px-4 text-right">{o.deliveredQuantity ?? "—"}</td>
                      <td className="py-2 px-4">{o.promisedDeliveryAt ?? "—"}</td>
                      <td className="py-2 px-4">{o.actualDeliveryAt ?? "—"}</td>
                      <td className="py-2 px-4 text-center">{o.isPeak ? "🔥" : ""}</td>
                      <td className="py-2 pl-4">{o.status ?? "—"}</td>
                      <td className="py-2 pl-2 text-right shrink-0">
                        <button
                          className="text-xs text-action hover:underline mr-2"
                          onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                        >
                          {expandedId === o.id ? "收起" : "详情/编辑"}
                        </button>
                        <button
                          className="text-xs text-warning hover:underline mr-2"
                          onClick={() => handleIgnore("order", o.id)}
                        >
                          忽略
                        </button>
                        <button
                          className="text-xs text-danger hover:underline"
                          onClick={() => handleDelete("order", o.id)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                    {expandedId === o.id ? (
                      <tr className="bg-paper-warm/40">
                        <td colSpan={8} className="px-4 py-3">
                          <OrderRecordEditor
                            record={o}
                            value={editingPatch[o.id] ?? {}}
                            onChange={(patch) => setEditingPatch((prev) => ({ ...prev, [o.id]: patch }))}
                            onSave={() => handleSave("order", o.id)}
                            onReset={() => {
                              setEditingPatch((prev) => {
                                const next = { ...prev };
                                delete next[o.id];
                                return next;
                              });
                              setExpandedId(null);
                            }}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* 质量问题 */}
      {activeQuality.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold mb-3">质量问题（{activeQuality.length}）</h3>
          <div className="space-y-0">
            {activeQuality.map((q, i) => (
              <>
                <div key={q.id} className={`flex items-start gap-3 py-2.5 ${expandedId === q.id ? "" : i < activeQuality.length - 1 ? "border-b border-line-soft" : ""}`}>
                  <div className="flex-1">
                    <div className="text-sm">{q.issueDescription || "质量问题"}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {q.reportedAt ?? "—"} · {q.issueCount}件
                      {q.isClosed ? " · 已关闭" : " · 未关闭"}
                      {q.repeated ? " · 重复发生" : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <button
                      className="text-xs text-action hover:underline mr-2"
                      onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                    >
                      {expandedId === q.id ? "收起" : "详情/编辑"}
                    </button>
                    <button
                      className="text-xs text-warning hover:underline mr-2"
                      onClick={() => handleIgnore("quality", q.id)}
                    >
                      忽略
                    </button>
                    <button
                      className="text-xs text-danger hover:underline"
                      onClick={() => handleDelete("quality", q.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
                {expandedId === q.id ? (
                  <div className="bg-paper-warm/40 px-4 py-3 text-xs mb-2">
                    <QualityRecordEditor
                      record={q}
                      value={editingPatch[q.id] ?? {}}
                      onChange={(patch) => setEditingPatch((prev) => ({ ...prev, [q.id]: patch }))}
                      onSave={() => handleSave("quality", q.id)}
                      onReset={() => {
                        setEditingPatch((prev) => {
                          const next = { ...prev };
                          delete next[q.id];
                          return next;
                        });
                        setExpandedId(null);
                      }}
                    />
                  </div>
                ) : null}
              </>
            ))}
          </div>
        </section>
      ) : null}

      {/* 服务事件 */}
      {activeService.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold mb-3">服务事件（{activeService.length}）</h3>
          <div className="space-y-0">
            {activeService.map((s, i) => (
              <>
                <div key={s.id} className={`flex items-start gap-3 py-2.5 ${expandedId === s.id ? "" : i < activeService.length - 1 ? "border-b border-line-soft" : ""}`}>
                  <span className="text-[10px] text-muted shrink-0 mt-0.5 w-12">
                    {s.type === "promise" ? "承诺" :
                     s.type === "price_change" ? "价格变动" :
                     s.type === "response" ? "响应" :
                     s.type === "attitude" ? "态度" :
                     s.type === "solution_proposal" ? "提方案" :
                     s.type === "solution_fulfilled" ? "兑方案" :
                     s.type === "evasion" ? "推诿" : "配合度"}
                  </span>
                  <div className="flex-1 text-sm">{s.content}</div>
                  <div className="text-right shrink-0">
                    {s.responseHours != null ? <span className="text-xs text-muted mr-3">{s.responseHours}h</span> : null}
                    <button
                      className="text-xs text-action hover:underline mr-2"
                      onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    >
                      {expandedId === s.id ? "收起" : "详情/编辑"}
                    </button>
                    <button
                      className="text-xs text-warning hover:underline mr-2"
                      onClick={() => handleIgnore("service", s.id)}
                    >
                      忽略
                    </button>
                    <button
                      className="text-xs text-danger hover:underline"
                      onClick={() => handleDelete("service", s.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
                {expandedId === s.id ? (
                  <div className="bg-paper-warm/40 px-4 py-3 text-xs mb-2">
                    <ServiceRecordEditor
                      record={s}
                      value={editingPatch[s.id] ?? {}}
                      onChange={(patch) => setEditingPatch((prev) => ({ ...prev, [s.id]: patch }))}
                      onSave={() => handleSave("service", s.id)}
                      onReset={() => {
                        setEditingPatch((prev) => {
                          const next = { ...prev };
                          delete next[s.id];
                          return next;
                        });
                        setExpandedId(null);
                      }}
                    />
                  </div>
                ) : null}
              </>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// ===== 订单记录编辑器 =====
function OrderRecordEditor({ record, value, onChange, onSave, onReset }: {
  record: SupplierOrderRecord;
  value: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const patch = { ...record, ...value };
  const isDirty = Object.keys(value).length > 0;
  return (
    <div className="space-y-3">
      {record.source === "chat_parse" ? (
        <div className="border border-amber-200 bg-amber-50 p-2 rounded">
          <div className="text-[10px] font-medium text-amber-700 mb-1">💡 AI 识别原文依据</div>
          <div className="text-xs text-amber-900 font-mono whitespace-pre-wrap">
            {record.sourceLineIndex != null ? `[聊天第 ${record.sourceLineIndex} 行] ` : ""}
            来自聊天记录解析。如信息有误，请在下方修改。
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] text-muted mb-0.5">产品名称</label>
          <input className="w-full border border-line px-2 py-1 text-xs" value={patch.productName ?? ""}
            onChange={(e) => onChange({ ...value, productName: e.target.value })} />
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">下单量</label>
          <input type="number" className="w-full border border-line px-2 py-1 text-xs" value={patch.orderQuantity ?? ""}
            onChange={(e) => onChange({ ...value, orderQuantity: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">到货量</label>
          <input type="number" className="w-full border border-line px-2 py-1 text-xs" value={patch.deliveredQuantity ?? ""}
            onChange={(e) => onChange({ ...value, deliveredQuantity: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">是否旺季</label>
          <select className="w-full border border-line px-2 py-1 text-xs" value={patch.isPeak ? "true" : "false"}
            onChange={(e) => onChange({ ...value, isPeak: e.target.value === "true" })}>
            <option value="false">否</option>
            <option value="true">是</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">下单日期</label>
          <input type="date" className="w-full border border-line px-2 py-1 text-xs" value={patch.orderedAt ?? ""}
            onChange={(e) => onChange({ ...value, orderedAt: e.target.value || undefined })} />
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">承诺交期</label>
          <input type="date" className="w-full border border-line px-2 py-1 text-xs" value={patch.promisedDeliveryAt ?? ""}
            onChange={(e) => onChange({ ...value, promisedDeliveryAt: e.target.value || undefined })} />
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">实际到货</label>
          <input type="date" className="w-full border border-line px-2 py-1 text-xs" value={patch.actualDeliveryAt ?? ""}
            onChange={(e) => onChange({ ...value, actualDeliveryAt: e.target.value || undefined })} />
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">订单状态</label>
          <select className="w-full border border-line px-2 py-1 text-xs" value={patch.status ?? ""}
            onChange={(e) => onChange({ ...value, status: e.target.value || undefined })}>
            <option value="">—</option>
            <option value="pending">待发货</option>
            <option value="fulfilled">已完成</option>
            <option value="partial">部分发货</option>
            <option value="overdue">已逾期</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          className={`px-3 py-1 text-xs rounded ${isDirty ? "bg-action text-white" : "bg-line text-muted"}`}
          onClick={onSave}
          disabled={!isDirty}
        >
          保存修改并重算评估
        </button>
        <button className="px-3 py-1 text-xs text-muted hover:text-ink" onClick={onReset}>
          取消
        </button>
      </div>
    </div>
  );
}

// ===== 质量记录编辑器 =====
function QualityRecordEditor({ record, value, onChange, onSave, onReset }: {
  record: SupplierQualityIssue;
  value: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const patch = { ...record, ...value };
  const isDirty = Object.keys(value).length > 0;
  return (
    <div className="space-y-3">
      {record.source === "chat_parse" ? (
        <div className="border border-amber-200 bg-amber-50 p-2 rounded">
          <div className="text-[10px] font-medium text-amber-700 mb-1">💡 AI 识别原文依据</div>
          <div className="text-xs text-amber-900 font-mono whitespace-pre-wrap">
            来自聊天记录解析。如信息有误，请在下方修改。
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[10px] text-muted mb-0.5">问题描述</label>
          <input className="w-full border border-line px-2 py-1 text-xs" value={patch.issueDescription ?? ""}
            onChange={(e) => onChange({ ...value, issueDescription: e.target.value })} />
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">问题数量</label>
          <input type="number" className="w-full border border-line px-2 py-1 text-xs" value={patch.issueCount ?? ""}
            onChange={(e) => onChange({ ...value, issueCount: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">是否已关闭</label>
          <select className="w-full border border-line px-2 py-1 text-xs" value={patch.isClosed ? "true" : "false"}
            onChange={(e) => onChange({ ...value, isClosed: e.target.value === "true" })}>
            <option value="false">未关闭</option>
            <option value="true">已关闭</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">是否重复发生</label>
          <select className="w-full border border-line px-2 py-1 text-xs" value={patch.repeated ? "true" : "false"}
            onChange={(e) => onChange({ ...value, repeated: e.target.value === "true" })}>
            <option value="false">否</option>
            <option value="true">是</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">是否客户退货/投诉</label>
          <select className="w-full border border-line px-2 py-1 text-xs" value={patch.isCustomerReturn ? "true" : "false"}
            onChange={(e) => onChange({ ...value, isCustomerReturn: e.target.value === "true" })}>
            <option value="false">否（来料问题）</option>
            <option value="true">是（客退/投诉）</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          className={`px-3 py-1 text-xs rounded ${isDirty ? "bg-action text-white" : "bg-line text-muted"}`}
          onClick={onSave}
          disabled={!isDirty}
        >
          保存修改并重算评估
        </button>
        <button className="px-3 py-1 text-xs text-muted hover:text-ink" onClick={onReset}>
          取消
        </button>
      </div>
    </div>
  );
}

// ===== 服务记录编辑器 =====
function ServiceRecordEditor({ record, value, onChange, onSave, onReset }: {
  record: SupplierServiceEvent;
  value: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const patch = { ...record, ...value };
  const isDirty = Object.keys(value).length > 0;
  return (
    <div className="space-y-3">
      {record.sourceLineText ? (
        <div className="border border-amber-200 bg-amber-50 p-2 rounded">
          <div className="text-[10px] font-medium text-amber-700 mb-1">💡 AI 识别原文依据</div>
          <div className="text-xs text-amber-900 font-mono whitespace-pre-wrap">"{record.sourceLineText}"</div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[10px] text-muted mb-0.5">事件内容</label>
          <input className="w-full border border-line px-2 py-1 text-xs" value={patch.content ?? ""}
            onChange={(e) => onChange({ ...value, content: e.target.value })} />
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">事件类型</label>
          <select className="w-full border border-line px-2 py-1 text-xs" value={patch.type ?? ""}
            onChange={(e) => onChange({ ...value, type: e.target.value })}>
            <option value="promise">承诺</option>
            <option value="response">响应</option>
            <option value="attitude">态度</option>
            <option value="solution_proposal">提方案</option>
            <option value="solution_fulfilled">兑方案</option>
            <option value="evasion">推诿</option>
            <option value="price_change">价格变动</option>
            <option value="cooperation_rating">配合度</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-0.5">响应时长(小时)</label>
          <input type="number" className="w-full border border-line px-2 py-1 text-xs" value={patch.responseHours ?? ""}
            onChange={(e) => onChange({ ...value, responseHours: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        {patch.type === "attitude" || (patch.attitudeScore != null) ? (
          <div>
            <label className="block text-[10px] text-muted mb-0.5">态度评分(1-5)</label>
            <input type="number" min={1} max={5} className="w-full border border-line px-2 py-1 text-xs" value={patch.attitudeScore ?? ""}
              onChange={(e) => onChange({ ...value, attitudeScore: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
        ) : null}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          className={`px-3 py-1 text-xs rounded ${isDirty ? "bg-action text-white" : "bg-line text-muted"}`}
          onClick={onSave}
          disabled={!isDirty}
        >
          保存修改并重算评估
        </button>
        <button className="px-3 py-1 text-xs text-muted hover:text-ink" onClick={onReset}>
          取消
        </button>
      </div>
    </div>
  );
}

// ===== 扣分项分析类型 =====
type DeductionItem = {
  category: "delivery" | "quality" | "service";
  label: string;
  reason: string;
  severity: "low" | "medium" | "high";
  impact: string;
  recordId?: string;
};

type DeductionAnalysis = {
  deductions: DeductionItem[];
  summary: {
    deliveryCount: number;
    qualityCount: number;
    serviceCount: number;
    totalImpact: string;
  };
};

// ===== 扣分项分析面板 =====
// ===== 评分公式总览面板：满分100 - 扣分项 = 最终得分 =====
function ScoreFormulaPanel({ latestEval, autoDeductions, manualDeductions, hasNoIssues, businessModel = "inbound" }: {
  latestEval?: SupplierEvaluationRecord;
  autoDeductions: DeductionItem[];
  manualDeductions: ManualDeduction[];
  hasNoIssues: boolean;
  businessModel?: SupplierBusinessModel;
}) {
  const scores = latestEval?.scores;
  const w = getQcdsWeights(businessModel);
  const weightPct = (v: number) => `${Math.round(v * 100)}%`;
  const dims = [
    { key: "delivery", label: "交付", score: scores?.delivery, weight: w.delivery },
    { key: "cost", label: "成本", score: scores?.cost, weight: w.cost },
    { key: "quality", label: "质量", score: scores?.quality, weight: w.quality },
    { key: "service", label: "服务", score: scores?.service, weight: w.service },
  ];
  const modelLabel =
    businessModel === "dropship" ? "代发型权重" :
    businessModel === "hybrid" ? "混合型权重" : "入仓型权重";

  return (
    <section className="border border-line bg-paper-warm/30 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Scale className="h-4 w-4 text-action" />
        <span className="text-sm font-semibold">评分公式总览</span>
        <span className="text-xs text-muted">默认满分100 · 有异常才扣分 · {modelLabel}</span>
      </div>

      {/* 四维度评分展示 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {dims.map((dim) => {
          const isFull = dim.score != null && dim.score >= 95;
          const isLow = dim.score != null && dim.score < 70;
          const autoCount = autoDeductions.filter((d) => d.category === dim.key).length;
          const manualCount = manualDeductions.filter((d) => d.dimension === dim.key).length;
          const bonusCount = manualDeductions.filter((d) => d.dimension === dim.key && d.type === "bonus" && !d.ignored).length;
          return (
            <div key={dim.key} className={`border p-3 ${isFull ? "border-success/30 bg-success-soft/5" : isLow ? "border-danger/30 bg-danger-soft/5" : "border-line"}`}>
              <div className="text-xs text-muted">{dim.label}（权重{weightPct(dim.weight)}）</div>
              <div className={`text-2xl font-bold mt-1 ${isFull ? "text-success" : isLow ? "text-danger" : "text-slate-700"}`}>
                {dim.score != null ? Math.round(dim.score) : "—"}
              </div>
              <div className="text-[10px] text-muted mt-1">
                {bonusCount > 0 ? `${bonusCount}项加分 · ` : ""}
                {autoCount + manualCount > 0 ? `${autoCount + manualCount}项调整` : "无异常·满分"}
              </div>
            </div>
          );
        })}
      </div>

      {/* 总分公式 */}
      <div className="bg-white border border-line p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">总分公式</span>
          <span className="text-xs text-muted">
            交付×{weightPct(w.delivery)} + 成本×{weightPct(w.cost)} + 质量×{weightPct(w.quality)} + 服务×{weightPct(w.service)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-semibold">
            总分：{scores?.total != null ? Math.round(scores.total) : "—"} 分
          </span>
          <span className={`text-lg font-bold ${scores?.grade === "A" ? "text-success" : scores?.grade === "D" ? "text-danger" : "text-slate-700"}`}>
            {scores?.grade ?? "—"}
          </span>
        </div>
      </div>

      {/* 无异常提示 */}
      {hasNoIssues ? (
        <div className="mt-3 p-2 bg-success-soft/10 border border-success/20 text-xs text-success flex items-center gap-2">
          <AlertCircle className="h-3 w-3" />
          当前无任何扣分项，各维度按满分核算。如发现供应商有异常但AI未识别，可手动添加扣分项。
        </div>
      ) : null}
    </section>
  );
}

function DeductionAnalysisPanel({ analysis }: { analysis: DeductionAnalysis }) {
  if (analysis.deductions.length === 0) {
    return (
      <section className="border border-success/30 bg-success-soft/10 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-success" />
          <span className="text-sm font-medium text-success">暂无异常记录，所有记录均正常计入评分</span>
        </div>
        <div className="mt-2 text-xs text-muted">
          如发现异常数据，可点击「忽略」按钮标记，系统将按标准值重新核算
        </div>
      </section>
    );
  }

  return (
    <section className="border border-line p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <span className="text-sm font-semibold">扣分项分析</span>
        <span className="text-xs text-muted">（共 {analysis.deductions.length} 项异常）</span>
      </div>
      
      {/* 扣分项列表 */}
      <div className="space-y-2">
        {analysis.deductions.slice(0, 8).map((item, idx) => (
          <div key={idx} className={`flex items-start gap-2 p-2 text-xs ${
            item.severity === "high" ? "bg-danger-soft/10 border-l-2 border-danger" :
            item.severity === "medium" ? "bg-warning-soft/10 border-l-2 border-warning" :
            "bg-paper-warm border-l-2 border-line"
          }`}>
            <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium ${
              item.category === "delivery" ? "bg-action/20 text-action" :
              item.category === "quality" ? "bg-success/20 text-success" :
              "bg-muted/20 text-muted"
            }`}>
              {item.category === "delivery" ? "交付" : item.category === "quality" ? "质量" : "服务"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-700">{item.label}</div>
              <div className="text-muted mt-0.5">{item.reason}</div>
              <div className="text-danger mt-0.5">影响：{item.impact}</div>
            </div>
          </div>
        ))}
        {analysis.deductions.length > 8 ? (
          <div className="text-xs text-muted text-center">... 还有 {analysis.deductions.length - 8} 项，详情见下方记录</div>
        ) : null}
      </div>

      {/* 汇总 */}
      <div className="mt-3 pt-3 border-t border-line text-xs text-muted">
        <div className="flex items-center gap-4">
          <span>交付异常 {analysis.summary.deliveryCount} 项</span>
          <span>质量异常 {analysis.summary.qualityCount} 项</span>
          <span>服务异常 {analysis.summary.serviceCount} 项</span>
          <span className="text-danger font-medium ml-auto">{analysis.summary.totalImpact}</span>
        </div>
      </div>

      {/* 操作提示 */}
      <div className="mt-3 pt-3 border-t border-line-soft text-xs bg-paper-warm/50 p-2">
        💡 提示：如果识别有误，可点击记录旁的「忽略」按钮，忽略后该记录按标准值核算，不再计入扣分项
      </div>
    </section>
  );
}

// ===== 扣分项分析函数 =====
function analyzeDeductions(
  orders: SupplierOrderRecord[],
  qualityIssues: SupplierQualityIssue[],
  serviceEvents: SupplierServiceEvent[]
): DeductionAnalysis {
  const deductions: DeductionItem[] = [];

  // 交付扣分项
  for (const o of orders) {
    if (!o.orderedAt || !o.actualDeliveryAt) continue;
    const promised = o.promisedDeliveryAt;
    if (!promised) continue;
    
    const actual = new Date(o.actualDeliveryAt);
    const promisedDate = new Date(promised);
    const diffDays = Math.ceil((actual.getTime() - promisedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      deductions.push({
        category: "delivery",
        label: `延迟交付 ${diffDays} 天`,
        reason: `${o.productName || "未知产品"}：承诺 ${promised}，实际 ${o.actualDeliveryAt}`,
        severity: diffDays > 7 ? "high" : diffDays > 3 ? "medium" : "low",
        impact: diffDays > 7 ? "严重影响交期评分" : diffDays > 3 ? "中度影响交期评分" : "轻微影响交期评分",
        recordId: o.id
      });
    }
    
    // 缺量
    if (o.orderQuantity && o.deliveredQuantity && o.deliveredQuantity < o.orderQuantity) {
      const shortage = o.orderQuantity - o.deliveredQuantity;
      const shortageRate = (shortage / o.orderQuantity) * 100;
      if (shortageRate > 20) {
        deductions.push({
          category: "delivery",
          label: `缺量 ${shortage} 件（缺量率 ${Math.round(shortageRate)}%）`,
          reason: `${o.productName || "未知产品"}：订单 ${o.orderQuantity}，到货 ${o.deliveredQuantity}`,
          severity: shortageRate > 50 ? "high" : "medium",
          impact: "影响订单满足率评分",
          recordId: o.id
        });
      }
    }
  }

  // 质量扣分项
  for (const q of qualityIssues) {
    if (q.repeated) {
      deductions.push({
        category: "quality",
        label: `重复质量问题`,
        reason: q.issueDescription || "质量问题重复发生",
        severity: "high",
        impact: "重复发生率扣分",
        recordId: q.id
      });
    }
    if (q.isCustomerReturn) {
      deductions.push({
        category: "quality",
        label: `客户退货/投诉`,
        reason: q.issueDescription || "客户退货或投诉",
        severity: "high",
        impact: "影响客户满意度评分",
        recordId: q.id
      });
    }
    if (!q.isClosed) {
      deductions.push({
        category: "quality",
        label: `未关闭的质量问题`,
        reason: q.issueDescription || "质量问题尚未解决",
        severity: "medium",
        impact: "质量问题持续影响评分",
        recordId: q.id
      });
    }
    if (q.wrongShipIssue) {
      deductions.push({
        category: "quality",
        label: `错发/漏发`,
        reason: q.issueDescription || "错发或漏发",
        severity: "high",
        impact: "影响错发漏发率评分",
        recordId: q.id
      });
    }
  }

  // 服务扣分项
  for (const s of serviceEvents) {
    if (s.type === "evasion") {
      deductions.push({
        category: "service",
        label: `推诿行为`,
        reason: s.content,
        severity: (s.evasionSeverity ?? 0) >= 2 ? "high" : "medium",
        impact: "推诿次数累计扣分",
        recordId: s.id
      });
    }
    if (s.type === "response" && s.responseHours && s.responseHours > 24) {
      deductions.push({
        category: "service",
        label: `响应超时 ${s.responseHours} 小时`,
        reason: s.content,
        severity: s.responseHours > 48 ? "high" : "medium",
        impact: "平均响应时长扣分",
        recordId: s.id
      });
    }
    if (s.type === "promise" && s.fulfilled === false) {
      deductions.push({
        category: "service",
        label: `承诺未兑现`,
        reason: s.content,
        severity: "high",
        impact: "承诺兑现率扣分",
        recordId: s.id
      });
    }
    if (s.type === "attitude" && s.attitudeScore && s.attitudeScore <= 2) {
      deductions.push({
        category: "service",
        label: `态度评分低（${s.attitudeScore}/5）`,
        reason: s.content,
        severity: s.attitudeScore === 1 ? "high" : "medium",
        impact: "态度评分影响服务分",
        recordId: s.id
      });
    }
  }

  // 按严重程度排序
  const severityOrder = { high: 0, medium: 1, low: 2 };
  deductions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    deductions,
    summary: {
      deliveryCount: deductions.filter((d) => d.category === "delivery").length,
      qualityCount: deductions.filter((d) => d.category === "quality").length,
      serviceCount: deductions.filter((d) => d.category === "service").length,
      totalImpact: deductions.length > 0 
        ? `共 ${deductions.length} 项异常影响评分` 
        : "无扣分项"
    }
  };
}

// ===== Tab 3: 沟通记录 - 去卡片化 =====
function CommunicationsTab({ communications }: { communications: LocalCommunication[] }) {
  if (communications.length === 0) {
    return <EmptyTabContent label="暂无沟通记录" tip="在快速录入中添加与该供应商的沟通记录" />;
  }
  return (
    <div className="space-y-0">
      {communications.map((c, idx) => (
        <div key={c.id} className={`py-4 ${idx < communications.length - 1 ? "border-b border-line-soft" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
          <p className="text-sm font-medium">{c.summary}</p>
          {c.promises.length > 0 ? (
            <div className="mt-2">
              <span className="text-[10px] text-muted">承诺</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {c.promises.map((p, i) => <span key={i} className="text-[10px] text-action">{p}</span>)}
              </div>
            </div>
          ) : null}
          {c.risks.length > 0 ? (
            <div className="mt-2">
              <span className="text-[10px] text-muted">风险</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {c.risks.map((r, i) => <span key={i} className="text-[10px] text-danger">{r}</span>)}
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ===== Tab 4: 降本记录 - 去卡片化 =====
function CostReductionTab({ costReductionRecords, offers }: {
  costReductionRecords: SupplierCostReduction[];
  offers: LocalOffer[];
}) {
  if (costReductionRecords.length === 0 && offers.length === 0) {
    return <EmptyTabContent label="暂无降本/报价记录" tip="通过「聊天快速评估」提取价格变动，或添加货盘记录" />;
  }
  return (
    <div className="space-y-8">
      {costReductionRecords.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold mb-3">价格变动记录（{costReductionRecords.length}）</h3>
          <div className="space-y-0">
            {costReductionRecords.map((c, i) => (
              <div key={i} className={`flex items-center gap-3 py-2.5 ${i < costReductionRecords.length - 1 ? "border-b border-line-soft" : ""}`}>
                <div className="flex-1">
                  <div className="text-sm">{c.productName || "未指定产品"}</div>
                  <div className="text-xs text-muted mt-0.5">{c.achievedAt ?? "—"}</div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted">{c.priceBefore}元</span>
                  <ArrowDown className="h-3 w-3 text-success" />
                  <span className="text-success font-medium">{c.priceAfter}元</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 关联货盘报价 */}
      {offers.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold mb-3">货盘报价（{offers.length}）</h3>
          <div className="space-y-0">
            {offers.map((o, idx) => (
              <Link key={o.id} href={`/offers/${o.id}`} className={`block py-2.5 hover:bg-paper-warm/30 transition-colors ${idx < offers.length - 1 ? "border-b border-line-soft" : ""}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{o.name}</div>
                    <div className="text-xs text-muted">{o.productName || "未关联产品"} · {o.category || "未分类"}</div>
                  </div>
                  <div className="text-right">
                    {o.quotedPrice ? <div className="text-sm font-bold">{o.quotedPrice}</div> : null}
                    {o.moq ? <div className="text-xs text-muted">MOQ: {o.moq}</div> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// ===== Tab 5: 评估历史 - 去卡片化 =====
function HistoryTab({ evaluations }: { evaluations: SupplierEvaluationRecord[] }) {
  if (evaluations.length === 0) {
    return <EmptyTabContent label="暂无评估历史" tip="完成第一次评估后，历史趋势将在此展示" />;
  }
  const sorted = [...evaluations].reverse();
  return (
    <div className="space-y-0">
      {sorted.map((ev, idx) => {
        const prev = sorted[idx + 1];
        const scoreDiff = prev ? ev.scores.total - prev.scores.total : null;
        return (
          <div key={ev.id} className={`py-4 ${idx < sorted.length - 1 ? "border-b border-line-soft" : ""}`}>
            <div className="flex items-center gap-3">
              <GradeCircle grade={ev.scores.grade} score={ev.scores.total} size="sm" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{ev.period}</span>
                  <span className="text-xs text-muted">{new Date(ev.evaluatedAt).toLocaleDateString("zh-CN")}</span>
                  {scoreDiff != null ? (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${scoreDiff > 0 ? "text-success" : scoreDiff < 0 ? "text-danger" : "text-muted"}`}>
                      {scoreDiff > 0 ? <ArrowUp className="h-3 w-3" /> : scoreDiff < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      {scoreDiff > 0 ? "+" : ""}{scoreDiff.toFixed(1)}分
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex gap-3 text-xs text-muted">
                  <span>交付 {Math.round(ev.scores.delivery)}</span>
                  <span>成本 {Math.round(ev.scores.cost)}</span>
                  <span>质量 {Math.round(ev.scores.quality)}</span>
                  <span>服务 {Math.round(ev.scores.service)}</span>
                </div>
                {ev.riskLabels.length > 0 && ev.riskLabels[0] !== "无风险" ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ev.riskLabels.map((label, i) => (
                      <span key={i} className="text-[10px] text-danger">{label}</span>
                    ))}
                  </div>
                ) : null}
                {ev.note ? <p className="mt-1 text-[10px] text-muted">{ev.note}</p> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActualInboundOverview({ products, period, total }: {
  products: { skuCode: string; productName: string; specification: string; receivedQuantity: number }[];
  period?: string;
  total: number;
}) {
  return (
    <section className="pt-4 border-t border-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Package className="h-4 w-4 text-action" />
            实际入仓协同
          </h3>
          <p className="mt-1 text-xs text-muted">来自供应商月度入仓表，不等同于货盘报价或备选供应商。</p>
        </div>
        {period ? <span className="text-xs text-muted">最新月份：{period}</span> : null}
      </div>
      {products.length === 0 ? (
        <p className="mt-4 text-xs text-muted-light">暂无已确认的实际入仓记录。</p>
      ) : (
        <>
          <div className="mt-4 grid gap-6 sm:grid-cols-3">
            <div><div className="text-xs text-muted">实际入仓 SKU</div><div className="mt-1 text-2xl font-bold">{products.length}</div></div>
            <div><div className="text-xs text-muted">本月实际入仓</div><div className="mt-1 text-2xl font-bold">{total}</div></div>
            <div><div className="text-xs text-muted">覆盖产品</div><div className="mt-1 text-2xl font-bold">{new Set(products.map((item) => item.productName)).size}</div></div>
          </div>
          <div className="mt-4 divide-y divide-line border-y border-line">
            {products.slice(0, 8).map((item) => (
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs" key={item.skuCode}>
                <span><strong className="text-slate-800">{item.skuCode}</strong><span className="ml-2 text-muted">{item.productName} · {item.specification}</span></span>
                <span className="text-slate-600">入仓 {item.receivedQuantity}</span>
              </div>
            ))}
          </div>
          {products.length > 8 ? <p className="mt-2 text-[11px] text-muted">仅展示最新月份前 8 个 SKU。</p> : null}
        </>
      )}
    </section>
  );
}

// ===== 关联资源概览 - 去卡片化 =====
function ResourceOverview({ offers, linkedProducts, tasks, supplierId }: {
  offers: LocalOffer[];
  linkedProducts: { offer: LocalOffer; product: LocalProductKnowledge }[];
  tasks: LocalTask[];
  supplierId: string;
}) {
  const openTasks = tasks.filter((t) => t.status === "open");
  return (
    <section className="pt-4 border-t border-line">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
        <Package className="h-4 w-4 text-action" />
        关联资源
      </h3>
      <div className="grid gap-8 sm:grid-cols-3">
        {/* 货盘 */}
        <div>
          <div className="text-xs text-muted">货盘报价</div>
          <div className="text-2xl font-bold mt-1">{offers.length}</div>
          {offers.length > 0 ? (
            <Link className="text-xs text-action hover:underline mt-1 inline-block" href={`/offers?supplierId=${supplierId}`}>
              查看全部 →
            </Link>
          ) : null}
        </div>
        {/* 关联产品 */}
        <div>
          <div className="text-xs text-muted">关联产品</div>
          <div className="text-2xl font-bold mt-1">{linkedProducts.length}</div>
          {linkedProducts.length > 0 ? (
            <div className="mt-1 space-y-0.5">
              {linkedProducts.slice(0, 3).map(({ product }, i) => (
                <Link key={i} href={`/products/${product.id}`} className="block text-xs text-action hover:underline truncate">
                  {product.name || "未命名产品"}
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-muted-light mt-1">通过货盘自动关联</div>
          )}
        </div>
        {/* 待办 */}
        <div>
          <div className="text-xs text-muted">关联待办</div>
          <div className="text-2xl font-bold mt-1">{openTasks.length}<span className="text-sm text-muted">/{tasks.length}</span></div>
          {tasks.length > 0 ? (
            <Link className="text-xs text-action hover:underline mt-1 inline-block" href={`/tasks?supplierId=${supplierId}`}>
              查看全部 →
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ===== 通用空状态 =====
function EmptyTabContent({ label, tip }: { label: string; tip: string }) {
  return (
    <div className="border border-line p-8 text-center">
      <FileText className="mx-auto h-8 w-8 text-muted-light" />
      <p className="mt-2 text-sm text-muted">{label}</p>
      <p className="mt-1 text-xs text-muted-light">{tip}</p>
    </div>
  );
}

// ===== 聊天预览面板 =====
function ChatPreviewPanel({ preview }: { preview: ChatAnalyzeResult }) {
  const { draft, previewScores } = preview;
  const orders = draft.orders ?? [];
  const qualityIssues = draft.qualityIssues ?? [];
  const serviceEvents = draft.serviceEvents ?? [];
  const costReductions = draft.costReductions ?? [];
  const uncertaintyNotes = draft.uncertaintyNotes ?? [];

  return (
    <div className="space-y-3 border border-line bg-white p-4">
      {previewScores ? (
        <div className="flex items-center gap-3 bg-action-soft/30 px-3 py-2">
          <GradeCircle grade={previewScores.grade} score={previewScores.total} size="sm" />
          <div className="flex-1 grid grid-cols-4 gap-2 text-center">
            <div><div className="text-[10px] text-muted">交付</div><div className="text-sm font-bold text-action">{Math.round(previewScores.delivery)}</div></div>
            <div><div className="text-[10px] text-muted">成本</div><div className="text-sm font-bold text-warning">{Math.round(previewScores.cost)}</div></div>
            <div><div className="text-[10px] text-muted">质量</div><div className="text-sm font-bold text-success">{Math.round(previewScores.quality)}</div></div>
            <div><div className="text-[10px] text-muted">服务</div><div className="text-sm font-bold text-muted">{Math.round(previewScores.service)}</div></div>
          </div>
        </div>
      ) : null}

      {orders.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-muted mb-1">识别到 {orders.length} 条订单记录</div>
          <div className="space-y-1">
            {orders.map((o, i) => (
              <div key={i} className="text-xs text-slate-700 flex flex-wrap gap-x-3">
                <span>{o.productName || "未识别产品"}</span>
                {o.orderQuantity ? <span className="text-muted">数量: {o.orderQuantity}</span> : null}
                {o.promisedDeliveryAt ? <span className="text-muted">交期: {o.promisedDeliveryAt}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {qualityIssues.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-danger mb-1">识别到 {qualityIssues.length} 条质量问题</div>
          <div className="space-y-1">
            {qualityIssues.map((q, i) => (
              <div key={i} className="text-xs text-slate-700">
                {q.issueDescription || "质量问题"}{q.issueCount ? ` (${q.issueCount}件)` : ""}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {serviceEvents.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-muted mb-1">识别到 {serviceEvents.length} 条服务事件</div>
          <div className="space-y-1">
            {serviceEvents.map((s, i) => (
              <div key={i} className="text-xs text-slate-700">
                <span className="text-muted">{s.type}</span> {s.content}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {costReductions.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-success mb-1">识别到 {costReductions.length} 条价格变动</div>
          <div className="space-y-1">
            {costReductions.map((c, i) => (
              <div key={i} className="text-xs text-slate-700">
                {c.productName || ""} {c.priceBefore} → {c.priceAfter}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {uncertaintyNotes.length > 0 ? (
        <div className="bg-warning-soft/20 px-3 py-2">
          <div className="text-[10px] font-medium text-warning mb-0.5">解析器不确定的内容（需人工核对）</div>
          <ul className="text-xs text-slate-700 list-disc list-inside">
            {uncertaintyNotes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      ) : null}

      {orders.length === 0 && qualityIssues.length === 0 && serviceEvents.length === 0 && costReductions.length === 0 ? (
        <div className="text-sm text-muted text-center py-2">未从聊天记录中识别到可量化的评估数据。你可以直接保存，或修改文本后重新解析。</div>
      ) : null}
    </div>
  );
}

// ===== 工具函数 + 子组件 =====

function defaultPeriod(): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${quarter}`;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-success-soft", text: "text-success", border: "border-success/30" },
  B: { bg: "bg-action-soft", text: "text-action", border: "border-action/30" },
  C: { bg: "bg-warning-soft", text: "text-warning", border: "border-warning/30" },
  D: { bg: "bg-danger-soft", text: "text-danger", border: "border-danger/30" },
};

function GradeCircle({ grade, score, size = "md" }: { grade: SupplierGrade; score: number; size?: "sm" | "md" | "lg" }) {
  const c = GRADE_COLORS[grade];
  const dims = size === "sm" ? "h-12 w-12" : size === "lg" ? "h-20 w-20" : "h-16 w-16";
  const fontSize = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";
  const scoreSize = size === "sm" ? "text-[9px]" : "text-[10px]";
  return (
    <div className={`flex ${dims} shrink-0 flex-col items-center justify-center rounded-full border-2 ${c.border} ${c.bg}`}>
      <span className={`${fontSize} font-bold ${c.text}`}>{grade}</span>
      <span className={`${scoreSize} ${c.text}`}>{Math.round(score)}分</span>
    </div>
  );
}
