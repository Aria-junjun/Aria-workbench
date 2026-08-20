# 货盘报价列表与 SKU 比价 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有货盘页上增加列表视图、SKU比价视图和右侧详情抽屉，同时保留原有卡片、筛选、置顶、勾选和对比表能力。

**Architecture:** 继续使用 `src/app/offers/page.tsx` 作为页面容器，新增纯展示/计算组件和小型领域辅助函数；不改变 `LocalOffer` 数据结构，不删除原始报价文本。第一阶段使用现有字段计算关联状态和聚合结果，缺失信息显示“未记录”，低置信度匹配不自动合并。

**Tech Stack:** Next.js App Router, React client components, TypeScript, Tailwind CSS, lucide-react, Vitest/Testing Library。

## Global Constraints

- 保留现有货盘数据、原始报价文字、1688链接、搜索、置顶、筛选、勾选和 `/quotes` 对比流程。
- 不接入聚水潭，不删除或批量合并货盘，不重做首页和左侧导航。
- 不把缺失字段当作0或低风险；统一显示“未记录”或“待确认”。
- 第一阶段不自动确认低置信度的相似商品匹配。
- 页面视觉继续使用现有工作台的圆角、边框、浅色背景和 `action` 色系。

---

### Task 1: 建立货盘页面展示辅助函数和视图状态

**Files:**
- Modify: `src/app/offers/page.tsx`
- Create: `src/features/workbench/offer-presentation.ts`
- Test: `tests/domain/offer-presentation.test.ts`

**Interfaces:**
- `getOfferCompleteness(offer: LocalOffer): "structured" | "partial" | "pending_review"`
- `getOfferRelationStatus(offer: LocalOffer): "已关联" | "待确认" | "未关联"`
- `getOfferDisplayPrice(offer: LocalOffer): string`
- `getOfferDisplaySkuCount(offer: LocalOffer): number`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { getOfferCompleteness, getOfferDisplayPrice, getOfferRelationStatus } from "@/features/workbench/offer-presentation";

