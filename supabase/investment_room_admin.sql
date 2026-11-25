-- ═══════════════════════════════════════════════════════════════════════════
-- Portfolio Tree — ห้องลงทุน: ธีมกลางจากแอดมิน
--
-- แอดมิน (แทน ADMIN_EMAIL_HERE ด้วยอีเมลแอดมินก่อนรัน) เป็นคนเดียวที่เพิ่ม/แก้/ลบธีมได้
-- ผู้ใช้คนอื่นเห็นธีมชุดเดียวกับแอดมิน แต่ปรับสัดส่วน / ซื้อขาย / เงินสด ของตัวเองได้
-- ฟังก์ชันนี้คืน id แอดมิน + ธีมและสัดส่วนของแอดมิน (ใช้กับปุ่ม "คัดลอกสัดส่วน")
-- รันซ้ำได้ (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.investment_room_admin()
returns table (admin_id uuid, themes jsonb, cash_alloc numeric)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, coalesce(r.themes, '[]'::jsonb), coalesce(r.cash_alloc, 100)
  from auth.users u
  left join public.investment_room r on r.user_id = u.id
  where lower(u.email) = lower('ADMIN_EMAIL_HERE')
  limit 1
$$;

revoke all on function public.investment_room_admin() from public, anon;
grant execute on function public.investment_room_admin() to authenticated;

notify pgrst, 'reload schema';
