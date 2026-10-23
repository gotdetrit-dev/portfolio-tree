// ─────────────────────────────────────────────────────────────────────────────
// MacroOverview.jsx — หน้ากรอกข้อมูล macro ด้วยตัวเอง + สรุปใหญ่ด้านขวา
//
// Layout:
//   ซ้าย = sections (US-Credit Spread / US-Inflation / Real-Yield /
//                   Market Volatility / Overview Index And Price)
//          แต่ละ metric มี input "ตัวเลข" + textarea "บทวิเคราะห์"
//   ขวา  = textarea สรุปใหญ่ sticky
//
// Save: debounce 800ms (type แล้วหยุด) + save on blur ทันที
//       แสดง "กำลังบันทึก..." / "บันทึกเมื่อ HH:MM"
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadMacroOverview, saveMacroOverview } from '../db.js'

const SECTIONS = [
  {
    key: 'credit', title: 'US-Credit Spread', icon: '📊', tone: '#ff8aa0',
    metrics: [
      { key: 'hy_spread',  label: 'High Yield Credit Spread',  unit: '%' },
      { key: 'bbb_spread', label: 'BBB Yield Credit Spread',   unit: '%' },
      { key: 'ccc_spread', label: 'CCC Yield Credit Spread',   unit: '%' },
    ],
  },
  {
    key: 'inflation', title: 'US-Inflation', icon: '📈', tone: '#f7c948',
    metrics: [
      { key: 'us_inflation_rate',     label: 'US-Inflation Rate',           unit: '%' },
      { key: 'us_core_inflation_mom', label: 'US-Core Inflation Rate MoM',  unit: '%' },
    ],
  },
  {
    key: 'realyield', title: 'Real-Yield', icon: '💰', tone: '#9bffae',
    metrics: [
      { key: 'dfii10', label: 'Real-Yield (DFII10)', unit: '%' },
    ],
  },
  {
    key: 'volatility', title: 'Market Volatility', icon: '🌪', tone: '#7bd1ff',
    metrics: [
      { key: 'vix_spx', label: 'VIX-S&P500', unit: '' },
      { key: 'vix_ndx', label: 'VIX-NASDAQ', unit: '' },
    ],
  },
  {
    key: 'overview', title: 'Overview Index And Price', icon: '🔭', tone: '#c9a9ff',
    metrics: [
      { key: 'usdthb', label: 'USD/THB',     unit: '฿' },
      { key: 'usoil',  label: 'USOIL',       unit: '$' },
      { key: 'gold',   label: 'GOLD',        unit: '$' },
      { key: 'btc',    label: 'BTC',         unit: '$' },
      { key: 'spx',    label: 'S&P500',      unit: '' },
      { key: 'ndx',    label: 'NASDAQ',      unit: '' },
      { key: 'dji',    label: 'Dow Jones',   unit: '' },
      { key: 'rut',    label: 'Russell 2000', unit: '' },
    ],
  },
]

// ─── Market Regime Assessment (ด้านขวา) ─────────────────────────────────────
const ASSESSMENT = [
  { key: 'credit_risk',     label: 'Credit Risk' },
  { key: 'inflation',       label: 'Inflation' },
  { key: 'real_yield',      label: 'Real Yield' },
  { key: 'volatility',      label: 'Volatility' },
  { key: 'market_breadth',  label: 'Market Breadth' },
]

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                     'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const thaiDateCE = (d) => `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()}`

const fmtTime = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
  } catch { return '' }
}

