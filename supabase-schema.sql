-- 创建工作台数据表
-- 在 Supabase Dashboard -> SQL Editor -> New Query 中执行

-- 启用 RLS (Row Level Security)
alter table if exists workbench_data enable row level security;

-- 创建工作台数据表
create table if not exists workbench_data (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 创建索引
create index if not exists idx_workbench_data_user_id on workbench_data(user_id);

-- 启用 RLS
alter table workbench_data enable row level security;

-- 创建 RLS 策略：用户只能读写自己的数据
create policy "Users can only access their own workbench data"
  on workbench_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 创建 updated_at 自动更新触发器
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_workbench_data_updated_at on workbench_data;
create trigger update_workbench_data_updated_at
  before update on workbench_data
  for each row
  execute function update_updated_at_column();
