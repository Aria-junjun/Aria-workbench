# 产品知识 V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立独立于快速录入的产品研究资料库，让用户复制统一提示词、导入 ChatGPT Plus 生成的标准文档、校验编辑后入库，并生成产品对比表和产品知识简报。

**Architecture:** 新增独立的产品研究领域模型、Markdown 解析器和本地存储迁移层，保留原始文档与结构化数据双层记录。产品知识使用 `/products/import` 和 `/products/review/[draftId]` 完成导入确认，现有 `/products` 与详情页升级为 V2 展示；快速录入不再生成产品知识。所有解析和比较在本地完成，不调用付费 AI。

**Tech Stack:** Next.js 15 App Router、React 19、TypeScript、Zod、Vitest、Playwright、浏览器 localStorage、`mammoth`（仅用于 `.docx` 文本提取）。

## Global Constraints

- 产品知识必须独立于供应商、沟通记录和货盘快速录入。
- 工作台不得在产品文档导入时再次调用 AI。
- 不核算广告、平台、客服、仓储、快递和售后等电商链路成本。
- 不生成组货建议表。
- 缺少成本依据时使用“待确认”，不得猜测确定成本。
- 同时保留原始调研文档和结构化产品数据。
- 导入确认前所有结构化字段必须可编辑。
- 本期只提供产品对比表和产品知识简报两种输出。
- 现有产品知识记录不得丢失或被伪造补全。
- UI 文案使用中文。

---

## File Structure

### New domain files

- `src/features/workbench/product-knowledge.ts`：V2 类型、Zod schema、旧数据迁移、成本合计和搜索文本。
- `src/features/workbench/product-research-prompt.ts`：统一调研提示词常量。
- `src/features/workbench/product-research-parser.ts`：固定 Markdown 标题、键值和表格解析及问题校验。
- `src/features/workbench/product-comparison.ts`：产品可比性、统一口径和对比行生成。
- `src/features/workbench/product-brief.ts`：知识简报的可打印视图模型。
- `src/features/workbench/product-import-store.ts`：临时导入草稿的 localStorage 读写。
- `src/components/workbench/product-knowledge-editor.tsx`：导入确认页和详情页共用的结构化字段编辑器。

### New routes

- `src/app/products/import/page.tsx`：提示词复制、文本粘贴和文件上传。
- `src/app/products/review/[draftId]/page.tsx`：解析结果校验、编辑和入库。
- `src/app/products/compare/page.tsx`：已选产品对比表。
- `src/app/products/[productId]/brief/page.tsx`：产品知识简报及打印入口。
- `src/app/api/products/file/route.ts`：`.md`、`.txt`、`.docx` 文件文本提取。

### Modified files

- `package.json` / lockfile：增加 `mammoth`。
- `src/features/workbench/local-store.ts`：保存 V2 数据并迁移旧记录。
- `src/features/workbench/schemas.ts`：停止把产品知识作为快速录入输出。
- `src/features/workbench/ai-extraction.ts`：删除快速录入产品知识提示与本地兜底生成。
- `src/app/intake/page.tsx`：删除快速录入中的产品知识提示。
- `src/app/review/[draftId]/page.tsx`：删除快速录入确认页中的产品知识区块。
- `src/app/products/page.tsx`：升级产品库入口、筛选、勾选和对比操作。
- `src/app/products/[productId]/page.tsx`：升级 V2 详情和编辑。

### Tests

- `tests/domain/product-knowledge.test.ts`
- `tests/domain/product-research-parser.test.ts`
- `tests/domain/product-file-text.test.ts`
- `tests/domain/product-comparison.test.ts`
- `tests/domain/product-brief.test.ts`
- `tests/domain/local-store.test.ts`
- `tests/domain/ai-extraction.test.ts`
- `tests/e2e/product-knowledge-v2.spec.ts`

---

### Task 1: 建立产品知识 V2 数据契约和旧数据迁移

**Files:**
- Create: `src/features/workbench/product-knowledge.ts`
- Create: `tests/domain/product-knowledge.test.ts`
- Modify: `src/features/workbench/local-store.ts`
- Modify: `tests/domain/local-store.test.ts`

**Interfaces:**
- Produces: `ProductSpecification`、`ProductCostItem`、`ProductManufacturing`、`ProductOptimizationOption`、`ProductRiskSet`、`ProductDecisionSummary`、`ProductResearchDocument`、`ProductKnowledgeV2`。
- Produces: `normalizeProductKnowledge(value: unknown): LocalProductKnowledge`。
- Produces: `calculateHardCost(items: ProductCostItem[]): { total?: number; status: "confirmed" | "pending" }`。
- Consumes later: parser、存储、详情、对比和简报全部使用上述类型。

