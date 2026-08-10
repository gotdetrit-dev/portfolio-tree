// ─────────────────────────────────────────────────────────────────────────────
// MoneyMarket.jsx — Forex/CFD position tracker.
// ผู้ใช้เติมเงิน (บาท) แล้วเปิด long/short คู่เงินได้ พร้อม TP/SL
// ระบบดึงราคาสดจาก /api/fxrate?pair=... เพื่อคำนวณ P/L ปัจจุบัน
//
// MVP: เก็บใน localStorage (ยังไม่ sync cross-device) — จะย้ายไป Supabase ทีหลัง
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const PAIRS = [
  { s: 'USDJPY', label: 'USD/JPY' },
  { s: 'EURUSD', label: 'EUR/USD' },
  { s: 'GBPUSD', label: 'GBP/USD' },
  { s: 'USDCHF', label: 'USD/CHF' },
  { s: 'USDCAD', label: 'USD/CAD' },
  { s: 'AUDUSD', label: 'AUD/USD' },
  { s: 'NZDUSD', label: 'NZD/USD' },
  { s: 'XAUUSD', label: 'ทอง XAU/USD' },
  { s: 'XAGUSD', label: 'เงิน XAG/USD' },
]

// ─── Forex math ─────────────────────────────────────────────────────────────
// Contract size ต่อ 1 lot — ต่างกันตามประเภทสินทรัพย์
function contractSize(pair) {
  if (/^(XAU|XAG)/.test(pair)) return 100          // โลหะ: 100 oz ต่อ lot
  if (/^(BTC|ETH)/.test(pair)) return 1            // คริปโต: 1 unit
  return 100000                                     // Forex มาตรฐาน
}

const quoteCcy = (pair) => pair.slice(3, 6)

// P/L ใน "quote currency" (สกุลตัวหลังของคู่เงิน)
function pnlQuote(pos, currentPrice) {
  const dir = pos.direction === 'long' ? 1 : -1
  return (currentPrice - pos.entry) * dir * pos.lot * contractSize(pos.pair)
}

// แปลง P/L จาก quote currency → USD
// - ถ้า quote เป็น USD อยู่แล้ว (EURUSD, XAUUSD): ไม่ต้องแปลง
// - ถ้าคู่เงินขึ้นต้นด้วย USD (USDJPY, USDCHF): แปลงโดยหารด้วยราคาปัจจุบันของคู่นั้นเอง
function pnlUsd(pos, currentPrice) {
  const q = quoteCcy(pos.pair)
  const raw = pnlQuote(pos, currentPrice)
  if (q === 'USD') return raw
  if (pos.pair.startsWith('USD')) return raw / currentPrice
  return raw // fallback
}

// ระยะห่างเป็น pips (ประมาณ) — สำหรับดูว่าห่างจาก TP/SL กี่ pip
function pipsAway(pair, from, to) {
  if (!from || !to) return null
  const pipSize = /JPY$/.test(pair) ? 0.01 : /^X(AU|AG)/.test(pair) ? 0.1 : 0.0001
  return (to - from) / pipSize
}

// ─── Format helpers ─────────────────────────────────────────────────────────
const fmtN = (n, frac = 2) => {
  if (n == null || !isFinite(n)) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: frac, maximumFractionDigits: frac })
}
const fmtSigned = (n, frac = 2) => (n == null || !isFinite(n)) ? '—' : (n >= 0 ? '+' : '') + fmtN(n, frac)
const priceDigits = (pair) => /JPY$/.test(pair) ? 3 : /^X(AU|AG)/.test(pair) ? 2 : 5

// ─── LocalStorage keys ───────────────────────────────────────────────────────
const LS_BALANCE = 'mm_balance_v1'
const LS_POSITIONS = 'mm_positions_v1'
const LS_ACTIVITY = 'mm_activity_v1' // ประวัติเติม/ถอน/ปิด

const loadJson = (k, dflt) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : dflt } catch { return dflt }
}

