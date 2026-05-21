import { useState } from 'react'
import { CATS, MODES, fmtUsd, uid } from '../data.js'
import { isStockApiConfigured, lookupSymbol } from '../stockApi.js'

// ─────────────────────────────────────────────────────────────────────────────
// Modals: Transaction, Holding edit, Price plan, Target edit
// ─────────────────────────────────────────────────────────────────────────────

function Modal({ title, subtitle, onClose, children, color = '#fff', maxWidth = 560 }) {
  return (
    <div className="backdrop fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel rounded-2xl w-full overflow-hidden"
        style={{
          maxWidth,
          maxHeight: '92vh',
          boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px ${color}44, 0 0 40px ${color}22`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5">
          <div>
            <div className="text-[16px] font-semibold tracking-tight" style={{ color }}>{title}</div>
            {subtitle && <div className="text-[12px] text-[var(--txt-dim)] mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="btn btn-ghost text-[16px] leading-none">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

// ─── Transaction Modal ─────────────────────────────────────────────────────────
export function TransactionModal({ initial, holdings, onClose, onSubmit }) {
  const [type, setType] = useState(initial?.type || 'buy')
  const [symbol, setSymbol] = useState(initial?.symbol || '')
  const [cat, setCat] = useState(initial?.cat || 'core')
  const [price, setPrice] = useState(initial?.price || '')
  const [qty, setQty] = useState(initial?.qty || '')
  const [feePct, setFeePct] = useState(0.1)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  const total = Number(price || 0) * Number(qty || 0)
  const fee = total * (Number(feePct || 0) / 100)
  const netBuy = total + fee
  const netSell = total - fee

  function onSymbolChange(v) {
    setSymbol(v.toUpperCase())
    const found = holdings.find((h) => h.symbol === v.toUpperCase())
    if (found) setCat(found.cat)
  }

  const colorMap = { buy: '#9bffae', sell: '#ff8aa0' }
  return (
    <Modal
      title={type === 'buy' ? 'ซื้อ' : 'ขาย'}
      subtitle={initial?.symbol ? `${initial.symbol} · ${CATS[initial.cat].name}` : 'รายการซื้อขายใหม่'}
      onClose={onClose}
      color={colorMap[type]}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {['buy', 'sell'].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className="py-2 rounded-md text-[13px] font-medium transition-all"
                style={{
                  background: type === t ? (t === 'buy' ? 'rgba(155,255,174,0.12)' : 'rgba(255,138,160,0.12)') : 'transparent',
                  color: type === t ? colorMap[t] : 'var(--txt-dim)',
                  border: type === t ? `1px solid ${colorMap[t]}55` : '1px solid transparent',
                }}
              >
                {t === 'buy' ? 'ซื้อ' : 'ขาย'}
              </button>
            ))}
          </div>
        </div>
        <Field label="ชื่อย่อ">
          <input className="field" value={symbol} onChange={(e) => onSymbolChange(e.target.value)} placeholder="NVDA" />
        </Field>
        <Field label="หมวด">
          <select className="field" value={cat} onChange={(e) => setCat(e.target.value)}>
            {['cash', 'core', 'stab', 'boost'].map((k) => <option key={k} value={k}>{CATS[k].name}</option>)}
          </select>
        </Field>
        <Field label="ราคา (USD)">
          <input type="number" className="field" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="142.80" />
        </Field>
        <Field label="จำนวน">
          <input type="number" className="field" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="10" />
        </Field>
        <Field label="ค่าธรรมเนียม %">
          <input type="number" step="0.01" className="field" value={feePct} onChange={(e) => setFeePct(e.target.value)} />
        </Field>
        <Field label="วันที่">
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="หมายเหตุ">
            <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ซื้อตอนย่อ, ลดไม้ที่ 1, ..." />
          </Field>
        </div>
      </div>

      <div className="mt-4 hairline rounded-xl p-3 grid grid-cols-3 gap-2 text-[12px]" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--txt-faint)]">มูลค่ารวม</div>
          <div className="font-mono num-tabular text-white">{fmtUsd(total)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--txt-faint)]">ค่าธรรมเนียม</div>
          <div className="font-mono num-tabular text-[var(--txt-dim)]">{fmtUsd(fee)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--txt-faint)]">{type === 'buy' ? 'น้ำที่ใช้' : 'น้ำที่ได้คืน'}</div>
          <div className="font-mono num-tabular" style={{ color: type === 'buy' ? '#ff8aa0' : '#9bffae' }}>
            {type === 'buy' ? '−' : '+'}{fmtUsd(type === 'buy' ? netBuy : netSell)}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button
          className="btn btn-primary"
          onClick={() => onSubmit({
            type, symbol, cat, price: Number(price), qty: Number(qty), fee, feePct: Number(feePct), date, note,
            total: type === 'buy' ? netBuy : netSell,
          })}
          disabled={!symbol || !price || !qty}
        >
          บันทึก{type === 'buy' ? 'ซื้อ' : 'ขาย'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Holding Edit Modal ────────────────────────────────────────────────────────
export function HoldingModal({ initial, onClose, onSubmit }) {
  const isNew = !initial?.id
  // Spread `initial` over the defaults so a partial pre-fill (e.g. from the
  // Watching List "Mark as Bought" action) works as well as a full edit.
  const [h, setH] = useState(() => ({
    id: uid('h'), cat: 'core', symbol: '', name: '', qty: 0, avg: 0, price: 0,
    addPlan: [0, 0, 0], trimPlan: [0, 0, 0], note: '',
    ...(initial || {}),
  }))
  const upd = (k, v) => setH((s) => ({ ...s, [k]: v }))

  // Live lookup: on symbol blur, fetch company name + current price from Finnhub.
  const [looking, setLooking] = useState(false)
  const [lookMsg, setLookMsg] = useState(null) // { ok: boolean, text: string }

  async function lookupAndFill(rawSymbol) {
    const sym = (rawSymbol || '').trim().toUpperCase()
    if (!sym || !isStockApiConfigured) return
    setLooking(true)
    setLookMsg(null)
    try {
      const r = await lookupSymbol(sym)
      setH((s) => ({ ...s, symbol: sym, name: r.name || s.name, price: r.price || s.price }))
      setLookMsg({ ok: true, text: r.price ? `ราคาล่าสุด ${fmtUsd(r.price)}` : 'อัปเดตชื่อแล้ว' })
    } catch (e) {
      setLookMsg({ ok: false, text: e.message || 'ดึงข้อมูลไม่สำเร็จ' })
    } finally {
      setLooking(false)
    }
  }

  const lookStatus = looking
    ? { color: 'var(--txt-dim)', text: 'กำลังดึงข้อมูล…' }
    : lookMsg
      ? { color: lookMsg.ok ? '#9bffae' : '#ff8aa0', text: lookMsg.text }
      : { color: 'var(--txt-faint)', text: 'พิมพ์ชื่อย่อแล้วคลิกออกจากช่อง ระบบจะดึงชื่อ + ราคาให้' }

  return (
    <Modal
      title={isNew ? 'เพิ่มสินทรัพย์' : `แก้ไข ${h.symbol}`}
      subtitle={isNew ? 'สร้างรายการใหม่' : h.name}
      onClose={onClose}
      color={CATS[h.cat].hex}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="ชื่อย่อ">
          <input
            className="field"
            value={h.symbol}
            onChange={(e) => upd('symbol', e.target.value.toUpperCase())}
            onBlur={(e) => lookupAndFill(e.target.value)}
            placeholder="NVDA"
          />
          {isStockApiConfigured && (
            <div className="text-[10.5px] mt-1 leading-tight" style={{ color: lookStatus.color }}>
              {lookStatus.text}
            </div>
          )}
        </Field>
        <Field label="หมวด">
          <select className="field" value={h.cat} onChange={(e) => upd('cat', e.target.value)}>
            {['core', 'stab', 'boost', 'cash'].map((k) => <option key={k} value={k}>{CATS[k].name}</option>)}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="ชื่อสินทรัพย์">
            <input className="field" value={h.name} onChange={(e) => upd('name', e.target.value)} />
          </Field>
        </div>
        <Field label="จำนวน">
          <input type="number" className="field" value={h.qty} onChange={(e) => upd('qty', Number(e.target.value))} />
        </Field>
        <Field label="ทุนเฉลี่ย">
          <input type="number" className="field" value={h.avg} onChange={(e) => upd('avg', Number(e.target.value))} />
        </Field>
        <Field label="ราคาปัจจุบัน">
          <input type="number" className="field" value={h.price} onChange={(e) => upd('price', Number(e.target.value))} />
        </Field>
        <Field label=" ">
          <div className="field flex items-center justify-between" style={{ cursor: 'default' }}>
            <span className="text-[var(--txt-faint)]">มูลค่า</span>
            <span className="text-white">{fmtUsd(h.qty * h.price)}</span>
          </div>
        </Field>
        <div className="col-span-2">
          <Field label="หมายเหตุ">
            <input className="field" value={h.note} onChange={(e) => upd('note', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={() => onSubmit(h)} disabled={!h.symbol}>{isNew ? 'สร้าง' : 'บันทึก'}</button>
      </div>
    </Modal>
  )
}

// ─── Price Plan Modal ──────────────────────────────────────────────────────────
export function PricePlanModal({ initial, onClose, onSubmit }) {
  const [add, setAdd] = useState(initial.addPlan || [0, 0, 0])
  const [trim, setTrim] = useState(initial.trimPlan || [0, 0, 0])
  const [note, setNote] = useState(initial.note || '')
  function setLvl(arr, setter, i, v) {
    const next = [...arr]
    next[i] = Number(v)
    setter(next)
  }
  return (
    <Modal title="แผนเพิ่ม / ลด" subtitle={`${initial.symbol} · ${initial.name}`} onClose={onClose} color={CATS[initial.cat].hex}>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <div className="text-[12px] font-semibold mb-2" style={{ color: '#9bffae' }}>แผนเพิ่ม (ราคาต่ำกว่า = ดีกว่า)</div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="mb-2">
              <Field label={`ไม้ที่ ${i + 1}`}>
                <input type="number" className="field" value={add[i]} onChange={(e) => setLvl(add, setAdd, i, e.target.value)} placeholder="$" />
              </Field>
            </div>
          ))}
        </div>
        <div>
          <div className="text-[12px] font-semibold mb-2" style={{ color: '#ff8aa0' }}>แผนลด (ราคาสูงกว่า = ดีกว่า)</div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="mb-2">
              <Field label={`ไม้ที่ ${i + 1}`}>
                <input type="number" className="field" value={trim[i]} onChange={(e) => setLvl(trim, setTrim, i, e.target.value)} placeholder="$" />
              </Field>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <Field label="หมายเหตุ">
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <div className="text-[11px] text-[var(--txt-dim)]">
          ราคาปัจจุบัน <span className="font-mono text-white">{fmtUsd(initial.price)}</span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => onSubmit({ addPlan: add, trimPlan: trim, note })}>บันทึกแผน</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Edit-targets Modal ────────────────────────────────────────────────────────
export function TargetsModal({ mode, allTargets, onClose, onSubmit }) {
  const [targets, setTargets] = useState({ ...allTargets })
  function upd(modeKey, catKey, v) {
    setTargets((prev) => ({ ...prev, [modeKey]: { ...prev[modeKey], [catKey]: Number(v) } }))
  }
  const sums = Object.fromEntries(
    Object.keys(targets).map((m) => [m, Object.values(targets[m]).reduce((a, b) => a + Number(b || 0), 0)]),
  )
  return (
    <Modal title="สัดส่วนเป้าหมาย" subtitle="ตั้งเป้าตามโหมด (รวมต้องได้ 100%)" onClose={onClose} maxWidth={680}>
      <div className="space-y-4">
        {Object.values(MODES).map((m) => {
          const sum = sums[m.key]
          const ok = sum === 100
          return (
            <div
              key={m.key}
              className="hairline rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.015)', borderColor: mode === m.key ? m.tone + '55' : 'var(--line-strong)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[18px]">{m.icon}</span>
                  <div>
                    <div className="text-[13px] font-thai font-semibold" style={{ color: m.tone }}>{m.th}</div>
                    <div className="text-[11px] text-[var(--txt-dim)]">{m.en}</div>
                  </div>
                </div>
                <span className="text-[11px] font-mono" style={{ color: ok ? '#9bffae' : '#ff8aa0' }}>Σ {sum}%</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {['cash', 'core', 'stab', 'boost'].map((k) => (
                  <Field key={k} label={CATS[k].name}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="field"
                      value={targets[m.key][k]}
                      onChange={(e) => upd(m.key, k, e.target.value)}
                    />
                  </Field>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button
          className="btn btn-primary"
          onClick={() => onSubmit(targets)}
          disabled={!Object.values(sums).every((s) => s === 100)}
        >
          บันทึกเป้าหมาย
        </button>
      </div>
    </Modal>
  )
}
