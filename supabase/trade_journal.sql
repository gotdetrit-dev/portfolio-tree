-- ═══════════════════════════════════════════════════════════════════════════
-- Portfolio Tree — Daily Portfolio Journal table
--
-- Run this in the Supabase SQL Editor IN ADDITION to schema.sql.
-- Safe to re-run (idempotent).
--
-- A manual daily trade log, split across three portfolio groups
-- (Shay's / Channel's / Insider). Independent of the holdings tables —
-- it does not affect any portfolio calculation.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.trade_journal (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  portfolio   text not null,            -- 'shay' | 'channel' | 'insider'
  action      text not null,            -- 'buy' | 'sell'
  ticker      text not null,
  quantity    double precision not null default 0,
  price       double precision not null default 0,
  reason      text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists trade_journal_user_idx on public.trade_journal(user_id);

alter table public.trade_journal enable row level security;

drop policy if exists "own trade_journal" on public.trade_journal;
create policy "own trade_journal" on public.trade_journal
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