- [ ] **Step 1: 写 V2 schema 和旧数据迁移失败测试**

```ts
import { describe, expect, it } from "vitest";
import { calculateHardCost, normalizeProductKnowledge } from "@/features/workbench/product-knowledge";

describe("product knowledge v2", () => {
  it("migrates legacy text fields without inventing structured costs", () => {
    const product = normalizeProductKnowledge({
      id: "legacy-1",
      name: "亚克力留言板",
      materials: "3mm 亚克力板",
      costStructure: "板材和激光切割",
      keyParameters: "尺寸 20x30cm",
      createdAt: "2026-07-01T00:00:00.000Z"
    });

    expect(product.schemaVersion).toBe(2);
    expect(product.specifications).toContainEqual(expect.objectContaining({ name: "旧版关键参数" }));
    expect(product.costItems).toEqual([]);
    expect(product.hardCostStatus).toBe("pending");
    expect(product.legacyNotes).toContain("板材和激光切割");
  });

  it("returns pending when any included cost lacks a subtotal", () => {
    expect(calculateHardCost([
      { id: "1", category: "主材", name: "亚克力板", subtotal: 8, currency: "CNY" },
      { id: "2", category: "加工", name: "激光切割", currency: "CNY" }
    ])).toEqual({ status: "pending" });
  });

  it("sums complete hard-cost rows", () => {
    expect(calculateHardCost([
      { id: "1", category: "主材", name: "亚克力板", subtotal: 8, currency: "CNY" },
      { id: "2", category: "加工", name: "激光切割", subtotal: 2, currency: "CNY" }
    ])).toEqual({ total: 10, status: "confirmed" });
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/domain/product-knowledge.test.ts`

Expected: FAIL，提示 `product-knowledge` 模块不存在。

- [ ] **Step 3: 实现类型、Zod schema、成本计算和兼容迁移**

`ProductKnowledgeV2` 至少包含以下稳定字段：

```ts
export type ProductKnowledgeV2 = {
  schemaVersion: 2;
  id: string;
  pinned?: boolean;
  name: string;
  category?: string;
  coreUse?: string;
  targetUsers?: string;
  useScenarios: string[];
  defaultUnit?: string;
  specifications: ProductSpecification[];
  costItems: ProductCostItem[];
  hardCostTotal?: number;
  hardCostStatus: "confirmed" | "pending";
  manufacturing: ProductManufacturing;
  optimizationOptions: ProductOptimizationOption[];
  risks: ProductRiskSet;
  opportunities: string[];
  decision: ProductDecisionSummary;
  rawDocument?: ProductResearchDocument;
  importIssues: ProductImportIssue[];
  legacyNotes?: string;
  createdAt: string;
  updatedAt?: string;
};
```

`normalizeProductKnowledge` 必须接受旧版对象，将旧字段映射为可读的动态条目或 `legacyNotes`，但 `costItems` 保持空数组，`hardCostStatus` 为 `pending`。

- [ ] **Step 4: 在 local-store 读取路径中统一调用迁移函数**

修改 `normalizeWorkbenchData` 的 products 分支，使每条记录都经过 `normalizeProductKnowledge`；更新 `LocalProductKnowledge` 为 `ProductKnowledgeV2` 的导出别名。保留 backup 导入导出格式兼容。

- [ ] **Step 5: 运行领域和存储测试**

