-- ═══════════════════════════════════════════════════════════════════════════
-- Portfolio Tree — database schema for Supabase (PostgreSQL)
--
-- HOW TO USE:
--   1. Open your Supabase project → SQL Editor → New query
--   2. Paste this whole file and click "Run"
--   3. Re-running is safe (idempotent)
--
-- Each signed-in user only ever sees and edits their own rows (Row Level
-- Security below). `double precision` is used for numbers so the JS client
-- receives plain numbers instead of strings.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- One settings row per user: cash balance, active market mode, target weights.
create table if not exists public.portfolio_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  cash       double precision not null default 0,
  mode       text not null default 'cool',
  targets    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.holdings (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  cat        text not null,
  symbol     text not null,
  name       text,
  qty        double precision not null default 0,
  avg        double precision not null default 0,
  price      double precision not null default 0,
  add_plan   jsonb not null default '[0,0,0]'::jsonb,
  trim_plan  jsonb not null default '[0,0,0]'::jsonb,
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id                        text primary key,
  user_id                   uuid not null references auth.users(id) on delete cascade,
  date                      date not null,
  type                      text not null,
  symbol                    text,
  cat                       text,
  qty                       double precision,
  price                     double precision,
  fee                       double precision default 0,
  note                      text,
  total                     double precision,
  amount                    double precision,
  realized_pl               double precision,
  average_cost_at_sell_time double precision,
  gross_proceeds            double precision,
  net_proceeds              double precision,
  created_at                timestamptz not null default now()
);

create table if not exists public.cash_activity (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  type       text not null,
  amount     double precision not null,
  note       text,
  created_at timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists holdings_user_idx       on public.holdings(user_id);
create index if not exists transactions_user_idx   on public.transactions(user_id);
create index if not exists cash_activity_user_idx  on public.cash_activity(user_id);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Without these policies, no one can read or write any row.

alter table public.portfolio_settings enable row level security;
alter table public.holdings           enable row level security;
alter table public.transactions        enable row level security;
alter table public.cash_activity        enable row level security;

drop policy if exists "own settings"      on public.portfolio_settings;
drop policy if exists "own holdings"      on public.holdings;
drop policy if exists "own transactions"  on public.transactions;
drop policy if exists "own cash_activity" on public.cash_activity;

create policy "own settings" on public.portfolio_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own holdings" on public.holdings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own cash_activity" on public.cash_activity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
