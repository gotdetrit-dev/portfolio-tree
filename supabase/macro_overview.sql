-- ═══════════════════════════════════════════════════════════════════════════
-- Portfolio Tree — Macro-Overview
--
-- หน้ากรอกข้อมูลภาพรวม macro ด้วยตัวเอง — เก็บทั้งหมดใน 1 row/user
--   data    = jsonb { metric_key: { value, analysis, updatedAt } }
--   summary = text สรุปใหญ่ด้านขวา
-- รันซ้ำได้ (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.macro_overview (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  summary    text  not null default '',
  updated_at timestamptz not null default now()
);

alter table public.macro_overview enable row level security;

drop policy if exists "own macro_overview" on public.macro_overview;
create policy "own macro_overview" on public.macro_overview
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