Run: `npm test -- tests/domain/product-knowledge.test.ts tests/domain/local-store.test.ts`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/features/workbench/product-knowledge.ts src/features/workbench/local-store.ts tests/domain/product-knowledge.test.ts tests/domain/local-store.test.ts
git commit -m "feat: add product knowledge v2 model"
```

---

### Task 2: 建立统一调研提示词和 Markdown 解析器

**Files:**
- Create: `src/features/workbench/product-research-prompt.ts`
- Create: `src/features/workbench/product-research-parser.ts`
- Create: `tests/domain/product-research-parser.test.ts`

**Interfaces:**
- Consumes: `ProductKnowledgeV2` 及其子类型。
- Produces: `PRODUCT_RESEARCH_PROMPT: string`。
- Produces: `parseProductResearchMarkdown(rawText: string, source?: ProductResearchSource): ParsedProductResearch`。
- Produces: `ParsedProductResearch = { product: ProductKnowledgeV2; issues: ProductImportIssue[] }`。

- [ ] **Step 1: 写标准文档、缺失字段、成本矛盾和未知段落测试**

测试样例必须包含：产品定位、动态规格、两条成本、制造方式、替代方案、风险、延伸机会和决策摘要。断言：

```ts
const parsed = parseProductResearchMarkdown(STANDARD_MARKDOWN, { fileName: "亚克力留言板.md", importedAt: "2026-07-16T00:00:00.000Z" });
expect(parsed.product.name).toBe("亚克力留言板");
expect(parsed.product.specifications).toContainEqual(expect.objectContaining({ name: "厚度", value: "3", unit: "mm" }));
expect(parsed.product.costItems).toHaveLength(2);
expect(parsed.product.rawDocument?.content).toBe(STANDARD_MARKDOWN);
expect(parsed.issues).toEqual([]);
```

另外断言：缺少产品名称产生 `blocking` 问题；成本表缺小计产生 `warning`；声明合计与明细不一致产生 `conflict`；自定义未知章节仍保留在 `rawDocument.content`。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/domain/product-research-parser.test.ts`

Expected: FAIL，提示解析器不存在。

- [ ] **Step 3: 实现固定标题解析和按列名映射的表格解析**

解析器使用行级状态机识别 `##` 标题、`字段：值` 和 Markdown 表格。表格必须按中文列名映射，不依赖列顺序。支持的规范标题固定为设计文档第 6 节的八个标题。

问题类型固定为：

```ts
export type ProductImportIssue = {
  id: string;
  severity: "blocking" | "warning" | "conflict";
  section: string;
  message: string;
};
```

- [ ] **Step 4: 编写统一提示词常量**

提示词必须明确：先识别关键缺口、每轮最多提问 5 个、不允许猜测价格、时效数据记录来源日期地区、最终只输出固定 Markdown 模板、不输出 JSON、不增加章节。

- [ ] **Step 5: 运行解析器测试**

Run: `npm test -- tests/domain/product-research-parser.test.ts`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/features/workbench/product-research-prompt.ts src/features/workbench/product-research-parser.ts tests/domain/product-research-parser.test.ts
git commit -m "feat: parse standard product research documents"
```

---

### Task 3: 建立产品导入草稿存储和独立入库函数

**Files:**
- Create: `src/features/workbench/product-import-store.ts`
- Modify: `src/features/workbench/local-store.ts`
- Modify: `tests/domain/local-store.test.ts`

**Interfaces:**
- Produces: `saveProductImportDraft(parsed: ParsedProductResearch): string`，返回 draft id。
- Produces: `loadProductImportDraft(id: string): ParsedProductResearch | undefined`。
- Produces: `updateProductImportDraft(id: string, product: ProductKnowledgeV2): void`。
- Produces: `deleteProductImportDraft(id: string): void`。
- Produces: `saveProductKnowledge(product: ProductKnowledgeV2): ProductKnowledgeV2`。

- [ ] **Step 1: 写草稿生命周期和正式入库测试**

断言草稿使用独立 localStorage key `personal-commercial-workbench-product-imports`，不会进入正式 products；确认入库后产品出现在正式库，原始文档仍存在，草稿被删除。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/domain/local-store.test.ts`

Expected: FAIL，提示产品导入草稿函数不存在。

- [ ] **Step 3: 实现草稿存储和正式入库**

`saveProductKnowledge` 在写入前重新计算成本状态、更新时间并执行 schema 校验。存在 `blocking` 问题时抛出中文错误“产品名称缺失，无法入库”。warning 和 conflict 允许用户确认后入库并保留在记录中。

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/domain/local-store.test.ts tests/domain/product-knowledge.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/features/workbench/product-import-store.ts src/features/workbench/local-store.ts tests/domain/local-store.test.ts
git commit -m "feat: add product research import drafts"
```

---

### Task 4: 支持 Markdown、文本和 Word 文档输入

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/app/api/products/file/route.ts`
- Create: `tests/domain/product-file-text.test.ts`
- Create or Modify: `src/features/workbench/file-text.ts`

**Interfaces:**
- Produces: `extractProductResearchFileText(input: FileTextInput): Promise<string>`。
- API contract: multipart field `file`，成功返回 `{ fileName, text }`；失败返回 `{ error }` 和 HTTP 400。

