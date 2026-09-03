-- ═══════════════════════════════════════════════════════════════════════════
-- Portfolio Tree — รองรับสินทรัพย์หลายสกุลเงิน (currency + manual_price)
--
-- รันไฟล์นี้ใน Supabase SQL Editor ก่อน deploy code ที่รองรับกองทุนไทย
-- ปลอดภัย รันซ้ำได้ (idempotent) ไม่ลบข้อมูลเดิม
--
-- เพิ่ม 2 columns ในตาราง holdings:
--   currency     — 'USD' (default) หรือ 'THB' สำหรับกองทุนไทย
--   manual_price — true = ระบบจะไม่ยิง Finnhub อัพเดตราคาให้ (กรอกเอง)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.holdings
  add column if not exists currency text not null default 'USD',
  add column if not exists manual_price boolean not null default false;

-- ป้องกันค่าอื่นๆ (เผื่ออนาคตเพิ่ม 'EUR', 'JPY' จะแก้ตรงนี้)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'holdings_currency_valid' and table_name = 'holdings'
  ) then
    alter table public.holdings
      add constraint holdings_currency_valid check (currency in ('USD','THB'));
  end if;
end$$;
