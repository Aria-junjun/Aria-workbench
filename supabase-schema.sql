-- 创建工作台数据表
-- 在 Supabase Dashboard -> SQL Editor -> New Query 中执行

-- 创建工作台数据表
create table if not exists workbench_data (
  id uuid default gen_random_uuid() primary key,
  data jsonb not null default '{}',
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 关闭 RLS（工作台使用密码认证，不需要 Supabase Auth）
alter table workbench_data disable row level security;

-- 清除旧的 RLS 策略（如果存在）
drop policy if exists "Users can only access their own workbench data" on workbench_data;

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
