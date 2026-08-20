# Product Production Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将产品知识从理论成本拆解改为可用于询价、打样和验货的生产端知识，并提供按需技术趋势分析。

**Architecture:** 保留现有 `ProductKnowledgeV2` 和原始文档兼容层，新增真实采购报价、原料结构、设备与技术趋势字段；旧成本数据只存档、不再参与前台展示。默认产品调研提示词和解析器使用同一套中文章节，详情、对比和简报共享结构化数据。

**Tech Stack:** Next.js 15、React 19、TypeScript、Zod、Vitest、localStorage。

## Global Constraints

- 不调用付费 AI 完成导入或展示。
- 价格只接受用户提供的 1688、供应商或实际采购报价。
- 不再推算材料成本、加工成本或理论硬成本。
- 技术趋势必须由用户主动调用，空数据不显示模块。
- 旧成本资料保留在原始数据中，不丢失、不参与判断。
- UI 和导出统一使用中文。

---

### Task 1: 扩展生产端数据模型并兼容旧记录

**Files:**
- Modify: `src/features/workbench/product-knowledge.ts`
- Test: `tests/domain/product-knowledge.test.ts`
- Test: `tests/domain/local-store.test.ts`

**Interfaces:**
- Produces: `ProductProcurementQuote`、`ProductMaterialStructure`、`ProductTechnologyOutlook`
- Extends: `ProductKnowledgeV2.procurementQuotes`、`materials`、`machinery`、`qualityControls`、`industryClusters`、`technologyOutlook`
- Preserves: legacy `costItems`、`hardCostTotal`、`hardCostStatus` only for compatibility

- [ ] **Step 1: 写失败测试，确认新字段可保存且旧成本只保留不计算**

```ts
it("stores production intelligence without promoting legacy hard costs", () => {
  const product = normalizeProductKnowledge({
    ...baseProduct(),
    procurementQuotes: [{ source: "1688", specification: "20×30cm", price: "12元/套", moq: "10套" }],
    materials: [{ name: "亚克力板", role: "主体板材", keyParameters: "厚度、透光率" }],
    machinery: ["激光切割机", "UV打印机"],
    qualityControls: ["检查板材平整度"],
    industryClusters: ["浙江台州"],
    costItems: [{ id: "legacy", category: "主材", name: "旧估算", subtotal: 8, currency: "CNY" }],
    hardCostTotal: 8,
    hardCostStatus: "confirmed"
  });

  expect(product.procurementQuotes[0].price).toBe("12元/套");
  expect(product.materials[0].name).toBe("亚克力板");
  expect(product.hardCostStatus).toBe("pending");
  expect(product.rawDocument?.rawData).toMatchObject({ hardCostTotal: 8 });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/domain/product-knowledge.test.ts tests/domain/local-store.test.ts --exclude ".worktrees/**"`

Expected: FAIL，新生产端字段尚未定义。

- [ ] **Step 3: 实现最小 schema 与保守迁移**

```ts
export const ProductProcurementQuoteSchema = z.object({
  source: z.string(), specification: z.string(), price: z.string(),
  moq: z.string().optional(), freight: z.string().optional(), quotedAt: z.string().optional()
});

export const ProductMaterialStructureSchema = z.object({
  name: z.string(), role: z.string().optional(),
  keyParameters: z.string().optional(), weaknesses: z.string().optional()
});

export const ProductTechnologyOutlookSchema = z.object({
  mainstream: z.array(z.string()), alternatives: z.array(z.string()),
  emerging: z.array(z.string()), replacementRisks: z.array(z.string()),
  watchSignals: z.array(z.string()), updatedAt: z.string().optional()
});
```

旧记录读取时初始化空数组；旧成本字段移动或复制到 `rawDocument.rawData`，前台状态统一为 `pending`。

- [ ] **Step 4: 运行测试并提交**

Run: `npm test -- tests/domain/product-knowledge.test.ts tests/domain/local-store.test.ts --exclude ".worktrees/**"`

