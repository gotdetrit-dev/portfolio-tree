-- tracked_levels.sql
-- เพิ่มคอลัมน์เก็บ "ไม้ที่ติดตาม" ของแต่ละหุ้น (index 0-4 ของ add_plan / trim_plan)
-- ใช้สำหรับแสดงเตือน ถือ / แผนเพิ่ม / แผนลด บนแดชบอร์ด
-- ค่า null = ไม่ได้ติดตามไม้ใด

alter table public.holdings
  add column if not exists tracked_add  smallint,
  add column if not exists tracked_trim smallint;
