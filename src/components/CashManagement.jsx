import { useState } from 'react'
import { fmtUsd, uid } from '../data.js'

// ─────────────────────────────────────────────────────────────────────────────
// CashManagement — deposits / withdrawals / dividends / interest / other.
// Rendered inside the cash-management modal; the modal provides the panel
// chrome and the "ยอดคงเหลือ" subtitle.
// ─────────────────────────────────────────────────────────────────────────────

const CASH_TYPES = {
  deposit: { label: 'ฝากเงิน', sign: 1, tone: '#9bffae' },
  withdraw: { label: 'ถอนเงิน', sign: -1, tone: '#ff8aa0' },
  dividend: { label: 'ปันผล', sign: 1, tone: '#7bd1ff' },
  interest: { label: 'ดอกเบี้ย', sign: 1, tone: '#cfe3ff' },
  other: { label: 'รายได้อื่น', sign: 1, tone: '#f7c948' },
}

export default function CashManagement({ activity, onAdd, onDelete }) {
  const [type, setType] = useState('deposit')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  function submit() {
    if (!amount) return
    onAdd({ id: uid('c'), type, amount: Number(amount), date, note })
    setAmount('')
    setNote('')
  }

  return (
    <div>
      {/* Type segmented row */}
      <div className="grid grid-cols-5 gap-1 mb-3">
        {Object.entries(CASH_TYPES).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setType(k)}
            className="px-2 py-2 rounded-lg text-[11.5px] font-medium transition-all"
            style={{
              background: type === k ? `${v.tone}14` : 'rgba(255,255,255,0.025)',
              border: `1px solid ${type === k ? v.tone + '66' : 'var(--line)'}`,
              color: type === k ? v.tone : 'var(--txt-dim)',
              boxShadow: type === k ? `0 0 12px ${v.tone}33` : 'none',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <input type="number" className="field" placeholder="จำนวน USD" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="field" placeholder="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button onClick={submit} disabled={!amount} className="btn btn-primary w-full">
        บันทึก{CASH_TYPES[type].label}
      </button>

      {/* Activity log */}
      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-wider text-[var(--txt-faint)] mb-2">กิจกรรมล่าสุด</div>
        <div className="space-y-1.5">
          {[...activity].reverse().map((a) => {
            const meta = CASH_TYPES[a.type] || CASH_TYPES.other
            return (
              <div key={a.id} className="hairline rounded-lg p-2 flex items-center gap-3 text-[12px]" style={{ background: 'rgba(255,255,255,0.015)' }}>
                <span className="text-[10px] font-mono text-[var(--txt-faint)] w-[78px]">{a.date}</span>
                <span className="px-2 py-0.5 rounded text-[10.5px]" style={{ color: meta.tone, border: `1px solid ${meta.tone}44` }}>{meta.label}</span>
                <span className="font-mono num-tabular" style={{ color: meta.sign > 0 ? '#9bffae' : '#ff8aa0' }}>
                  {meta.sign > 0 ? '+' : '−'}{fmtUsd(Math.abs(a.amount))}
                </span>
                <span className="text-[var(--txt-dim)] flex-1 truncate">{a.note || '—'}</span>
                {onDelete && (
                  <button
                    onClick={() => onDelete(a.id)}
                    className="text-[var(--txt-faint)] hover:text-[#ff8aa0] transition-colors text-[12px] shrink-0"
                    title="ลบรายการนี้ (ยอดน้ำคงเดิม)"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
          {activity.length === 0 && (
            <div className="text-[12px] text-[var(--txt-faint)] italic">ยังไม่มีรายการ</div>
          )}
        </div>
      </div>
    </div>
  )
}