export default function MacroOverview({ user }) {
  const userId = user?.id
  const [status, setStatus] = useState('loading') // loading | ready | needs-migration | error
  const [errorMsg, setErrorMsg] = useState('')
  const [data, setData] = useState({})       // { metric_key: { value, analysis, updatedAt } }
  const [summary, setSummary] = useState('')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [openPicker, setOpenPicker] = useState(null) // row.key ที่กำลังเปิด color picker

  // ปิด picker เมื่อคลิกนอก
  useEffect(() => {
    if (!openPicker) return
    const close = (e) => {
      if (!e.target.closest?.('[data-color-picker]')) setOpenPicker(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openPicker])

  // ── Initial load ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const row = await loadMacroOverview(userId)
        if (cancelled) return
        if (row.missingTable) { setStatus('needs-migration'); return }
        setData(row.data || {})
        setSummary(row.summary || '')
        setLastSavedAt(row.updatedAt)
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        setErrorMsg(String(e?.message || e))
        setStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  // ── Debounced save ─────────────────────────────────────────────────────
  const saveTimer = useRef(null)
  const latestRef = useRef({ data, summary })
  useEffect(() => { latestRef.current = { data, summary } }, [data, summary])

  const flush = useCallback(async () => {
    if (!userId || status !== 'ready') return
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    setSaveState('saving')
    try {
      await saveMacroOverview(userId, latestRef.current)
      setLastSavedAt(new Date().toISOString())
      setSaveState('saved')
      setTimeout(() => setSaveState((s) => s === 'saved' ? 'idle' : s), 2000)
    } catch (e) {
      console.error('macro save failed', e)
      setSaveState('error')
    }
  }, [userId, status])

  const scheduleSave = useCallback(() => {
    if (!userId || status !== 'ready') return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    saveTimer.current = setTimeout(() => {
      flush()
    }, 800)
  }, [userId, status, flush])

  // ── Mutators ───────────────────────────────────────────────────────────
  function setMetric(key, patch) {
    setData((d) => ({
      ...d,
      [key]: { ...(d[key] || {}), ...patch, updatedAt: new Date().toISOString() },
    }))
    scheduleSave()
  }

  function setSummaryText(v) {
    setSummary(v)
    scheduleSave()
  }

  // Assessment ด้านขวา — เก็บใน data._assessment (ไม่ต้องแก้ schema)
  // Shape ใหม่: { text, color } ต่อ key
  // Backward compat: ถ้าเจอ string เก่า → treat เป็น { text: str, color: 'red' }
  const assessment = data._assessment || {}
  const getEntry = (key) => {
    const raw = assessment[key]
    if (!raw) return { text: '', color: 'red' }
    if (typeof raw === 'string') return { text: raw, color: 'red' }
    return { text: raw.text || '', color: raw.color || 'red' }
  }
  function setAssessment(key, patch) {
    setData((d) => {
      const prev = getEntry(key)
      const next = { ...prev, ...patch }
      return { ...d, _assessment: { ...(d._assessment || {}), [key]: next } }
    })
    scheduleSave()
  }

  const COLOR_MAP = {
    red:   { ink: '#ff6a3d', border: 'rgba(255,106,61,0.3)', dot: '#ff4d4f' },
    white: { ink: '#f5f5f5', border: 'rgba(255,255,255,0.3)', dot: '#ffffff' },
    green: { ink: '#9bffae', border: 'rgba(155,255,174,0.3)', dot: '#34e07a' },
  }

  // ── Loading / migration / error ─────────────────────────────────────────
  if (status === 'loading') {
    return (
      <section className="px-4 lg:px-10 mt-6">
        <div className="panel rounded-2xl p-8 text-center text-[13px] text-[var(--txt-dim)]">
          กำลังโหลดข้อมูลจาก Supabase…
        </div>
      </section>
    )
  }

  if (status === 'needs-migration') {
    return (
      <section className="px-4 lg:px-10 mt-6">
        <div className="panel rounded-2xl p-6">
          <div className="text-[18px] font-semibold mb-2">⚠️ ต้องรัน SQL migration ก่อนใช้งาน</div>
          <div className="text-[13px] text-[var(--txt-dim)] mb-4">
            หน้า Macro-Overview ต้องสร้าง table ในฐานข้อมูลก่อน
            <br />เปิด Supabase SQL Editor → paste เนื้อหาจากไฟล์ <code className="text-[var(--txt-bright)]">supabase/macro_overview.sql</code>
          </div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            รีเฟรชหลังรัน SQL แล้ว
          </button>
        </div>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="px-4 lg:px-10 mt-6">
        <div className="panel rounded-2xl p-6">
          <div className="text-[16px] font-semibold mb-2" style={{ color: '#ff4d6d' }}>เกิดข้อผิดพลาด</div>
          <div className="text-[12px] font-mono">{errorMsg}</div>
          <button className="btn mt-4" onClick={() => window.location.reload()}>รีเฟรช</button>
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 lg:px-10 mt-6 pb-24">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-3 text-[12px]">
        <div className="text-[var(--txt-dim)]">
          🌍 Macro-Overview · กรอกเองทั้งหมด · Sync กับ Supabase อัตโนมัติ
        </div>
        <div>
          {saveState === 'saving' && <span className="text-[var(--txt-dim)]">⋯ กำลังบันทึก…</span>}
          {saveState === 'saved' && <span style={{ color: '#9bffae' }}>✓ บันทึกแล้ว</span>}
          {saveState === 'error' && <span style={{ color: '#ff4d6d' }}>✗ บันทึกไม่สำเร็จ</span>}
          {saveState === 'idle' && lastSavedAt && (
            <span className="text-[var(--txt-faint)]">อัปเดตล่าสุด {fmtTime(lastSavedAt)}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-4">
        {/* ── ด้านซ้าย: Sections ────────────────────────────────────────── */}
        <div className="space-y-4">
          {SECTIONS.map((section, si) => (
            <div
              key={section.key}
              className="panel rounded-2xl overflow-hidden"
              style={{ borderColor: section.tone + '33' }}
            >
              <div
                className="px-5 py-3 flex items-center gap-2 border-b"
                style={{ background: section.tone + '0d', borderBottomColor: section.tone + '22' }}
              >
                <span className="text-[18px]" style={{ filter: `drop-shadow(0 0 6px ${section.tone}88)` }}>
                  {section.icon}
                </span>
                <span className="text-[11px] text-[var(--txt-faint)] font-mono">{si + 1}.</span>
                <span className="text-[14px] font-semibold" style={{ color: section.tone }}>
                  {section.title}
                </span>
                <span className="ml-auto text-[10.5px] text-[var(--txt-faint)]">{section.metrics.length} รายการ</span>
              </div>
              <div className="p-4 space-y-3">
                {section.metrics.map((m, mi) => {
                  const entry = data[m.key] || {}
                  return (
                    <div
                      key={m.key}
                      className="hairline rounded-xl p-3"
                      style={{ background: 'rgba(255,255,255,0.015)' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10.5px] text-[var(--txt-faint)] font-mono">{si + 1}.{mi + 1}</span>
                        <span className="text-[13px] font-medium" style={{ color: 'var(--txt-bright)' }}>
                          {m.label}
                        </span>
                        {entry.updatedAt && (
                          <span className="ml-auto text-[9.5px] text-[var(--txt-faint)]">
                            แก้ไข {fmtTime(entry.updatedAt)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
                        {/* ตัวเลข */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-[var(--txt-faint)] mb-1">
                            ตัวเลข {m.unit && <span className="text-[var(--txt-dim)]">({m.unit})</span>}
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="field w-full font-mono"
                            value={entry.value || ''}
                            onChange={(e) => setMetric(m.key, { value: e.target.value })}
                            onBlur={flush}
                            placeholder="—"
                            style={{ fontSize: 15, fontWeight: 600 }}
                          />
                        </div>
                        {/* บทวิเคราะห์ */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-[var(--txt-faint)] mb-1">
                            บทวิเคราะห์
                          </label>
                          <textarea
                            rows={2}
                            className="field w-full"
                            value={entry.analysis || ''}
                            onChange={(e) => setMetric(m.key, { analysis: e.target.value })}
                            onBlur={flush}
                            placeholder="เช่น spread กำลังขยายตัว แสดงความกังวลด้าน credit..."
                            style={{ resize: 'vertical', minHeight: 48 }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── ด้านขวา: Market Regime Assessment (sticky) ────────────────── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="panel rounded-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-[var(--line)]">
              <div className="text-[18px] font-semibold text-white">Market Regime Assessment</div>
              <div className="text-[11px] text-[var(--txt-dim)] mt-1">
                {thaiDateCE(new Date())} • จากข้อมูลที่ตรวจสอบได้
              </div>
            </div>
            <div className="p-2">
              {ASSESSMENT.map((row, i) => {
                const entry = getEntry(row.key)
                const palette = COLOR_MAP[entry.color] || COLOR_MAP.red
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-[130px_1fr] gap-3 items-start px-3 py-3"
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}
                  >
                    <div className="pt-1.5">
                      <div className="text-[13px] text-[var(--txt-dim)]">{row.label}</div>
                    </div>
                    <div className="relative" data-color-picker>
                      <textarea
                        rows={1}
                        className="field w-full"
                        value={entry.text}
                        onChange={(e) => setAssessment(row.key, { text: e.target.value })}
                        onBlur={flush}
                        placeholder="—"
                        style={{
                          color: palette.ink,
                          fontWeight: 600,
                          fontSize: 13.5,
                          lineHeight: 1.5,
                          resize: 'vertical',
                          minHeight: 36,
                          background: 'transparent',
                          border: `1px dashed ${palette.border}`,
                          paddingRight: 32, // เว้นที่ให้ปุ่มสี
                        }}
                      />
                      {/* ปุ่มสีด้านขวา — แสดงเฉพาะเมื่อมีข้อความแล้ว */}
                      {entry.text.trim() && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenPicker(openPicker === row.key ? null : row.key) }}
                            title="เปลี่ยนสี"
                            className="transition-all"
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              background: palette.dot,
                              border: '2px solid rgba(255,255,255,0.5)',
                              boxShadow: `0 0 6px ${palette.dot}`,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          />
                          {/* Popover: 3 ตัวเลือกสี */}
                          {openPicker === row.key && (
                            <div
                              className="absolute flex items-center gap-2 fade-in"
                              style={{
                                top: 32,
                                right: 0,
                                padding: '6px 8px',
                                background: 'rgba(8,9,13,0.98)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: 10,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
                                zIndex: 20,
                              }}
                            >
                              {['red', 'white', 'green'].map((c) => {
                                const active = entry.color === c
                                return (
                                  <button
                                    key={c}
                                    onClick={() => { setAssessment(row.key, { color: c }); setOpenPicker(null); flush() }}
                                    title={c === 'red' ? 'เสี่ยง / Bearish' : c === 'green' ? 'ดี / Bullish' : 'กลางๆ / Neutral'}
                                    className="transition-all"
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: '50%',
                                      background: COLOR_MAP[c].dot,
                                      border: active ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                                      boxShadow: active ? `0 0 10px ${COLOR_MAP[c].dot}` : 'none',
                                      cursor: 'pointer',
                                      padding: 0,
                                    }}
                                  />
                                )
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
