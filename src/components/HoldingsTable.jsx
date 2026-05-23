import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CATS, fmtPct, fmtPctPlain, fmtQty, fmtUsd, holdingCost, holdingMV, nextPlan } from '../data.js'

// ─────────────────────────────────────────────────────────────────────────────
// HoldingsTable — full table with all required columns, filterable by category
// ─────────────────────────────────────────────────────────────────────────────

function ZoneBadge({ zone, onClick }) {
  const tone = zone === 'Add Zone' ? '#9bffae' : zone === 'Trim Zone' ? '#ff8aa0' : '#cfd6e3'
  const labelMap = { 'Add Zone': 'โซนเพิ่ม', 'Trim Zone': 'โซนลด', Hold: 'ถือรอ' }
  const actionable = zone === 'Add Zone' || zone === 'Trim Zone'
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={`chip whitespace-nowrap font-semibold ${actionable ? 'chip-blink' : ''} ${onClick ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
      style={{ color: tone, fontSize: 12, padding: '4px 10px' }}
      title={onClick ? 'คลิกเพื่อแก้ไขแผนเพิ่ม/ลด' : undefined}
    >
      {labelMap[zone] || zone}
    </Tag>
  )
}

function RowActions({ row, onAddTxn, onPlan, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function onEsc(e) { if (e.key === 'Escape') setOpen(false) }
    function onScroll() { setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  // The menu is `position: fixed` so no table/panel overflow can clip it.
  // Position it from the button's viewport rect; flip upward near the bottom.
  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const MENU_H = 190
      const below = window.innerHeight - r.bottom
      const openUp = below < MENU_H && r.top > below
      setPos({
        right: Math.max(8, window.innerWidth - r.right),
        top: openUp ? undefined : r.bottom + 6,
        bottom: openUp ? window.innerHeight - r.top + 6 : undefined,
      })
    }
    setOpen((o) => !o)
  }

  const items = [
    { key: 'buy', label: 'ซื้อ', tone: '#9bffae', onClick: () => { onAddTxn({ ...row, type: 'buy' }); setOpen(false) } },
    { key: 'sell', label: 'ขาย', tone: '#ff8aa0', onClick: () => { onAddTxn({ ...row, type: 'sell' }); setOpen(false) } },
    { key: 'plan', label: 'ตั้งแผนเพิ่ม/ลด', tone: '#cfd6e3', onClick: () => { onPlan(row); setOpen(false) } },
    { key: 'edit', label: 'แก้ไข', tone: '#cfd6e3', onClick: () => { onEdit(row); setOpen(false) } },
    { key: 'del', label: 'ลบ', tone: '#ff8aa0', onClick: () => { onDelete(row); setOpen(false) } },
  ]

  return (
    <div className="inline-block">
      <button
        ref={btnRef}
        className="btn px-3 py-1 text-[11.5px] inline-flex items-center gap-1 whitespace-nowrap"
        onClick={toggle}
        title="จัดการรายการ"
      >
        จัดการ
        <span
          className="text-[9px] opacity-70"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}
        >
          ▾
        </span>
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[120] panel rounded-lg p-1 fade-in"
          style={{ minWidth: 168, top: pos.top, bottom: pos.bottom, right: pos.right, boxShadow: '0 18px 40px rgba(0,0,0,0.55)' }}
        >
          {items.map((it) => (
            <button
              key={it.key}
              onClick={it.onClick}
              className="w-full text-left px-3 py-1.5 rounded-md text-[12px] hover:bg-white/5 transition-colors"
              style={{ color: it.tone }}
            >
              {it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

function FilterChip({ active, onClick, label, color }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-[11.5px] transition-all whitespace-nowrap"
      style={{
        border: `1px solid ${color}${active ? '88' : '44'}`,
        background: active ? color + '18' : 'transparent',
        color,
        boxShadow: active ? `0 0 14px ${color}55` : 'none',
        opacity: active ? 1 : 0.85,
      }}
    >
      {label}
    </button>
  )
}

export default function HoldingsTable({ holdings, agg, onAddTxn, onEdit, onDelete, onPlan, onAddHolding, onShowHistory, onRefreshPrices, refreshing }) {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'mv', dir: 'desc' })

  const rows = useMemo(() => {
    const filtered = filter === 'all' ? holdings : holdings.filter((h) => h.cat === filter)
    const enriched = filtered.map((h) => {
      const mv = holdingMV(h)
      const cost = holdingCost(h)
      const pl = mv - cost
      const plPct = cost ? (pl / cost) * 100 : 0
      const curPct = agg.total ? (mv / agg.total) * 100 : 0
      // Per-stock target allocation (% of the whole portfolio), set on the holding.
      const tgtPct = h.targetPct || 0
      const diffPct = curPct - tgtPct
      const diffUsd = (diffPct / 100) * agg.total
      const np = nextPlan(h)
      return { ...h, mv, cost, pl, plPct, curPct, tgtPct, diffPct, diffUsd, ...np }
    })
    enriched.sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1
      const av = a[sort.key]
      const bv = b[sort.key]
      if (typeof av === 'string') return av.localeCompare(bv) * dir
      return ((av || 0) - (bv || 0)) * dir
    })
    return enriched
  }, [holdings, filter, sort, agg])

  function toggleSort(k) {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' }))
  }

  const SortHead = ({ k, children, align = 'left' }) => (
    <th onClick={() => toggleSort(k)} className="cursor-pointer select-none hover:text-white" style={{ textAlign: align }}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sort.key === k && <span className="text-[var(--txt-faint)] text-[10px]">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  )

  // When a single category is selected, tint the panel border + glow with that
  // category's colour so the active filter is visible at a glance.
  const filterColor = filter !== 'all' ? CATS[filter]?.hex : null

  return (
    <div
      className="panel rounded-2xl overflow-hidden transition-all"
      style={filterColor ? {
        borderColor: filterColor + '55',
        boxShadow: `0 0 0 1px ${filterColor}33, 0 0 28px ${filterColor}22`,
      } : undefined}
    >
      <div
        className="flex items-center justify-between gap-3 p-5 border-b flex-wrap transition-colors"
        style={filterColor ? {
          borderBottomColor: filterColor + '44',
          background: filterColor + '0a',
        } : { borderBottomColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-2">
          <div className="text-[14px] font-semibold tracking-wide">สินทรัพย์ในพอร์ต</div>
          <span className="text-[11px] text-[var(--txt-dim)]">{rows.length} รายการ</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="ทั้งหมด" color="#fff" />
          {['cash', 'core', 'stab', 'boost'].map((k) => (
            <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)} label={CATS[k].name} color={CATS[k].hex} />
          ))}
          <div className="w-px h-5 bg-white/10 mx-1" />
          {onRefreshPrices && (
            <button className="btn whitespace-nowrap" onClick={onRefreshPrices} disabled={refreshing}>
              {refreshing ? 'กำลังอัปเดต…' : '↻ อัปเดตราคา'}
            </button>
          )}
          {onShowHistory && (
            <button className="btn whitespace-nowrap" onClick={onShowHistory} title="ประวัติรายการ">
              🕘 ประวัติ
            </button>
          )}
          <button className="btn whitespace-nowrap" onClick={onAddHolding}>＋ เพิ่มสินทรัพย์</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="holdings w-full">
          <colgroup>
            <col style={{ width: 'auto', minWidth: '220px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ width: '60px' }} />
            <col style={{ width: '104px' }} />
            <col style={{ width: '92px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '96px' }} />
          </colgroup>
          <thead>
            <tr>
              <SortHead k="symbol">สินทรัพย์</SortHead>
              <th>โซน</th>
              <SortHead k="curPct">สัดส่วน</SortHead>
              <SortHead k="qty" align="right">จำนวน</SortHead>
              <SortHead k="price" align="right">ราคา</SortHead>
              <SortHead k="mv" align="right">มูลค่า</SortHead>
              <SortHead k="pl" align="right">กำไร/ขาดทุน</SortHead>
              <th style={{ textAlign: 'right' }}>คำสั่ง</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = CATS[r.cat]
              const plPos = r.pl >= 0
              // Status text for allocation
              let allocStatus = 'สมดุล'
              let allocTone = '#cfd6e3'
              if (r.diffPct > 1.0) { allocStatus = 'เกินเป้า'; allocTone = '#ff8aa0' }
              if (r.diffPct < -1.0) { allocStatus = 'ต่ำกว่าเป้า'; allocTone = '#9bffae' }
              // Gauge fill = progress toward this stock's own target weight.
              const gaugeFill = r.tgtPct > 0 ? Math.min(100, Math.max(0, (r.curPct / r.tgtPct) * 100)) : 0
              return (
                <tr key={r.id}>
                  {/* สินทรัพย์ — ชื่อย่อ + ชื่อเต็ม + หมายเหตุ + หมวด (pill) */}
                  <td>
                    <div className="leading-tight">
                      <div className="mono font-semibold text-[13.5px] whitespace-nowrap">{r.symbol}</div>
                      <div className="text-[var(--txt-dim)] text-[11.5px] truncate" style={{ maxWidth: 240 }} title={r.name}>{r.name}</div>
                      {r.note && (
                        <div className="text-[var(--txt-faint)] text-[10.5px] truncate italic" style={{ maxWidth: 240 }} title={r.note}>{r.note}</div>
                      )}
                      <div className="mt-1.5">
                        <span className="pill" style={{ color: c.hex, borderColor: c.hex + '66', fontSize: 10, padding: '1px 7px' }}>
                          <span className="pill-dot" style={{ background: c.hex, boxShadow: `0 0 6px ${c.hex}` }} />
                          {c.name}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* โซน — คลิกเพื่อเปิดหน้าต่างแผนเพิ่ม/ลด */}
                  <td>
                    <ZoneBadge zone={r.zone} onClick={() => onPlan(r)} />
                  </td>

                  {/* สัดส่วน — เกจเทียบเป้าหมายรายตัว */}
                  <td className="mono">
                    <div className="flex items-baseline gap-1 leading-none whitespace-nowrap mb-1">
                      <span className="text-[12.5px] font-semibold">{fmtPctPlain(r.curPct, 1)}</span>
                      <span className="text-[10px] text-[var(--txt-faint)]">/ {fmtPctPlain(r.tgtPct, 1)}</span>
                    </div>
                    <div
                      className="relative h-2 rounded-full overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.07)' }}
                      title={`ปัจจุบัน ${fmtPctPlain(r.curPct, 1)} · เป้าหมาย ${fmtPctPlain(r.tgtPct, 1)}`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ width: `${gaugeFill}%`, background: allocTone, boxShadow: `0 0 6px ${allocTone}99` }}
                      />
                    </div>
                    <div className="text-[10px] mt-0.5 whitespace-nowrap" style={{ color: allocTone }}>
                      {fmtPct(r.diffPct, 1)} <span className="text-[var(--txt-faint)]">· {allocStatus}</span>
                    </div>
                  </td>

                  {/* จำนวน */}
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtQty(r.qty)}</td>

                  {/* ราคา — ต้นทุน → ปัจจุบัน */}
                  <td className="mono" style={{ textAlign: 'right' }}>
                    <div className="text-[10.5px] text-[var(--txt-faint)] whitespace-nowrap">ต้นทุน {fmtUsd(r.avg)}</div>
                    <div className="font-semibold text-[13px] whitespace-nowrap">{fmtUsd(r.price)}</div>
                  </td>

                  {/* มูลค่า */}
                  <td className="mono font-semibold whitespace-nowrap" style={{ textAlign: 'right' }}>
                    {fmtUsd(r.mv, 0)}
                  </td>

                  {/* กำไร/ขาดทุน — เงิน + เปอร์เซ็นต์ */}
                  <td className="mono" style={{ textAlign: 'right' }}>
                    <div className="text-[13.5px] font-semibold leading-tight whitespace-nowrap" style={{ color: plPos ? '#9bffae' : '#ff8aa0' }}>{fmtUsd(r.pl, 0)}</div>
                    <div className="text-[11px] whitespace-nowrap" style={{ color: plPos ? '#9bffae' : '#ff8aa0', opacity: 0.85 }}>{fmtPct(r.plPct, 1)}</div>
                  </td>

                  {/* คำสั่ง */}
                  <td style={{ textAlign: 'right' }}>
                    <RowActions row={r} onAddTxn={onAddTxn} onPlan={onPlan} onEdit={onEdit} onDelete={onDelete} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
