-- ═══════════════════════════════════════════════════════════════════════════
-- Portfolio Tree — Watching List table
--
-- Run this in the Supabase SQL Editor IN ADDITION to schema.sql.
-- Safe to re-run (idempotent).
--
-- Stocks the user is watching for a support-price entry. Synced per user.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.watching_list (
  id            text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  ticker        text not null,
  asset_name    text,
  category      text not null default 'Core',
  support_price double precision not null default 0,
  current_price double precision not null default 0,
  alert_status  text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists watching_list_user_idx on public.watching_list(user_id);

alter table public.watching_list enable row level security;

drop policy if exists "own watching_list" on public.watching_list;
create policy "own watching_list" on public.watching_list
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
