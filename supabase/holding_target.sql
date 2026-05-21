-- ═══════════════════════════════════════════════════════════════════════════
-- Portfolio Tree — add per-stock target allocation to holdings
--
-- Run this in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- `target_pct` is each holding's own target weight, as a % of the whole
-- portfolio. Shown in the holdings table's allocation column.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.holdings
  add column if not exists target_pct double precision not null default 0;
