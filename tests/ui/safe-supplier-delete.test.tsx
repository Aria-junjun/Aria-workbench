// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SafeSupplierDeleteAction } from "@/components/workbench/safe-supplier-delete-action";
import { loadLocalWorkbenchData, normalizeWorkbenchData, saveLocalWorkbenchData } from "@/features/workbench/local-store";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:backup"), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("blocks referenced supplier deletion and directs the user to merge or archive", () => {
  const data = normalizeWorkbenchData({
    suppliers:[{id:"a",name:"供应商甲",categories:[],riskTags:[],createdAt:""}],
    offers:[{id:"offer",name:"报价",supplierId:"a",createdAt:""}],
  });
  saveLocalWorkbenchData(data);
  render(<SafeSupplierDeleteAction supplierId="a" supplierName="供应商甲" onDeleted={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name:"永久删除" }));
  expect(screen.getByText(/仍有 1 条引用/)).toBeTruthy();
  expect(screen.getByText(/请使用合并供应商或停用供应商/)).toBeTruthy();
  expect(screen.queryByRole("button", { name:"确认永久删除" })).toBeNull();
});

it("requires backup, typed name and second confirmation before deleting an unreferenced master", () => {
  const data = normalizeWorkbenchData({ suppliers:[{id:"a",name:"供应商甲",categories:[],riskTags:[],createdAt:""}] });
  saveLocalWorkbenchData(data);
  const onDeleted = vi.fn();
  render(<SafeSupplierDeleteAction supplierId="a" supplierName="供应商甲" onDeleted={onDeleted} />);
  fireEvent.click(screen.getByRole("button", { name:"永久删除" }));
  const confirm = screen.getByRole("button", { name:"确认永久删除" }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name:"下载完整 JSON 备份" }));
  fireEvent.change(screen.getByLabelText("输入供应商名称确认"), { target:{ value:"供应商甲" } });
  fireEvent.click(screen.getByLabelText("我确认永久删除且不可恢复"));
  expect(confirm.disabled).toBe(false);
  fireEvent.click(confirm);
  expect(loadLocalWorkbenchData().suppliers).toHaveLength(0);
  expect(onDeleted).toHaveBeenCalled();
});

it("aborts when the workbench snapshot changes after preview", () => {
  const data = normalizeWorkbenchData({ suppliers:[{id:"a",name:"供应商甲",categories:[],riskTags:[],createdAt:""}] });
  saveLocalWorkbenchData(data);
  render(<SafeSupplierDeleteAction supplierId="a" supplierName="供应商甲" onDeleted={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name:"永久删除" }));
  fireEvent.click(screen.getByRole("button", { name:"下载完整 JSON 备份" }));
  fireEvent.change(screen.getByLabelText("输入供应商名称确认"), { target:{ value:"供应商甲" } });
  fireEvent.click(screen.getByLabelText("我确认永久删除且不可恢复"));
  saveLocalWorkbenchData({ ...loadLocalWorkbenchData(), tasks:[{id:"new",title:"变化",priority:"中",status:"open",createdAt:""}] });
  fireEvent.click(screen.getByRole("button", { name:"确认永久删除" }));
  expect(screen.getByText(/数据已发生变化/)).toBeTruthy();
  expect(loadLocalWorkbenchData().suppliers).toHaveLength(1);
});
