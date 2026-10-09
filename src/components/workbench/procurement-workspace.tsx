"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { directProcurementEntry } from "@/features/workbench/procurement-entry";
import { ProcurementFilter } from "./procurement-filter";
import { ProcurementManagementFields } from "./procurement-management-fields";
import {
  transitionRequirements,
  type ProcurementTransition,
} from "@/features/workbench/procurement-gates";
import { updateProjectManagement } from "@/features/workbench/procurement-management";
import {
  hasSharedProcurementChanges,
  repairProcurementSourceSnapshots,
  syncProcurementSourceUpdate,
} from "@/features/workbench/procurement-sync";
import { ProcurementTaskExecutionFields } from "./procurement-task-execution-fields";
import {
  BusinessRecordDialog,
  BusinessFacts,
  BusinessSection,
  businessInput,
  businessPrimary,
  businessSecondary,
} from "./business-record-dialog";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import {
  ProcurementLineFields,
  ProcurementLineFacts,
  procurementTable,
  validProductUrl,
} from "./procurement-line-details";
import {
  ProcurementFulfillmentWorkspace,
  FulfillmentRecordDialog,
} from "./procurement-fulfillment-workspace";
import { ProcurementQuoteWorkspace } from "./procurement-quote-workspace";
import {
  acceptProcurementRequest,
  addQuoteCandidate,
  advanceFulfillment,
  childProcurementRecords,
  createFulfillmentFromQuote,
  createProcurementChild,
  createQuoteProject,
  finalizeQuote,
  loadProcurementRecords,
  newProcurementRecord,
  normalizeLineItems,
  procurementSourceChain,
  repairProcurementLinks,
  saveProcurementRecords,
  saveQuoteOffer,
  setProcurementStatus,
  type FulfillmentStage,
  type ProcurementLineItem,
  type ProcurementRecord,
  type ProcurementSection,
  type QuoteOffer,
  type SupplierCandidate,
} from "@/features/workbench/procurement";

export const links: Array<{
  key: ProcurementSection;
  label: string;
  href: string;
}> = [
  { key: "request", label: "需求申请", href: "/procurement/request" },
  { key: "pool", label: "需求池", href: "/procurement/pool" },
  { key: "task", label: "采购任务", href: "/procurement/task" },
  { key: "quote", label: "询价比价", href: "/procurement/quote" },
  { key: "fulfillment", label: "采购履约", href: "/procurement/fulfillment" },
];
const sectionTitles: Record<ProcurementSection, string> = {
  request: "采购需求申请",
  pool: "采购需求池",
  task: "采购任务",
  quote: "询价与比价",
  fulfillment: "采购履约",
};
const statusLabels: Record<string, string> = {
  draft: "草稿",
  pending: "待承接",
  accepted: "已承接",
  paused: "已暂缓",
  sourcing: "寻源中",
  completed: "已完成",
  cancelled: "已取消",
};
const fulfillmentLabels: Record<FulfillmentStage, string> = {
  待下单: "待下单",
  已下单: "已下单",
  已发货: "已发货",
  已到货: "已到货",
  对账中: "对账中",
  已完成: "已完成",
  异常: "异常",
};

