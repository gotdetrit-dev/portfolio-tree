import { useState } from 'react'
import { CATS, fmtQty, fmtUsd } from '../data.js'

// ─────────────────────────────────────────────────────────────────────────────
// TransactionHistory — log rows of buys/sells, shown inside the history modal.
// The "รับรู้แล้ว" amount shows realized P/L, populated only for sells.
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABEL = { buy: 'ซื้อ', sell: 'ขาย', div: 'ปันผล', import: '📥 ยกยอด' }

const todayStr = () => new Date().toISOString().slice(0, 10)
const yesterdayStr = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10)

const DATE_FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'today', label: 'วันนี้' },
  { key: 'yesterday', label: 'เมื่อวาน' },
]

export default function TransactionHistory({ transactions, onEdit, onDelete }) {
  const [dateFilter, setDateFilter] = useState('all')

  if (transactions.length === 0) {
    return <div className="text-[12px] text-[var(--txt-faint)] italic">ยังไม่มีประวัติ</div>
  }

  const filtered = dateFilter === 'today'
    ? transactions.filter((t) => t.date === todayStr())
    : dateFilter === 'yesterday'
      ? transactions.filter((t) => t.date === yesterdayStr())
      : transactions

  return (
    <div>
      {/* Date filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {DATE_FILTERS.map((opt) => {
          const active = dateFilter === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => setDateFilter(opt.key)}
              className="px-3 py-1 rounded-full text-[11px] transition-all whitespace-nowrap"
              style={{
                border: `1px solid ${active ? 'rgba(255,255,255,0.45)' : 'var(--line-strong)'}`,
                background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: active ? '#fff' : 'var(--txt-dim)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
        <span className="text-[10px] text-[var(--txt-faint)] ml-1">{filtered.length} รายการ</span>
      </div>

      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-[12px] text-[var(--txt-faint)] italic">ไม่มีรายการในช่วงนี้</div>
        )}
        {[...filtered].reverse().map((t) => {
        const isBuy = t.type === 'buy'
        const isSell = t.type === 'sell'
        const isImport = t.type === 'import'
        // สีของ pill: buy เขียวอ่อน, sell แดงชมพู, import ทอง, อื่นๆ ฟ้า
        const tone = isBuy ? '#9bffae' : isSell ? '#ff8aa0' : isImport ? '#f7c948' : '#7bd1ff'
        const c = t.cat ? CATS[t.cat] : null
        // realized แสดงเมื่อ sell หรือ import (import เป็นการยกยอดกำไรย้อนหลัง)
        const realized = (isSell || isImport) ? (t.realizedPL || 0) : null
        const realPos = realized !== null && realized >= 0
        return (
          <div
            key={t.id}
            className="hairline rounded-lg p-2.5 flex items-center gap-3 text-[12px]"
            style={{
              background: isImport ? 'rgba(247,201,72,0.06)' : 'rgba(255,255,255,0.015)',
              borderColor: isImport ? 'rgba(247,201,72,0.3)' : undefined,
            }}
            title={isImport ? (t.note || 'ยกยอดกำไรย้อนหลัง (ก่อนใช้ระบบ)') : undefined}
          >
            <span className="text-[10px] font-mono text-[var(--txt-faint)] w-[80px]">{t.date}</span>
            <span className="px-2 py-0.5 rounded text-[10.5px] font-medium whitespace-nowrap" style={{ color: tone, border: `1px solid ${tone}44` }}>
              {TYPE_LABEL[t.type] || t.type}
            </span>
            <span className="font-mono font-semibold w-[60px]">{t.symbol || (isImport ? '—' : '')}</span>
            {c && (
              <span className="pill" style={{ color: c.hex, borderColor: c.hex + '66' }}>
                <span className="pill-dot" style={{ background: c.hex, boxShadow: `0 0 6px ${c.hex}` }} />
                {c.name}
              </span>
            )}
            <span className="font-mono num-tabular text-[var(--txt-dim)] ml-auto whitespace-nowrap">
              {isImport
                ? <span className="text-[10px] italic text-[var(--txt-faint)]">นำเข้าจาก broker เดิม</span>
                : t.qty ? `${fmtQty(t.qty)} @ ${fmtUsd(t.price)}` : ''}
            </span>
            {/* รับรู้แล้ว: sell + import */}
            <span
              className="font-mono num-tabular w-[110px] text-right whitespace-nowrap"
              style={{ color: realized === null ? 'var(--txt-faint)' : realPos ? '#9bffae' : '#ff8aa0' }}
            >
              {realized === null ? '—' : `${realPos ? '+' : ''}${fmtUsd(realized)}`}
            </span>
            <span className="font-mono num-tabular w-[100px] text-right whitespace-nowrap" style={{ color: tone }}>
              {isImport ? '' : (isBuy ? '−' : '+') + fmtUsd(t.total || t.amount || 0)}
            </span>
            {onEdit && !isImport && (
              <button
                onClick={() => onEdit(t)}
                className="text-[var(--txt-faint)] hover:text-[#7bd1ff] transition-colors text-[12px] shrink-0"
                title="แก้ไขรายการนี้"
              >
                ✎
              </button>
            )}
            {onDelete && !isImport && (
              <button
                onClick={() => onDelete(t.id)}
                className="text-[var(--txt-faint)] hover:text-[#ff8aa0] transition-colors text-[12px] shrink-0"
                title="ลบรายการนี้ออกจากประวัติ"
              >
                ✕
              </button>
            )}
            {/* Import row: ไม่มีปุ่มแก้/ลบ (ป้องกันลบผิด) — ต้องลบผ่าน SQL */}
            {isImport && <span className="w-[30px] shrink-0" />}
          </div>
        )
      })}
      </div>
    </div>
  )
}