// ─── Price fetcher ──────────────────────────────────────────────────────────
async function fetchPair(pair) {
  try {
    const r = await fetch(`/api/fxrate?pair=${encodeURIComponent(pair)}`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!r.ok) return null
    const d = await r.json()
    return d?.rate > 0 ? { rate: d.rate, source: d.source, time: d.time } : null
  } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MoneyMarket() {
  const [balance, setBalance] = useState(() => Number(loadJson(LS_BALANCE, 20000)) || 20000)
  const [positions, setPositions] = useState(() => loadJson(LS_POSITIONS, []))
  const [activity, setActivity] = useState(() => loadJson(LS_ACTIVITY, []))
  const [prices, setPrices] = useState({})           // { USDJPY: { rate, source, time } }
  const [usdThb, setUsdThb] = useState(0)
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)

  // Persist
  useEffect(() => { localStorage.setItem(LS_BALANCE, JSON.stringify(balance)) }, [balance])
  useEffect(() => { localStorage.setItem(LS_POSITIONS, JSON.stringify(positions)) }, [positions])
  useEffect(() => { localStorage.setItem(LS_ACTIVITY, JSON.stringify(activity)) }, [activity])

  // Refresh prices for all open positions + USDTHB
  const refresh = useCallback(async () => {
    const open = positions.filter((p) => !p.closed)
    const pairs = [...new Set(open.map((p) => p.pair))]
    setLoading(true)
    try {
      const results = await Promise.all(pairs.map(async (p) => [p, await fetchPair(p)]))
      const map = {}
      for (const [p, v] of results) if (v) map[p] = v
      setPrices((prev) => ({ ...prev, ...map }))
      const thb = await fetchPair('USDTHB')
      if (thb) setUsdThb(thb.rate)
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }, [positions])

  // Fetch on mount + when open positions change (new pair)
  const openPairsKey = useMemo(
    () => [...new Set(positions.filter((p) => !p.closed).map((p) => p.pair))].sort().join(','),
    [positions],
  )
  useEffect(() => { refresh() }, [openPairsKey]) // eslint-disable-line

  // Auto-refresh every 60s
  const timerRef = useRef(null)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => refresh(), 60000)
    return () => clearInterval(timerRef.current)
  }, [refresh])

  // ── Actions ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({ pair: 'USDJPY', direction: 'short', lot: '0.2', leverage: 50, entry: '', tp: '', sl: '' })
  const [showTopup, setShowTopup] = useState(false)

  function openPosition() {
    const entry = Number(form.entry)
    const lot = Number(form.lot)
    if (!(entry > 0) || !(lot > 0)) return
    const pos = {
      id: 'p_' + Math.random().toString(36).slice(2, 10),
      pair: form.pair,
      direction: form.direction,
      lot,
      leverage: Number(form.leverage) || 1,
      entry,
      tp: Number(form.tp) || null,
      sl: Number(form.sl) || null,
      openedAt: new Date().toISOString(),
      closed: false,
    }
    setPositions((arr) => [pos, ...arr])
    setForm({ ...form, entry: '', tp: '', sl: '' })
  }

  function closePosition(id) {
    const pos = positions.find((p) => p.id === id)
    if (!pos) return
    const price = prices[pos.pair]?.rate
    if (!price) { alert('ยังไม่มีราคาสด — ลองกดรีเฟรชก่อน'); return }
    const usd = pnlUsd(pos, price)
    const thb = usdThb ? usd * usdThb : 0
    if (!confirm(`ปิดสถานะ ${pos.pair} ${pos.direction} ที่ราคา ${fmtN(price, priceDigits(pos.pair))}\nP/L ≈ ${fmtSigned(thb, 2)} ฿ (${fmtSigned(usd, 2)} $)\nยืนยัน?`)) return
    setBalance((b) => b + thb)
    setPositions((arr) => arr.map((p) => p.id === id ? { ...p, closed: true, closePrice: price, closedAt: new Date().toISOString(), pnlUsd: usd, pnlThb: thb } : p))
    setActivity((arr) => [{
      id: 'a_' + Math.random().toString(36).slice(2, 8),
      kind: 'close',
      at: new Date().toISOString(),
      pair: pos.pair,
      direction: pos.direction,
      lot: pos.lot,
      entry: pos.entry,
      exit: price,
      pnlThb: thb,
      pnlUsd: usd,
    }, ...arr])
  }

  function deletePosition(id) {
    const pos = positions.find((p) => p.id === id)
    if (!pos) return
    if (!confirm(`ลบสถานะนี้ทิ้งถาวร (ไม่กระทบยอดเงิน)?\n${pos.pair} · ${pos.direction} · ${pos.lot} lot`)) return
    setPositions((arr) => arr.filter((p) => p.id !== id))
  }

  function topup(amount, kind) {
    const n = Number(amount)
    if (!(n > 0)) return
    const signed = kind === 'withdraw' ? -n : n
    setBalance((b) => b + signed)
    setActivity((arr) => [{
      id: 'a_' + Math.random().toString(36).slice(2, 8),
      kind,
      at: new Date().toISOString(),
      amountThb: signed,
    }, ...arr])
    setShowTopup(false)
  }

  // ── Derived ─────────────────────────────────────────────────────────────
  const open = positions.filter((p) => !p.closed)
  const closed = positions.filter((p) => p.closed)

  const totalUsdPnl = open.reduce((s, p) => {
    const price = prices[p.pair]?.rate
    return price ? s + pnlUsd(p, price) : s
  }, 0)
  const totalThbPnl = usdThb ? totalUsdPnl * usdThb : 0
  const equity = balance + totalThbPnl

  const realizedThb = closed.reduce((s, p) => s + (p.pnlThb || 0), 0)
  const depositedThb = activity.filter((a) => a.kind === 'deposit').reduce((s, a) => s + (a.amountThb || 0), 0)

  return (
    <section className="px-4 lg:px-10 mt-6 pb-24 space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="ยอดเงิน (Balance)"
          value={`฿${fmtN(balance, 2)}`}
          sub={depositedThb ? `เติมสะสม ฿${fmtN(depositedThb, 2)}` : 'พร้อมเทรด'}
          action={<button className="btn text-[11px] px-2 py-1" onClick={() => setShowTopup(true)}>เติม/ถอน</button>}
        />
        <KpiCard
          label="P/L ที่ยังไม่ปิด (Floating)"
          value={`${totalThbPnl >= 0 ? '+' : ''}฿${fmtN(totalThbPnl, 2)}`}
          valueColor={totalThbPnl >= 0 ? '#34e07a' : '#ff4d6d'}
          sub={`≈ ${fmtSigned(totalUsdPnl, 2)} $ · ${open.length} สถานะ`}
        />
        <KpiCard
          label="กำไรสะสมที่ปิดแล้ว"
          value={`${realizedThb >= 0 ? '+' : ''}฿${fmtN(realizedThb, 2)}`}
          valueColor={realizedThb >= 0 ? '#34e07a' : '#ff4d6d'}
          sub={`${closed.length} สถานะปิด`}
        />
        <KpiCard
          label="Equity (Balance + Floating)"
          value={`฿${fmtN(equity, 2)}`}
          sub={usdThb ? `1 USD = ฿${fmtN(usdThb, 2)}` : 'กำลังโหลดเรท…'}
        />
      </div>

      {/* Refresh bar */}
      <div className="flex items-center justify-between text-[12px] text-[var(--txt-dim)]">
        <div>
          {loading ? 'กำลังดึงราคา…' : lastRefresh ? `อัพเดตล่าสุด ${lastRefresh.toLocaleTimeString('th-TH')}` : 'ยังไม่ได้ดึงราคา'}
          {' · '}Auto-refresh ทุก 60 วินาที
        </div>
        <button className="btn text-[11px] px-2 py-1" onClick={refresh} disabled={loading}>
          🔄 รีเฟรชราคา
        </button>
      </div>

      {/* Open position form */}
      <div className="panel rounded-2xl p-5">
        <div className="text-[14px] font-semibold mb-3 flex items-center gap-2">
          <span>เปิดสถานะใหม่</span>
          <span className="text-[11px] text-[var(--txt-faint)] font-normal">— บันทึกการเปิด Long/Short ของคุณ</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <FormField label="คู่เงิน">
            <select className="field w-full" value={form.pair} onChange={(e) => setForm({ ...form, pair: e.target.value })}>
              {PAIRS.map((p) => <option key={p.s} value={p.s}>{p.label}</option>)}
            </select>
          </FormField>
          <FormField label="ทิศทาง">
            <select className="field w-full" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value="long">Long (ซื้อ)</option>
              <option value="short">Short (ขาย)</option>
            </select>
          </FormField>
          <FormField label="Lot">
            <input type="number" step="0.01" min="0.01" className="field w-full" value={form.lot}
              onChange={(e) => setForm({ ...form, lot: e.target.value })} placeholder="0.20" />
          </FormField>
          <FormField label="Leverage 1:">
            <input type="number" step="1" min="1" className="field w-full" value={form.leverage}
              onChange={(e) => setForm({ ...form, leverage: e.target.value })} placeholder="50" />
          </FormField>
          <FormField label="ราคาเข้า Entry">
            <input type="number" step="0.00001" className="field w-full" value={form.entry}
              onChange={(e) => setForm({ ...form, entry: e.target.value })} placeholder={prices[form.pair]?.rate ? String(prices[form.pair].rate) : '—'} />
          </FormField>
          <FormField label="TP (เป้าหมาย)">
            <input type="number" step="0.00001" className="field w-full" value={form.tp}
              onChange={(e) => setForm({ ...form, tp: e.target.value })} placeholder="ว่างได้" />
          </FormField>
          <FormField label="SL (จุดตัดขาดทุน)">
            <input type="number" step="0.00001" className="field w-full" value={form.sl}
              onChange={(e) => setForm({ ...form, sl: e.target.value })} placeholder="ว่างได้" />
          </FormField>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={openPosition} disabled={!Number(form.entry) || !Number(form.lot)}
            className="btn btn-primary flex-1">
            ✓ เปิดสถานะ
          </button>
          {prices[form.pair]?.rate && (
            <button
              onClick={() => setForm({ ...form, entry: String(prices[form.pair].rate) })}
              className="btn text-[11px]"
              title="ใช้ราคาสดปัจจุบันเป็น Entry"
            >
              ใช้ราคาสด {fmtN(prices[form.pair].rate, priceDigits(form.pair))}
            </button>
          )}
        </div>
      </div>

      {/* Open positions */}
      <div className="panel rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
          <div className="text-[14px] font-semibold">
            สถานะที่เปิดอยู่ · {open.length} รายการ
          </div>
          {totalThbPnl !== 0 && (
            <div className="text-[12px] font-mono" style={{ color: totalThbPnl >= 0 ? '#34e07a' : '#ff4d6d' }}>
              รวม {fmtSigned(totalThbPnl, 2)} ฿
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="holdings" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingLeft: 16 }}>คู่เงิน / ทิศทาง</th>
                <th style={{ textAlign: 'right' }}>Lot</th>
                <th style={{ textAlign: 'right' }}>Entry</th>
                <th style={{ textAlign: 'right' }}>ราคาปัจจุบัน</th>
                <th style={{ textAlign: 'right' }}>TP / SL</th>
                <th style={{ textAlign: 'right' }}>P/L (quote)</th>
                <th style={{ textAlign: 'right' }}>P/L (USD)</th>
                <th style={{ textAlign: 'right' }}>P/L (THB)</th>
                <th style={{ textAlign: 'right', paddingRight: 16 }}></th>
              </tr>
            </thead>
            <tbody>
              {open.length === 0 && (
                <tr><td colSpan={9} className="text-center italic py-6" style={{ color: 'var(--txt-faint)' }}>
                  ยังไม่มีสถานะที่เปิด — กรอกฟอร์มด้านบนเพื่อบันทึกการเทรดแรก
                </td></tr>
              )}
              {open.map((p) => {
                const price = prices[p.pair]?.rate
                const pQuote = price ? pnlQuote(p, price) : null
                const pUsd = price ? pnlUsd(p, price) : null
                const pThb = pUsd != null && usdThb ? pUsd * usdThb : null
                const tone = pThb == null ? 'var(--txt-dim)' : pThb >= 0 ? '#34e07a' : '#ff4d6d'
                const tpPips = pipsAway(p.pair, price, p.tp)
                const slPips = pipsAway(p.pair, price, p.sl)
                const hitTp = price && p.tp && ((p.direction === 'long' && price >= p.tp) || (p.direction === 'short' && price <= p.tp))
                const hitSl = price && p.sl && ((p.direction === 'long' && price <= p.sl) || (p.direction === 'short' && price >= p.sl))
                return (
                  <tr key={p.id}>
                    <td style={{ paddingLeft: 16 }}>
                      <div className="font-semibold text-[13px]">{p.pair}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: p.direction === 'long' ? '#34e07a' : '#ff4d6d' }}>
                        {p.direction === 'long' ? '↑ Long (ซื้อ)' : '↓ Short (ขาย)'} · 1:{p.leverage}
                      </div>
                    </td>
                    <td className="mono text-right">{fmtN(p.lot, 2)}</td>
                    <td className="mono text-right">{fmtN(p.entry, priceDigits(p.pair))}</td>
                    <td className="mono text-right">
                      {price ? (
                        <>
                          <div>{fmtN(price, priceDigits(p.pair))}</div>
                          <div className="text-[10px]" style={{ color: tone }}>
                            {fmtSigned(price - p.entry, priceDigits(p.pair))}
                          </div>
                        </>
                      ) : <span style={{ color: 'var(--txt-faint)' }}>—</span>}
                    </td>
                    <td className="mono text-right text-[11px]">
                      {p.tp ? (
                        <div style={{ color: hitTp ? '#34e07a' : 'var(--txt-dim)', fontWeight: hitTp ? 700 : 400 }}>
                          TP {fmtN(p.tp, priceDigits(p.pair))}
                          {tpPips != null && !hitTp && <span className="text-[9px] ml-1">({fmtN(Math.abs(tpPips), 0)}p)</span>}
                          {hitTp && ' 🎯'}
                        </div>
                      ) : <div style={{ color: 'var(--txt-faint)' }}>TP —</div>}
                      {p.sl ? (
                        <div style={{ color: hitSl ? '#ff4d6d' : 'var(--txt-dim)', fontWeight: hitSl ? 700 : 400 }}>
                          SL {fmtN(p.sl, priceDigits(p.pair))}
                          {slPips != null && !hitSl && <span className="text-[9px] ml-1">({fmtN(Math.abs(slPips), 0)}p)</span>}
                          {hitSl && ' ⚠️'}
                        </div>
                      ) : <div style={{ color: 'var(--txt-faint)' }}>SL —</div>}
                    </td>
                    <td className="mono text-right" style={{ color: tone }}>
                      {pQuote != null ? `${fmtSigned(pQuote, 2)} ${quoteCcy(p.pair)}` : '—'}
                    </td>
                    <td className="mono text-right" style={{ color: tone }}>
                      {pUsd != null ? fmtSigned(pUsd, 2) + ' $' : '—'}
                    </td>
                    <td className="mono text-right font-semibold" style={{ color: tone }}>
                      {pThb != null ? fmtSigned(pThb, 2) + ' ฿' : '—'}
                    </td>
                    <td className="text-right" style={{ paddingRight: 16 }}>
                      <button onClick={() => closePosition(p.id)} className="btn text-[11px] px-2 py-1 mr-1"
                        title="ปิดสถานะ (บวก/ลบ P/L เข้ายอดเงิน)">ปิด</button>
                      <button onClick={() => deletePosition(p.id)} className="btn text-[11px] px-2 py-1"
                        style={{ color: '#ff4d6d' }} title="ลบทิ้ง (ไม่คำนวณ P/L)">🗑</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Closed positions */}
      {closed.length > 0 && (
        <div className="panel rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
            <div className="text-[14px] font-semibold">ประวัติสถานะที่ปิดแล้ว · {closed.length} รายการ</div>
            <div className="text-[12px] font-mono" style={{ color: realizedThb >= 0 ? '#34e07a' : '#ff4d6d' }}>
              รวม {fmtSigned(realizedThb, 2)} ฿
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="holdings" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: 16 }}>คู่เงิน / ทิศทาง</th>
                  <th style={{ textAlign: 'right' }}>Lot</th>
                  <th style={{ textAlign: 'right' }}>Entry → Exit</th>
                  <th style={{ textAlign: 'right' }}>P/L (USD)</th>
                  <th style={{ textAlign: 'right' }}>P/L (THB)</th>
                  <th style={{ textAlign: 'right', paddingRight: 16 }}>ปิดเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {closed.slice().sort((a, b) => (b.closedAt || '').localeCompare(a.closedAt || '')).map((p) => {
                  const tone = (p.pnlThb || 0) >= 0 ? '#34e07a' : '#ff4d6d'
                  return (
                    <tr key={p.id}>
                      <td style={{ paddingLeft: 16 }}>
                        <div className="font-semibold text-[13px]">{p.pair}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: p.direction === 'long' ? '#34e07a' : '#ff4d6d' }}>
                          {p.direction === 'long' ? '↑ Long' : '↓ Short'}
                        </div>
                      </td>
                      <td className="mono text-right">{fmtN(p.lot, 2)}</td>
                      <td className="mono text-right text-[11px]">
                        {fmtN(p.entry, priceDigits(p.pair))} → {fmtN(p.closePrice, priceDigits(p.pair))}
                      </td>
                      <td className="mono text-right" style={{ color: tone }}>{fmtSigned(p.pnlUsd, 2)} $</td>
                      <td className="mono text-right font-semibold" style={{ color: tone }}>{fmtSigned(p.pnlThb, 2)} ฿</td>
                      <td className="text-right text-[11px]" style={{ paddingRight: 16, color: 'var(--txt-dim)' }}>
                        {p.closedAt ? new Date(p.closedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Topup modal */}
      {showTopup && <TopupModal onClose={() => setShowTopup(false)} onSubmit={topup} balance={balance} />}
    </section>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, valueColor, action }) {
  return (
    <div className="panel rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--txt-faint)' }}>{label}</div>
        {action}
      </div>
      <div className="text-[20px] font-mono num-tabular font-semibold" style={valueColor ? { color: valueColor } : {}}>
        {value}
      </div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: 'var(--txt-faint)' }}>{sub}</div>}
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--txt-faint)' }}>{label}</span>
      {children}
    </label>
  )
}