export function ProcurementWorkspace({
  section,
}: {
  section: ProcurementSection;
}) {
  const [records, setRecords] = useState<ProcurementRecord[]>([]);
  const [editing, setEditing] = useState<ProcurementRecord | null>(null);
  const [viewing, setViewing] = useState<ProcurementRecord | null>(null);
  const [focusEventId, setFocusEventId] = useState('');
  const [gate, setGate] = useState<{
    record: ProcurementRecord;
    transition: ProcurementTransition;
    missing: string[];
  } | null>(null);
  useEffect(() => {
    setEditing(null);
    setViewing(null);
    setFilter("");
  }, [section]);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    const loaded = loadProcurementRecords();
    const repaired = repairProcurementSourceSnapshots(
      repairProcurementLinks(loaded),
    );
    setRecords(repaired);
    if (section === 'fulfillment') {
      const params = new URLSearchParams(window.location.search);
      const target = repaired.find(
        (record) => record.id === params.get('recordId') && record.section === 'fulfillment',
      );
      if (target) {
        setViewing(target);
        setFocusEventId(params.get('eventId') || '');
      }
    }
    if (JSON.stringify(repaired) !== JSON.stringify(loaded))
      saveProcurementRecords(repaired);
  }, []);
  const rows = useMemo(
    () =>
      records.filter((r) =>
        section === "pool"
          ? (r.section === "pool" || r.section === "request") &&
            r.status !== "cancelled" &&
            r.status !== "draft"
          : section === "task"
            ? r.section === "task"
            : section === "quote"
              ? r.section === "quote"
              : section === "fulfillment"
                ? r.section === "fulfillment"
                : section === "request"
                  ? r.section === "request"
                  : [],
      ),
    [records, section],
  );
  const editRecord = (record: ProcurementRecord) => {
    const root = procurementSourceChain(records, record)[0];
    setEditing({
      ...record,
      management: root?.management || record.management,
    });
    setViewing(null);
    setGate(null);
  };
  const save = (record: ProcurementRecord) => {
    const previous = records.find((item) => item.id === record.id);
    const clean = record.sourceId
      ? { ...record, management: undefined }
      : record;
    let next = previous
      ? records.map((r) => (r.id === clean.id ? clean : r))
      : [clean, ...records];
    if (record.management)
      next = updateProjectManagement(next, record.id, record.management);
    if (previous && hasSharedProcurementChanges(previous, clean))
      next = syncProcurementSourceUpdate(
        next,
        next.find((item) => item.id === record.id)!,
      );
    saveProcurementRecords(next);
    setRecords(next);
    setEditing(null);
    setViewing(next.find((item) => item.id === record.id) || null);
  };
  const passGate = (
    record: ProcurementRecord,
    transition: ProcurementTransition,
    action: () => void,
  ) => {
    const missing = transitionRequirements(records, record, transition);
    if (missing.length) {
      setGate({ record, transition, missing });
      return;
    }
    action();
  };
  const commit = (next: ProcurementRecord[]) => {
    saveProcurementRecords(next);
    setRecords(next);
  };
  const create = () =>
    setEditing(
      section === "pool" || section === "task"
        ? directProcurementEntry(section)
        : newProcurementRecord("request"),
    );
  const submit = (record: ProcurementRecord) => {
    return passGate(record, "submit", () => {
      const next = setProcurementStatus(
        records,
        record.id,
        "pending",
        "等待采购承接",
      );
      commit(next);
      setViewing(next.find((item) => item.id === record.id) || null);
    });
  };
  const accept = (record: ProcurementRecord) => {
    return passGate(record, "accept", () => {
      const next = acceptProcurementRequest(records, record.id);
      commit(next);
      setViewing(next.find((item) => item.id === record.id) || null);
    });
  };
  const pause = (record: ProcurementRecord) => {
    const next = setProcurementStatus(
      records,
      record.id,
      "paused",
      "等待补充信息或重新启用",
    );
    commit(next);
    setViewing(next.find((item) => item.id === record.id) || null);
  };
  const startQuote = (record: ProcurementRecord) =>
    passGate(record, "quote", () => {
      const next = createQuoteProject(records, record.id);
      commit(next);
      window.location.href = "/procurement/quote";
    });
  const createFulfillment = (record: ProcurementRecord) => {
    const next = createFulfillmentFromQuote(records, record.id);
    commit(next);
    setViewing(
      next.find(
        (item) => item.sourceId === record.id && item.section === "fulfillment",
      ) || record,
    );
  };
  const advance = (record: ProcurementRecord, stage: FulfillmentStage) => {
    const next = advanceFulfillment(records, record.id, stage);
    commit(next);
    setViewing(next.find((item) => item.id === record.id) || null);
  };
  return (
    <main className="mx-auto max-w-[1440px] py-5">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-line pb-4">
        <div>
          <p className="text-xs text-action">采购管理 · 业务主线</p>
          <h1 className="mt-1 text-2xl font-semibold">
            {sectionTitles[section]}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            className="rounded-lg border border-line px-3 py-2 text-sm"
            href="/procurement/overview"
          >
            采购总览
          </Link>
          {section === "request" && (
            <button
              className="rounded-lg bg-action px-3 py-2 text-sm text-white"
              onClick={create}
              type="button"
            >
              新建需求
            </button>
          )}
          {(section === "pool" || section === "task") && (
            <button type="button" className={businessPrimary} onClick={create}>
              {section === "pool" ? "直接新建需求" : "新建采购任务"}
            </button>
          )}
          {section === "pool" && (
            <Link
              className="rounded-lg border border-line px-3 py-2 text-sm"
              href="/procurement/request"
            >
              去需求申请
            </Link>
          )}
          {section === "task" && (
            <Link
              className="rounded-lg border border-line px-3 py-2 text-sm"
              href="/procurement/pool"
            >
              从需求池承接
            </Link>
          )}
          {section === "fulfillment" && (
            <Link
              className="rounded-lg border border-line px-3 py-2 text-sm"
              href="/procurement/quote"
            >
              从询价结果生成
            </Link>
          )}
        </div>
      </header>
      <nav className="flex flex-wrap gap-x-6 gap-y-3 border-b border-line py-4">
        {links.map((item) => (
          <Link
            className={`text-sm ${item.key === section ? "font-semibold text-action" : "text-muted hover:text-ink"}`}
            href={item.href}
            key={item.key}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {section === "quote" ? (
        <ProcurementQuoteWorkspace
          records={records}
          onCommit={commit}
          onView={setViewing}
        />
      ) : section === "fulfillment" ? (
        <ProcurementFulfillmentWorkspace
          records={records}
          onView={setViewing}
          onCommit={commit}
        />
      ) : (
        <>
          <section className="flex flex-wrap items-center gap-5 border-b border-line py-4 text-sm">
            <ProcurementFilter
              label="当前状态"
              value={filter}
              onChange={setFilter}
            >
              {[
                "",
                "draft",
                "pending",
                "accepted",
                "paused",
                "sourcing",
                "completed",
                "cancelled",
              ].map((value) => (
                <option key={value} value={value}>
                  {value ? statusLabels[value] : "全部状态"}
                </option>
              ))}
            </ProcurementFilter>
            <span className="text-muted">
              共 {rows.filter((r) => !filter || r.status === filter).length}{" "}
              条记录
            </span>
          </section>
          <RecordTable
            records={rows.filter((r) => !filter || r.status === filter)}
            section={section}
            allRecords={records}
            onView={setViewing}
            onSubmit={submit}
            onAccept={accept}
            onPause={pause}
            onStartQuote={startQuote}
            onCreateFulfillment={createFulfillment}
            onAdvance={advance}
          />
        </>
      )}
      {viewing && viewing.section !== "fulfillment" && !editing && (
        <BusinessRecordDialog
          title={viewing.title || sectionTitles[section]}
          onClose={() => setViewing(null)}
          footer={
            <>
              {viewing.section === section && section !== "quote" && (
                <button
                  className={businessSecondary}
                  type="button"
                  onClick={() => {
                    editRecord(viewing);
                  }}
                >
                  编辑
                </button>
              )}
              {section === "request" && viewing.status === "draft" && (
                <button
                  className={businessPrimary}
                  type="button"
                  onClick={() => submit(viewing)}
                >
                  提交到需求池
                </button>
              )}
              {section === "pool" &&
                (viewing.status === "pending" ||
                  viewing.status === "draft") && (
                  <button
                    className={businessPrimary}
                    type="button"
                    onClick={() => accept(viewing)}
                  >
                    承接为采购任务
                  </button>
                )}
              {section === "pool" && viewing.status === "pending" && (
                <button
                  className={businessSecondary}
                  type="button"
                  onClick={() => pause(viewing)}
                >
                  暂缓
                </button>
              )}
              {section === "task" &&
                !records.some(
                  (item) =>
                    item.section === "quote" && item.sourceId === viewing.id,
                ) && (
                  <button
                    className={businessPrimary}
                    type="button"
                    onClick={() => startQuote(viewing)}
                  >
                    发起询价
                  </button>
                )}
              {viewing.section === "quote" &&
                section === "quote" &&
                viewing.quoteReview?.status === "approved" &&
                !records.some(
                  (item) =>
                    item.section === "fulfillment" &&
                    item.sourceId === viewing.id,
                ) && (
                  <button
                    className={businessPrimary}
                    type="button"
                    onClick={() => createFulfillment(viewing)}
                  >
                    生成履约单
                  </button>
                )}
            </>
          }
        >
          <BusinessSection title="需求与执行信息">
            <BusinessFacts
              values={[
                [
                  "产品 / SKU",
                  [viewing.productName, viewing.sku]
                    .filter(Boolean)
                    .join(" · "),
                ],
                ["明细行数", String(normalizeLineItems(viewing).length)],
                ["负责人", viewing.owner],
                ["提出人", viewing.requester],
                ["需求来源", viewing.sourceKind],
                ["来源说明", viewing.sourceNote],
                ["状态", statusLabels[viewing.status]],
                [
                  "履约阶段",
                  viewing.fulfillmentStage
                    ? fulfillmentLabels[viewing.fulfillmentStage]
                    : undefined,
                ],
                ["优先级", viewing.priority],
                ["下一步动作", viewing.nextAction],
              ]}
            />
            <LineItemTable items={normalizeLineItems(viewing)} />
          </BusinessSection>
          {viewing.section === "task" && (
            <BusinessSection title="任务执行计划">
              <BusinessFacts
                values={[
                  ["寻源渠道", viewing.taskExecution?.channels],
                  ["目标有效报价数", viewing.taskExecution?.targetQuoteCount],
                  ["计划提交日期", viewing.taskExecution?.plannedQuoteDate],
                  ["寻源重点 / 分工", viewing.taskExecution?.strategy],
                ]}
              />
            </BusinessSection>
          )}
          <BusinessSection title="项目管理信息">
            <BusinessFacts
              values={Object.entries(
                procurementSourceChain(records, viewing)[0]?.management || {},
              ).map(([key, value]) => [
                {
                  projectName: "项目名称",
                  team: "项目组",
                  platform: "服务平台",
                  operator: "运营对接人",
                  reviewer: "验收人",
                  deadline: "项目交付期限",
                  criteria: "验收标准",
                  blockedReason: "阻塞原因",
                  waitingFor: "等待对象",
                }[key] || key,
                value,
              ])}
            />
          </BusinessSection>
          <BusinessSection title="来源与协同">
            <BusinessFacts
              values={procurementSourceChain(records, viewing).map((item) => [
                item.section === "request"
                  ? "需求申请"
                  : item.section === "pool"
                    ? "直接入池需求"
                    : item.section === "task"
                      ? "采购任务"
                      : item.section === "quote"
                        ? "询价项目"
                        : "采购履约",
                item.title || "未命名记录",
              ])}
            />
          </BusinessSection>
        </BusinessRecordDialog>
      )}
      {gate && (
        <BusinessRecordDialog
          title={
            gate.transition === "submit"
              ? "暂不能提交需求"
              : gate.transition === "accept"
                ? "暂不能承接为任务"
                : "暂不能发起询价"
          }
          onClose={() => setGate(null)}
          footer={
            <>
              <button
                className={businessSecondary}
                type="button"
                onClick={() => setGate(null)}
              >
                返回
              </button>
              <button
                className={businessPrimary}
                type="button"
                onClick={() => editRecord(gate.record)}
              >
                补充信息
              </button>
            </>
          }
        >
          <p className="text-sm text-muted">
            请先补齐以下信息，保存后再执行本节点：
          </p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {gate.missing.map((item) => (
              <li
                className="rounded-md border border-line bg-paper px-3 py-2"
                key={item}
              >
                • {item}
              </li>
            ))}
          </ul>
        </BusinessRecordDialog>
      )}
      {viewing?.section === "fulfillment" && (
        <FulfillmentRecordDialog
          key={viewing.id}
          recordId={viewing.id}
          records={records}
          focusEventId={focusEventId}
          onCommit={commit}
          onClose={() => setViewing(null)}
          onOpen={setViewing}
        />
      )}
      {editing && (
        <RecordEditor
          record={editing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </main>
  );
}

function RecordTable({
  records,
  allRecords,
  section,
  onView,
  onSubmit,
  onAccept,
  onPause,
  onStartQuote,
  onCreateFulfillment,
  onAdvance,
}: {
  records: ProcurementRecord[];
  allRecords: ProcurementRecord[];
  section: ProcurementSection;
  onView: (record: ProcurementRecord) => void;
  onSubmit: (record: ProcurementRecord) => void;
  onAccept: (record: ProcurementRecord) => void;
  onPause: (record: ProcurementRecord) => void;
  onStartQuote: (record: ProcurementRecord) => void;
  onCreateFulfillment: (record: ProcurementRecord) => void;
  onAdvance: (record: ProcurementRecord, stage: FulfillmentStage) => void;
}) {
  const nextStage: Record<FulfillmentStage, FulfillmentStage | undefined> = {
    待下单: "已下单",
    已下单: "已发货",
    已发货: "已到货",
    已到货: "对账中",
    对账中: "已完成",
    已完成: undefined,
    异常: undefined,
  };
  return (
    <section className="overflow-x-auto py-5">
      <table className={`${procurementTable} min-w-[1100px]`}>
        <thead>
          <tr className="border-b border-line text-muted">
            <th className="px-3 py-3">状态</th>
            <th className="px-3 py-3">需求 / 任务</th>
            <th className="px-3 py-3">产品 / SKU</th>
            <th className="px-3 py-3">数量</th>
            <th className="px-3 py-3">期望日期</th>
            <th className="px-3 py-3">负责人</th>
            <th className="px-3 py-3">优先级</th>
            <th className="px-3 py-3">下一步</th>
            <th className="px-3 py-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const task = allRecords.find(
              (item) => item.section === "task" && item.sourceId === record.id,
            );
            const quote = allRecords.find(
              (item) => item.section === "quote" && item.sourceId === record.id,
            );
            const fulfillment = allRecords.find(
              (item) =>
                item.section === "fulfillment" && item.sourceId === record.id,
            );
            const upcoming = record.fulfillmentStage
              ? nextStage[record.fulfillmentStage]
              : undefined;
            return (
              <tr
                className="border-b border-line/70 hover:bg-paper-warm/40"
                key={record.id}
              >
                <td className="px-3 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${record.status === "completed" ? "bg-emerald-50 text-emerald-700" : record.priority === "高" ? "bg-red-50 text-red-600" : "bg-action-soft text-action"}`}
                  >
                    {section === "fulfillment" && record.fulfillmentStage
                      ? fulfillmentLabels[record.fulfillmentStage]
                      : statusLabels[record.status]}
                  </span>
                </td>
                <td className="px-3 py-4 font-medium">
                  {record.title || "未命名记录"}
                  {record.sourceId ? (
                    <span className="ml-2 text-xs text-muted">已关联</span>
                  ) : null}
                </td>
                <td className="px-3 py-4">
                  {record.productName || "未填写"}
                  {record.lineItems && record.lineItems.length > 1 ? (
                    <span className="ml-2 text-xs text-muted">
                      {record.lineItems.length} 个 SKU
                    </span>
                  ) : record.sku ? (
                    <span className="ml-2 text-xs text-muted">
                      {record.sku}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-4">
                  {record.lineItems && record.lineItems.length > 1
                    ? `${record.lineItems.length} 行`
                    : `${record.quantity || "—"} ${record.unit || ""}`}
                </td>
                <td className="px-3 py-4">{record.expectedDate || "未定"}</td>
                <td className="px-3 py-4">
                  {record.owner || record.requester || "待分配"}
                </td>
                <td
                  className={`px-3 py-4 ${record.priority === "高" ? "font-semibold text-red-600" : ""}`}
                >
                  {record.priority}
                </td>
                <td className="max-w-56 px-3 py-4 text-muted">
                  {record.nextAction || "待安排"}
                </td>
                <td className="whitespace-nowrap px-3 py-4">
                  <button
                    className="mr-3 text-action hover:underline"
                    onClick={() => onView(record)}
                    type="button"
                  >
                    查看详情
                  </button>
                  {section === "request" && record.status === "draft" && (
                    <button
                      className="mr-3 text-action hover:underline"
                      onClick={() => onSubmit(record)}
                      type="button"
                    >
                      提交入池
                    </button>
                  )}
                  {section === "pool" &&
                    (record.status === "pending" ||
                      record.status === "draft") && (
                      <button
                        className="mr-3 text-action hover:underline"
                        onClick={() => onAccept(record)}
                        type="button"
                      >
                        承接为任务
                      </button>
                    )}
                  {section === "pool" && record.status === "pending" && (
                    <button
                      className="text-muted hover:underline"
                      onClick={() => onPause(record)}
                      type="button"
                    >
                      暂缓
                    </button>
                  )}
                  {section === "task" && !quote && (
                    <button
                      className="text-action hover:underline"
                      onClick={() => onStartQuote(record)}
                      type="button"
                    >
                      发起询价
                    </button>
                  )}
                  {section === "quote" &&
                    record.quoteReview?.status === "approved" &&
                    !fulfillment && (
                      <button
                        className="text-action hover:underline"
                        onClick={() => onCreateFulfillment(record)}
                        type="button"
                      >
                        生成履约单
                      </button>
                    )}
                  {section === "fulfillment" && upcoming && (
                    <button
                      className="text-action hover:underline"
                      onClick={() => onAdvance(record, upcoming)}
                    >
                      进入{upcoming}
                    </button>
                  )}
                  {task && section === "pool" && (
                    <span className="text-muted">已生成任务</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {records.length === 0 && (
        <p className="py-12 text-center text-sm text-muted">
          暂无记录。
          {section === "pool"
            ? "可直接新建需求，也可从需求申请提交入池。"
            : "先录入一条真实业务需求。"}
        </p>
      )}
    </section>
  );
}

function RecordEditor({
  record,
  onCancel,
  onSave,
}: {
  record: ProcurementRecord;
  onCancel: () => void;
  onSave: (record: ProcurementRecord) => void;
}) {
  const [draft, setDraft] = useState({
    ...record,
    lineItems: normalizeLineItems(record),
  });
  const [error, setError] = useState("");
  const set = (key: keyof ProcurementRecord, value: string) =>
    setDraft((old) => ({ ...old, [key]: value }));
  const updateLine = (
    index: number,
    key: keyof ProcurementLineItem,
    value: string,
  ) =>
    setDraft((old) => ({
      ...old,
      lineItems: old.lineItems?.map((line, itemIndex) =>
        itemIndex === index ? { ...line, [key]: value } : line,
      ),
    }));
  const addLine = () =>
    setDraft((old) => ({
      ...old,
      lineItems: [
        ...(old.lineItems || []),
        {
          id: crypto.randomUUID(),
          productName: "",
          sku: "",
          category: "",
          specification: "",
          unit: "",
          quantity: "",
          expectedDate: "",
        },
      ],
    }));
  const removeLine = (index: number) =>
    setDraft((old) => ({
      ...old,
      lineItems: (old.lineItems || []).filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  const duplicateLine = (index: number) =>
    setDraft((old) => {
      const source = old.lineItems?.[index];
      return source
        ? {
            ...old,
            lineItems: [
              ...(old.lineItems || []),
              { ...source, id: crypto.randomUUID() },
            ],
          }
        : old;
    });
  const save = () => {
    const validLines = (draft.lineItems || []).filter((line) =>
      line.productName.trim(),
    );
    if (!draft.title.trim() || validLines.length === 0) {
      setError("请填写需求标题，并至少保留一条产品明细");
      return;
    }
    if (validLines.some((line) => !validProductUrl(line.referenceUrl || ""))) {
      setError("参考链接须为完整的 http:// 或 https:// 地址");
      return;
    }
    if (
      !draft.sourceId &&
      (draft.section === "pool" || draft.section === "task") &&
      (!draft.sourceKind?.trim() ||
        !draft.sourceNote?.trim() ||
        !draft.requester?.trim() ||
        !draft.owner?.trim())
    ) {
      setError("请填写来源、来源说明、提出人和负责人，便于协同追溯");
      return;
    }
    const first = validLines[0];
    try {
      onSave({
        ...draft,
        lineItems: validLines,
        productName: first.productName,
        sku: first.sku,
        category: first.category,
        specification: first.specification,
        unit: first.unit,
        quantity: first.quantity,
        expectedDate: first.expectedDate,
      });
    } catch {
      setError("保存失败，请检查本机存储空间后重试");
    }
  };
  return (
    <BusinessRecordDialog
      title={`${record.title ? "编辑" : "新建"}${record.section === "task" ? "采购任务" : "采购需求"}`}
      onClose={onCancel}
      footer={
        <>
          <button
            className={businessSecondary}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button className={businessPrimary} onClick={save} type="button">
            保存
          </button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label>
          需求标题
          <input
            className={businessInput}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>
        <label>
          负责人
          <input
            className={businessInput}
            value={draft.owner || ""}
            onChange={(e) => set("owner", e.target.value)}
          />
        </label>
        <label>
          提出人
          <input
            className={businessInput}
            value={draft.requester || ""}
            onChange={(e) => set("requester", e.target.value)}
          />
        </label>
        <label>
          优先级
          <select
            className={businessInput}
            value={draft.priority}
            onChange={(e) =>
              set("priority", e.target.value as ProcurementRecord["priority"])
            }
          >
            <option>高</option>
            <option>中</option>
            <option>低</option>
          </select>
        </label>
        {!draft.sourceId &&
          (draft.section === "pool" || draft.section === "task") && (
            <>
              <label>
                需求来源 *
                <select
                  className={businessInput}
                  value={draft.sourceKind || ""}
                  onChange={(e) => set("sourceKind", e.target.value)}
                >
                  <option value="">请选择</option>
                  {["部门提出", "领导加派", "采购主动补货", "其他"].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                来源说明 *
                <input
                  className={businessInput}
                  value={draft.sourceNote || ""}
                  onChange={(e) => set("sourceNote", e.target.value)}
                  placeholder="记录提出背景、指派依据或原始单号"
                />
              </label>
            </>
          )}
        <label className="sm:col-span-2">
          需求原因 / 备注
          <textarea
            className={businessInput}
            value={draft.reason || ""}
            onChange={(e) => set("reason", e.target.value)}
          />
        </label>
      </div>
      <div className="mt-6">
        <h3 className="mb-3 font-semibold">项目管理信息（可后续补充）</h3>
        <ProcurementManagementFields
          value={draft.management || {}}
          onChange={(management) => setDraft((old) => ({ ...old, management }))}
        />
      </div>
      {draft.section === "task" && (
        <div className="mt-6">
          <h3 className="mb-3 font-semibold">任务执行计划（发起询价前必填）</h3>
          <ProcurementTaskExecutionFields
            value={draft.taskExecution || {}}
            onChange={(taskExecution) =>
              setDraft((old) => ({ ...old, taskExecution }))
            }
          />
        </div>
      )}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">采购明细（支持多个 SKU）</h3>
          <button className={businessSecondary} onClick={addLine} type="button">
            新增一行
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className={`${procurementTable} min-w-[900px]`}>
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="p-2">SKU</th>
                <th className="p-2">产品名称 *</th>
                <th className="p-2">品类</th>
                <th className="p-2">规格型号</th>
                <th className="p-2">单位</th>
                <th className="p-2">数量</th>
                <th className="p-2">期望到货</th>
                <th className="p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {(draft.lineItems || []).map((line, index) => (
                <tr key={line.id} className="border-b border-line/70">
                  <td className="p-2">
                    <input
                      aria-label={`第${index + 1}行 SKU`}
                      className={businessInput}
                      value={line.sku || ""}
                      onChange={(e) => updateLine(index, "sku", e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      aria-label={`第${index + 1}行产品名称`}
                      className={businessInput}
                      value={line.productName}
                      onChange={(e) =>
                        updateLine(index, "productName", e.target.value)
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      aria-label={`第${index + 1}行品类`}
                      className={businessInput}
                      value={line.category || ""}
                      onChange={(e) =>
                        updateLine(index, "category", e.target.value)
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      aria-label={`第${index + 1}行规格型号`}
                      className={businessInput}
                      value={line.specification || ""}
                      onChange={(e) =>
                        updateLine(index, "specification", e.target.value)
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      aria-label={`第${index + 1}行单位`}
                      className={businessInput}
                      value={line.unit || ""}
                      onChange={(e) =>
                        updateLine(index, "unit", e.target.value)
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      aria-label={`第${index + 1}行数量`}
                      className={businessInput}
                      value={line.quantity || ""}
                      onChange={(e) =>
                        updateLine(index, "quantity", e.target.value)
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      aria-label={`第${index + 1}行期望到货`}
                      className={businessInput}
                      type="date"
                      value={line.expectedDate || ""}
                      onChange={(e) =>
                        updateLine(index, "expectedDate", e.target.value)
                      }
                    />
                  </td>
                  <td className="whitespace-nowrap p-2">
                    <button
                      className="mr-2 text-action"
                      onClick={() => duplicateLine(index)}
                      type="button"
                    >
                      复制
                    </button>
                    {(draft.lineItems || []).length > 1 && (
                      <button
                        className="text-red-600"
                        onClick={() => removeLine(index)}
                        type="button"
                      >
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3">
          {draft.lineItems.map((line, index) => (
            <details
              className="border border-line bg-surface p-4"
              key={line.id}
            >
              <summary className="cursor-pointer text-sm font-medium">
                第 {index + 1} 行 · {line.productName || "未命名产品"} ·
                采购要求与参考
              </summary>
              <div className="pt-4">
                <ProcurementLineFields
                  item={line}
                  onChange={(updated) =>
                    setDraft((old) => ({
                      ...old,
                      lineItems: old.lineItems.map((item) =>
                        item.id === line.id ? updated : item,
                      ),
                    }))
                  }
                />
              </div>
            </details>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
    </BusinessRecordDialog>
  );
}

function LineItemTable({ items }: { items: ProcurementLineItem[] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className={`${procurementTable} min-w-[760px]`}>
        <thead>
          <tr className="border-b border-line text-muted">
            <th className="p-2">SKU</th>
            <th className="p-2">产品名称</th>
            <th className="p-2">规格型号</th>
            <th className="p-2">单位</th>
            <th className="p-2">数量</th>
            <th className="p-2">期望到货</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="border-b border-line/70" key={item.id}>
              <td className="p-2">{item.sku || "—"}</td>
              <td className="p-2">{item.productName}</td>
              <td className="p-2">{item.specification || "—"}</td>
              <td className="p-2">{item.unit || "—"}</td>
              <td className="p-2">{item.quantity || "—"}</td>
              <td className="p-2">{item.expectedDate || "未定"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <details key={item.id} className="border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm">
              {item.productName} · 采购要求与参考
            </summary>
            <div className="pt-4">
              <ProcurementLineFacts item={item} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function QuoteWorkspace({
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
  const [selectedQuoteId, setSelectedQuoteId] = useState(quotes[0]?.id || "");
  const quote =
    quotes.find((record) => record.id === selectedQuoteId) || quotes[0];
  useEffect(() => {
    if (!selectedQuoteId && quotes[0]) setSelectedQuoteId(quotes[0].id);
  }, [quotes, selectedQuoteId]);
  const addCandidate = (supplierId?: string) => {
    if (!quote) return;
    const master = supplierId
      ? data.suppliers.find((supplier) => supplier.id === supplierId)
      : undefined;
    const name = master?.name || window.prompt("请输入本次新供应商名称");
    if (!name?.trim()) return;
    const candidate: SupplierCandidate = {
      id: crypto.randomUUID(),
      supplierId: master?.id,
      name: name.trim(),
      contact:
        master?.contactName ||
        (master ? undefined : window.prompt("请输入联系人") || undefined),
      phone:
        master?.contactMethod ||
        (master ? undefined : window.prompt("请输入联系电话") || undefined),
      source: master ? "master" : "new",
      status: "candidate",
    };
    onCommit(addQuoteCandidate(records, quote.id, candidate));
  };
  const addOffer = () => {
    if (!quote || !(quote.supplierCandidates || []).length) return;
    const candidate = quote.supplierCandidates![0];
    const line = normalizeLineItems(quote)[0];
    const offer: QuoteOffer = {
      id: crypto.randomUUID(),
      supplierCandidateId: candidate.id,
      lineItemId: line.id,
      unitPrice: window.prompt("请输入单价") || "",
      taxRate: window.prompt("请输入税点") || "",
      freight: window.prompt("请输入运费口径") || "",
      leadTime: window.prompt("请输入交期") || "",
    };
    onCommit(saveQuoteOffer(records, quote.id, offer));
  };
  const finalize = () => {
    if (!quote) return;
    const candidateIds = (quote.supplierCandidates || []).map(
      (candidate) => candidate.id,
    );
    if (!candidateIds.length || !(quote.quoteOffers || []).length) return;
    onCommit(finalizeQuote(records, quote.id, candidateIds));
  };
  return (
    <section className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="text-lg font-semibold">当前采购项目询价比价</h2>
          <p className="mt-1 text-sm text-muted">
            报价属于当前询价项目，不自动写入供应商历史报价。
          </p>
        </div>
        <Link
          className="rounded-lg border border-line px-3 py-2 text-sm"
          href="/procurement/task"
        >
          返回采购任务
        </Link>
      </div>
      {!quotes.length ? (
        <div className="py-16 text-center text-sm text-muted">
          还没有询价项目。请先在采购任务中点击“发起询价”。
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 border-b border-line py-4">
            {quotes.map((item) => (
              <button
                className={`rounded-full px-3 py-1 text-sm ${item.id === quote?.id ? "bg-action-soft text-action" : "text-muted"}`}
                key={item.id}
                onClick={() => setSelectedQuoteId(item.id)}
                type="button"
              >
                {item.title}
              </button>
            ))}
          </div>
          {quote && (
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{quote.title}</h3>
                  <p className="mt-1 text-sm text-muted">
                    状态：{statusLabels[quote.status]} · {quote.nextAction}
                  </p>
                </div>
                <button
                  className="text-action"
                  onClick={() => onView(quote)}
                  type="button"
                >
                  查看项目详情
                </button>
              </div>
              <LineItemTable items={normalizeLineItems(quote)} />
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  className={businessSecondary}
                  onClick={() => addCandidate()}
                  type="button"
                >
                  新增本次新供应商
                </button>
                {data.suppliers.slice(0, 12).map((supplier) => (
                  <button
                    className={businessSecondary}
                    key={supplier.id}
                    onClick={() => addCandidate(supplier.id)}
                    type="button"
                  >
                    选择{supplier.name}
                  </button>
                ))}
                <button
                  className={businessSecondary}
                  onClick={addOffer}
                  type="button"
                >
                  录入一条 SKU 报价
                </button>
                <button
                  className={businessPrimary}
                  onClick={finalize}
                  type="button"
                >
                  形成当前比价结果
                </button>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th className="p-2">SKU</th>
                      {(quote.supplierCandidates || []).map((candidate) => (
                        <th className="p-2" key={candidate.id}>
                          {candidate.name}
                          <span className="ml-1 text-xs text-muted">
                            {candidate.source === "new"
                              ? "本次候选"
                              : "已有供应商"}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {normalizeLineItems(quote).map((line) => (
                      <tr className="border-b border-line/70" key={line.id}>
                        <td className="p-2">{line.sku || line.productName}</td>
                        {(quote.supplierCandidates || []).map((candidate) => {
                          const offer = (quote.quoteOffers || []).find(
                            (item) =>
                              item.lineItemId === line.id &&
                              item.supplierCandidateId === candidate.id,
                          );
                          return (
                            <td className="p-2" key={candidate.id}>
                              {offer
                                ? `${offer.unitPrice || "未填"} / ${offer.leadTime || "未填"}`
                                : "未报价"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
