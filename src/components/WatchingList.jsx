import { useMemo, useState } from 'react'
import { checkWatchingAlert } from '../watchingList.js'
import { fmtPct, fmtUsd } from '../data.js'
import { isStockApiConfigured, lookupSymbol } from '../stockApi.js'

// ─────────────────────────────────────────────────────────────────────────────
// WatchingList — stocks to watch, with support-price alerts.
// Separate from the portfolio; persisted in localStorage.
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ['Core', 'Stabilizer', 'Booster']
const CAT_HEX = { Core: '#34e07a', Stabilizer: '#f7c948', Booster: '#ff4d6d' }
const STATUSES = ['Normal', 'Near Support', 'Alert']
const STATUS_TH = { Normal: 'ปกติ', 'Near Support': 'ใกล้แนวรับ', Alert: 'ถึงแนวรับ' }
const STATUS_HEX = { Normal: '#cfd6e3', 'Near Support': '#f7c948', Alert: '#ff4d6d' }
const ROW_TINT = { Normal: 'transparent', 'Near Support': 'rgba(247,201,72,0.10)', Alert: 'rgba(255,77,109,0.13)' }

function CatBadge({ category }) {
  const hex = CAT_HEX[category] || '#8a92a3'
  return (
    <span className="chip" style={{ color: hex, borderColor: hex + '66', fontSize: 10.5, padding: '2px 7px' }}>
      <span className="pill-dot" style={{ background: hex, boxShadow: `0 0 6px ${hex}` }} />
      {category}
    </span>
  )
}

function WatchingForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [ticker, setTicker] = useState(initial?.ticker || '')
  const [assetName, setAssetName] = useState(initial?.assetName || '')
  const [category, setCategory] = useState(initial?.category || 'Core')
  const [supportPrice, setSupportPrice] = useState(initial?.supportPrice ?? '')
  const [currentPrice, setCurrentPrice] = useState(initial?.currentPrice ?? '')
  const [note, setNote] = useState(initial?.note || '')
  const [looking, setLooking] = useState(false)
  const [lookMsg, setLookMsg] = useState(null)
  const canSave = ticker.trim() && Number(supportPrice) > 0 && Number(currentPrice) > 0

  // On ticker blur, pull the company name + current price from Finnhub.
  async function lookupAndFill(rawSymbol) {
    const sym = (rawSymbol || '').trim().toUpperCase()
    if (!sym || !isStockApiConfigured) return
    setLooking(true)
    setLookMsg(null)
    try {
      const r = await lookupSymbol(sym)
      if (r.name) setAssetName(r.name)
      if (r.price) setCurrentPrice(r.price)
      setLookMsg({ ok: true, text: r.price ? `ราคาล่าสุด ${fmtUsd(r.price)}` : 'อัปเดตชื่อแล้ว' })
    } catch (e) {
      setLookMsg({ ok: false, text: e.message || 'ดึงข้อมูลไม่สำเร็จ' })
    } finally {
      setLooking(false)
    }
  }

  function submit() {
    if (!canSave) return
    onSubmit({
      ticker: ticker.trim().toUpperCase(),
      assetName: assetName.trim(),
      category,
      supportPrice: Number(supportPrice),
      currentPrice: Number(currentPrice),
      note: note.trim(),
    })
    if (!initial) {
      setTicker('')
      setAssetName('')
      setCategory('Core')
      setSupportPrice('')
      setCurrentPrice('')
      setNote('')
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <label className="block">
          <span className="field-label">Ticker / ชื่อย่อหุ้น</span>
          <input
            className="field"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onBlur={(e) => lookupAndFill(e.target.value)}
            placeholder="NVDA"
          />
          {isStockApiConfigured && (
            <div
              className="text-[10.5px] mt-1 leading-tight"
              style={{ color: looking ? 'var(--txt-dim)' : lookMsg ? (lookMsg.ok ? '#9bffae' : '#ff8aa0') : 'var(--txt-faint)' }}
            >
              {looking ? 'กำลังดึงข้อมูล…' : lookMsg ? lookMsg.text : 'พิมพ์ชื่อย่อแล้วคลิกออก ระบบจะดึงชื่อ + ราคาให้'}
            </div>
          )}
        </label>
        <label className="block">
          <span className="field-label">Asset Name / ชื่อสินทรัพย์</span>
          <input className="field" value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="NVIDIA" />
        </label>
        <label className="block">
          <span className="field-label">Category</span>
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Support Price / แนวรับ</span>
          <input type="number" className="field" value={supportPrice} onChange={(e) => setSupportPrice(e.target.value)} placeholder="120" />
        </label>
        <label className="block">
          <span className="field-label">Current Price / ราคาปัจจุบัน</span>
          <input type="number" className="field" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} placeholder="125" />
        </label>
        <label className="block col-span-2 md:col-span-1">
          <span className="field-label">Note / หมายเหตุ</span>
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="รอย่อใกล้แนวรับ" />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        {onCancel && <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>}
        <button className="btn btn-primary" onClick={submit} disabled={!canSave}>{submitLabel}</button>
      </div>
    </div>
  )
}

