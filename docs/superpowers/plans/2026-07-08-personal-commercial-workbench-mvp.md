# Personal Commercial Workbench MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Web MVP for an AI-assisted personal supply-chain workbench with low-friction intake, confirmation before save, supplier records, communication records, offer archives, product knowledge, tasks, and lightweight business notes.

**Architecture:** Create a Next.js application with a focused supply-chain UI and a generic domain model underneath. Use Supabase for cloud authentication, relational data, and file storage; use an AI extraction endpoint to turn screenshots, pasted chat records, and oral summaries into reviewable drafts before writing to permanent records.

**Tech Stack:** Next.js App Router, TypeScript, React, Tailwind CSS, Supabase Auth/Postgres/Storage, Zod, Vitest, Playwright, OpenAI-compatible structured extraction API.

## Global Constraints

- First-stage UI is supply-chain specific; do not expose a generic object platform in the user interface.
- AI output must create drafts only; confirmed user action is required before permanent data is written.
- First stage excludes orders, inventory, finance, purchase approval, team collaboration, multi-role permissions, large-scale 1688 scraping, final supplier decision automation, and complex offer comparison.
- Support three low-friction intake modes: screenshot upload, pasted chat record, and typed oral summary.
- Keep first-version fields minimal; optional details go into notes, tags, or raw source records.
- Every stored business record must be associated with the signed-in user.
- Data must be exportable in JSON and CSV format.
- The app must be usable from a browser after login, not limited to the current computer.

---

## File Structure

- Create: `package.json` - scripts, dependencies, and test commands.
- Create: `tsconfig.json` - TypeScript configuration.
- Create: `next.config.mjs` - Next.js configuration.
- Create: `postcss.config.mjs` - Tailwind PostCSS configuration.
- Create: `tailwind.config.ts` - Tailwind content and theme tokens.
- Create: `.env.example` - required environment variables.
- Create: `src/app/layout.tsx` - root layout.
- Create: `src/app/page.tsx` - dashboard page.
- Create: `src/app/intake/page.tsx` - low-friction intake page.
- Create: `src/app/review/[draftId]/page.tsx` - AI draft confirmation page.
- Create: `src/app/suppliers/page.tsx` - supplier list page.
- Create: `src/app/suppliers/[supplierId]/page.tsx` - supplier detail page.
- Create: `src/app/offers/page.tsx` - offer archive page.
- Create: `src/app/products/page.tsx` - product knowledge page.
- Create: `src/app/tasks/page.tsx` - task reminders page.
- Create: `src/app/knowledge/page.tsx` - lightweight business knowledge page.
- Create: `src/app/api/intake/route.ts` - create intake draft.
- Create: `src/app/api/drafts/[draftId]/route.ts` - read and update draft.
- Create: `src/app/api/drafts/[draftId]/confirm/route.ts` - confirm draft and write permanent records.
- Create: `src/app/api/export/route.ts` - JSON/CSV export.
- Create: `src/components/app-shell.tsx` - navigation shell.
- Create: `src/components/empty-state.tsx` - reusable empty states.
- Create: `src/features/workbench/types.ts` - domain TypeScript types.
- Create: `src/features/workbench/schemas.ts` - Zod schemas for AI drafts and forms.
- Create: `src/features/workbench/supabase.ts` - browser/server Supabase clients.
- Create: `src/features/workbench/repository.ts` - data access functions.
- Create: `src/features/workbench/ai-extraction.ts` - AI structured extraction wrapper.
- Create: `src/features/workbench/confirm-draft.ts` - draft-to-record conversion.
- Create: `supabase/migrations/0001_initial_workbench.sql` - database tables and row-level security.
- Create: `tests/domain/schemas.test.ts` - schema validation tests.
- Create: `tests/domain/confirm-draft.test.ts` - draft confirmation tests.
- Create: `tests/e2e/intake-review.spec.ts` - browser smoke flow.

---

### Task 1: Scaffold the Web App Foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/components/app-shell.tsx`
- Create: `src/components/empty-state.tsx`

**Interfaces:**
- Produces: `AppShell({ children }: { children: React.ReactNode }): JSX.Element`
- Produces: `EmptyState(props: { title: string; description: string; actionHref?: string; actionLabel?: string }): JSX.Element`
- Later tasks rely on `/intake`, `/suppliers`, `/offers`, `/products`, `/tasks`, and `/knowledge` navigation links existing in `AppShell`.

- [ ] **Step 1: Create the project manifest**

Create `package.json`:

```json
{
  "name": "personal-commercial-workbench",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.45.4",
    "clsx": "^2.1.1",
    "next": "^15.0.0",
    "openai": "^4.67.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.2",
    "@testing-library/react": "^16.0.1",
    "@types/node": "^22.7.4",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Add TypeScript and Next configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

Create `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
```

Create `postcss.config.mjs`:

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};

export default config;
```

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        paper: "#fbfaf7",
        line: "#d8d3c8",
        action: "#1f6f68",
        warning: "#a45f00"
      }
    }
  },
  plugins: []
};

export default config;
```

- [ ] **Step 3: Add environment template**

Create `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-anon-key
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key
OPENAI_API_KEY=replace-with-openai-api-key
OPENAI_EXTRACTION_MODEL=gpt-4.1-mini
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 4: Add the root shell and dashboard**

Create `src/components/app-shell.tsx`:

```tsx
import Link from "next/link";

const navItems = [
  { href: "/", label: "工作台" },
  { href: "/intake", label: "快速录入" },
  { href: "/suppliers", label: "供应商" },
  { href: "/offers", label: "货盘" },
  { href: "/products", label: "产品知识" },
  { href: "/tasks", label: "待办" },
  { href: "/knowledge", label: "商业知识" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-56 border-r border-line bg-white px-4 py-5 md:block">
        <div className="mb-6 text-lg font-semibold">个人商业工作台</div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              className="block rounded-md px-3 py-2 text-sm hover:bg-paper"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="md:pl-56">
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
```

Create `src/components/empty-state.tsx`:

