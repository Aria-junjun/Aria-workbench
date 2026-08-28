"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import {
  invalidateSupplierCapability,
  saveSupplierCapabilities,
  type LocalSupplierCapability,
} from "@/features/workbench/local-store";

export type SupplierCapabilityEditorHandle = {
  save: () => { saved: boolean; message?: string };
  reset: () => void;
};

type CapabilityDraft = {
  productFamilyKeys: string[];
  processNames: string;
  materialNames: string;
  equipmentNames: string;
  supportsSampling: boolean;
  supportsCustomization: boolean;
  moq: string;
  leadTime: string;
};

type Props = {
  supplierId: string;
  productFamilies: Array<{ key: string; label: string }>;
  capabilities: LocalSupplierCapability[];
  editable: boolean;
  onSaved?: () => void;
};

const emptyDraft = (productFamilyKeys: string[] = []): CapabilityDraft => ({
  productFamilyKeys,
  processNames: "",
  materialNames: "",
  equipmentNames: "",
  supportsSampling: false,
  supportsCustomization: false,
  moq: "",
  leadTime: "",
});

export const SupplierCapabilityEditor = forwardRef<SupplierCapabilityEditorHandle, Props>(function SupplierCapabilityEditor({
  supplierId,
  productFamilies,
  capabilities,
  editable,
  onSaved,
}, ref) {
  const [draft, setDraft] = useState<CapabilityDraft>(() => emptyDraft());
  const [invalidations, setInvalidations] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useImperativeHandle(ref, () => ({
    save() {
      try {
        if (draft.productFamilyKeys.length > 0 && (draft.processNames.trim() || draft.materialNames.trim() || draft.equipmentNames.trim())) {
          saveSupplierCapabilities(draft.productFamilyKeys.map((productFamilyKey) => ({
            supplierId,
            productFamilyKey,
            processNames: splitList(draft.processNames),
            materialNames: splitList(draft.materialNames),
            equipmentNames: splitList(draft.equipmentNames),
            supportsSampling: draft.supportsSampling,
            supportsCustomization: draft.supportsCustomization,
            moq: draft.moq.trim() || undefined,
            leadTime: draft.leadTime.trim() || undefined,
            sourceRecordIds: [],
            sourceType: "manual",
            status: "candidate",
          })));
        }
        invalidations.forEach((id) => invalidateSupplierCapability(id));
        setMessage("供应商能力已保存");
        setDraft(emptyDraft());
        setInvalidations([]);
        onSaved?.();
        return { saved: true };
      } catch (error) {
        return { saved: false, message: error instanceof Error ? error.message : "供应商能力保存失败" };
      }
    },
    reset() {
      setDraft(emptyDraft());
      setInvalidations([]);
      setMessage("");
    },
  }), [draft, invalidations, onSaved, productFamilies, supplierId]);

  const activeCapabilities = capabilities.filter((item) => item.status !== "expired" && !invalidations.includes(item.id));

  return (
    <section className="border-b border-line pb-5 scroll-mt-6" data-testid="supplier-capabilities" id="supplier-capabilities">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">供应商能力</h2>
          <p className="mt-1 text-xs text-muted">记录产品族、工艺、原材料和设备；只有明确来源或人工确认后，才可用于新品打样判断。</p>
        </div>
        <span className="shrink-0 text-xs text-muted">{activeCapabilities.length} 项有效能力</span>
      </div>

      <div className="mt-4 space-y-2">
        {activeCapabilities.length === 0 ? <p className="text-sm text-muted">暂无能力记录</p> : activeCapabilities.map((capability) => (
          <div className="flex items-start justify-between gap-4 border-b border-line/60 py-2 text-sm last:border-b-0" key={capability.id}>
            <div>
              <div className="font-medium text-ink">{capability.productFamilyKey || "未指定产品族"}</div>
              <div className="mt-1 text-xs text-muted">工艺：{joinList(capability.processNames)} · 原材料：{joinList(capability.materialNames)} · 设备：{joinList(capability.equipmentNames)}</div>
               <div className="mt-1 text-xs text-muted">{capability.supportsSampling ? "支持打样" : "未确认打样"} · {capability.leadTime ? `交期 ${capability.leadTime}` : "交期未确认"} · {capability.sourceType === "manual" ? "人工确认" : "已有来源"} · 生效 {capability.effectiveFrom ?? "未指定"}{capability.effectiveTo ? ` 至 ${capability.effectiveTo}` : ""}</div>
            </div>
            {editable ? <button className="text-xs text-danger hover:underline" onClick={() => setInvalidations((current) => [...current, capability.id])} type="button">标记失效</button> : null}
          </div>
        ))}
      </div>

      {editable ? (
        <div className="mt-4 border-t border-line pt-4">
           <div className="text-xs font-medium text-muted">新增能力（可同时选择多个产品族，保存能力由页面右上角“保存”统一提交）</div>
           <div className="mt-2 grid gap-3 sm:grid-cols-2">
             <label className="text-xs text-muted">产品族（可多选）<select className="mt-1 block min-h-24 w-full border border-line bg-white px-3 py-2 text-sm text-ink" multiple value={draft.productFamilyKeys} onChange={(event) => setDraft({ ...draft, productFamilyKeys: Array.from(event.target.selectedOptions, (option) => option.value) })}>{productFamilies.map((family) => <option key={family.key} value={family.key}>{family.label}</option>)}</select><span className="mt-1 block text-[11px] text-muted-light">按住 Ctrl / ⌘ 可多选</span></label>
            <Field label="工艺（逗号分隔）" value={draft.processNames} onChange={(value) => setDraft({ ...draft, processNames: value })} />
            <Field label="原材料（逗号分隔）" value={draft.materialNames} onChange={(value) => setDraft({ ...draft, materialNames: value })} />
            <Field label="设备（逗号分隔）" value={draft.equipmentNames} onChange={(value) => setDraft({ ...draft, equipmentNames: value })} />
            <Field label="MOQ" value={draft.moq} onChange={(value) => setDraft({ ...draft, moq: value })} />
            <Field label="交期" value={draft.leadTime} onChange={(value) => setDraft({ ...draft, leadTime: value })} />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted"><label><input checked={draft.supportsSampling} className="mr-1" onChange={(event) => setDraft({ ...draft, supportsSampling: event.target.checked })} type="checkbox" />支持打样</label><label><input checked={draft.supportsCustomization} className="mr-1" onChange={(event) => setDraft({ ...draft, supportsCustomization: event.target.checked })} type="checkbox" />支持定制</label></div>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-xs text-success" role="status">{message}</p> : null}
    </section>
  );
});

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs text-muted">{label}<input className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-ink" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function splitList(value: string) {
  return value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean);
}

function joinList(values: string[]) {
  return values.length > 0 ? values.join("、") : "未记录";
}