Expected: PASS。

Commit: `git commit -m "feat: model product production intelligence"`

---

### Task 2: 替换统一调研提示词和 Markdown 解析口径

**Files:**
- Modify: `src/features/workbench/product-research-prompt.ts`
- Modify: `src/features/workbench/product-research-parser.ts`
- Test: `tests/domain/product-research-prompt.test.ts`
- Test: `tests/domain/product-research-parser.test.ts`

**Interfaces:**
- Keeps: `PRODUCT_RESEARCH_PROMPT: string`
- Keeps: `parseProductResearchMarkdown(rawText, source): ParsedProductResearch`
- Parses headings: `产品与规格`、`1688采购参考`、`原料与结构`、`生产流程与设备`、`缺陷与风险`、`成熟替代与优化`、`采购与验证`

- [ ] **Step 1: 写失败测试，禁止理论成本并要求生产端内容**

```ts
expect(PRODUCT_RESEARCH_PROMPT).toContain("不得推算理论成本");
expect(PRODUCT_RESEARCH_PROMPT).toContain("1688采购参考");
expect(PRODUCT_RESEARCH_PROMPT).toContain("原料与结构");
expect(PRODUCT_RESEARCH_PROMPT).toContain("生产流程与设备");
expect(PRODUCT_RESEARCH_PROMPT).not.toContain("产品硬成本合计");
```