```tsx
import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({ title, description, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      {actionHref && actionLabel ? (
        <Link className="mt-4 inline-flex rounded-md bg-action px-3 py-2 text-sm text-white" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
```

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "个人商业工作台",
  description: "AI 辅助的个人供应链与商业知识资产工作台"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}
```

Create `src/app/page.tsx`:

```tsx
import Link from "next/link";

const cards = [
  { label: "供应商", value: "0", href: "/suppliers" },
  { label: "沟通记录", value: "0", href: "/suppliers" },
  { label: "货盘", value: "0", href: "/offers" },
  { label: "待办", value: "0", href: "/tasks" }
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">工作台</h1>
          <p className="mt-1 text-sm text-slate-600">从沟通结果开始沉淀供应商、货盘、产品知识和待办。</p>
        </div>
        <Link className="rounded-md bg-action px-4 py-2 text-sm text-white" href="/intake">
          快速录入
        </Link>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link className="rounded-lg border border-line bg-white p-4" href={card.href} key={card.label}>
            <div className="text-sm text-slate-500">{card.label}</div>
            <div className="mt-3 text-3xl font-semibold">{card.value}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 6: Run build check**

Run: `npm run build`

Expected: build fails only if missing `next-env.d.ts`; rerun after Next creates it with `npm run dev` once, or create `next-env.d.ts` with Next defaults.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs postcss.config.mjs tailwind.config.ts .env.example src
git commit -m "chore: scaffold personal workbench app"
```

---

### Task 2: Define Domain Types and Validation Schemas

**Files:**
- Create: `src/features/workbench/types.ts`
- Create: `src/features/workbench/schemas.ts`
- Create: `tests/domain/schemas.test.ts`

**Interfaces:**
- Produces: `IntakeMode = "screenshot" | "chat" | "summary"`
- Produces: `DraftExtractionSchema`
- Produces: `type DraftExtraction`
- Later tasks consume `DraftExtraction` in API routes and confirmation logic.

- [ ] **Step 1: Write failing schema tests**

Create `tests/domain/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DraftExtractionSchema } from "@/features/workbench/schemas";