- [ ] **Step 1: 安装 docx 文本提取依赖**

Run: `npm install mammoth`

Expected: `package.json` 和 lockfile 增加 `mammoth`。

- [ ] **Step 2: 写文件类型测试**

覆盖 `.md`、`.txt` 的 UTF-8 文本读取、空文件拒绝、不支持扩展名拒绝。为 `.docx` 使用最小 fixture 或 mock `mammoth.extractRawText`，断言返回纯文本。

- [ ] **Step 3: 运行测试并确认失败**

Run: `npm test -- tests/domain/product-file-text.test.ts`

Expected: FAIL，提示 `extractProductResearchFileText` 不存在。

- [ ] **Step 4: 实现产品文件读取和 API 路由**

允许的扩展名固定为 `.md`、`.txt`、`.docx`。文件最大 10 MB；空文本返回“文件中没有可读取的文字”；其他格式返回“当前支持 Markdown、TXT 和 Word 文档”。不要复用报价 Excel 解析逻辑。

- [ ] **Step 5: 运行测试**

Run: `npm test -- tests/domain/product-file-text.test.ts`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add package.json package-lock.json src/features/workbench/file-text.ts src/app/api/products/file/route.ts tests/domain/product-file-text.test.ts
git commit -m "feat: import product research files"
```

---

### Task 5: 构建产品知识专用导入和确认页面

**Files:**
- Create: `src/app/products/import/page.tsx`
- Create: `src/app/products/review/[draftId]/page.tsx`
- Create: `src/components/workbench/product-knowledge-editor.tsx`
- Modify: `src/app/products/page.tsx`

**Interfaces:**
- Consumes: `PRODUCT_RESEARCH_PROMPT`、`parseProductResearchMarkdown`、产品草稿存储接口。
- Produces: `ProductKnowledgeEditor({ value, onChange, issues })`，供确认页和详情页复用。

- [ ] **Step 1: 为导入页写页面行为测试或 Playwright 场景骨架**

验证：复制提示词按钮存在；可粘贴文档；可选择支持文件；点击“解析文档”后进入 `/products/review/[draftId]`；空内容显示中文错误。

- [ ] **Step 2: 实现 `/products/import`**

页面只包含三个工作区：调研提示词、粘贴文档、上传文档。复制按钮使用剪贴板 API 并显示“已复制”；上传成功后将提取文本填入同一个文档输入框，避免两套解析流程。

- [ ] **Step 3: 实现共用结构化编辑器**

编辑器按八个标准模块分区。动态规格、成本、替代方案支持新增和删除行；所有字段均为受控输入。成本合计只读，由 `calculateHardCost` 计算；缺依据时显示“待确认”。

- [ ] **Step 4: 实现确认页**

页面顶部显示 blocking、warning 和 conflict；主体左右分区展示原始文档和结构化编辑器。blocking 未解决时禁用“确认入库”；确认后调用 `saveProductKnowledge`、删除草稿并跳转产品详情。

- [ ] **Step 5: 在产品库增加独立入口**

将空状态和页头主操作改为“导入产品调研”，链接 `/products/import`，不再链接 `/intake`。

- [ ] **Step 6: 手动验证响应式布局**

Run: `npm run dev`

检查桌面 1440px 和移动端 390px：输入区、问题提示和编辑字段无重叠，按钮文字不折成竖排。

- [ ] **Step 7: 提交**

```bash
git add src/app/products/import/page.tsx src/app/products/review/[draftId]/page.tsx src/components/workbench/product-knowledge-editor.tsx src/app/products/page.tsx
git commit -m "feat: add dedicated product research import flow"
```

---

### Task 6: 从快速录入中移除产品知识

**Files:**
- Modify: `src/features/workbench/schemas.ts`
- Modify: `src/features/workbench/ai-extraction.ts`
- Modify: `src/features/workbench/local-store.ts`
- Modify: `src/app/intake/page.tsx`
- Modify: `src/app/review/[draftId]/page.tsx`
- Modify: `tests/domain/ai-extraction.test.ts`
- Modify: `tests/domain/local-store.test.ts`

**Interfaces:**
- `DraftExtraction` 不再对新输入产生 `productKnowledge`。
- 旧的已保存草稿允许 schema 宽容读取，但确认快速录入时忽略旧 `productKnowledge` 字段，防止重复入库。

- [ ] **Step 1: 写快速录入隔离测试**

输入包含“原材料、工艺、成本构成”的产品研究文本，断言快速录入结果不包含产品知识；保存普通供应商草稿后 products 数量不变。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/domain/ai-extraction.test.ts tests/domain/local-store.test.ts`

