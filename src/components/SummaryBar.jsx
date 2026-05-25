import { useEffect, useRef, useState } from 'react'
import { CATS, MODES, fmtPct, fmtUsd } from '../data.js'

// ─────────────────────────────────────────────────────────────────────────────
// SummaryBar — KPI ribbon. The "โหมดตลาด" tile opens a popover that
// holds the 3 seasonal mode cards plus the edit-targets button.
// ─────────────────────────────────────────────────────────────────────────────

// Display-only currency toggle for this panel. State + rate live here so the
// rest of the app keeps using USD internally.
const FALLBACK_THB = 36
function fmtThb(n, rate) {
  const v = (n || 0) * rate
  return (v < 0 ? '-' : '') + '฿' + Math.abs(v).toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

export default function SummaryBar({ agg, mode, rebalancing, onModeChange, onEditTargets }) {
  const m = MODES[mode]
  const totalPos = (agg.totalPL || 0) >= 0
  const realPos = (agg.realizedPL || 0) >= 0
  const unrealPos = (agg.unrealizedPL || 0) >= 0
  const totalTone = totalPos ? '#9bffae' : '#ff8aa0'

  const [modeOpen, setModeOpen] = useState(false)
  const popRef = useRef(null)
  useEffect(() => {
    if (!modeOpen) return
    function onDoc(e) { if (popRef.current && !popRef.current.contains(e.target)) setModeOpen(false) }
    function onEsc(e) { if (e.key === 'Escape') setModeOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [modeOpen])

  // ─── USD / THB switch — affects only the numbers in this panel ──────────────
  const [currency, setCurrency] = useState('USD')
  const [usdThb, setUsdThb] = useState(FALLBACK_THB)
  useEffect(() => {
    let cancelled = false
    // Try a chain of free, no-key exchange-rate sources (Thailand-friendly).
    // Stops at the first source that returns a usable THB rate.
    const sources = [
      { url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', pick: (d) => d?.usd?.thb },
      { url: 'https://latest.currency-api.pages.dev/v1/currencies/usd.json', pick: (d) => d?.usd?.thb },
      { url: 'https://open.er-api.com/v6/latest/USD', pick: (d) => d?.rates?.THB },
    ]
    ;(async () => {
      for (const s of sources) {
        if (cancelled) return
        try {
          const r = await fetch(s.url)
          if (!r.ok) continue
          const d = await r.json()
          const rate = s.pick(d)
          if (rate && rate > 0) {
            if (!cancelled) setUsdThb(rate)
            return
          }
        } catch { /* try next source */ }
      }
    })()
    return () => { cancelled = true }
  }, [])
  const fmtMoney = (n) => (currency === 'THB' ? fmtThb(n, usdThb) : fmtUsd(n))

  return (
    <div className="panel rounded-2xl px-5 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 items-center">
      {/* พอร์ตรวม — main number; น้ำ + ลงทุนแล้ว stacked underneath as breakdown */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--txt-faint)]">พอร์ตรวม</div>
        <div className="text-[19px] font-mono num-tabular mt-1 whitespace-nowrap" style={{ color: '#fff' }}>
          {fmtMoney(agg.total)}
        </div>
        <div className="mt-1.5 flex flex-col gap-0.5 text-[10.5px] font-mono num-tabular whitespace-nowrap leading-tight">
          <span style={{ color: CATS.cash.hex, opacity: 0.9 }}>
            <span className="text-[var(--txt-faint)] uppercase tracking-wider mr-1">น้ำ</span>
            {fmtMoney(agg.cash)}
          </span>
          <span style={{ color: 'var(--txt-dim)' }}>
            <span className="text-[var(--txt-faint)] uppercase tracking-wider mr-1">ลงทุน</span>
            {fmtMoney(agg.invested)}
          </span>
        </div>
      </div>

      {/* Combined กำไร/ขาดทุน tile spans 2 columns */}
      <div className="col-span-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--txt-faint)]">กำไร/ขาดทุนรวม</div>
        <div className="text-[19px] font-mono num-tabular mt-1 whitespace-nowrap" style={{ color: totalTone, textShadow: `0 0 10px ${totalTone}66` }}>
          {fmtMoney(agg.totalPL || 0)} <span className="text-[12px] opacity-80">({fmtPct(agg.totalReturnPct || 0, 1)})</span>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[10.5px] font-mono num-tabular whitespace-nowrap leading-tight">
          <span style={{ color: realPos ? '#9bffae' : '#ff8aa0', opacity: 0.85 }}>
            <span className="text-[var(--txt-faint)] uppercase tracking-wider mr-1">รับรู้แล้ว</span>
            {fmtMoney(agg.realizedPL || 0)}
          </span>
          <span className="text-[var(--txt-faint)]">·</span>
          <span style={{ color: unrealPos ? '#9bffae' : '#ff8aa0', opacity: 0.85 }}>
            <span className="text-[var(--txt-faint)] uppercase tracking-wider mr-1">ยังไม่รับรู้</span>
            {fmtMoney(agg.unrealizedPL || 0)}
          </span>
        </div>
      </div>

      {/* โหมดตลาด — คลิกเพื่อเปิด popover เลือกโหมด + ปุ่มตั้งเป้าหมาย */}
      <div className="relative" ref={popRef}>
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--txt-faint)]">โหมดตลาด</div>
        <button
          onClick={() => setModeOpen((o) => !o)}
          className="mt-1 flex items-center gap-2 w-full text-left rounded-lg px-2 py-1 -ml-2 hover:bg-white/5 transition-colors"
          title="คลิกเพื่อเปลี่ยนโหมด"
        >
          <span className="text-[18px]" style={{ filter: `drop-shadow(0 0 6px ${m.tone})` }}>{m.icon}</span>
          <div className="min-w-0">
            <div className="text-[13px] font-thai font-semibold whitespace-nowrap" style={{ color: m.tone }}>{m.th}</div>
            <div className="text-[10px] text-[var(--txt-dim)] whitespace-nowrap">{m.en}</div>
          </div>
          <span
            className="ml-auto text-[10px] text-[var(--txt-faint)]"
            style={{ transform: modeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 140ms' }}
          >
            ▾
          </span>
        </button>

        {modeOpen && (
          <div
            className="absolute right-0 top-full mt-2 z-50 rounded-2xl p-3 fade-in"
            style={{
              width: 'min(760px, calc(100vw - 40px))',
              background: 'rgba(8,9,13,0.98)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          >
            <div className="flex items-stretch gap-2 flex-wrap">
              {Object.values(MODES).map((mm) => {
                const active = mode === mm.key
                return (
                  <button
                    key={mm.key}
                    onClick={() => { onModeChange(mm.key); setModeOpen(false) }}
                    className={`mode-tab flex-1 min-w-[200px] ${active ? 'active' : ''}`}
                    style={active ? { borderColor: mm.tone + '66', boxShadow: `inset 0 0 24px ${mm.tone}22, 0 0 0 1px ${mm.tone}55` } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[22px] shrink-0" style={{ filter: active ? `drop-shadow(0 0 6px ${mm.tone})` : 'none' }}>{mm.icon}</span>
                      <div className="text-left min-w-0">
                        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                          <span className="text-[15px] font-semibold font-thai" style={{ color: active ? mm.tone : '#fff' }}>{mm.th}</span>
                          <span className="text-[11px] text-[var(--txt-dim)]">· {mm.en}</span>
                        </div>
                        <div className="text-[11px] font-thai text-[var(--txt-dim)] truncate">{mm.sub}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      {['cash', 'core', 'stab', 'boost'].map((k) => {
                        const w = mm.targets[k]
                        return (
                          <div
                            key={k}
                            className="h-1.5 rounded-full"
                            style={{ flex: w, background: CATS[k].hex, opacity: active ? 0.9 : 0.45 }}
                            title={`${CATS[k].name} ${w}%`}
                          />
                        )
                      })}
                    </div>
                  </button>
                )
              })}
              <button
                onClick={() => { setModeOpen(false); onEditTargets() }}
                className="btn btn-ghost self-stretch px-4 whitespace-nowrap shrink-0"
                title="ตั้งค่าเป้าหมาย"
              >
                <span className="text-[var(--txt-dim)] whitespace-nowrap">⚙ เป้าหมาย</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--txt-faint)]">สถานะปรับสมดุล</div>
        <div className="mt-1 flex items-center gap-2 whitespace-nowrap">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{
              background: rebalancing.balanced ? '#9bffae' : '#f7c948',
              boxShadow: `0 0 10px ${rebalancing.balanced ? '#9bffae' : '#f7c948'}`,
            }}
          />
          <span className="text-[13px] font-medium" style={{ color: rebalancing.balanced ? '#9bffae' : '#f7c948' }}>
            {rebalancing.balanced ? 'สมดุลแล้ว' : `${rebalancing.offCount} หมวดเกินเป้า`}
          </span>
        </div>
      </div>

      {/* สกุลเงิน — สวิตช์แสดงผลในกล่องนี้ตัวเดียว (ไม่กระทบส่วนอื่น) */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--txt-faint)]">สกุลเงิน</div>
        <div className="mt-1 inline-flex items-center p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {['USD', 'THB'].map((c) => {
            const on = currency === c
            return (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className="px-2.5 py-1 rounded text-[12px] font-semibold transition-all"
                style={{
                  background: on ? 'rgba(123,209,255,0.15)' : 'transparent',
                  color: on ? '#7bd1ff' : 'var(--txt-dim)',
                  border: on ? '1px solid rgba(123,209,255,0.55)' : '1px solid transparent',
                }}
              >
                {c}
              </button>
            )
          })}
        </div>
        <div className="text-[10px] text-[var(--txt-faint)] font-mono mt-1 whitespace-nowrap">
          1 USD = ฿{usdThb.toFixed(2)}
        </div>
      </div>
    </div>
  )
}
