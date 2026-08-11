-- ═══════════════════════════════════════════════════════════════════════════
-- Portfolio Tree — Money Market (Forex/CFD tracker)
--
-- รันไฟล์นี้ใน Supabase SQL Editor เพิ่มเติมจาก schema.sql
-- ปลอดภัย รันซ้ำได้ (idempotent) ไม่ลบข้อมูลเดิม
--
-- 3 ตาราง:
--   mm_balance     — ยอดเงินคงเหลือของผู้ใช้ (1 แถว/user)
--   mm_positions   — สถานะเปิด/ปิดทั้งหมด
--   mm_activity    — ประวัติเติม/ถอน/ปิดสถานะ
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── ยอดเงินคงเหลือ ────────────────────────────────────────────────────────
create table if not exists public.mm_balance (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  balance_thb double precision not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.mm_balance enable row level security;
drop policy if exists "own mm_balance" on public.mm_balance;
create policy "own mm_balance" on public.mm_balance
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ─── สถานะ (Positions) ─────────────────────────────────────────────────────
create table if not exists public.mm_positions (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  pair         text not null,                       -- USDJPY, EURUSD, XAUUSD, ...
  direction    text not null,                       -- 'long' | 'short'
  lot          double precision not null,
  leverage     integer not null default 1,
  entry        double precision not null,
  tp           double precision,                    -- take profit (nullable)
  sl           double precision,                    -- stop loss (nullable)
  opened_at    timestamptz not null default now(),
  closed       boolean not null default false,
  close_price  double precision,
  closed_at    timestamptz,
  pnl_usd      double precision,                    -- P/L สุดท้ายตอนปิด
  pnl_thb      double precision,
  created_at   timestamptz not null default now()
);

create index if not exists mm_positions_user_idx on public.mm_positions(user_id);
create index if not exists mm_positions_open_idx on public.mm_positions(user_id, closed);

alter table public.mm_positions enable row level security;
drop policy if exists "own mm_positions" on public.mm_positions;
create policy "own mm_positions" on public.mm_positions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ─── ประวัติเงินสด / ปิดสถานะ ──────────────────────────────────────────────
create table if not exists public.mm_activity (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,                        -- 'deposit' | 'withdraw' | 'close'
  at          timestamptz not null default now(),
  amount_thb  double precision,                     -- สำหรับ deposit/withdraw (บวก/ลบ)
  -- เฉพาะ kind='close' ↓
  pair        text,
  direction   text,
  lot         double precision,
  entry       double precision,
  exit_price  double precision,                     -- (คำว่า "exit" เป็น reserved word — ใช้ exit_price)
  pnl_usd     double precision,
  pnl_thb     double precision,
  created_at  timestamptz not null default now()
);

create index if not exists mm_activity_user_idx on public.mm_activity(user_id, at desc);

alter table public.mm_activity enable row level security;
drop policy if exists "own mm_activity" on public.mm_activity;
create policy "own mm_activity" on public.mm_activity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
