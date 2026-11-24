-- ═══════════════════════════════════════════════════════════════════════════
-- Portfolio Tree — ห้องลงทุน (Investment Room)
--
-- เก็บทั้งหมดใน 1 row/user
--   themes     = jsonb [ { id, name, icon, tone, description, news, image, alloc, holdings, watchlist } ]
--   cash_alloc = สัดส่วนเงินสด (%) — ธีมทั้งหมด + เงินสด = 100
--   avatar     = jsonb ตัวละคร
-- รันซ้ำได้ (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.investment_room (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  themes     jsonb   not null default '[]'::jsonb,
  cash_alloc numeric not null default 100,
  avatar     jsonb   not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.investment_room enable row level security;

drop policy if exists "own investment_room" on public.investment_room;
create policy "own investment_room" on public.investment_room
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
