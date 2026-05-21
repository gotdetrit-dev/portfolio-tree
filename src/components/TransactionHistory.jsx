import { CATS, fmtQty, fmtUsd } from '../data.js'

// ─────────────────────────────────────────────────────────────────────────────
// TransactionHistory — log of buys/sells/cash events.
// The "รับรู้แล้ว" column shows realized P/L, populated only for sells.
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABEL = { buy: 'ซื้อ', sell: 'ขาย', div: 'ปันผล' }

export default function TransactionHistory({ transactions, onDelete }) {
  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[14px] font-semibold tracking-wide">ประวัติรายการ</div>
          <div className="text-[11px] text-[var(--txt-dim)]">{transactions.length} รายการ</div>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--txt-faint)]">รับรู้แล้ว เฉพาะรายการขาย</div>
      </div>
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
        {[...transactions].slice().reverse().map((t) => {
          const isBuy = t.type === 'buy'
          const isSell = t.type === 'sell'
          const tone = isBuy ? '#9bffae' : isSell ? '#ff8aa0' : '#7bd1ff'
          const c = t.cat ? CATS[t.cat] : null
          const realized = isSell ? t.realizedPL || 0 : null
          const realPos = realized !== null && realized >= 0
          return (
            <div key={t.id} className="hairline rounded-lg p-2.5 flex items-center gap-3 text-[12px]" style={{ background: 'rgba(255,255,255,0.015)' }}>
              <span className="text-[10px] font-mono text-[var(--txt-faint)] w-[80px]">{t.date}</span>
              <span className="px-2 py-0.5 rounded text-[10.5px] font-medium" style={{ color: tone, border: `1px solid ${tone}44` }}>
                {TYPE_LABEL[t.type] || t.type}
              </span>
              <span className="font-mono font-semibold w-[60px]">{t.symbol}</span>
              {c && (
                <span className="pill" style={{ color: c.hex, borderColor: c.hex + '66' }}>
                  <span className="pill-dot" style={{ background: c.hex, boxShadow: `0 0 6px ${c.hex}` }} />
                  {c.name}
                </span>
              )}
              <span className="font-mono num-tabular text-[var(--txt-dim)] ml-auto whitespace-nowrap">
                {t.qty ? `${fmtQty(t.qty)} @ ${fmtUsd(t.price)}` : ''}
              </span>
              {/* รับรู้แล้ว: only on sells */}
              <span
                className="font-mono num-tabular w-[110px] text-right whitespace-nowrap"
                style={{ color: realized === null ? 'var(--txt-faint)' : realPos ? '#9bffae' : '#ff8aa0' }}
              >
                {realized === null ? '—' : `${realPos ? '+' : ''}${fmtUsd(realized)}`}
              </span>
              <span className="font-mono num-tabular w-[100px] text-right whitespace-nowrap" style={{ color: tone }}>
                {isBuy ? '−' : '+'}{fmtUsd(t.total || t.amount || 0)}
              </span>
              {onDelete && (
                <button
                  onClick={() => onDelete(t.id)}
                  className="text-[var(--txt-faint)] hover:text-[#ff8aa0] transition-colors text-[12px] shrink-0"
                  title="ลบรายการนี้ออกจากประวัติ"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
        {transactions.length === 0 && (
          <div className="text-[12px] text-[var(--txt-faint)] italic">ยังไม่มีประวัติ</div>
        )}
      </div>
    </div>
  )
}
