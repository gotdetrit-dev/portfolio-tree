-- ═══════════════════════════════════════════════════════════════════════════
-- Portfolio Tree — ผูกหุ้นกับธีมในห้องลงทุน
--
-- เพิ่มคอลัมน์ theme_id ให้ holdings และ watching_list
-- (theme_id = id ของธีมใน investment_room.themes)
-- รันซ้ำได้ (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.holdings      add column if not exists theme_id text;
alter table public.watching_list add column if not exists theme_id text;

create index if not exists holdings_theme_idx      on public.holdings(user_id, theme_id);
create index if not exists watching_list_theme_idx on public.watching_list(user_id, theme_id);