Expected: FAIL，当前逻辑仍生成或保存 `productKnowledge`。

- [ ] **Step 3: 删除快速录入产品知识提示和解析分支**

从 AI JSON 输出说明、本地兜底解析、intake 提示词和 review 产品知识区块中移除产品知识。保留旧草稿宽容读取仅用于不崩溃，不提供入库路径。

- [ ] **Step 4: 删除 `saveDraftToLocalWorkbench` 的产品写入映射**

供应商、沟通、货盘、待办和商业知识行为保持不变。

- [ ] **Step 5: 运行相关测试**

Run: `npm test -- tests/domain/ai-extraction.test.ts tests/domain/local-store.test.ts`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/features/workbench/schemas.ts src/features/workbench/ai-extraction.ts src/features/workbench/local-store.ts src/app/intake/page.tsx src/app/review/[draftId]/page.tsx tests/domain/ai-extraction.test.ts tests/domain/local-store.test.ts
git commit -m "refactor: isolate product knowledge from quick intake"
```

---

### Task 7: 升级产品库和产品详情页

**Files:**
- Modify: `src/app/products/page.tsx`
- Modify: `src/app/products/[productId]/page.tsx`
- Reuse: `src/components/workbench/product-knowledge-editor.tsx`

**Interfaces:**
- Consumes: V2 产品模型、local-store 更新删除接口。
- Product list selection: query parameter `productIds=id1,id2` 传给 `/products/compare`。

- [ ] **Step 1: 升级产品库卡片和筛选**

卡片只显示名称、品类、核心用途、硬成本状态、最大成本驱动因素和置顶。支持复选框；选择两个及以上产品时启用“生成产品对比表”。搜索覆盖产品名、品类、用途、规格、材料、工艺和风险。

- [ ] **Step 2: 升级详情展示**

按八个模块展示 V2 内容，并提供“编辑”“删除”“导出知识简报”。原始资料使用折叠区显示，不占据首屏。旧记录显示“旧版资料，成本明细待补”，但内容完整可见。

- [ ] **Step 3: 复用编辑器完成详情编辑**

保存时重新校验并更新 `updatedAt`；编辑不会修改 `rawDocument.content`。取消编辑恢复进入编辑前的快照。

- [ ] **Step 4: 手动验证数据兼容**

在包含现有旧产品记录的浏览器中打开 `/products` 和一条详情，确认页面不报错、旧文字仍可见、硬成本为“待确认”。

- [ ] **Step 5: 提交**

```bash
git add src/app/products/page.tsx src/app/products/[productId]/page.tsx src/components/workbench/product-knowledge-editor.tsx
git commit -m "feat: upgrade product knowledge library"
```

---

### Task 8: 实现产品对比表

**Files:**
- Create: `src/features/workbench/product-comparison.ts`
- Create: `tests/domain/product-comparison.test.ts`
- Create: `src/app/products/compare/page.tsx`

**Interfaces:**
- Produces: `buildProductComparison(products: ProductKnowledgeV2[]): ProductComparisonModel`。
- Produces: `ProductComparisonModel = { products; rows; warnings }`。
- `rows` 固定覆盖定位、关键规格、材料、五类硬成本、合计、工艺、风险、替代方案、核心优劣和下一步建议。

- [ ] **Step 1: 写可比性和单位处理测试**

覆盖：同品类同单位直接对比；同品类可换算单位统一；无法换算显示原单位并生成“计量口径不同”；规格不同显示差异但不自动断言便宜者更优；少于两个产品返回中文错误。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/domain/product-comparison.test.ts`

Expected: FAIL，提示 comparison 模块不存在。

- [ ] **Step 3: 实现纯函数比较模型**

只允许明确的单位换算表，例如 `m/cm/mm`、`kg/g`、`㎡/cm²`；件、套、卷之间不推测换算。核心优劣来自现有 decision、risks 和 optimizationOptions，不调用 AI 生成新结论。

- [ ] **Step 4: 实现对比页面**

从 `productIds` 读取产品，展示横向可滚动表格。固定第一列为字段名；顶部允许返回产品库重新选择。警告显示在表格上方。

- [ ] **Step 5: 运行测试并手动检查**

Run: `npm test -- tests/domain/product-comparison.test.ts`

Expected: PASS。