export default function WatchingList({ watchingList, onAdd, onEdit, onDelete, onMarkAsBought }) {
  const [catFilter, setCatFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [expanded, setExpanded] = useState({})

  const enriched = useMemo(
    () =>
      watchingList.map((it) => {
        const status = checkWatchingAlert(it)
        const distance = it.supportPrice > 0 ? ((it.currentPrice - it.supportPrice) / it.supportPrice) * 100 : 0
        return { ...it, status, distance }
      }),
    [watchingList],
  )

  const summary = useMemo(
    () => ({
      total: enriched.length,
      Core: enriched.filter((e) => e.category === 'Core').length,
      Stabilizer: enriched.filter((e) => e.category === 'Stabilizer').length,
      Booster: enriched.filter((e) => e.category === 'Booster').length,
      alert: enriched.filter((e) => e.status === 'Alert').length,
      near: enriched.filter((e) => e.status === 'Near Support').length,
    }),
    [enriched],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enriched.filter((e) => {
      if (catFilter !== 'All' && e.category !== catFilter) return false
      if (statusFilter !== 'All' && e.status !== statusFilter) return false
      if (q && !e.ticker.toLowerCase().includes(q) && !(e.assetName || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [enriched, catFilter, statusFilter, search])

  const summaryCards = [
    { label: 'Watching', value: summary.total, hex: '#e8ecf2' },
    { label: 'Core', value: summary.Core, hex: CAT_HEX.Core },
    { label: 'Stabilizer', value: summary.Stabilizer, hex: CAT_HEX.Stabilizer },
    { label: 'Booster', value: summary.Booster, hex: CAT_HEX.Booster },
    { label: 'Alert', value: summary.alert, hex: '#ff4d6d' },
    { label: 'Near Support', value: summary.near, hex: '#f7c948' },
  ]

  function handleDelete(item) {
    if (confirm(`ลบ ${item.ticker} ออกจาก Watching List?`)) onDelete(item.id)
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((c) => (
          <div key={c.label} className="panel rounded-2xl px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--txt-faint)]">{c.label}</div>
            <div
              className="text-[22px] font-mono num-tabular mt-1"
              style={{ color: c.hex, textShadow: c.hex !== '#e8ecf2' ? `0 0 10px ${c.hex}55` : 'none' }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      <div className="panel rounded-2xl p-5">
        <div className="text-[14px] font-semibold tracking-wide mb-1">เพิ่มหุ้นเข้า Watching List</div>
        <div className="text-[11px] text-[var(--txt-dim)] mb-4">Add Watching Stock — หุ้นที่กำลังเฝ้าดูรอจังหวะเข้าซื้อ</div>
        <WatchingForm submitLabel="Add to Watching List" onSubmit={onAdd} />
      </div>

      {/* Table */}
      <div className="panel rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-white/5 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="text-[14px] font-semibold tracking-wide">รายการเฝ้าดู</div>
            <span className="text-[11px] text-[var(--txt-dim)]">{rows.length} รายการ</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="field"
              style={{ width: 180 }}
              placeholder="ค้นหา ticker / ชื่อ"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="field" style={{ width: 'auto' }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="All">หมวด: ทั้งหมด</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="field" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">สถานะ: ทั้งหมด</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_TH[s]}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="holdings w-full">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Asset Name</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Support</th>
                <th style={{ textAlign: 'right' }}>Current</th>
                <th style={{ textAlign: 'right' }}>Distance</th>
                <th>Status</th>
                <th>Note</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const distPos = r.distance >= 0
                const noteOpen = expanded[r.id]
                const noteLong = (r.note || '').length > 40
                return (
                  <tr key={r.id} style={{ background: ROW_TINT[r.status] }}>
                    <td className="mono font-semibold">{r.ticker}</td>
                    <td className="text-[var(--txt-dim)]">{r.assetName || '—'}</td>
                    <td><CatBadge category={r.category} /></td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmtUsd(r.supportPrice)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmtUsd(r.currentPrice)}</td>
                    <td className="mono font-semibold" style={{ textAlign: 'right', color: distPos ? '#9bffae' : '#ff8aa0' }}>
                      {r.supportPrice > 0 ? fmtPct(r.distance, 1) : '—'}
                    </td>
                    <td>
                      <span className="chip" style={{ color: STATUS_HEX[r.status], borderColor: STATUS_HEX[r.status] + '66', fontSize: 10.5 }}>
                        {STATUS_TH[r.status]}
                      </span>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      {r.note ? (
                        <span className="text-[var(--txt-dim)] text-[11.5px]">
                          {noteLong && !noteOpen ? r.note.slice(0, 40) + '… ' : r.note + ' '}
                          {noteLong && (
                            <button
                              className="text-[var(--txt-faint)] underline hover:text-white"
                              onClick={() => setExpanded((s) => ({ ...s, [r.id]: !noteOpen }))}
                            >
                              {noteOpen ? 'ย่อ' : 'ดูเพิ่ม'}
                            </button>
                          )}
                        </span>
                      ) : (
                        <span className="text-[var(--txt-faint)]">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="inline-flex items-center gap-1 whitespace-nowrap">
                        <button className="btn px-2 py-1 text-[11px]" onClick={() => setEditing(r)}>แก้ไข</button>
                        <button
                          className="btn px-2 py-1 text-[11px]"
                          style={{ borderColor: 'rgba(155,255,174,0.4)', color: '#9bffae' }}
                          onClick={() => onMarkAsBought(r)}
                          title="เพิ่มหุ้นนี้เข้าพอร์ต"
                        >
                          ซื้อแล้ว
                        </button>
                        <button className="btn btn-danger px-2 py-1 text-[11px]" onClick={() => handleDelete(r)}>ลบ</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-[var(--txt-faint)] italic" style={{ padding: '24px 10px' }}>
                    {watchingList.length === 0
                      ? 'ยังไม่มีหุ้นในรายการเฝ้าดู — เพิ่มจากฟอร์มด้านบนได้เลย'
                      : 'ไม่พบรายการที่ตรงกับตัวกรอง'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="backdrop fade-in" onClick={() => setEditing(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel rounded-2xl w-full overflow-hidden"
            style={{ maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5">
              <div>
                <div className="text-[16px] font-semibold tracking-tight">แก้ไขรายการเฝ้าดู</div>
                <div className="text-[12px] text-[var(--txt-dim)] mt-0.5">{editing.ticker}</div>
              </div>
              <button onClick={() => setEditing(null)} className="btn btn-ghost text-[16px] leading-none">✕</button>
            </div>
            <div className="p-5 overflow-y-auto">
              <WatchingForm
                initial={editing}
                submitLabel="บันทึกการแก้ไข"
                onCancel={() => setEditing(null)}
                onSubmit={(data) => {
                  onEdit(editing.id, data)
                  setEditing(null)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