describe("DraftExtractionSchema", () => {
  it("accepts a supplier communication draft with offer, knowledge, and task", () => {
    const result = DraftExtractionSchema.parse({
      supplier: {
        name: "义乌某包装厂",
        sourceUrl: "https://example.1688.com",
        categories: ["包装盒"],
        location: "浙江义乌",
        contactName: "王经理",
        contactMethod: "微信",
        supplierType: "factory",
        cooperationLevel: "medium",
        priceLevel: "low",
        qualityJudgement: "待样品确认",
        riskTags: ["需要确认交期"],
        notes: "配合度一般"
      },
      communication: {
        summary: "报价 12.5 元，MOQ 1000，交期 7 天。",
        promises: ["7 天交货"],
        questions: ["包装方式未确认"],
        risks: ["交期需要复核"],
        nextActions: ["明天确认包装方式"]
      },
      offers: [
        {
          name: "白卡纸包装盒",
          category: "包装盒",
          quotedPrice: "12.5 元",
          moq: "1000",
          leadTime: "7 天",
          specs: "白卡纸 350g",
          packaging: "未确认",
          sampleStatus: "可寄样",
          channelFit: "电商",
          advantages: "价格低",
          risks: "包装方式未确认",
          notes: ""
        }
      ],
      productKnowledge: [
        {
          name: "包装盒",
          materials: "白卡纸",
          process: "印刷、覆膜、模切、糊盒",
          costStructure: "纸张、印刷、人工、损耗",
          keyParameters: "克重、尺寸、覆膜方式",
          qualityRisks: "压痕、色差、爆边",
          commonPitfalls: "只看单价不看损耗",
          alternatives: "灰板盒",
          judgement: "需要拿样确认挺度"
        }
      ],
      tasks: [
        {
          title: "确认包装方式",
          dueText: "明天",
          priority: "medium",
          type: "confirm_quote"
        }
      ],
      uncertaintyNotes: ["供应商真实类型需要确认"]
    });

    expect(result.supplier.name).toBe("义乌某包装厂");
    expect(result.offers[0].moq).toBe("1000");
    expect(result.tasks[0].priority).toBe("medium");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/schemas.test.ts`

Expected: FAIL with module not found for `@/features/workbench/schemas`.

- [ ] **Step 3: Add domain types**

Create `src/features/workbench/types.ts`:

```ts
export type IntakeMode = "screenshot" | "chat" | "summary";

export type Priority = "low" | "medium" | "high";

export type SupplierType = "factory" | "trader" | "unknown";

export type DraftStatus = "draft" | "confirmed" | "discarded";

export type SupplierDraft = {
  name: string;
  sourceUrl?: string;
  categories: string[];
  location?: string;
  contactName?: string;
  contactMethod?: string;
  supplierType: SupplierType;
  cooperationLevel?: string;
  priceLevel?: string;
  qualityJudgement?: string;
  riskTags: string[];
  notes?: string;
};

export type CommunicationDraft = {
  summary: string;
  promises: string[];
  questions: string[];
  risks: string[];
  nextActions: string[];
};

export type OfferDraft = {
  name: string;
  category?: string;
  quotedPrice?: string;
  moq?: string;
  leadTime?: string;
  specs?: string;
  packaging?: string;
  sampleStatus?: string;
  channelFit?: string;
  advantages?: string;
  risks?: string;
  notes?: string;
};

export type ProductKnowledgeDraft = {
  name: string;
  materials?: string;
  process?: string;
  costStructure?: string;
  keyParameters?: string;
  qualityRisks?: string;
  commonPitfalls?: string;
  alternatives?: string;
  judgement?: string;
};

export type TaskDraft = {
  title: string;
  dueText?: string;
  priority: Priority;
  type: "confirm_quote" | "follow_sample" | "confirm_moq" | "confirm_lead_time" | "supplement_product_knowledge" | "review_supplier" | "follow_up";
};
```

- [ ] **Step 4: Add Zod schemas**

Create `src/features/workbench/schemas.ts`:

```ts
import { z } from "zod";

export const PrioritySchema = z.enum(["low", "medium", "high"]);

export const SupplierDraftSchema = z.object({
  name: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  categories: z.array(z.string()).default([]),
  location: z.string().optional(),
  contactName: z.string().optional(),
  contactMethod: z.string().optional(),
  supplierType: z.enum(["factory", "trader", "unknown"]).default("unknown"),
  cooperationLevel: z.string().optional(),
  priceLevel: z.string().optional(),
  qualityJudgement: z.string().optional(),
  riskTags: z.array(z.string()).default([]),
  notes: z.string().optional()
});

export const CommunicationDraftSchema = z.object({
  summary: z.string().min(1),
  promises: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([])
});

export const OfferDraftSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  quotedPrice: z.string().optional(),
  moq: z.string().optional(),
  leadTime: z.string().optional(),
  specs: z.string().optional(),
  packaging: z.string().optional(),
  sampleStatus: z.string().optional(),
  channelFit: z.string().optional(),
  advantages: z.string().optional(),
  risks: z.string().optional(),
  notes: z.string().optional()
});

export const ProductKnowledgeDraftSchema = z.object({
  name: z.string().min(1),
  materials: z.string().optional(),
  process: z.string().optional(),
  costStructure: z.string().optional(),
  keyParameters: z.string().optional(),
  qualityRisks: z.string().optional(),
  commonPitfalls: z.string().optional(),
  alternatives: z.string().optional(),
  judgement: z.string().optional()
});

export const TaskDraftSchema = z.object({
  title: z.string().min(1),
  dueText: z.string().optional(),
  priority: PrioritySchema.default("medium"),
  type: z.enum([
    "confirm_quote",
    "follow_sample",
    "confirm_moq",
    "confirm_lead_time",
    "supplement_product_knowledge",
    "review_supplier",
    "follow_up"
  ])
});

export const DraftExtractionSchema = z.object({
  supplier: SupplierDraftSchema.optional(),
  communication: CommunicationDraftSchema,
  offers: z.array(OfferDraftSchema).default([]),
  productKnowledge: z.array(ProductKnowledgeDraftSchema).default([]),
  tasks: z.array(TaskDraftSchema).default([]),
  uncertaintyNotes: z.array(z.string()).default([])
});

export type DraftExtraction = z.infer<typeof DraftExtractionSchema>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/domain/schemas.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/workbench/types.ts src/features/workbench/schemas.ts tests/domain/schemas.test.ts
git commit -m "feat: define workbench draft schemas"
```

---

### Task 3: Create Supabase Database Schema

**Files:**
- Create: `supabase/migrations/0001_initial_workbench.sql`

**Interfaces:**
- Produces tables: `intake_drafts`, `suppliers`, `communications`, `offers`, `product_knowledge`, `tasks`, `business_notes`, `attachments`
- Later repository functions assume each table has `id uuid`, `user_id uuid`, `created_at timestamptz`, and `updated_at timestamptz`.

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/0001_initial_workbench.sql`:

```sql
create extension if not exists "pgcrypto";

create table public.intake_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('screenshot', 'chat', 'summary')),
  raw_text text,
  source_url text,
  extraction jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source_url text,
  categories text[] not null default '{}',
  location text,
  contact_name text,
  contact_method text,
  supplier_type text not null default 'unknown',
  cooperation_level text,
  price_level text,
  quality_judgement text,
  risk_tags text[] not null default '{}',
  notes text,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  draft_id uuid references public.intake_drafts(id) on delete set null,
  source_type text not null,
  summary text not null,
  promises text[] not null default '{}',
  questions text[] not null default '{}',
  risks text[] not null default '{}',
  next_actions text[] not null default '{}',
  communicated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  communication_id uuid references public.communications(id) on delete set null,
  name text not null,
  category text,
  quoted_price text,
  moq text,
  lead_time text,
  specs text,
  packaging text,
  sample_status text,
  channel_fit text,
  advantages text,
  risks text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  materials text,
  process text,
  cost_structure text,
  key_parameters text,
  quality_risks text,
  common_pitfalls text,
  alternatives text,
  judgement text,
  source_communication_id uuid references public.communications(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  product_knowledge_id uuid references public.product_knowledge(id) on delete set null,
  communication_id uuid references public.communications(id) on delete set null,
  title text not null,
  due_text text,
  due_at timestamptz,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  task_type text not null,
  status text not null default 'open' check (status in ('open', 'done', 'archived')),
  completed_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source text,
  tags text[] not null default '{}',
  summary text,
  key_points text,
  application_context text,
  related_supply_chain_issue text,
  action_insight text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid references public.intake_drafts(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

alter table public.intake_drafts enable row level security;
alter table public.suppliers enable row level security;
alter table public.communications enable row level security;
alter table public.offers enable row level security;
alter table public.product_knowledge enable row level security;
alter table public.tasks enable row level security;
alter table public.business_notes enable row level security;
alter table public.attachments enable row level security;

create policy "users own intake drafts" on public.intake_drafts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own suppliers" on public.suppliers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own communications" on public.communications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own offers" on public.offers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own product knowledge" on public.product_knowledge for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own business notes" on public.business_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own attachments" on public.attachments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index suppliers_user_id_idx on public.suppliers(user_id);
create index communications_user_id_idx on public.communications(user_id);
create index offers_user_id_idx on public.offers(user_id);
create index tasks_user_id_status_idx on public.tasks(user_id, status);
```

- [ ] **Step 2: Apply migration locally or to Supabase**

Run locally if Supabase CLI is configured:

```bash
supabase db reset
```

Expected: migration succeeds and all tables exist.

Run against hosted project if using linked Supabase project:

```bash
supabase db push
```

Expected: migration succeeds with no policy errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_initial_workbench.sql
git commit -m "feat: add workbench database schema"
```

---

### Task 4: Implement AI Draft Extraction

**Files:**
- Create: `src/features/workbench/ai-extraction.ts`
- Create: `src/app/api/intake/route.ts`

**Interfaces:**
- Produces: `extractWorkbenchDraft(input: { mode: IntakeMode; rawText: string; sourceUrl?: string }): Promise<DraftExtraction>`
- Produces API: `POST /api/intake` with body `{ mode, rawText, sourceUrl }`
- Later review page consumes returned `{ draftId: string }`.

- [ ] **Step 1: Create AI extraction wrapper**

Create `src/features/workbench/ai-extraction.ts`:

```ts
import OpenAI from "openai";
import { DraftExtractionSchema, type DraftExtraction } from "./schemas";
import type { IntakeMode } from "./types";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function extractWorkbenchDraft(input: {
  mode: IntakeMode;
  rawText: string;
  sourceUrl?: string;
}): Promise<DraftExtraction> {
  const model = process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-4.1-mini";
  const response = await client.chat.completions.create({
    model,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "你是供应链工作台的信息整理助手。你只提取事实和用户明确表达的判断，不替用户做最终供应商决策。输出必须是 JSON。"
      },
      {
        role: "user",
        content: JSON.stringify({
          instruction:
            "从输入中提取供应商、沟通摘要、货盘、产品知识、待办和不确定信息。没有的信息用空数组或省略可选字段。",
          mode: input.mode,
          sourceUrl: input.sourceUrl,
          rawText: input.rawText
        })
      }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error("AI extraction returned empty content");
  }

  return DraftExtractionSchema.parse(JSON.parse(content));
}
```

- [ ] **Step 2: Add intake API skeleton**

Create `src/app/api/intake/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { extractWorkbenchDraft } from "@/features/workbench/ai-extraction";

const IntakeRequestSchema = z.object({
  mode: z.enum(["screenshot", "chat", "summary"]),
  rawText: z.string().min(1),
  sourceUrl: z.string().url().optional()
});

export async function POST(request: Request) {
  const body = IntakeRequestSchema.parse(await request.json());
  const extraction = await extractWorkbenchDraft(body);

  return NextResponse.json({
    draftId: "local-preview",
    extraction
  });
}
```

- [ ] **Step 3: Run type check**

Run: `npm run build`

Expected: build succeeds if environment variables are present or API route is not executed at build time.

- [ ] **Step 4: Commit**

```bash
git add src/features/workbench/ai-extraction.ts src/app/api/intake/route.ts
git commit -m "feat: add AI intake extraction"
```

---

### Task 5: Implement Draft Confirmation Logic

**Files:**
- Create: `src/features/workbench/confirm-draft.ts`
- Create: `tests/domain/confirm-draft.test.ts`

**Interfaces:**
- Produces: `buildConfirmedRecords(input: { userId: string; draftId: string; extraction: DraftExtraction }): ConfirmedRecordBatch`
- Later repository task persists `ConfirmedRecordBatch`.

- [ ] **Step 1: Write failing confirmation test**

Create `tests/domain/confirm-draft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildConfirmedRecords } from "@/features/workbench/confirm-draft";
import type { DraftExtraction } from "@/features/workbench/schemas";

describe("buildConfirmedRecords", () => {
  it("converts an extraction into permanent record inputs", () => {
    const extraction: DraftExtraction = {
      supplier: {
        name: "义乌某包装厂",
        categories: ["包装盒"],
        supplierType: "factory",
        riskTags: ["交期待确认"]
      },
      communication: {
        summary: "报价 12.5 元，MOQ 1000。",
        promises: [],
        questions: ["包装方式未确认"],
        risks: ["交期待确认"],
        nextActions: ["明天确认包装"]
      },
      offers: [{ name: "白卡纸包装盒", quotedPrice: "12.5 元", moq: "1000" }],
      productKnowledge: [{ name: "包装盒", materials: "白卡纸" }],
      tasks: [{ title: "确认包装方式", priority: "medium", type: "confirm_quote", dueText: "明天" }],
      uncertaintyNotes: []
    };

    const batch = buildConfirmedRecords({
      userId: "user-1",
      draftId: "draft-1",
      extraction
    });

    expect(batch.supplier?.name).toBe("义乌某包装厂");
    expect(batch.communication.summary).toContain("MOQ 1000");
    expect(batch.offers).toHaveLength(1);
    expect(batch.productKnowledge).toHaveLength(1);
    expect(batch.tasks[0].title).toBe("确认包装方式");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/confirm-draft.test.ts`

Expected: FAIL with module not found for `confirm-draft`.

- [ ] **Step 3: Implement conversion function**

Create `src/features/workbench/confirm-draft.ts`:

```ts
import type { DraftExtraction } from "./schemas";

export type ConfirmedRecordBatch = {
  supplier?: {
    userId: string;
    name: string;
    sourceUrl?: string;
    categories: string[];
    location?: string;
    contactName?: string;
    contactMethod?: string;
    supplierType: string;
    cooperationLevel?: string;
    priceLevel?: string;
    qualityJudgement?: string;
    riskTags: string[];
    notes?: string;
  };
  communication: {
    userId: string;
    draftId: string;
    sourceType: string;
    summary: string;
    promises: string[];
    questions: string[];
    risks: string[];
    nextActions: string[];
  };
  offers: Array<{
    userId: string;
    name: string;
    category?: string;
    quotedPrice?: string;
    moq?: string;
    leadTime?: string;
    specs?: string;
    packaging?: string;
    sampleStatus?: string;
    channelFit?: string;
    advantages?: string;
    risks?: string;
    notes?: string;
  }>;
  productKnowledge: Array<{
    userId: string;
    name: string;
    materials?: string;
    process?: string;
    costStructure?: string;
    keyParameters?: string;
    qualityRisks?: string;
    commonPitfalls?: string;
    alternatives?: string;
    judgement?: string;
  }>;
  tasks: Array<{
    userId: string;
    title: string;
    dueText?: string;
    priority: string;
    taskType: string;
  }>;
};

export function buildConfirmedRecords(input: {
  userId: string;
  draftId: string;
  extraction: DraftExtraction;
}): ConfirmedRecordBatch {
  const { userId, draftId, extraction } = input;

  return {
    supplier: extraction.supplier
      ? {
          userId,
          name: extraction.supplier.name,
          sourceUrl: extraction.supplier.sourceUrl,
          categories: extraction.supplier.categories,
          location: extraction.supplier.location,
          contactName: extraction.supplier.contactName,
          contactMethod: extraction.supplier.contactMethod,
          supplierType: extraction.supplier.supplierType,
          cooperationLevel: extraction.supplier.cooperationLevel,
          priceLevel: extraction.supplier.priceLevel,
          qualityJudgement: extraction.supplier.qualityJudgement,
          riskTags: extraction.supplier.riskTags,
          notes: extraction.supplier.notes
        }
      : undefined,
    communication: {
      userId,
      draftId,
      sourceType: "ai_intake",
      summary: extraction.communication.summary,
      promises: extraction.communication.promises,
      questions: extraction.communication.questions,
      risks: extraction.communication.risks,
      nextActions: extraction.communication.nextActions
    },
    offers: extraction.offers.map((offer) => ({
      userId,
      name: offer.name,
      category: offer.category,
      quotedPrice: offer.quotedPrice,
      moq: offer.moq,
      leadTime: offer.leadTime,
      specs: offer.specs,
      packaging: offer.packaging,
      sampleStatus: offer.sampleStatus,
      channelFit: offer.channelFit,
      advantages: offer.advantages,
      risks: offer.risks,
      notes: offer.notes
    })),
    productKnowledge: extraction.productKnowledge.map((item) => ({
      userId,
      name: item.name,
      materials: item.materials,
      process: item.process,
      costStructure: item.costStructure,
      keyParameters: item.keyParameters,
      qualityRisks: item.qualityRisks,
      commonPitfalls: item.commonPitfalls,
      alternatives: item.alternatives,
      judgement: item.judgement
    })),
    tasks: extraction.tasks.map((task) => ({
      userId,
      title: task.title,
      dueText: task.dueText,
      priority: task.priority,
      taskType: task.type
    }))
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/domain/confirm-draft.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/workbench/confirm-draft.ts tests/domain/confirm-draft.test.ts
git commit -m "feat: convert AI drafts into confirmed records"
```

---

### Task 6: Implement Supabase Repository and Confirmation API

**Files:**
- Create: `src/features/workbench/supabase.ts`
- Create: `src/features/workbench/repository.ts`
- Create: `src/app/api/drafts/[draftId]/route.ts`
- Create: `src/app/api/drafts/[draftId]/confirm/route.ts`

**Interfaces:**
- Produces: `createIntakeDraft(args): Promise<{ id: string }>`
- Produces: `getDraftById(userId: string, draftId: string): Promise<DraftRecord | null>`
- Produces: `confirmDraft(userId: string, draftId: string, extraction: DraftExtraction): Promise<{ supplierId?: string; communicationId: string }>`
- Produces API: `GET /api/drafts/:draftId`, `PATCH /api/drafts/:draftId`, `POST /api/drafts/:draftId/confirm`

- [ ] **Step 1: Add Supabase server client**

Create `src/features/workbench/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase service credentials are missing");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false
    }
  });
}
```

- [ ] **Step 2: Add repository functions**

Create `src/features/workbench/repository.ts`:

```ts
import type { DraftExtraction } from "./schemas";
import { buildConfirmedRecords } from "./confirm-draft";
import { createServiceClient } from "./supabase";
import type { IntakeMode } from "./types";

export type DraftRecord = {
  id: string;
  user_id: string;
  mode: IntakeMode;
  raw_text: string | null;
  source_url: string | null;
  extraction: DraftExtraction;
  status: "draft" | "confirmed" | "discarded";
};

export async function createIntakeDraft(args: {
  userId: string;
  mode: IntakeMode;
  rawText: string;
  sourceUrl?: string;
  extraction: DraftExtraction;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("intake_drafts")
    .insert({
      user_id: args.userId,
      mode: args.mode,
      raw_text: args.rawText,
      source_url: args.sourceUrl,
      extraction: args.extraction,
      status: "draft"
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id };
}

export async function getDraftById(userId: string, draftId: string): Promise<DraftRecord | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("intake_drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", draftId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as DraftRecord | null;
}

export async function updateDraftExtraction(args: {
  userId: string;
  draftId: string;
  extraction: DraftExtraction;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("intake_drafts")
    .update({ extraction: args.extraction, updated_at: new Date().toISOString() })
    .eq("user_id", args.userId)
    .eq("id", args.draftId)
    .eq("status", "draft");

  if (error) throw error;
}

export async function confirmDraft(args: {
  userId: string;
  draftId: string;
  extraction: DraftExtraction;
}): Promise<{ supplierId?: string; communicationId: string }> {
  const supabase = createServiceClient();
  const batch = buildConfirmedRecords(args);

  let supplierId: string | undefined;
  if (batch.supplier) {
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        user_id: batch.supplier.userId,
        name: batch.supplier.name,
        source_url: batch.supplier.sourceUrl,
        categories: batch.supplier.categories,
        location: batch.supplier.location,
        contact_name: batch.supplier.contactName,
        contact_method: batch.supplier.contactMethod,
        supplier_type: batch.supplier.supplierType,
        cooperation_level: batch.supplier.cooperationLevel,
        price_level: batch.supplier.priceLevel,
        quality_judgement: batch.supplier.qualityJudgement,
        risk_tags: batch.supplier.riskTags,
        notes: batch.supplier.notes,
        last_contact_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (error) throw error;
    supplierId = data.id;
  }

  const { data: communication, error: communicationError } = await supabase
    .from("communications")
    .insert({
      user_id: batch.communication.userId,
      supplier_id: supplierId,
      draft_id: batch.communication.draftId,
      source_type: batch.communication.sourceType,
      summary: batch.communication.summary,
      promises: batch.communication.promises,
      questions: batch.communication.questions,
      risks: batch.communication.risks,
      next_actions: batch.communication.nextActions
    })
    .select("id")
    .single();

  if (communicationError) throw communicationError;

  if (batch.offers.length > 0) {
    const { error } = await supabase.from("offers").insert(
      batch.offers.map((offer) => ({
        user_id: offer.userId,
        supplier_id: supplierId,
        communication_id: communication.id,
        name: offer.name,
        category: offer.category,
        quoted_price: offer.quotedPrice,
        moq: offer.moq,
        lead_time: offer.leadTime,
        specs: offer.specs,
        packaging: offer.packaging,
        sample_status: offer.sampleStatus,
        channel_fit: offer.channelFit,
        advantages: offer.advantages,
        risks: offer.risks,
        notes: offer.notes
      }))
    );
    if (error) throw error;
  }

  if (batch.productKnowledge.length > 0) {
    const { error } = await supabase.from("product_knowledge").insert(
      batch.productKnowledge.map((item) => ({
        user_id: item.userId,
        name: item.name,
        materials: item.materials,
        process: item.process,
        cost_structure: item.costStructure,
        key_parameters: item.keyParameters,
        quality_risks: item.qualityRisks,
        common_pitfalls: item.commonPitfalls,
        alternatives: item.alternatives,
        judgement: item.judgement,
        source_communication_id: communication.id
      }))
    );
    if (error) throw error;
  }

  if (batch.tasks.length > 0) {
    const { error } = await supabase.from("tasks").insert(
      batch.tasks.map((task) => ({
        user_id: task.userId,
        supplier_id: supplierId,
        communication_id: communication.id,
        title: task.title,
        due_text: task.dueText,
        priority: task.priority,
        task_type: task.taskType,
        status: "open"
      }))
    );
    if (error) throw error;
  }

  const { error: draftError } = await supabase
    .from("intake_drafts")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("user_id", args.userId)
    .eq("id", args.draftId);

  if (draftError) throw draftError;

  return { supplierId, communicationId: communication.id };
}
```

- [ ] **Step 3: Add draft APIs**

Create `src/app/api/drafts/[draftId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { DraftExtractionSchema } from "@/features/workbench/schemas";
import { getDraftById, updateDraftExtraction } from "@/features/workbench/repository";

function getUserIdForMvp() {
  return "00000000-0000-0000-0000-000000000001";
}

export async function GET(_request: Request, context: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await context.params;
  const draft = await getDraftById(getUserIdForMvp(), draftId);
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  return NextResponse.json({ draft });
}

export async function PATCH(request: Request, context: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await context.params;
  const extraction = DraftExtractionSchema.parse(await request.json());
  await updateDraftExtraction({ userId: getUserIdForMvp(), draftId, extraction });
  return NextResponse.json({ ok: true });
}
```

Create `src/app/api/drafts/[draftId]/confirm/route.ts`:

```ts
import { NextResponse } from "next/server";
import { DraftExtractionSchema } from "@/features/workbench/schemas";
import { confirmDraft } from "@/features/workbench/repository";

function getUserIdForMvp() {
  return "00000000-0000-0000-0000-000000000001";
}

export async function POST(request: Request, context: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await context.params;
  const extraction = DraftExtractionSchema.parse(await request.json());
  const result = await confirmDraft({ userId: getUserIdForMvp(), draftId, extraction });
  return NextResponse.json(result);
}
```

- [ ] **Step 4: Replace intake local preview with persisted draft**

Modify `src/app/api/intake/route.ts` so it uses `createIntakeDraft`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { extractWorkbenchDraft } from "@/features/workbench/ai-extraction";
import { createIntakeDraft } from "@/features/workbench/repository";

const IntakeRequestSchema = z.object({
  mode: z.enum(["screenshot", "chat", "summary"]),
  rawText: z.string().min(1),
  sourceUrl: z.string().url().optional()
});

function getUserIdForMvp() {
  return "00000000-0000-0000-0000-000000000001";
}

export async function POST(request: Request) {
  const body = IntakeRequestSchema.parse(await request.json());
  const extraction = await extractWorkbenchDraft(body);
  const draft = await createIntakeDraft({
    userId: getUserIdForMvp(),
    mode: body.mode,
    rawText: body.rawText,
    sourceUrl: body.sourceUrl,
    extraction
  });

  return NextResponse.json({
    draftId: draft.id,
    extraction
  });
}
```

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/workbench/supabase.ts src/features/workbench/repository.ts src/app/api/intake/route.ts src/app/api/drafts
git commit -m "feat: persist and confirm intake drafts"
```

---

### Task 7: Build Intake and Review UI

**Files:**
- Create: `src/app/intake/page.tsx`
- Create: `src/app/review/[draftId]/page.tsx`

**Interfaces:**
- Consumes API: `POST /api/intake`
- Consumes API: `GET /api/drafts/:draftId`
- Consumes API: `POST /api/drafts/:draftId/confirm`
- Produces user flow: submit intake -> review draft -> confirm records.

- [ ] **Step 1: Create intake page**

Create `src/app/intake/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function IntakePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"screenshot" | "chat" | "summary">("summary");
  const [rawText, setRawText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setIsSubmitting(true);
    setError("");

    const response = await fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        rawText,
        sourceUrl: sourceUrl.trim() || undefined
      })
    });

    if (!response.ok) {
      setError("整理失败，请检查输入内容和 AI 配置。");
      setIsSubmitting(false);
      return;
    }

    const data = (await response.json()) as { draftId: string };
    router.push(`/review/${data.draftId}`);
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">快速录入</h1>
        <p className="mt-1 text-sm text-slate-600">粘贴聊天记录、输入沟通结果，或先用文字描述截图内容。</p>
      </div>

      <div className="rounded-lg border border-line bg-white p-4">
        <label className="text-sm font-medium">录入类型</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["summary", "口述总结"],
            ["chat", "聊天记录"],
            ["screenshot", "截图内容"]
          ].map(([value, label]) => (
            <button
              className={`rounded-md border px-3 py-2 text-sm ${mode === value ? "border-action bg-action text-white" : "border-line"}`}
              key={value}
              onClick={() => setMode(value as "screenshot" | "chat" | "summary")}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-medium">1688 或资料链接</label>
        <input
          className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm"
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="https://..."
          value={sourceUrl}
        />

        <label className="mt-4 block text-sm font-medium">沟通内容</label>
        <textarea
          className="mt-2 min-h-56 w-full rounded-md border border-line px-3 py-2 text-sm"
          onChange={(event) => setRawText(event.target.value)}
          placeholder="例如：这个供应商报价 12.5，MOQ 1000，交期 7 天，包装方式还没确认，明天需要再问。"
          value={rawText}
        />

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <button
          className="mt-4 rounded-md bg-action px-4 py-2 text-sm text-white disabled:opacity-60"
          disabled={isSubmitting || rawText.trim().length === 0}
          onClick={submit}
          type="button"
        >
          {isSubmitting ? "整理中" : "生成整理草稿"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create review page**

Create `src/app/review/[draftId]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DraftExtraction } from "@/features/workbench/schemas";

type DraftResponse = {
  draft: {
    id: string;
    extraction: DraftExtraction;
    status: string;
  };
};

export default function ReviewPage({ params }: { params: Promise<{ draftId: string }> }) {
  const router = useRouter();
  const [draftId, setDraftId] = useState("");
  const [extraction, setExtraction] = useState<DraftExtraction | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    params.then(({ draftId: id }) => {
      setDraftId(id);
      fetch(`/api/drafts/${id}`)
        .then((response) => response.json())
        .then((data: DraftResponse) => setExtraction(data.draft.extraction));
    });
  }, [params]);

  async function confirm() {
    if (!extraction) return;
    setIsConfirming(true);
    const response = await fetch(`/api/drafts/${draftId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(extraction)
    });
    if (response.ok) router.push("/suppliers");
    setIsConfirming(false);
  }

  if (!extraction) {
    return <div className="text-sm text-slate-600">加载整理草稿中</div>;
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">确认整理结果</h1>
        <p className="mt-1 text-sm text-slate-600">AI 只生成草稿。确认后才会写入供应商、沟通、货盘、产品知识和待办。</p>
      </div>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">供应商</h2>
        <pre className="mt-3 overflow-auto rounded-md bg-paper p-3 text-sm">{JSON.stringify(extraction.supplier ?? {}, null, 2)}</pre>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">沟通摘要</h2>
        <p className="mt-3 text-sm">{extraction.communication.summary}</p>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">货盘</h2>
        <pre className="mt-3 overflow-auto rounded-md bg-paper p-3 text-sm">{JSON.stringify(extraction.offers, null, 2)}</pre>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">产品知识</h2>
        <pre className="mt-3 overflow-auto rounded-md bg-paper p-3 text-sm">{JSON.stringify(extraction.productKnowledge, null, 2)}</pre>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">待办</h2>
        <pre className="mt-3 overflow-auto rounded-md bg-paper p-3 text-sm">{JSON.stringify(extraction.tasks, null, 2)}</pre>
      </section>

      <button
        className="rounded-md bg-action px-4 py-2 text-sm text-white disabled:opacity-60"
        disabled={isConfirming}
        onClick={confirm}
        type="button"
      >
        {isConfirming ? "保存中" : "确认入库"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/intake/page.tsx src/app/review
git commit -m "feat: add intake and review flow"
```

---

### Task 8: Build Core Library Pages

**Files:**
- Create: `src/app/suppliers/page.tsx`
- Create: `src/app/suppliers/[supplierId]/page.tsx`
- Create: `src/app/offers/page.tsx`
- Create: `src/app/products/page.tsx`
- Create: `src/app/tasks/page.tsx`
- Create: `src/app/knowledge/page.tsx`

**Interfaces:**
- Consumes repository list functions added in this task.
- Produces pages required by the MVP navigation.

- [ ] **Step 1: Extend repository with list functions**

Modify `src/features/workbench/repository.ts` by adding:

```ts
export async function listSuppliers(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("suppliers").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listOffers(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("offers").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listProductKnowledge(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("product_knowledge").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listTasks(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listBusinessNotes(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("business_notes").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Create supplier list**

Create `src/app/suppliers/page.tsx`:

```tsx
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { listSuppliers } from "@/features/workbench/repository";

const userId = "00000000-0000-0000-0000-000000000001";

export default async function SuppliersPage() {
  const suppliers = await listSuppliers(userId);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">供应商库</h1>
      {suppliers.length === 0 ? (
        <EmptyState title="还没有供应商" description="从一次沟通整理开始建立供应商档案。" actionHref="/intake" actionLabel="快速录入" />
      ) : (
        <div className="grid gap-3">
          {suppliers.map((supplier) => (
            <Link className="rounded-lg border border-line bg-white p-4" href={`/suppliers/${supplier.id}`} key={supplier.id}>
              <div className="font-medium">{supplier.name}</div>
              <div className="mt-1 text-sm text-slate-600">{supplier.categories?.join(" / ") || "未分类"}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create simple placeholder pages with real empty states**

Create `src/app/offers/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { listOffers } from "@/features/workbench/repository";

const userId = "00000000-0000-0000-0000-000000000001";

export default async function OffersPage() {
  const offers = await listOffers(userId);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">货盘库</h1>
      {offers.length === 0 ? (
        <EmptyState title="还没有货盘" description="货盘会从沟通整理结果中归档，不需要复杂对比。" actionHref="/intake" actionLabel="录入沟通" />
      ) : (
        <div className="grid gap-3">
          {offers.map((offer) => (
            <div className="rounded-lg border border-line bg-white p-4" key={offer.id}>
              <div className="font-medium">{offer.name}</div>
              <div className="mt-1 text-sm text-slate-600">{offer.quoted_price || "未记录报价"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Create `src/app/products/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { listProductKnowledge } from "@/features/workbench/repository";

const userId = "00000000-0000-0000-0000-000000000001";

export default async function ProductsPage() {
  const products = await listProductKnowledge(userId);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">产品知识库</h1>
      {products.length === 0 ? (
        <EmptyState title="还没有产品知识" description="原材料、工艺、成本和风险点会从沟通整理中逐步沉淀。" actionHref="/intake" actionLabel="录入资料" />
      ) : (
        <div className="grid gap-3">
          {products.map((product) => (
            <div className="rounded-lg border border-line bg-white p-4" key={product.id}>
              <div className="font-medium">{product.name}</div>
              <div className="mt-1 text-sm text-slate-600">{product.materials || "未记录原材料"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Create `src/app/tasks/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { listTasks } from "@/features/workbench/repository";

const userId = "00000000-0000-0000-0000-000000000001";

export default async function TasksPage() {
  const tasks = await listTasks(userId);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">待办提醒</h1>
      {tasks.length === 0 ? (
        <EmptyState title="还没有待办" description="确认报价、跟进样品、复盘供应商等事项会从沟通中生成。" actionHref="/intake" actionLabel="录入沟通" />
      ) : (
        <div className="grid gap-3">
          {tasks.map((task) => (
            <div className="rounded-lg border border-line bg-white p-4" key={task.id}>
              <div className="font-medium">{task.title}</div>
              <div className="mt-1 text-sm text-slate-600">
                优先级：{task.priority} · 状态：{task.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Create `src/app/knowledge/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { listBusinessNotes } from "@/features/workbench/repository";

const userId = "00000000-0000-0000-0000-000000000001";

export default async function KnowledgePage() {
  const notes = await listBusinessNotes(userId);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">商业知识</h1>
      {notes.length === 0 ? (
        <EmptyState title="还没有商业知识" description="读书笔记、商业观点和业务启发可以先轻量沉淀。" actionHref="/intake" actionLabel="录入知识" />
      ) : (
        <div className="grid gap-3">
          {notes.map((note) => (
            <div className="rounded-lg border border-line bg-white p-4" key={note.id}>
              <div className="font-medium">{note.title}</div>
              <div className="mt-1 text-sm text-slate-600">{note.summary || "未记录摘要"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/workbench/repository.ts src/app/suppliers src/app/offers src/app/products src/app/tasks src/app/knowledge
git commit -m "feat: add core workbench library pages"
```

---

### Task 9: Add Export Endpoint

**Files:**
- Create: `src/app/api/export/route.ts`

**Interfaces:**
- Produces API: `GET /api/export?format=json`
- Produces API: `GET /api/export?format=csv`

- [ ] **Step 1: Create export route**

Create `src/app/api/export/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listBusinessNotes, listOffers, listProductKnowledge, listSuppliers, listTasks } from "@/features/workbench/repository";

const userId = "00000000-0000-0000-0000-000000000001";

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [keys.join(","), ...rows.map((row) => keys.map((key) => escape(row[key])).join(","))].join("\n");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const data = {
    suppliers: await listSuppliers(userId),
    offers: await listOffers(userId),
    productKnowledge: await listProductKnowledge(userId),
    tasks: await listTasks(userId),
    businessNotes: await listBusinessNotes(userId)
  };

  if (format === "csv") {
    return new Response(toCsv(data.suppliers as Array<Record<string, unknown>>), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=suppliers.csv"
      }
    });
  }

  return NextResponse.json(data, {
    headers: {
      "Content-Disposition": "attachment; filename=workbench-export.json"
    }
  });
}
```

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/export/route.ts
git commit -m "feat: add data export endpoint"
```

---

### Task 10: Add E2E Smoke Test and Run Verification

**Files:**
- Create: `tests/e2e/intake-review.spec.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Consumes UI routes `/`, `/intake`
- Produces automated smoke coverage for the first user path.

- [ ] **Step 1: Add Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
```

- [ ] **Step 2: Add smoke test**

Create `tests/e2e/intake-review.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("dashboard links to intake page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
  await page.getByRole("link", { name: "快速录入" }).first().click();
  await expect(page.getByRole("heading", { name: "快速录入" })).toBeVisible();
  await page.getByText("口述总结").click();
  await page.getByPlaceholder(/这个供应商报价/).fill("供应商报价 12.5，MOQ 1000，交期 7 天，明天确认包装。");
  await expect(page.getByRole("button", { name: "生成整理草稿" })).toBeEnabled();
});
```

- [ ] **Step 3: Run unit tests**

Run: `npm test`

Expected: PASS for schema and confirmation tests.

- [ ] **Step 4: Run E2E test**

Run: `npm run e2e`

Expected: PASS for dashboard-to-intake smoke flow.

- [ ] **Step 5: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e/intake-review.spec.ts
git commit -m "test: add intake smoke coverage"
```

---

## Execution Notes

1. Before implementation, initialize Git if the directory is still not a repository:

```bash
git init
git add docs/superpowers/specs docs/superpowers/plans
git commit -m "docs: add workbench spec and plan"
```

2. Create a Supabase project and fill `.env.local` with real values copied from `.env.example`.

3. Apply the database migration before testing API routes that write data.

4. Set `OPENAI_API_KEY` and `OPENAI_EXTRACTION_MODEL` before testing AI intake.

5. Replace the MVP fixed user id with real Supabase authentication before exposing the app beyond private local testing.

## Self-Review

- Spec coverage: The plan covers low-friction intake, AI draft extraction, confirmation before save, supplier library, communication persistence, offer archive, product knowledge, tasks, lightweight business notes, exportability, and cloud-ready architecture.
- Scope control: The plan excludes orders, inventory, finance, approvals, team collaboration, multi-role permissions, large-scale 1688 scraping, final supplier decision automation, and complex offer comparison.
- Placeholder scan: The plan contains concrete file paths, function names, commands, and expected outcomes. No `TBD` or `TODO` placeholders are used.
- Type consistency: `DraftExtraction`, `buildConfirmedRecords`, repository functions, and API routes use consistent names and data flow.