浏览器检查 1440px 和 390px 下表格可滚动、无文字重叠。

- [ ] **Step 6: 提交**

```bash
git add src/features/workbench/product-comparison.ts tests/domain/product-comparison.test.ts src/app/products/compare/page.tsx
git commit -m "feat: add product knowledge comparison"
```

---

### Task 9: 实现产品知识简报

**Files:**
- Create: `src/features/workbench/product-brief.ts`
- Create: `tests/domain/product-brief.test.ts`
- Create: `src/app/products/[productId]/brief/page.tsx`
- Modify: `src/app/products/[productId]/page.tsx`

**Interfaces:**
- Produces: `buildProductBrief(product: ProductKnowledgeV2): ProductBriefModel`。
- 简报页面使用浏览器打印，不增加 Word/PDF 生成依赖。

- [ ] **Step 1: 写简报完整性测试**

断言输出包含产品定位、规格、成本、制造、风险、优化、延伸、决策、来源、日期、可信程度和未确认项；旧记录缺少结构化成本时显示“成本明细待补”，不生成 0 元。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/domain/product-brief.test.ts`

Expected: FAIL，提示 brief 模块不存在。

- [ ] **Step 3: 实现简报视图模型和打印页**

页面提供“返回产品详情”和“打印/保存为 PDF”按钮。使用 `window.print()`；打印样式隐藏导航、按钮和侧边栏，保留 A4 友好的标题、表格和分页控制。

- [ ] **Step 4: 在详情页接入简报入口**

按钮链接 `/products/[productId]/brief`，不在详情页直接生成文件。

- [ ] **Step 5: 运行测试并检查打印预览**

Run: `npm test -- tests/domain/product-brief.test.ts`

Expected: PASS。

浏览器打印预览确认表格不横向截断，来源和未确认项不会遗漏。

- [ ] **Step 6: 提交**

```bash
git add src/features/workbench/product-brief.ts tests/domain/product-brief.test.ts src/app/products/[productId]/brief/page.tsx src/app/products/[productId]/page.tsx
git commit -m "feat: add printable product knowledge brief"
```

---

### Task 10: 端到端验收和回归验证

**Files:**
- Create: `tests/e2e/product-knowledge-v2.spec.ts`
- Modify only if failures reveal scoped defects in files from Tasks 1-9.

**Interfaces:**
- Validates the complete flow without external AI or network access.

- [ ] **Step 1: 写端到端主流程**

场景：打开产品知识库，进入导入页，复制提示词，粘贴标准亚克力留言板文档，解析，修正一个待确认字段，确认入库，查看详情，再导入第二个同类产品，勾选两个产品，生成对比表，打开其中一个知识简报。

- [ ] **Step 2: 写隔离和失败场景**

覆盖：缺产品名称不能入库；快速录入页不出现产品知识提示；导入不触发 `/api/intake` 或 OpenAI 请求；不支持文件显示中文错误；旧产品知识详情可正常打开。

- [ ] **Step 3: 运行全部领域测试**

Run: `npm test`

Expected: 所有测试 PASS。

- [ ] **Step 4: 运行端到端测试**

Run: `npm run e2e -- tests/e2e/product-knowledge-v2.spec.ts`

Expected: 所有 product knowledge V2 场景 PASS。

- [ ] **Step 5: 运行生产构建**

Run: `npm run build`

Expected: Next.js production build 成功，无 TypeScript 错误。

- [ ] **Step 6: 浏览器视觉验收**

用 Playwright 在 1440x900 和 390x844 截图检查 `/products`、导入页、确认页、详情、对比表和简报。确认无横向页面溢出（对比表内部滚动除外）、无按钮文字竖排、无卡片嵌套和内容遮挡。

- [ ] **Step 7: 最终提交**

```bash
git add tests/e2e/product-knowledge-v2.spec.ts
git commit -m "test: cover product knowledge v2 workflow"
```

---

## Implementation Order and Review Gates

1. Tasks 1-3 完成后审查数据契约、迁移和草稿隔离，确认旧数据无损。
2. Tasks 4-6 完成后审查独立导入流程和快速录入隔离。
3. Tasks 7-9 完成后审查产品库、对比和简报是否真正服务决策。
4. Task 10 完成后进行全量回归和视觉验收。

每个任务只提交其列出的文件。当前工作区已有其他未提交改动，实施时必须逐文件暂存，禁止使用 `git add .`，也不得回退用户现有改动。
