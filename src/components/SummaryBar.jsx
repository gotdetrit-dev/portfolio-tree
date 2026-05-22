import { useEffect, useRef, useState } from 'react'
import { CATS, MODES, fmtPct, fmtUsd } from '../data.js'

// ─────────────────────────────────────────────────────────────────────────────
// SummaryBar — KPI ribbon. The "โหมดตลาด" tile opens a popover that
// holds the 3 seasonal mode cards plus the edit-targets button.
// ─────────────────────────────────────────────────────────────────────────────

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

  const simpleItems = [
    { label: 'พอร์ตรวม', value: fmtUsd(agg.total), tone: '#fff' },
    { label: 'น้ำ (เงินสด)', value: fmtUsd(agg.cash), tone: CATS.cash.hex },
    { label: 'ลงทุนแล้ว', value: fmtUsd(agg.invested), tone: '#fff' },
  ]

  return (
    <div className="panel rounded-2xl px-5 py-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-5 items-center">
      {simpleItems.map((it, i) => (
        <div key={i}>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--txt-faint)]">{it.label}</div>
          <div
            className="text-[19px] font-mono num-tabular mt-1 whitespace-nowrap"
            style={{ color: it.tone, textShadow: it.tone !== '#fff' ? `0 0 10px ${it.tone}66` : 'none' }}
          >
            {it.value}
          </div>
        </div>
      ))}

      {/* Combined กำไร/ขาดทุน tile spans 2 columns */}
      <div className="col-span-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--txt-faint)]">กำไร/ขาดทุนรวม</div>
        <div className="text-[19px] font-mono num-tabular mt-1 whitespace-nowrap" style={{ color: totalTone, textShadow: `0 0 10px ${totalTone}66` }}>
          {fmtUsd(agg.totalPL || 0)} <span className="text-[12px] opacity-80">({fmtPct(agg.totalReturnPct || 0, 1)})</span>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[10.5px] font-mono num-tabular whitespace-nowrap leading-tight">
          <span style={{ color: realPos ? '#9bffae' : '#ff8aa0', opacity: 0.85 }}>
            <span className="text-[var(--txt-faint)] uppercase tracking-wider mr-1">รับรู้แล้ว</span>
            {fmtUsd(agg.realizedPL || 0)}
          </span>
          <span className="text-[var(--txt-faint)]">·</span>
          <span style={{ color: unrealPos ? '#9bffae' : '#ff8aa0', opacity: 0.85 }}>
            <span className="text-[var(--txt-faint)] uppercase tracking-wider mr-1">ยังไม่รับรู้</span>
            {fmtUsd(agg.unrealizedPL || 0)}
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
    </div>
  )
}