解析样例必须断言真实报价、材料、设备、质控点和产业带进入对应字段，未提供报价时保持空数组且不产生阻断问题。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/domain/product-research-prompt.test.ts tests/domain/product-research-parser.test.ts --exclude ".worktrees/**"`

Expected: FAIL，旧提示词仍要求市场原料价和硬成本。

- [ ] **Step 3: 修改提示词和解析器**

提示词只追问影响质量、工艺和报价的关键参数，每轮最多 5 个；真实报价表采用：

```md
| 来源 | 对应规格 | 批发报价 | MOQ | 运费口径 | 报价时间 |
| --- | --- | --- | --- | --- | --- |
```

原料结构、生产流程、设备、质控、缺陷和成熟替代分别解析；旧标题继续兼容，但旧成本表只保留到 `rawDocument.content/rawData`。

- [ ] **Step 4: 运行测试并提交**

Run: `npm test -- tests/domain/product-research-prompt.test.ts tests/domain/product-research-parser.test.ts --exclude ".worktrees/**"`

Expected: PASS。

Commit: `git commit -m "feat: focus product research on production"`

---

### Task 3: 更新录入编辑器、产品列表和详情页

**Files:**
- Modify: `src/components/workbench/product-knowledge-editor.tsx`
- Modify: `src/app/products/page.tsx`
- Modify: `src/app/products/[productId]/page.tsx`
- Test: `tests/ui/product-knowledge-editor.test.tsx`
- Test: `tests/ui/product-import-flow.test.ts`

**Interfaces:**
- Editor edits all default production-intelligence fields.
- Detail hides legacy costs and empty technology outlook.

- [ ] **Step 1: 写失败 UI 测试**

```ts
expect(html).toContain("1688采购参考");
expect(html).toContain("原料与结构");
expect(html).toContain("生产流程与设备");
expect(html).toContain("采购与验证");
expect(html).not.toContain("硬成本合计");
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/ui/product-knowledge-editor.test.tsx tests/ui/product-import-flow.test.ts --exclude ".worktrees/**"`

Expected: FAIL，页面仍展示硬成本。

- [ ] **Step 3: 更新编辑和展示**

删除成本行编辑器和硬成本卡片；新增采购报价、材料结构、设备、质控和产业带编辑区。产品列表不再显示硬成本，改为显示关键工艺、主要材料和真实报价数量。详情页按设计文档顺序展示，空模块不渲染。

- [ ] **Step 4: 运行测试并提交**

Run: `npm test -- tests/ui/product-knowledge-editor.test.tsx tests/ui/product-import-flow.test.ts --exclude ".worktrees/**"`

Expected: PASS。

Commit: `git commit -m "feat: show production intelligence in product library"`

---

### Task 4: 统一产品对比表和知识简报

**Files:**
- Modify: `src/features/workbench/product-comparison.ts`
- Modify: `src/features/workbench/product-brief.ts`
- Modify: `src/app/products/compare/page.tsx`
- Modify: `src/app/products/[productId]/brief/page.tsx`
- Test: `tests/domain/product-comparison.test.ts`
- Test: `tests/domain/product-brief.test.ts`

**Interfaces:**
- `buildProductComparison()` compares production facts and real procurement quotes only.
- `buildProductBrief()` outputs the same production-intelligence sections as product detail.

- [ ] **Step 1: 写失败测试**

```ts
expect(comparison.rows.some((row) => row.label === "产品硬成本")).toBe(false);
expect(comparison.rows.find((row) => row.label === "1688采购参考")?.values[0]).toContain("12元/套");
expect(brief.sections.find((section) => section.title === "生产流程与设备")).toBeDefined();
expect(brief.facts.some(([label]) => label === "产品硬成本")).toBe(false);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/domain/product-comparison.test.ts tests/domain/product-brief.test.ts --exclude ".worktrees/**"`

Expected: FAIL，旧输出仍比较硬成本。

- [ ] **Step 3: 修改共享输出模型**

对比字段固定为关键规格、采购报价、材料结构、工艺、设备、质控、缺陷、成熟替代和采购验证；简报使用同一口径，不增加组货建议。

- [ ] **Step 4: 运行测试并提交**

Run: `npm test -- tests/domain/product-comparison.test.ts tests/domain/product-brief.test.ts --exclude ".worktrees/**"`

Expected: PASS。

Commit: `git commit -m "feat: align product comparison and brief"`

---

### Task 5: 增加按需技术趋势入口并完成回归验证

**Files:**
- Create: `src/features/workbench/product-technology-prompt.ts`
- Modify: `src/app/products/[productId]/page.tsx`
- Modify: `src/components/workbench/product-knowledge-editor.tsx`
- Create: `tests/domain/product-technology-prompt.test.ts`
- Modify: `tests/ui/product-knowledge-editor.test.tsx`

**Interfaces:**
- Produces: `buildProductTechnologyPrompt(product: ProductKnowledgeV2): string`
- UI action: copy prompt; no API call.
- Storage: user pastes verified trend findings into optional `technologyOutlook` fields during edit.

- [ ] **Step 1: 写失败测试**

```ts
const prompt = buildProductTechnologyPrompt(product);
expect(prompt).toContain(product.name);
expect(prompt).toContain("当前主流技术路线");
expect(prompt).toContain("正在进入市场的新材料");
expect(prompt).toContain("区分已验证事实、公开行业动向和推断");
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/domain/product-technology-prompt.test.ts tests/ui/product-knowledge-editor.test.tsx --exclude ".worktrees/**"`

Expected: FAIL，按需提示词和入口尚不存在。

- [ ] **Step 3: 实现复制入口和可选保存区**

详情页按钮文案为“复制技术趋势分析提示词”，明确“当前不会自动调用付费 AI”。编辑器仅在用户选择补充时展示主流路线、替代路线、新技术、被替代风险和观察信号；无数据时详情页不显示趋势模块。

- [ ] **Step 4: 全量验证**

Run: `npm test -- --exclude ".worktrees/**"`

Run: `npx tsc --noEmit`

Run: `npm run build`

Expected: 全部通过；产品录入、旧数据读取、详情、对比、简报和趋势入口正常。

- [ ] **Step 5: 浏览器检查并提交**

在 `http://127.0.0.1:3000/products` 检查桌面和窄屏：文字不重叠、无硬成本展示、空趋势区不出现、复制按钮可用。

Commit: `git commit -m "feat: add opt-in product technology outlook"`

