import { useEffect, useRef, useState } from 'react'
import { CATS, MODES, fmtPct, fmtUsd } from '../data.js'

// ─────────────────────────────────────────────────────────────────────────────
// SummaryBar — top KPI ribbon.
//
// Layout:
//   1) Four KPI cards: มูลค่าพอร์ต / กำไรยังไม่รับรู้ / กำไรรับรู้แล้ว / กำไร/ขาดทุนรวม
//   2) Footer strip: market mode button, rebalance status, USD/THB currency switch
//
// All monetary numbers default to THB (converted from the USD database via
// the rate fetched in this component). The toggle only affects display here;
// the rest of the app continues to use USD.
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_THB = 36
const RATE_CACHE_KEY = 'usdThbRate.v1'

// Read the last successful rate from localStorage (any age — we only fall back
// to FALLBACK_THB if there is no cached value at all).
function readCachedRate() {
  try {
    const raw = localStorage.getItem(RATE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed?.rate === 'number' && parsed.rate > 0 ? parsed : null
  } catch {
    return null
  }
}

function writeCachedRate(rate) {
  try {
    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, ts: Date.now() }))
  } catch {}
}

function fmtThb(n, rate) {
  const v = (n || 0) * rate
  return (v < 0 ? '-' : '') + '฿' + Math.abs(v).toLocaleString('th-TH', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
}

export default function SummaryBar({ agg, mode, rebalancing, needAdjustCount = 0, onModeChange, onEditTargets }) {
  const m = MODES[mode]

  // ─── Currency state + live USD/THB rate ─────────────────────────────────────
  const [currency, setCurrency] = useState('THB')
  // Use the last-known-good rate from localStorage as initial value to avoid
  // showing the FALLBACK_THB=36 to users on devices where APIs are blocked.
  const [usdThb, setUsdThb] = useState(() => readCachedRate()?.rate ?? FALLBACK_THB)
  useEffect(() => {
    let cancelled = false
    const sources = [
      // Same-origin Vercel function → near-realtime (Yahoo) + no CORS. Falls
      // back to the once-a-day no-key APIs if the function isn't available
      // (e.g. local Vite dev, where /api doesn't run).
      { url: '/api/fxrate', pick: (d) => d?.rate },
      { url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', pick: (d) => d?.usd?.thb },
      { url: 'https://latest.currency-api.pages.dev/v1/currencies/usd.json', pick: (d) => d?.usd?.thb },
      { url: 'https://open.er-api.com/v6/latest/USD', pick: (d) => d?.rates?.THB },
    ]
    ;(async () => {
      for (const s of sources) {
        if (cancelled) return
        try {
          // Time each source out at 4s so a slow/blocked source fails over fast
          // instead of hanging on the browser's long default timeout.
          const r = await fetch(s.url, { signal: AbortSignal.timeout(4000) })
          if (!r.ok) continue
          const d = await r.json()
          const rate = s.pick(d)
          if (rate && rate > 0) {
            if (!cancelled) {
              setUsdThb(rate)
              writeCachedRate(rate)
            }
            return
          }
        } catch { /* try next source */ }
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Display helpers
  const fmtMoney = (n) => (currency === 'THB' ? fmtThb(n, usdThb) : fmtUsd(n))
  const fmtSigned = (n) => {
    const s = fmtMoney(Math.abs(n || 0))
    if ((n || 0) > 0) return '+' + s
    if ((n || 0) < 0) return '−' + s
    return s
  }
  // เขียว = สีปุ่ม "แดชบอร์ด" / Core hex, แดง = สี Booster hex
  const tonePos = '#34e07a'
  const toneNeg = '#ff4d6d'
  const toneOf = (n) => (n >= 0 ? tonePos : toneNeg)

  // ─── Derived values ─────────────────────────────────────────────────────────
  const unrealPct = agg.cost > 0 ? (agg.unrealizedPL / agg.cost) * 100 : 0
  const totalPL = agg.totalPL || 0
  const unrealPL = agg.unrealizedPL || 0
  const realPL = agg.realizedPL || 0

  const totalTone = toneOf(totalPL)
  const unrealTone = toneOf(unrealPL)
  const realTone = toneOf(realPL)

  // ─── Mode popover ───────────────────────────────────────────────────────────
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

  const cardCls = 'rounded-xl p-4'
  const cardStyle = { background: 'rgba(255,255,255,0.025)', border: '1px solid var(--line)' }

  return (
    <div className="panel rounded-2xl px-5 py-4">
      {/* ─── 4 KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Portfolio value */}
        <div className={cardCls} style={cardStyle}>
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--txt-faint)]">มูลค่าพอร์ต</div>
          <div className="text-[20px] font-semibold font-mono num-tabular mt-2 whitespace-nowrap text-white">
            {fmtMoney(agg.total)}
          </div>
          <div className="text-[11px] text-[var(--txt-faint)] mt-1.5">
            เงินสด <span className="text-[var(--txt-dim)] font-mono num-tabular">{fmtMoney(agg.cash)}</span>
          </div>
        </div>

        {/* Unrealized gain */}
        <div className={cardCls} style={cardStyle}>
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--txt-faint)]">กำไรยังไม่รับรู้</div>
          <div className="mt-2 flex items-baseline gap-2 whitespace-nowrap">
            <span className="text-[20px] font-semibold font-mono num-tabular" style={{ color: unrealTone, textShadow: `0 0 10px ${unrealTone}44` }}>
              {fmtSigned(unrealPL)}
            </span>
            <span className="text-[12px] font-mono num-tabular" style={{ color: unrealTone, opacity: 0.85 }}>
              {fmtPct(unrealPct, 2)}
            </span>
          </div>
          <div className="text-[11px] text-[var(--txt-faint)] mt-1.5">
            ลงทุน <span className="text-[var(--txt-dim)] font-mono num-tabular">{fmtMoney(agg.invested)}</span>
          </div>
        </div>

        {/* Realized gain */}
        <div className={cardCls} style={cardStyle}>
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--txt-faint)]">กำไรรับรู้แล้ว</div>
          <div className="text-[20px] font-semibold font-mono num-tabular mt-2 whitespace-nowrap" style={{ color: realTone, textShadow: `0 0 10px ${realTone}44` }}>
            {fmtSigned(realPL)}
          </div>
          <div className="text-[11px] text-[var(--txt-faint)] mt-1.5">
            ปันผล/ดอกเบี้ย <span className="text-[var(--txt-dim)] font-mono num-tabular">{fmtSigned(agg.cashIncome || 0)}</span>
          </div>
        </div>

        {/* Total gain */}
        <div className={cardCls} style={cardStyle}>
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--txt-faint)]">กำไร/ขาดทุนรวม</div>
          <div className="mt-2 flex items-baseline gap-2 whitespace-nowrap">
            <span className="text-[20px] font-semibold font-mono num-tabular" style={{ color: totalTone, textShadow: `0 0 10px ${totalTone}44` }}>
              {fmtSigned(totalPL)}
            </span>
            <span className="text-[12px] font-mono num-tabular" style={{ color: totalTone, opacity: 0.85 }}>
              {fmtPct(agg.totalReturnPct || 0, 2)}
            </span>
          </div>
          <div className="text-[11px] text-[var(--txt-faint)] mt-1.5">
            ต้นทุน <span className="text-[var(--txt-dim)] font-mono num-tabular">{fmtMoney(agg.costBasis || 0)}</span>
          </div>
        </div>
      </div>

      {/* ─── Footer strip: mode · status · currency switch ────────────────── */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-5 flex-wrap text-[12px]">
        {/* Market mode (popover trigger) */}
        <div className="relative" ref={popRef}>
          <button
            onClick={() => setModeOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 -ml-2 hover:bg-white/5 transition-colors whitespace-nowrap"
            title="คลิกเพื่อเปลี่ยนโหมด"
          >
            <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--txt-faint)]">โหมด</span>
            <span className="text-[16px]" style={{ filter: `drop-shadow(0 0 6px ${m.tone})` }}>{m.icon}</span>
            <span className="text-[13px] font-thai font-semibold" style={{ color: m.tone }}>{m.th}</span>
            <span className="text-[10px] text-[var(--txt-faint)]" style={{ transform: modeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 140ms' }}>▾</span>
          </button>

          {modeOpen && (
            <div
              className="absolute left-0 top-full mt-2 z-50 rounded-2xl p-3 fade-in"
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

        {/* Rebalance status */}
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--txt-faint)]">สถานะ</span>
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

        {/* Per-stock adjustment alert — blinks red when any stock needs action */}
        <div className={`flex items-center gap-2 whitespace-nowrap ${needAdjustCount > 0 ? 'chip-blink' : ''}`}>
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--txt-faint)]">หุ้นต้องปรับ</span>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{
              background: needAdjustCount > 0 ? '#ff4d6d' : '#8a92a3',
              boxShadow: needAdjustCount > 0 ? '0 0 10px #ff4d6d' : 'none',
            }}
          />
          <span className="text-[13px] font-medium" style={{ color: needAdjustCount > 0 ? '#ff4d6d' : 'var(--txt-dim)' }}>
            {needAdjustCount > 0 ? `${needAdjustCount} รายการ` : 'ไม่มี'}
          </span>
        </div>

        {/* Currency switch + live rate (display-only in this panel) */}
        <div className="flex items-center gap-2 ml-auto whitespace-nowrap">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--txt-faint)]">สกุลเงิน</span>
          <div className="inline-flex items-center p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {['USD', 'THB'].map((c) => {
              const on = currency === c
              return (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className="px-2.5 py-0.5 rounded text-[11.5px] font-semibold transition-all"
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
          <span className="text-[10.5px] text-[var(--txt-faint)] font-mono">
            1 USD = ฿{usdThb.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
}