describe("offer presentation", () => {
  it("shows a normalized range when numeric min and max exist", () => {
    expect(getOfferDisplayPrice({ minPrice: 2, maxPrice: 5 } as never)).toBe("¥2.00 - ¥5.00");
  });

  it("keeps missing prices visible as unrecorded", () => {
    expect(getOfferDisplayPrice({ quotedPrice: "" } as never)).toBe("未记录");
  });

  it("distinguishes incomplete data from a linked offer", () => {
    expect(getOfferCompleteness({ quotedPrice: "供应商说后天可发" } as never)).toBe("partial");
    expect(getOfferRelationStatus({ supplierName: "供应商A", productId: "product-1" } as never)).toBe("已关联");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --run tests/domain/offer-presentation.test.ts`

Expected: FAIL because `offer-presentation.ts` does not exist.

- [ ] **Step 3: Implement the helpers**

Use only existing `LocalOffer` fields. Treat `productId`, `productName`, or an existing related product reference as linked; otherwise use `待确认` when meaningful supplier/product information exists and `未关联` when no relation data exists. Never infer a product match from name similarity in this task.

- [ ] **Step 4: Run the focused test**

Run: `npm test -- --run tests/domain/offer-presentation.test.ts`

Expected: PASS.

### Task 2: Add list view without removing the current card view

**Files:**
- Modify: `src/app/offers/page.tsx`
- Create: `src/components/workbench/offer-list-view.tsx`
- Test: `tests/ui/offers-list-view.test.tsx`

**Interfaces:**
- `OfferListView({ offers, selectedOfferIds, onToggleSelected, onPin, onOpenDetails, onAddToCompare })`
- `OfferViewMode = "cards" | "list" | "sku" | "supplier"`

- [ ] **Step 1: Add a failing rendering test**

```tsx
it("renders comparable columns and preserves selection", () => {
  render(<OfferListView {...fixtureProps} />);
  expect(screen.getByText("商品/货盘")).toBeInTheDocument();
  expect(screen.getByText("供应商")).toBeInTheDocument();
  expect(screen.getByText("MOQ")).toBeInTheDocument();
  expect(screen.getByText("未记录")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /选择/ })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --run tests/ui/offers-list-view.test.tsx`

Expected: FAIL because `OfferListView` does not exist.

- [ ] **Step 3: Implement the list component**

Render a responsive table with columns for 商品/货盘、供应商、报价、MOQ、交期、关联状态、更新时间 and 操作. Keep the existing card rendering in `offers/page.tsx` under the `cards` mode. Use horizontal scrolling on narrow screens and keep the current checkbox, pin, detail link, and 1688 link behaviors.

- [ ] **Step 4: Add view-mode controls to `OffersPage`**

Default to `list` on desktop and retain `cards` as an explicit option. Add `SKU比价` and `供应商报价` buttons as visible modes; the first implementation may render their empty/selection states until Tasks 3 and 4 are complete.

- [ ] **Step 5: Run focused UI tests**

Run: `npm test -- --run tests/ui/offers-list-view.test.tsx tests/ui/cloud-parity-contract.test.ts`

Expected: PASS.

### Task 3: Add the right-side offer detail drawer

**Files:**
- Create: `src/components/workbench/offer-detail-drawer.tsx`
- Modify: `src/app/offers/page.tsx`
- Test: `tests/ui/offer-detail-drawer.test.tsx`

**Interfaces:**
- `OfferDetailDrawer({ offer, open, onClose, onAddToCompare })`

- [ ] **Step 1: Write the failing interaction test**

```tsx
it("shows structured fields and preserves raw quote text", () => {
  render(<OfferDetailDrawer offer={fixtureOffer} open onClose={vi.fn()} onAddToCompare={vi.fn()} />);
  expect(screen.getByText("原始资料")).toBeInTheDocument();
  expect(screen.getByText(fixtureOffer.priceDetails)).toBeInTheDocument();
  expect(screen.getByText("关联产品")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "加入对比" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run: `npm test -- --run tests/ui/offer-detail-drawer.test.tsx`

Expected: FAIL because the drawer does not exist.

- [ ] **Step 3: Implement the drawer**

Use the existing `LocalOffer` fields. Show product, supplier, 1688/resource links, price, MOQ, lead time, SKU count, relation status, source/update metadata when present, then render the complete raw quote text. Missing values display `未记录`. Use a right-side panel on desktop and a full-width bottom sheet style on small screens.

- [ ] **Step 4: Wire list and card actions to the drawer**

Clicking 查看 or the row title opens the drawer without navigating away. Existing direct detail links remain available as secondary links.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- --run tests/ui/offer-detail-drawer.test.tsx tests/ui/offers-list-view.test.tsx`

Expected: PASS.

### Task 4: Add SKU and supplier aggregate views

**Files:**
- Create: `src/components/workbench/offer-aggregate-views.tsx`
- Modify: `src/app/offers/page.tsx`
- Test: `tests/domain/offer-aggregates.test.ts`
- Test: `tests/ui/offer-aggregate-views.test.tsx`

**Interfaces:**
- `groupOffersByProduct(offers: LocalOffer[]): Array<{ key: string; label: string; offers: LocalOffer[] }>`
- `groupOffersBySupplier(offers: LocalOffer[]): Array<{ key: string; supplierName: string; offers: LocalOffer[] }>`
- `OfferSkuCompareView({ groups, onOpenDetails, onAddToCompare })`
- `SupplierOfferView({ groups, onOpenDetails })`

- [ ] **Step 1: Write failing aggregation tests**

```ts
it("groups repeated product names so suppliers can be compared", () => {
  const groups = groupOffersByProduct([offer("防撞条", "供应商A"), offer("防撞条", "供应商B")]);
  expect(groups).toHaveLength(1);
  expect(groups[0].offers).toHaveLength(2);
});
```

- [ ] **Step 2: Run domain and UI tests to verify failure**

Run: `npm test -- --run tests/domain/offer-aggregates.test.ts tests/ui/offer-aggregate-views.test.tsx`

Expected: FAIL because the aggregation helpers and views do not exist.

- [ ] **Step 3: Implement conservative grouping**

Group by an existing stable product reference when present; otherwise use a normalized display name only for presentation grouping. Do not mutate offers or claim that the grouped records are the same canonical SKU. Display a `待确认` indicator when grouping is name-based.

- [ ] **Step 4: Implement SKU comparison view**

For each group, show supplier, price, MOQ, lead time, SKU count, relation state, and current score if already available. Keep missing values visible and provide actions to open detail or add the offer to the existing `/quotes` comparison flow.

- [ ] **Step 5: Implement supplier view**

Aggregate supplier name, offer count, SKU count, latest update and known score. Do not calculate a new supplier score in this task.

- [ ] **Step 6: Run focused and full tests**

Run: `npm test -- --run tests/domain/offer-aggregates.test.ts tests/ui/offer-aggregate-views.test.tsx tests/ui/cloud-parity-contract.test.ts`

Expected: PASS.

### Task 5: Verify the complete page and preserve existing behavior

**Files:**
- Modify: `tests/ui/cloud-parity-contract.test.ts` only if a stable contract is needed for the new view labels.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: all existing and new tests PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Next.js build completes without TypeScript or route errors.

- [ ] **Step 3: Verify the local page**

Open `http://localhost:3000/offers` and verify:

- list view loads without data loss;
- card view still works;
- selection still enables `生成对比表`;
- detail drawer preserves raw quote text;
- SKU grouping shows comparison rows;
- supplier grouping shows aggregate rows;
- existing `/quotes` comparison still opens.

- [ ] **Step 4: Review changed files and report limitations**

Confirm no data migration or external API integration was introduced. Report that automatic product matching, supplier-score automation, 1688 import and Jushuitan sync remain later phases.