function TopupModal({ onClose, onSubmit, balance }) {
  const [kind, setKind] = useState('deposit')
  const [amount, setAmount] = useState('')
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel rounded-2xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-[16px] font-semibold mb-1">เติม / ถอนเงินในบัญชี</div>
        <div className="text-[11px] mb-4" style={{ color: 'var(--txt-dim)' }}>ยอดเงินปัจจุบัน ฿{fmtN(balance, 2)}</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            className="btn"
            style={kind === 'deposit' ? { borderColor: 'rgba(52,224,122,0.5)', color: '#34e07a', background: 'rgba(52,224,122,0.08)' } : {}}
            onClick={() => setKind('deposit')}
          >💰 เติมเงิน (Deposit)</button>
          <button
            className="btn"
            style={kind === 'withdraw' ? { borderColor: 'rgba(255,77,109,0.5)', color: '#ff4d6d', background: 'rgba(255,77,109,0.08)' } : {}}
            onClick={() => setKind('withdraw')}
          >💸 ถอนเงิน (Withdraw)</button>
        </div>
        <label className="block mb-4">
          <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--txt-faint)' }}>จำนวน (บาท)</span>
          <input type="number" step="0.01" min="0" className="field w-full" value={amount} autoFocus
            onChange={(e) => setAmount(e.target.value)} placeholder="20000" />
        </label>
        <div className="flex gap-2">
          <button className="btn flex-1" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary flex-1" onClick={() => onSubmit(amount, kind)} disabled={!Number(amount)}>
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  )
}
