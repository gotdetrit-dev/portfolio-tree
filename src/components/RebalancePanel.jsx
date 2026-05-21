import { CATS, fmtPctPlain, fmtUsd, fmtUsdK } from '../data.js'

// ─────────────────────────────────────────────────────────────────────────────
// RebalancePanel — actionable list with 25/50/100% staged rebalance
// ─────────────────────────────────────────────────────────────────────────────

export default function RebalancePanel({ targets, agg, onAct }) {
  // Per-category over/under in $
  const rows = ['cash', 'core', 'stab', 'boost'].map((k) => {
    const cur = agg.pct[k] || 0
    const tgt = targets[k] || 0
    const diffPct = cur - tgt
    const diffUsd = (diffPct / 100) * agg.total
    const action = diffPct > 0.5 ? 'ควรลด' : diffPct < -0.5 ? 'ควรเพิ่ม' : 'สมดุล'
    return { key: k, cat: CATS[k], cur, tgt, diffPct, diffUsd, action }
  })

  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <div className="text-[14px] font-semibold tracking-wide">สถานะปรับสมดุล</div>
          <div className="text-[11px] text-[var(--txt-dim)]">ปรับเป็นขั้น 25 / 50 / 100% ของส่วนต่าง</div>
        </div>
        <div
          className="rounded-lg px-3 py-1.5 text-[12px] whitespace-nowrap"
          style={{ background: 'rgba(45,212,255,0.08)', border: '1px solid rgba(45,212,255,0.28)' }}
          title="มูลค่า 1% ของพอร์ตทั้งหมด — ใช้คำนวณว่าจะซื้อกี่ % ต้องใช้เงินเท่าไร"
        >
          <span className="text-[var(--txt-dim)]">1% ของพอร์ต = </span>
          <span className="font-mono font-semibold text-cash">{fmtUsd(agg.total / 100)}</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const tone = r.action === 'ควรลด' ? '#ff8aa0' : r.action === 'ควรเพิ่ม' ? '#9bffae' : '#cfd6e3'
          const absUsd = Math.abs(r.diffUsd)
          return (
            <div key={r.key} className="hairline rounded-xl p-3 flex items-center gap-3 flex-wrap" style={{ background: 'rgba(255,255,255,0.015)' }}>
              <span className="pill" style={{ color: r.cat.hex, borderColor: r.cat.hex + '66' }}>
                <span className="pill-dot" style={{ background: r.cat.hex, boxShadow: `0 0 6px ${r.cat.hex}` }} />
                {r.cat.name}
              </span>
              <div className="text-[12px] text-[var(--txt-dim)] min-w-[120px]">
                {fmtPctPlain(r.cur)} <span className="text-[var(--txt-faint)]">→</span> <span className="text-white">{fmtPctPlain(r.tgt, 0)}</span>
              </div>
              <div className="flex-1 min-w-[120px]">
                <div className="h-1.5 rounded-full relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{ width: `${Math.min(100, Math.max(0, r.cur))}%`, background: r.cat.hex, opacity: 0.9, boxShadow: `0 0 8px ${r.cat.hex}` }}
                  />
                  <div
                    className="absolute top-[-3px] bottom-[-3px] w-[2px]"
                    style={{ left: `${Math.min(100, Math.max(0, r.tgt))}%`, background: '#fff', opacity: 0.55 }}
                  />
                </div>
              </div>
              <div className="text-[12px] mono min-w-[110px]" style={{ color: tone }}>
                {r.action} {r.action !== 'สมดุล' ? fmtUsdK(absUsd) : ''}
              </div>
              <div className="flex items-center gap-1">
                {[25, 50, 100].map((p) => (
                  <button
                    key={p}
                    disabled={r.action === 'สมดุล'}
                    onClick={() => onAct(r, p)}
                    className="btn px-2 py-1 text-[11px] disabled:opacity-30 disabled:cursor-not-allowed"
                    style={r.action === 'สมดุล' ? {} : { borderColor: tone + '55', color: tone }}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
