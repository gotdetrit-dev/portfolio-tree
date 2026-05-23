import { CATS, fmtPct, fmtPctPlain, fmtUsdK } from '../data.js'

// ─────────────────────────────────────────────────────────────────────────────
// CategoryCard — right-side neon-bordered cards (Booster/Stab/Core/Cash)
// ConnectorLine — dotted line from card to tree anchor
// ─────────────────────────────────────────────────────────────────────────────

function ConnectorLine({ color }) {
  // Connector sits to the LEFT of the card. The line is long enough to
  // visibly emerge from the tree image, and the left end fades out via
  // a mask so it dissolves into the tree rather than terminating abruptly.
  return (
    <div
      aria-hidden
      className="absolute right-full top-1/2 hidden md:block"
      style={{
        width: 'clamp(70px, 9vw, 140px)',
        height: '2px',
        transform: 'translateY(-50%)',
        right: 'calc(100% + 2px)',
        backgroundImage: `radial-gradient(circle, ${color} 0.9px, transparent 1.2px)`,
        backgroundSize: '7px 2px',
        backgroundRepeat: 'repeat-x',
        backgroundPosition: 'left center',
        opacity: 0.55,
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 35%, #000 100%)',
        maskImage: 'linear-gradient(to right, transparent 0%, #000 35%, #000 100%)',
        filter: `drop-shadow(0 0 4px ${color}88)`,
      }}
    />
  )
}

export default function CategoryCard({ catKey, agg, targets, onClick, onManage, fillHeight }) {
  const cat = CATS[catKey]
  const color = cat.hex
  const cur = agg.pct[catKey] || 0
  const tgt = targets[catKey] || 0
  const mv = agg.byCat[catKey] || 0
  const diff = cur - tgt
  const action = diff > 1.5 ? 'ลด' : diff < -1.5 ? 'เพิ่ม' : 'ถือ'
  const actionTone = action === 'เพิ่ม' ? '#9bffae' : action === 'ลด' ? '#ff8aa0' : '#cfd6e3'

  return (
    <div className={`relative ${fillHeight ? 'h-full' : ''}`}>
      <ConnectorLine color={color} />
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
        className={`relative w-full text-left rounded-2xl p-3 lg:p-3.5 panel transition-transform hover:-translate-y-0.5 glow-${cat.color} flex flex-col justify-between ${fillHeight ? 'h-full' : ''} cursor-pointer`}
        style={{ minHeight: 96 }}
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="text-[14.5px] font-semibold tracking-tight whitespace-nowrap" style={{ color, textShadow: `0 0 10px ${color}88` }}>
              {cat.name}
            </div>
            <div className="text-[10px] font-thai mt-0.5 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.55)' }}>{cat.th}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {catKey === 'cash' && onManage && (
              <button
                onClick={(e) => { e.stopPropagation(); onManage() }}
                className="chip hover:bg-white/5 transition-colors"
                title="ฝาก / ถอน / ปันผล / ดอกเบี้ย"
                style={{ color, borderColor: color + '66', fontSize: 10, padding: '2px 8px' }}
              >
                จัดการ
              </button>
            )}
            <span className="chip" style={{ color: actionTone, fontSize: 10, padding: '2px 6px' }}>{action}</span>
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-4 gap-2">
          <div>
            <div className="text-[8.5px] uppercase tracking-wider text-[var(--txt-faint)]">ปัจจุบัน</div>
            <div className="text-[12.5px] font-mono num-tabular mt-0.5" style={{ color: '#fff' }}>{fmtPctPlain(cur, 1)}</div>
          </div>
          <div>
            <div className="text-[8.5px] uppercase tracking-wider text-[var(--txt-faint)]">เป้าหมาย</div>
            <div className="text-[12.5px] font-mono num-tabular mt-0.5 text-[var(--txt-dim)]">{fmtPctPlain(tgt, 0)}</div>
          </div>
          <div>
            <div className="text-[8.5px] uppercase tracking-wider text-[var(--txt-faint)]">มูลค่า</div>
            <div className="text-[12.5px] font-mono num-tabular mt-0.5 text-white">{fmtUsdK(mv)}</div>
          </div>
          <div>
            <div className="text-[8.5px] uppercase tracking-wider text-[var(--txt-faint)]">{catKey === 'cash' ? 'ส่วนต่าง' : 'กำไร/ขาดทุน'}</div>
            {catKey === 'cash' ? (
              <div className="text-[12.5px] font-mono num-tabular mt-0.5" style={{ color: diff >= 0 ? '#ff9eb0' : '#9bffae' }}>
                {fmtPct(diff, 1)}
              </div>
            ) : (
              <div
                className="text-[12.5px] font-mono num-tabular mt-0.5"
                style={{ color: agg.plByCat && agg.plByCat[catKey].pct >= 0 ? '#9bffae' : '#ff8aa0' }}
              >
                {agg.plByCat ? fmtPct(agg.plByCat[catKey].pct, 1) : '—'}
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar — current vs target */}
        <div className="mt-2.5">
          <div className="relative h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, cur))}%`, background: color, boxShadow: `0 0 8px ${color}` }}
            />
            <div
              className="absolute top-[-2px] bottom-[-2px] w-[2px]"
              style={{ left: `${Math.min(100, Math.max(0, tgt))}%`, background: '#fff', opacity: 0.6 }}
              title={`Target ${tgt}%`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
