import { useMemo, useState } from 'react'
import { JOURNAL_PORTFOLIOS, fmtQty, fmtUsd, uid } from '../data.js'

// ─────────────────────────────────────────────────────────────────────────────
// TradeJournal — Daily Portfolio Journal.
// A manual daily trade log split across three portfolio groups, with the
// reason for each decision. Standalone — it does not affect any calculation.
// ─────────────────────────────────────────────────────────────────────────────

const PF_KEYS = ['shay', 'channel', 'insider']
const todayStr = () => new Date().toISOString().slice(0, 10)

function FilterPill({ active, onClick, label, color }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-[11px] transition-all whitespace-nowrap"
      style={{
        border: `1px solid ${active ? color + '88' : 'var(--line-strong)'}`,
        background: active ? color + '14' : 'transparent',
        color: active ? color : 'var(--txt)',
      }}
    >
      {label}
    </button>
  )
}

export default function TradeJournal({ records, onAdd, onDelete }) {
  const [date, setDate] = useState(todayStr)
  const [portfolio, setPortfolio] = useState('shay')
  const [action, setAction] = useState('buy')
  const [ticker, setTicker] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState('all')

  const totalValue = (Number(quantity) || 0) * (Number(price) || 0)
  const canSave = ticker.trim() && Number(quantity) > 0 && Number(price) > 0

  function submit() {
    if (!canSave) return
    onAdd({
      id: uid('j'),
      date,
      portfolio,
      action,
      ticker: ticker.trim().toUpperCase(),
      quantity: Number(quantity),
      price: Number(price),
      reason: reason.trim(),
      note: note.trim(),
    })
    // Keep date / portfolio / action for logging several trades in a row.
    setTicker('')
    setQuantity('')
    setPrice('')
    setReason('')
    setNote('')
  }

  const rows = useMemo(
    () => (filter === 'all' ? records : records.filter((r) => r.portfolio === filter)),
    [records, filter],
  )

  return (
    <div className="panel rounded-2xl p-5">
      <div className="mb-4">
        <div className="text-[14px] font-semibold tracking-wide">บันทึกการเทรดรายวัน</div>
        <div className="text-[11px] text-[var(--txt-dim)]">Daily Portfolio Journal · กรอกมือ · {records.length} รายการ</div>
      </div>

      {/* Entry form */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="field-label">วันที่</span>
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">พอร์ต</span>
          <select className="field" value={portfolio} onChange={(e) => setPortfolio(e.target.value)}>
            {PF_KEYS.map((k) => (
              <option key={k} value={k}>{JOURNAL_PORTFOLIOS[k].name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 p-1 rounded-lg mt-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {['buy', 'sell'].map((a) => {
          const tone = a === 'buy' ? '#9bffae' : '#ff8aa0'
          const on = action === a
          return (
            <button
              key={a}
              onClick={() => setAction(a)}
              className="py-2 rounded-md text-[13px] font-medium transition-all"
              style={{
                background: on ? (a === 'buy' ? 'rgba(155,255,174,0.12)' : 'rgba(255,138,160,0.12)') : 'transparent',
                color: on ? tone : 'var(--txt-dim)',
                border: on ? `1px solid ${tone}55` : '1px solid transparent',
              }}
            >
              {a === 'buy' ? 'ซื้อ (Buy)' : 'ขาย (Sell)'}
            </button>
          )
        })}
      </div>

      <div className="mt-2">
        <label className="block">
          <span className="field-label">ชื่อหุ้น (Ticker)</span>
          <input className="field" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="NVDA" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <label className="block">
          <span className="field-label">จำนวนหุ้น</span>
          <input type="number" className="field" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="10" />
        </label>
        <label className="block">
          <span className="field-label">ราคา/หุ้น</span>
          <input type="number" className="field" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="142.80" />
        </label>
      </div>

      <div className="hairline rounded-lg px-3 py-2 mt-2 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <span className="text-[11px] uppercase tracking-wider text-[var(--txt-faint)]">มูลค่ารวม</span>
        <span className="font-mono num-tabular text-[14px] text-white">{fmtUsd(totalValue)}</span>
      </div>

      <div className="mt-2">
        <label className="block">
          <span className="field-label">เหตุผลในการตัดสินใจ</span>
          <textarea
            className="field"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ทำไมถึงตัดสินใจซื้อ/ขายตัวนี้วันนี้"
          />
        </label>
      </div>
      <div className="mt-2">
        <label className="block">
          <span className="field-label">หมายเหตุ (ถ้ามี)</span>
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <button onClick={submit} disabled={!canSave} className="btn btn-primary w-full mt-3">
        บันทึกรายการ
      </button>

      {/* History */}
      <div className="flex items-center gap-1.5 flex-wrap mt-5 mb-2">
        <span className="text-[10px] uppercase tracking-wider text-[var(--txt-faint)] mr-1">ดูย้อนหลัง</span>
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')} label="ทั้งหมด" color="#fff" />
        {PF_KEYS.map((k) => (
          <FilterPill
            key={k}
            active={filter === k}
            onClick={() => setFilter(k)}
            label={JOURNAL_PORTFOLIOS[k].name}
            color={JOURNAL_PORTFOLIOS[k].hex}
          />
        ))}
      </div>

      <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
        {rows.map((r) => {
          const pf = JOURNAL_PORTFOLIOS[r.portfolio] || { name: r.portfolio, hex: '#8a92a3' }
          const isBuy = r.action === 'buy'
          const tone = isBuy ? '#9bffae' : '#ff8aa0'
          return (
            <div key={r.id} className="hairline rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.015)' }}>
              <div className="flex items-center gap-2 flex-wrap text-[12px]">
                <span className="text-[10px] font-mono text-[var(--txt-faint)]">{r.date}</span>
                <span className="pill" style={{ color: pf.hex, borderColor: pf.hex + '66' }}>
                  <span className="pill-dot" style={{ background: pf.hex, boxShadow: `0 0 6px ${pf.hex}` }} />
                  {pf.name}
                </span>
                <span className="px-2 py-0.5 rounded text-[10.5px] font-medium" style={{ color: tone, border: `1px solid ${tone}44` }}>
                  {isBuy ? 'ซื้อ' : 'ขาย'}
                </span>
                <span className="font-mono font-semibold">{r.ticker}</span>
                <span className="font-mono num-tabular text-[var(--txt-dim)]">
                  {fmtQty(r.quantity)} @ {fmtUsd(r.price)}
                </span>
                <span className="font-mono num-tabular ml-auto font-semibold" style={{ color: tone }}>
                  {fmtUsd(r.quantity * r.price)}
                </span>
                <button
                  onClick={() => onDelete(r.id)}
                  className="text-[var(--txt-faint)] hover:text-[#ff8aa0] transition-colors text-[12px]"
                  title="ลบบันทึกนี้"
                >
                  ✕
                </button>
              </div>
              {r.reason && (
                <div className="text-[11.5px] text-[var(--txt-dim)] mt-1">เหตุผล: {r.reason}</div>
              )}
              {r.note && (
                <div className="text-[10.5px] text-[var(--txt-faint)] mt-0.5 italic">หมายเหตุ: {r.note}</div>
              )}
            </div>
          )
        })}
        {rows.length === 0 && (
          <div className="text-[12px] text-[var(--txt-faint)] italic">ยังไม่มีบันทึก</div>
        )}
      </div>
    </div>
  )
}
