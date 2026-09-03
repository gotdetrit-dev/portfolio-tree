-- ═══════════════════════════════════════════════════════════════════════════
-- Portfolio Tree — นำเข้ากำไรย้อนหลังปี 2026 (Dr.Detrit Chalee)
--
-- รันไฟล์นี้ใน Supabase SQL Editor ขณะ login ด้วย account ของคุณหมอ
-- (auth.uid() = คนที่รัน)
--
-- เพิ่ม 1 row ใน transactions:
--   type   = 'import'  (ยกยอดกำไรย้อนหลัง)
--   date   = 2026-01-01 (วันแรกที่เริ่มเทรด)
--   realized_pl = +10670.17 USD (คำนวณจาก broker CSV)
--
-- ปลอดภัย รันซ้ำได้ (idempotent) เพราะ id fixed → on conflict do nothing
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.transactions (
  id, user_id, date, type, symbol, cat, qty, price, fee,
  note, realized_pl
)
values (
  'txn_import_hist_2026_v1',
  auth.uid(),
  '2026-01-01',
  'import',
  null,
  null,
  0, 0, 0,
  'ยกยอดกำไรย้อนหลัง 1 มค. - 8 พค. 2569 (นำเข้าจาก broker CSV) · trading +$10,544.23 · dividend +$125.94',
  10670.17
)
on conflict (id) do nothing;
