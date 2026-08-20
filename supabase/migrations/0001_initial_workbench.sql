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

alter table public.intake_drafts enable row level security;
alter table public.suppliers enable row level security;
alter table public.communications enable row level security;
alter table public.offers enable row level security;
alter table public.product_knowledge enable row level security;
alter table public.tasks enable row level security;
alter table public.business_notes enable row level security;

create policy "users own intake drafts" on public.intake_drafts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own suppliers" on public.suppliers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own communications" on public.communications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own offers" on public.offers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own product knowledge" on public.product_knowledge for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own business notes" on public.business_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index suppliers_user_id_idx on public.suppliers(user_id);
create index communications_user_id_idx on public.communications(user_id);
create index offers_user_id_idx on public.offers(user_id);
create index product_knowledge_user_id_idx on public.product_knowledge(user_id);
create index tasks_user_id_status_idx on public.tasks(user_id, status);
create index business_notes_user_id_idx on public.business_notes(user_id);
