# Decision Field Explanations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将产品页和供应商页的解释性内容收敛为小区块，并为影响决策的字段提供可访问的问号说明。

**Architecture:** 新增一个轻量的 `HelpHint` 展示组件，使用原生 `title` 与键盘可聚焦按钮承载说明；产品页删除大面积口径卡片，供应商页把口径说明收敛到标题和关键表头附近。只改呈现层，不改变现有数据计算和决策逻辑。

**Tech Stack:** Next.js 15、React、TypeScript、Tailwind CSS、Vitest。

## Global Constraints

- 不删除原始数据、不改变现有计算公式、不引入库存推算。
- 当前只接收入仓数据时，库存/可售不作为决策字段，不在主页面制造待采集噪音。
- 说明文案必须与当前数据来源一致。

---

### Task 1: Add accessible decision-field hint component

**Files:**
- Create: `src/components/workbench/help-hint.tsx`
- Test: `tests/components/help-hint.test.tsx`

**Interfaces:**
- Produces `HelpHint({ label, description }: { label: string; description: string })`.
- Renders a visually compact `?` control with an accessible label and native hover/focus title.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { HelpHint } from "@/components/workbench/help-hint";

test("shows the decision field explanation on a focusable hint", () => {
  render(<HelpHint label="实际入仓" description="来自当前统计月的入仓记录，不代表库存余额。" />);

  const hint = screen.getByRole("button", { name: "实际入仓说明" });
  expect(hint).toHaveAttribute("title", "来自当前统计月的入仓记录，不代表库存余额。");
  expect(hint).toHaveTextContent("?");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/help-hint.test.tsx`
Expected: FAIL because `HelpHint` does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
export function HelpHint({ label, description }: { label: string; description: string }) {
  return (
    <button
      aria-label={`${label}说明`}
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] text-muted hover:border-action hover:text-action focus:outline-none focus:ring-2 focus:ring-action/30"
      title={description}
      type="button"
    >
      ?
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/help-hint.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/workbench/help-hint.tsx tests/components/help-hint.test.tsx
git commit -m "feat: add decision field explanations"
```

### Task 2: Simplify product master explanation area

**Files:**
- Modify: `src/app/product-master/page.tsx`
- Test: `tests/components/product-master-page.test.tsx`

**Interfaces:**
- Consumes `HelpHint` from Task 1.
- Preserves existing product decision rows and operating data values.

- [ ] **Step 1: Write the failing test**

```tsx
test("renders a compact data policy and field hints instead of source cards", () => {
  render(<ProductMasterPage />);
  expect(screen.getByText("数据口径")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "实际入仓说明" })).toBeInTheDocument();
  expect(screen.queryByText("产品表现数据")).not.toBeInTheDocument();
  expect(screen.queryByText("使用右上角统计月份导入并保存；只写入能匹配内部编码的 SKU。")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/product-master-page.test.tsx`
Expected: FAIL because the page still renders the three source cards and does not expose the hint control.

- [ ] **Step 3: Implement the minimal UI change**

Remove the three `SourceNote` cards and the long instructional footer. Replace them with a compact line titled `数据口径`, containing the existing source summary in one sentence. Import `HelpHint` and append it to the headers for `实际入仓`, `退货率`, `供应关系`, and `关注提示`, using descriptions that explicitly state inbound data is not inventory.

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- tests/components/product-master-page.test.tsx && npm test`
Expected: focused test and full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/product-master/page.tsx tests/components/product-master-page.test.tsx
git commit -m "refactor: streamline product master explanations"
```

### Task 3: Simplify supplier page explanations

**Files:**
- Modify: `src/app/suppliers/page.tsx`
- Test: `tests/components/suppliers-page.test.tsx`

**Interfaces:**
- Consumes `HelpHint` from Task 1.
- Keeps supplier decision overview, score calculation, pagination, and actions unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
test("keeps decision evidence visible and exposes compact score explanations", () => {
  render(<SuppliersPage />);
  expect(screen.getByText(/供应商评分总览/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "退货率信号说明" })).toBeInTheDocument();
  expect(screen.queryByText(/交付、服务等无来源数据不补分/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/suppliers-page.test.tsx`
Expected: FAIL because the page has no hint control and still renders the long score formula note.

- [ ] **Step 3: Implement the minimal UI change**

Import `HelpHint`, replace the long score note with a compact `数据口径` line, and add hints to `本月入仓`, `退货率信号`, `供应关系`, `建议动作`, and the score heading. The descriptions must state that return rate is a quality-review signal, not direct attribution in multi-supplier scenarios, and that missing delivery/service evidence is not backfilled.

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- tests/components/suppliers-page.test.tsx && npm test`
Expected: focused test and full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/suppliers/page.tsx tests/components/suppliers-page.test.tsx
git commit -m "refactor: streamline supplier decision explanations"
```

### Task 4: Visual and production verification

**Files:**
- Modify: none

- [ ] **Step 1: Run typecheck and production build**

Run: `npx tsc --noEmit` and `npm run build`
Expected: both commands complete successfully.

- [ ] **Step 2: Check local routes**

Open `/product-master` and `/suppliers`; verify the main tables retain their values, the explanation area is compact, and every `?` is keyboard-focusable with a readable title.

- [ ] **Step 3: Commit any only-if-needed verification fix**

If verification reveals a real layout or accessibility defect, add a focused test first, fix it, rerun the relevant checks, and commit with `fix:`. Otherwise leave the implementation commits unchanged.
