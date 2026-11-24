// ─────────────────────────────────────────────────────────────────────────────
// InvestmentRoom.jsx — ห้องลงทุน
// Cockpit view: 1 ธีมต่อ 1 จอ, swipe L/R เปลี่ยนธีม
// Layout:
//   จอ 1 (ซ้าย)   = สรุปพอร์ตธีมนี้ (P/L, allocation, จำนวนหุ้น)
//   จอ 2 (กลางบน) = ชื่อธีม + description + news
//   จอ 3 (ขวา)    = หุ้นที่ถือ (ticker + qty + price + change)
//   Avatar (กลางล่าง) = customize ได้ (gender, hair, color)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { loadInvestmentRoom, saveInvestmentRoom } from '../db.js'

const LS_THEMES  = 'investment_room_themes_v2'
const LS_CASH_ALLOC = 'investment_room_cash_alloc_v1'
const LS_AVATAR  = 'investment_room_avatar_v1'

// ─── Starter data ──────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const STARTER = [
  { name: 'AI & Technology', icon: '🤖', tone: '#7bd1ff', description: 'หุ้น AI, semiconductor, cloud, software ที่คาดว่าจะเติบโตสูง', news: '', holdings: [], watchlist: [] },
  { name: 'Defensive',       icon: '🛡️', tone: '#9bffae', description: 'หุ้นกินปลอดภัย กลุ่ม utilities, consumer staples', news: '', holdings: [], watchlist: [] },
  { name: 'Hospital',        icon: '🏥', tone: '#ff8aa0', description: 'เครือโรงพยาบาลและบริการสุขภาพ', news: '', holdings: [], watchlist: [] },
  { name: 'Drug / Pharma',   icon: '💊', tone: '#f7c948', description: 'บริษัทยา biotech', news: '', holdings: [], watchlist: [] },
  { name: 'Food & Beverage', icon: '🍔', tone: '#ff9f43', description: 'อาหารเครื่องดื่ม brand-driven', news: '', holdings: [], watchlist: [] },
]

const DEFAULT_AVATAR = {
  type: 'cat',
  color: '#f5c988',
  name: 'เจ้าเหมียว',
}

const ANIMALS = [
  { key: 'cat',     label: 'แมว',      emoji: '🐱', defaultColor: '#f5c988' },
  { key: 'dog',     label: 'หมา',      emoji: '🐶', defaultColor: '#d4a574' },
  { key: 'bear',    label: 'หมี',      emoji: '🐻', defaultColor: '#a66f3f' },
  { key: 'fox',     label: 'จิ้งจอก',   emoji: '🦊', defaultColor: '#e8763a' },
  { key: 'rabbit',  label: 'กระต่าย',  emoji: '🐰', defaultColor: '#f5f0e8' },
  { key: 'panda',   label: 'แพนด้า',   emoji: '🐼', defaultColor: '#ffffff' },
  { key: 'frog',    label: 'กบ',       emoji: '🐸', defaultColor: '#8dd36a' },
  { key: 'penguin', label: 'เพนกวิน',  emoji: '🐧', defaultColor: '#1e2a3a' },
  { key: 'owl',     label: 'นกฮูก',    emoji: '🦉', defaultColor: '#a0825b' },
  { key: 'pig',     label: 'หมู',      emoji: '🐷', defaultColor: '#f5a5b8' },
]

const ANIMAL_COLORS = [
  '#f5c988', '#d4a574', '#a66f3f', '#e8763a', '#f5f0e8',
  '#ffffff', '#8dd36a', '#1e2a3a', '#a0825b', '#f5a5b8',
  '#7bd1ff', '#c9a9ff', '#ff79c6', '#f7c948', '#34e07a',
  '#ff6a3d', '#8be6ff', '#ff4d6d', '#b84848', '#3d3d3d',
]

function loadThemes() {
  try {
    const raw = localStorage.getItem(LS_THEMES)
    if (!raw) return STARTER.map((t) => ({ ...t, id: uid(), image: null }))
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : STARTER.map((t) => ({ ...t, id: uid(), image: null }))
  } catch { return STARTER.map((t) => ({ ...t, id: uid(), image: null })) }
}
function loadAvatar() {
  try {
    const raw = localStorage.getItem(LS_AVATAR)
    return raw ? { ...DEFAULT_AVATAR, ...JSON.parse(raw) } : DEFAULT_AVATAR
  } catch { return DEFAULT_AVATAR }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function InvestmentRoom({ user, agg }) {
  const [themes, setThemes] = useState(() => loadThemes())
  const [index, setIndex] = useState(0)
  const [avatar, setAvatar] = useState(() => loadAvatar())
  const [editMode, setEditMode] = useState(null) // null | 'theme' | 'avatar' | 'create'
  const [opened, setOpened] = useState(false) // false = หน้ารวมการ์ดธีม, true = เข้าไปในธีม
  const [showEdit, setShowEdit] = useState(false) // แสดงปุ่มแก้ไขบนการ์ด
  const [allocOpen, setAllocOpen] = useState(false) // หน้าต่างปรับสัดส่วน
  const [fabOpen, setFabOpen] = useState(false) // เมนูปุ่มมุมขวาล่าง
  // สัดส่วนเงินสด (%) — ธีมทั้งหมด + เงินสด = 100%
  const [cashAlloc, setCashAlloc] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_CASH_ALLOC)
      if (raw != null) return Number(raw) || 0
    } catch {}
    // ครั้งแรก: เงินสด = ส่วนที่เหลือจากธีม
    const used = loadThemes().reduce((s, t) => s + (Number(t.alloc) || 0), 0)
    return Math.max(0, 100 - used)
  })

  // localStorage = สำรองในเครื่อง (ใช้ตอนยังต่อ Supabase ไม่ได้)
  useEffect(() => { localStorage.setItem(LS_CASH_ALLOC, String(cashAlloc)) }, [cashAlloc])
  useEffect(() => { localStorage.setItem(LS_THEMES, JSON.stringify(themes)) }, [themes])
  useEffect(() => { localStorage.setItem(LS_AVATAR, JSON.stringify(avatar)) }, [avatar])

  // ─── Supabase sync ──────────────────────────────────────────────────────
  // syncStatus: loading | synced | local (ยังไม่มี table / ไม่ได้ล็อกอิน) | error
  const userId = user?.id
  const [syncStatus, setSyncStatus] = useState(userId && supabase ? 'loading' : 'local')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const skipSaveRef = useRef(true)
  const saveTimer = useRef(null)
  const latestRef = useRef({ themes, cashAlloc, avatar })
  latestRef.current = { themes, cashAlloc, avatar }

  // โหลดครั้งแรก: มี row → ใช้ข้อมูลจาก Supabase / ยังไม่มี row → อัปโหลดข้อมูลในเครื่องขึ้นไป
  useEffect(() => {
    if (!userId || !supabase) { setSyncStatus('local'); return }
    let cancelled = false
    ;(async () => {
      try {
        const row = await loadInvestmentRoom(userId)
        if (cancelled) return
        if (row.missingTable) { setSyncStatus('local'); return }
        if (row.exists && row.themes.length) {
          skipSaveRef.current = true
          setThemes(row.themes)
          setCashAlloc(row.cashAlloc)
          setAvatar({ ...DEFAULT_AVATAR, ...row.avatar })
          setIndex(0)
        } else {
          await saveInvestmentRoom(userId, latestRef.current)
          if (cancelled) return
        }
        setSyncStatus('synced')
      } catch (e) {
        console.error('investment room load failed', e)
        if (!cancelled) setSyncStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  // บันทึกอัตโนมัติ (หน่วง 0.8 วิ) ทุกครั้งที่ธีม / สัดส่วน / ตัวละคร เปลี่ยน
  useEffect(() => {
    if (syncStatus !== 'synced') return
    if (skipSaveRef.current) { skipSaveRef.current = false; return }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null
      try {
        await saveInvestmentRoom(userId, latestRef.current)
        setSaveState('saved')
      } catch (e) {
        console.error('investment room save failed', e)
        setSaveState('error')
      }
    }, 800)
  }, [themes, cashAlloc, avatar, syncStatus]) // eslint-disable-line

  // ออกจากหน้าก่อนครบ 0.8 วิ → บันทึกทันที
  useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveInvestmentRoom(userId, latestRef.current).catch((e) => console.error('investment room save failed', e))
    }
  }, [userId])

  // Keyboard nav
  useEffect(() => {
    const onKey = (e) => {
      if (editMode || !opened) return
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'Escape') setOpened(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editMode, opened, themes.length]) // eslint-disable-line

  const cur = themes[index]
  const prev = () => setIndex((i) => (i - 1 + themes.length) % themes.length)
  const next = () => setIndex((i) => (i + 1) % themes.length)

  const updateCur = (patch) => setThemes((arr) => arr.map((t, i) => (i === index ? { ...t, ...patch } : t)))
  const deleteCur = () => {
    if (themes.length <= 1) { alert('ต้องมีอย่างน้อย 1 ธีม'); return }
    if (!confirm(`ลบธีม "${cur.name}" ทิ้งถาวร?`)) return
    // สัดส่วนของธีมที่ลบ คืนไปเป็นเงินสด ให้รวมยังเป็น 100%
    setCashAlloc((c) => round1(c + (Number(cur.alloc) || 0)))
    setThemes((arr) => arr.filter((_, i) => i !== index))
    setIndex((i) => Math.max(0, i - 1))
    setEditMode(null)
    setOpened(false)
  }
  const createTheme = (name, icon, tone) => {
    const t = { id: uid(), name: name.trim() || 'ธีมใหม่', icon: icon || '✨', tone: tone || '#7bd1ff', description: '', news: '', holdings: [], watchlist: [], image: null }
    setThemes((arr) => {
      const next = [...arr, t]
      setIndex(next.length - 1)
      return next
    })
    setEditMode(null)
  }

  // ─── Swipe handling (touch) ────────────────────────────────────────────
  const touchRef = useRef({ x: 0 })
  const onTouchStart = (e) => { touchRef.current.x = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.x
    if (Math.abs(dx) > 60) { dx > 0 ? prev() : next() }
  }

  if (syncStatus === 'loading') {
    return (
      <section className="px-4 lg:px-10 mt-6">
        <div className="panel rounded-2xl p-8 text-center text-[13px] text-[var(--txt-dim)]">
          กำลังโหลดห้องลงทุนจาก Supabase…
        </div>
      </section>
    )
  }

  if (!cur) return null

  // ─── หน้ารวม: การ์ดธีม 3 ใบต่อแถว ─────────────────────────────────────
  if (!opened) {
    return (
      <section className="relative" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <CosmicBackdrop tone={cur.tone} />
        <div className="relative z-10 px-4 lg:px-10 pt-8 pb-12 max-w-[1200px] mx-auto">
          {/* หัวข้อ (ซ้ายบน) · เงินสด (กลาง ระดับเดียวกับช่องกำไร) · มูลค่าพอร์ต / กำไรรวม (ขวา) */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,420px)_1fr] items-end gap-4 mb-8">
            <h1
              className="self-start text-center lg:text-left text-[34px] sm:text-[44px] font-bold leading-tight text-white"
              style={{ textShadow: `0 0 24px ${cur.tone}88` }}
            >
              การลงทุนของฉัน
            </h1>
            <div className="w-full max-w-[420px] mx-auto lg:pb-6 order-last lg:order-none">
              <AllocBar label="💵 เงินสด" pct={cashAlloc} tone="#9fb3c8" />
            </div>
            <div className="flex flex-col gap-2 items-center lg:items-end">
              <PortfolioStat label="มูลค่าพอร์ต" value={fmtUsd(agg?.total || 0)} tone={cur.tone} />
              <PortfolioStat
                label="กำไรรวม (รับรู้แล้ว + ยังไม่รับรู้)"
                value={fmtSigned(agg?.totalPL || 0)}
                sub={fmtSignedPct(agg?.totalReturnPct || 0)}
                tone={cur.tone}
                color={(agg?.totalPL || 0) >= 0 ? '#34e07a' : '#ff4d6d'}
                footer={
                  <>
                    <span>รับรู้แล้ว <PlText n={agg?.realizedPL || 0} /></span>
                    <span>ยังไม่รับรู้ <PlText n={agg?.unrealizedPL || 0} /></span>
                  </>
                }
              />
            </div>
          </div>
          <SyncNotice status={syncStatus} saveState={saveState} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {themes
              .map((t, i) => ({ t, i }))
              .sort((a, b) => (Number(b.t.alloc) || 0) - (Number(a.t.alloc) || 0))
              .map(({ t, i }) => (
                <ThemeCard
                  key={t.id}
                  theme={t}
                  onClick={() => { setIndex(i); setOpened(true) }}
                  onEdit={showEdit ? () => { setIndex(i); setEditMode('theme') } : null}
                />
              ))}
          </div>
        </div>

        {allocOpen && (
          <AllocationModal
            themes={themes}
            cash={cashAlloc}
            onClose={() => setAllocOpen(false)}
            onSave={(allocById, cash) => {
              setThemes((arr) => arr.map((t) => ({ ...t, alloc: allocById[t.id] ?? 0 })))
              setCashAlloc(cash)
              setAllocOpen(false)
            }}
          />
        )}

        {/* ปุ่มเมนู (มุมขวาล่าง) — กดแล้วแสดง 3 ปุ่ม: ปรับสัดส่วน / แก้ไข / เพิ่มธีม */}
        <div className="fixed right-6 bottom-6 z-20 flex flex-col items-end gap-3">
          {fabOpen && (
            <>
              <FabButton tone={cur.tone} label="ปรับสัดส่วน" onClick={() => { setAllocOpen(true); setFabOpen(false) }}>⚖</FabButton>
              <FabButton tone={cur.tone} label={showEdit ? 'ซ่อนปุ่มแก้ไข' : 'แก้ไขธีม'} active={showEdit} onClick={() => setShowEdit((v) => !v)}>✎</FabButton>
              <FabButton tone={cur.tone} label="เพิ่มธีม" big onClick={() => { setEditMode('create'); setFabOpen(false) }}>+</FabButton>
            </>
          )}
          <FabButton tone={cur.tone} big active={fabOpen} onClick={() => setFabOpen((v) => !v)} title={fabOpen ? 'ปิดเมนู' : 'เมนู'}>
            {fabOpen ? '✕' : '☰'}
          </FabButton>
        </div>

        {editMode === 'create' && <CreateThemeModal onClose={() => setEditMode(null)} onCreate={createTheme} />}
        {editMode === 'theme' && (
          <ThemeSettingsModal theme={cur} onClose={() => setEditMode(null)} onUpdate={updateCur} />
        )}
      </section>
    )
  }

  // Aggregates from holdings (placeholder — user กรอกเองในธีม)
  const totalQty = (cur.holdings || []).reduce((s, h) => s + (Number(h.qty) || 0), 0)
  const costBasis = (cur.holdings || []).reduce((s, h) => s + (Number(h.qty) || 0) * (Number(h.avgCost) || 0), 0)
  const mvNow     = (cur.holdings || []).reduce((s, h) => s + (Number(h.qty) || 0) * (Number(h.lastPrice) || Number(h.avgCost) || 0), 0)
  const pl        = mvNow - costBasis
  const plPct     = costBasis > 0 ? (pl / costBasis) * 100 : 0

  return (
    <section
      className="relative"
      style={{ minHeight: 'calc(100vh - 60px)' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <CosmicBackdrop tone={cur.tone} />

      {/* Side nav arrows (fixed) */}
      <button
        onClick={prev}
        disabled={themes.length <= 1}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center text-[20px] transition-all hover:scale-110"
        style={{
          background: 'rgba(8,11,18,0.6)',
          border: `1px solid ${cur.tone}66`,
          color: cur.tone,
          boxShadow: `0 0 20px ${cur.tone}44, inset 0 0 10px ${cur.tone}22`,
          backdropFilter: 'blur(8px)',
        }}
        title="ธีมก่อนหน้า (←)"
      >‹</button>
      <button
        onClick={next}
        disabled={themes.length <= 1}
        className="fixed right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center text-[20px] transition-all hover:scale-110"
        style={{
          background: 'rgba(8,11,18,0.6)',
          border: `1px solid ${cur.tone}66`,
          color: cur.tone,
          boxShadow: `0 0 20px ${cur.tone}44, inset 0 0 10px ${cur.tone}22`,
          backdropFilter: 'blur(8px)',
        }}
        title="ธีมถัดไป (→)"
      >›</button>

      {/* Main stage */}
      <div className="relative z-10 px-4 lg:px-10 pt-6 max-w-[1400px] mx-auto">
        <button
          onClick={() => setOpened(false)}
          className="absolute left-4 lg:left-10 top-5 text-[12px] px-3 py-1.5 rounded-full transition-all hover:scale-105"
          style={{ color: cur.tone, border: `1px solid ${cur.tone}66`, background: 'rgba(8,11,18,0.6)' }}
          title="กลับไปหน้ารวมธีม (Esc)"
        >
          ← ธีมทั้งหมด
        </button>
        {/* Theme badge (top center) */}
        <div className="flex flex-col items-center text-center mb-3">
          <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.3em]" style={{ color: cur.tone, textShadow: `0 0 10px ${cur.tone}88` }}>
            <span>✦</span>
            <span>INVESTMENT ROOM · ธีมที่ {index + 1} / {themes.length}</span>
            <span>✦</span>
          </div>
          {/* Dots indicator */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {themes.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setIndex(i)}
                style={{
                  width: i === index ? 24 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === index ? t.tone : 'rgba(255,255,255,0.2)',
                  boxShadow: i === index ? `0 0 8px ${t.tone}` : 'none',
                  transition: 'all 300ms',
                }}
                title={t.name}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          {/* ── Center: Hero text ───────────────── */}
          <div className="flex flex-col items-center text-center px-2">
            {/* Theme icon + name (big title) */}
            <div className="text-[52px] leading-none mb-3" style={{ filter: `drop-shadow(0 0 20px ${cur.tone}aa)` }}>
              {cur.icon}
            </div>
            <h1
              className="text-[28px] sm:text-[36px] font-bold leading-[1.1] text-white mb-3"
              style={{ textShadow: `0 0 20px ${cur.tone}66` }}
            >
              {cur.name}
            </h1>
            <p className="text-[13px] text-[var(--txt-dim)] leading-relaxed max-w-md mb-4 min-h-[40px]">
              {cur.description}
            </p>
            {/* News preview */}
            {cur.news && (
              <div className="w-full max-w-md mb-3 rounded-lg p-3 text-left text-[11.5px] leading-relaxed" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${cur.tone}22` }}>
                <div className="text-[9.5px] uppercase tracking-wider mb-1" style={{ color: cur.tone }}>📰 ข่าวอัพเดต</div>
                <div className="text-[var(--txt-dim)] max-h-[60px] overflow-y-auto">{cur.news}</div>
              </div>
            )}

          </div>
        </div>

        {/* Stage platform (rectangular glowing bar at bottom) */}
        <div className="relative mt-12 mb-10 pointer-events-none" style={{ perspective: '600px' }}>
          <div
            style={{
              height: 50,
              width: '80%',
              margin: '0 auto',
              transform: 'rotateX(60deg)',
              background: `linear-gradient(90deg, transparent 0%, ${cur.tone}44 20%, ${cur.tone}88 50%, ${cur.tone}44 80%, transparent 100%)`,
              borderTop: `2px solid ${cur.tone}`,
              boxShadow: `0 -20px 40px ${cur.tone}55, 0 0 60px ${cur.tone}66`,
              filter: 'blur(0.5px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 0, right: 0,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${cur.tone}, transparent)`,
              boxShadow: `0 0 20px ${cur.tone}`,
            }}
          />
        </div>

        {/* Bottom action bar */}
        <div className="pb-10 flex items-center justify-center gap-2 flex-wrap">
          <button onClick={deleteCur} className="btn text-[11px]" style={{ color: '#ff8aa0' }}>
            🗑 ลบธีมนี้
          </button>
        </div>
      </div>

      {/* Modals */}
      {editMode === 'avatar' && <AvatarEditor avatar={avatar} onChange={setAvatar} onClose={() => setEditMode(null)} />}
      {editMode === 'create' && <CreateThemeModal onClose={() => setEditMode(null)} onCreate={createTheme} />}
      {editMode === 'theme' && (
        <ThemeSettingsModal
          theme={cur}
          onClose={() => setEditMode(null)}
          onUpdate={updateCur}
        />
      )}
    </section>
  )
}

// ─── การ์ดธีม (หน้ารวม) ───────────────────────────────────────────────────
function ThemeCard({ theme, onClick, onEdit }) {
  const tone = theme.tone || '#7bd1ff'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="group relative cursor-pointer rounded-2xl p-6 text-center flex flex-col items-center justify-start transition-all duration-300 hover:-translate-y-1"
      style={{
        minHeight: 200,
        background: 'linear-gradient(145deg, rgba(10,16,28,0.92) 0%, rgba(5,10,20,0.88) 100%)',
        border: `1px solid ${tone}66`,
        boxShadow: `0 0 0 1px ${tone}22, 0 0 24px ${tone}33, inset 0 0 40px ${tone}0d, 0 20px 40px rgba(0,0,0,0.5)`,
        backdropFilter: 'blur(4px)',
      }}
    >
      <CornerAccent tone={tone} pos="tl" />
      <CornerAccent tone={tone} pos="tr" />
      <CornerAccent tone={tone} pos="bl" />
      <CornerAccent tone={tone} pos="br" />
      {onEdit && <button
        onClick={(e) => { e.stopPropagation(); onEdit() }}
        className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-[14px] transition-all hover:scale-110"
        style={{ color: tone, border: `1px solid ${tone}55`, background: 'rgba(8,11,18,0.6)' }}
        title="แก้ไขชื่อและคำอธิบายธีม"
      >✎</button>}
      <div
        className="text-[44px] leading-none mb-3 transition-transform duration-300 group-hover:scale-110"
        style={{ filter: `drop-shadow(0 0 16px ${tone}aa)` }}
      >
        {theme.icon}
      </div>
      <div className="text-[20px] font-bold text-white mb-2 truncate max-w-full" style={{ textShadow: `0 0 14px ${tone}66` }}>
        {theme.name}
      </div>
      {/* หลอดสัดส่วนของธีม */}
      <div className="w-full max-w-[300px] mt-2">
        <AllocBar pct={Number(theme.alloc) || 0} tone={tone} />
      </div>
    </div>
  )
}

// ─── ปุ่มกลมลอย (เมนูมุมขวาล่าง) ────────────────────────────────────────────
function FabButton({ tone, label, title, active, big, onClick, children }) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span
          className="text-[11.5px] px-2 py-1 rounded-md whitespace-nowrap"
          style={{ background: 'rgba(8,11,18,0.85)', color: tone, border: `1px solid ${tone}44` }}
        >
          {label}
        </span>
      )}
      <button
        onClick={onClick}
        className={`w-14 h-14 rounded-full flex items-center justify-center leading-none transition-all hover:scale-110 ${big ? 'text-[26px]' : 'text-[22px]'}`}
        style={{
          background: active ? tone : 'rgba(8,11,18,0.75)',
          border: `1px solid ${tone}88`,
          color: active ? '#0a0e18' : tone,
          boxShadow: `0 0 20px ${tone}55, inset 0 0 10px ${tone}22`,
          backdropFilter: 'blur(8px)',
        }}
        title={title || label}
      >
        {children}
      </button>
    </div>
  )
}

// ─── สถานะการบันทึก Supabase ────────────────────────────────────────────────
// ─── กล่องตัวเลขพอร์ต (มุมขวาบน) ────────────────────────────────────────────
function PlText({ n }) {
  const v = Number(n) || 0
  return <span className="font-mono num-tabular" style={{ color: v >= 0 ? '#34e07a' : '#ff4d6d' }}>{fmtSigned(v)}</span>
}

function PortfolioStat({ label, value, sub, tone, color, footer }) {
  return (
    <div
      className="rounded-xl px-4 py-2 min-w-[220px] text-right"
      style={{ background: 'rgba(8,11,18,0.7)', border: `1px solid ${tone}55`, boxShadow: `0 0 16px ${tone}22` }}
    >
      <div className="text-[10.5px] text-[var(--txt-faint)]">{label}</div>
      <div className="flex items-baseline justify-end gap-2">
        <span className="text-[20px] font-semibold font-mono num-tabular" style={{ color: color || '#fff' }}>{value}</span>
        {sub && <span className="text-[12px] font-mono num-tabular" style={{ color: color || 'var(--txt-dim)' }}>{sub}</span>}
      </div>
      {footer && (
        <div className="mt-1 pt-1 border-t border-white/5 flex flex-col items-end gap-0.5 text-[11px] text-[var(--txt-dim)]">
          {footer}
        </div>
      )}
    </div>
  )
}

function SyncNotice({ status, saveState }) {
  if (status === 'synced') {
    // บันทึกปกติไม่ต้องแสดงอะไร — แสดงเฉพาะตอนบันทึกไม่สำเร็จ
    if (saveState !== 'error') return null
    return <div className="text-center text-[11px] -mt-4 mb-6" style={{ color: '#ff8aa0' }}>⚠ บันทึกลง Supabase ไม่สำเร็จ</div>
  }
  const msg = status === 'error'
    ? '⚠ โหลดจาก Supabase ไม่สำเร็จ — ตอนนี้ใช้ข้อมูลในเครื่องนี้ (ลองรีเฟรช)'
    : '⚠ ยังไม่ได้สร้างตาราง investment_room ใน Supabase — ข้อมูลเก็บแค่ในเครื่องนี้ (รันไฟล์ supabase/investment_room.sql ใน SQL Editor)'
  return (
    <div className="max-w-[720px] mx-auto -mt-4 mb-6 rounded-lg px-3 py-2 text-center text-[11.5px]"
      style={{ background: 'rgba(247,201,72,0.08)', border: '1px solid rgba(247,201,72,0.35)', color: '#f7c948' }}>
      {msg}
    </div>
  )
}

// ─── หลอดสัดส่วน ────────────────────────────────────────────────────────────
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10
const fmtPct = (n) => `${round1(n).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`

function AllocBar({ label, pct, tone }) {
  const w = Math.max(0, Math.min(100, Number(pct) || 0))
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-[var(--txt-dim)]">{label || 'สัดส่วน'}</span>
        <span className="font-mono font-semibold" style={{ color: tone }}>{fmtPct(w)}</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${w}%`, background: `linear-gradient(90deg, ${tone}99, ${tone})`, boxShadow: `0 0 10px ${tone}88` }}
        />
      </div>
    </div>
  )
}

// ─── หน้าต่างปรับสัดส่วน (รวมต้อง = 100%, เงินสดนับด้วย) ────────────────────
function AllocationModal({ themes, cash, onClose, onSave }) {
  const CASH = '__cash__'
  const [draft, setDraft] = useState(() => {
    const d = { [CASH]: round1(cash) }
    themes.forEach((t) => { d[t.id] = round1(t.alloc) })
    return d
  })
  const rows = [
    ...themes.map((t) => ({ id: t.id, icon: t.icon, name: t.name, tone: t.tone || '#7bd1ff' })),
    { id: CASH, icon: '💵', name: 'เงินสด', tone: '#9fb3c8' },
  ]
  const total = round1(Object.values(draft).reduce((s, v) => s + (Number(v) || 0), 0))
  const remaining = round1(100 - total)
  const ok = Math.abs(remaining) < 0.05

  // ตั้งค่าแถวหนึ่ง — เพิ่มได้ไม่เกินส่วนที่เหลือ (ถ้าอยากเพิ่มมากกว่านั้น ต้องลดตัวอื่นก่อน)
  function setRow(id, v) {
    setDraft((d) => {
      const others = Object.entries(d).reduce((s, [k, x]) => (k === id ? s : s + (Number(x) || 0)), 0)
      const max = round1(100 - others)
      const val = round1(Math.max(0, Math.min(max, Number(v) || 0)))
      return { ...d, [id]: val }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[16px] font-semibold">ปรับสัดส่วน</div>
          <button onClick={onClose} className="text-[var(--txt-dim)] hover:text-white text-[20px]">✕</button>
        </div>
        <div className="text-[11.5px] text-[var(--txt-dim)] mb-4">
          รวมทุกธีม + เงินสด ต้องเท่ากับ 100% · ถ้าอยากเพิ่มตัวไหน ต้องลดตัวอื่นก่อน
        </div>

        <div className="space-y-3">
          {rows.map((r) => {
            const v = Number(draft[r.id]) || 0
            const others = round1(total - v)
            const max = round1(100 - others)
            return (
              <div key={r.id}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[16px] leading-none">{r.icon}</span>
                  <span className="text-[13px] text-white truncate">{r.name}</span>
                  <span className="ml-auto text-[10.5px] text-[var(--txt-faint)]">เพิ่มได้ถึง {fmtPct(max)}</span>
                  <input
                    type="number"
                    min={0}
                    max={max}
                    step={0.5}
                    className="field w-20 text-right text-[12px] font-mono"
                    value={v}
                    onChange={(e) => setRow(r.id, e.target.value)}
                  />
                  <span className="text-[12px] text-[var(--txt-dim)]">%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={v}
                  onChange={(e) => setRow(r.id, e.target.value)}
                  className="w-full"
                  style={{ accentColor: r.tone }}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-4 rounded-lg p-3 flex items-center justify-between text-[13px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <span>รวม <b className="font-mono" style={{ color: ok ? '#34e07a' : '#f7c948' }}>{fmtPct(total)}</b></span>
          {ok
            ? <span className="text-[#34e07a]">✓ ครบ 100%</span>
            : <span className="text-[#f7c948]">ยังเหลือ {fmtPct(remaining)}</span>}
        </div>

        <div className="flex gap-2 mt-4">
          {!ok && (
            <button className="btn text-[12px]" onClick={() => setRow(CASH, (Number(draft[CASH]) || 0) + remaining)}>
              ใส่ส่วนที่เหลือเป็นเงินสด
            </button>
          )}
          <button className="btn ml-auto" onClick={onClose}>ยกเลิก</button>
          <button
            className="btn btn-primary"
            disabled={!ok}
            onClick={() => {
              const { [CASH]: c, ...byId } = draft
              onSave(byId, round1(c))
            }}
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Screen frame — holographic style ─────────────────────────────────────
// tilt: 'left' | 'center' | 'right' — ควบคุมการเอียง 3D
function Screen({ title, tone, children, tall, tilt = 'center' }) {
  const tiltDeg = tilt === 'left-big' ? 18 : tilt === 'right-big' ? -18 : tilt === 'left' ? 8 : tilt === 'right' ? -8 : 0
  const translateZ = tilt === 'center' ? 12 : 0
  const minH = tall ? 620 : 340

  return (
    <div
      style={{
        transform: `perspective(1400px) rotateY(${tiltDeg}deg) translateZ(${translateZ}px)`,
        transformStyle: 'preserve-3d',
        transition: 'transform 500ms cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <div
        className="rounded-2xl overflow-hidden flex flex-col relative"
        style={{
          background: 'linear-gradient(145deg, rgba(10,16,28,0.95) 0%, rgba(5,10,20,0.92) 100%)',
          border: `1px solid ${tone}88`,
          boxShadow: `
            0 0 0 1px ${tone}33,
            0 0 20px ${tone}55,
            0 0 60px ${tone}22,
            inset 0 0 1px ${tone}aa,
            inset 0 0 80px ${tone}0e,
            0 30px 60px rgba(0,0,0,0.6)
          `,
          minHeight: minH,
          backdropFilter: 'blur(4px)',
        }}
      >
        {/* Scanlines overlay — subtle */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `repeating-linear-gradient(0deg, transparent 0px, transparent 2px, ${tone}04 2px, ${tone}04 3px)`,
            pointerEvents: 'none',
            mixBlendMode: 'overlay',
            opacity: 0.4,
            zIndex: 1,
          }}
        />
        {/* Corner accents */}
        <CornerAccent tone={tone} pos="tl" />
        <CornerAccent tone={tone} pos="tr" />
        <CornerAccent tone={tone} pos="bl" />
        <CornerAccent tone={tone} pos="br" />

        {/* Header */}
        <div
          className="px-4 py-2.5 text-[11px] uppercase tracking-[0.2em] font-semibold flex items-center gap-2 relative"
          style={{
            background: `linear-gradient(90deg, ${tone}33 0%, ${tone}11 50%, transparent 100%)`,
            borderBottom: `1px solid ${tone}44`,
            color: tone,
            textShadow: `0 0 10px ${tone}88`,
            zIndex: 2,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: tone,
              boxShadow: `0 0 10px ${tone}, 0 0 20px ${tone}66`,
              animation: 'macro-pulse 1.8s ease-in-out infinite',
            }}
          />
          {title}
        </div>
        <style>{`
          @keyframes macro-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        `}</style>
        <div className="flex-1 p-4 overflow-auto relative" style={{ zIndex: 2 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function CornerAccent({ tone, pos }) {
  const styles = {
    tl: { top: -2, left: -2, borderTop: `2px solid ${tone}`, borderLeft: `2px solid ${tone}` },
    tr: { top: -2, right: -2, borderTop: `2px solid ${tone}`, borderRight: `2px solid ${tone}` },
    bl: { bottom: -2, left: -2, borderBottom: `2px solid ${tone}`, borderLeft: `2px solid ${tone}` },
    br: { bottom: -2, right: -2, borderBottom: `2px solid ${tone}`, borderRight: `2px solid ${tone}` },
  }
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        width: 14,
        height: 14,
        pointerEvents: 'none',
        zIndex: 3,
        filter: `drop-shadow(0 0 4px ${tone})`,
        ...styles[pos],
      }}
    />
  )
}

// ─── Holographic Platform (แท่นใต้ avatar) ───────────────────────────────
function HolographicPlatform({ tone }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'relative',
        width: 220,
        height: 100,
        marginTop: 20,
      }}
    >
      {/* Vertical light columns */}
      <svg
        width="220"
        height="100"
        viewBox="0 0 220 100"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <linearGradient id={`col-${tone.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={tone} stopOpacity="0" />
            <stop offset="100%" stopColor={tone} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {/* Rising light columns */}
        {[40, 70, 110, 150, 180].map((x, i) => (
          <rect
            key={i}
            x={x}
            y={0}
            width={2}
            height={85}
            fill={`url(#col-${tone.replace('#', '')})`}
            style={{
              animation: `col-rise-${i} ${2 + i * 0.3}s ease-in-out infinite`,
              transformOrigin: `${x}px 85px`,
            }}
          />
        ))}
      </svg>
      <style>{`
        @keyframes col-rise-0 { 0%,100% { transform: scaleY(0.6); opacity: 0.6; } 50% { transform: scaleY(1); opacity: 1; } }
        @keyframes col-rise-1 { 0%,100% { transform: scaleY(0.8); opacity: 0.5; } 50% { transform: scaleY(1); opacity: 0.9; } }
        @keyframes col-rise-2 { 0%,100% { transform: scaleY(0.7); opacity: 0.8; } 50% { transform: scaleY(1.1); opacity: 1; } }
        @keyframes col-rise-3 { 0%,100% { transform: scaleY(0.9); opacity: 0.6; } 50% { transform: scaleY(1); opacity: 0.95; } }
        @keyframes col-rise-4 { 0%,100% { transform: scaleY(0.7); opacity: 0.7; } 50% { transform: scaleY(1); opacity: 1; } }
      `}</style>
      {/* Platform disc (perspective ellipse) */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          transform: 'translateX(-50%) perspective(400px) rotateX(70deg)',
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${tone}44 0%, ${tone}22 35%, transparent 70%)`,
          boxShadow: `0 0 50px ${tone}88, 0 0 100px ${tone}44`,
        }}
      />
      {/* Ring */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: '50%',
          transform: 'translateX(-50%) perspective(400px) rotateX(70deg)',
          width: 160,
          height: 160,
          borderRadius: '50%',
          border: `2px solid ${tone}`,
          boxShadow: `0 0 20px ${tone}, inset 0 0 20px ${tone}66`,
        }}
      />
      {/* Inner smaller ring */}
      <div
        style={{
          position: 'absolute',
          bottom: 22,
          left: '50%',
          transform: 'translateX(-50%) perspective(400px) rotateX(70deg)',
          width: 110,
          height: 110,
          borderRadius: '50%',
          border: `1px solid ${tone}88`,
          boxShadow: `0 0 12px ${tone}66`,
        }}
      />
    </div>
  )
}

function StatRow({ label, value, sub, color, tone, big }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[11px] text-[var(--txt-dim)]">{label}</span>
      <div className="text-right">
        <div className={`font-mono num-tabular ${big ? 'text-[16px] font-semibold' : 'text-[13px]'}`} style={{ color: color || tone || 'white' }}>
          {value}
        </div>
        {sub && <div className="text-[10.5px] font-mono" style={{ color }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Holdings list (per-theme) ─────────────────────────────────────────────
function HoldingsList({ holdings, tone, onChange }) {
  const [adding, setAdding] = useState(false)
  const [ticker, setTicker] = useState('')
  const [qty, setQty] = useState('')
  const [avgCost, setAvgCost] = useState('')
  const [lastPrice, setLastPrice] = useState('')

  function add() {
    const t = ticker.trim().toUpperCase()
    if (!t) return
    const next = [...holdings, { ticker: t, qty: Number(qty) || 0, avgCost: Number(avgCost) || 0, lastPrice: Number(lastPrice) || 0 }]
    onChange(next)
    setTicker(''); setQty(''); setAvgCost(''); setLastPrice('')
    setAdding(false)
  }
  function remove(i) { onChange(holdings.filter((_, idx) => idx !== i)) }
  function updateField(i, k, v) {
    onChange(holdings.map((h, idx) => (idx === i ? { ...h, [k]: Number(v) || 0 } : h)))
  }

  return (
    <div className="space-y-2 text-[12px]">
      {holdings.length === 0 && !adding && (
        <div className="text-center text-[11px] text-[var(--txt-faint)] italic py-6">
          ยังไม่มีหุ้นในธีมนี้
        </div>
      )}
      {holdings.map((h, i) => {
        const mv = (h.qty || 0) * (h.lastPrice || h.avgCost || 0)
        const cost = (h.qty || 0) * (h.avgCost || 0)
        const pl = mv - cost
        const plColor = pl >= 0 ? '#34e07a' : '#ff4d6d'
        return (
          <div
            key={i}
            className="rounded-lg p-2 hairline"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: tone + '22' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono font-semibold text-[13px] text-white">{h.ticker}</span>
              <span className="ml-auto text-[11px] font-mono" style={{ color: plColor }}>
                {pl >= 0 ? '+' : ''}{fmtUsd(pl)}
              </span>
              <button onClick={() => remove(i)} className="text-[var(--txt-faint)] hover:text-[#ff8aa0] text-[10px]">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[10.5px]">
              <MiniInput label="จำนวน" value={h.qty} onChange={(v) => updateField(i, 'qty', v)} />
              <MiniInput label="ทุน" value={h.avgCost} onChange={(v) => updateField(i, 'avgCost', v)} />
              <MiniInput label="ราคา" value={h.lastPrice} onChange={(v) => updateField(i, 'lastPrice', v)} />
            </div>
          </div>
        )
      })}

      {adding ? (
        <div className="rounded-lg p-2 hairline" style={{ background: 'rgba(255,255,255,0.03)', borderColor: tone + '44' }}>
          <input
            autoFocus
            className="field w-full text-[12px] mb-2"
            placeholder="สัญลักษณ์ เช่น NVDA"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <div className="grid grid-cols-3 gap-1.5">
            <input className="field text-[11px]" placeholder="จำนวน" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
            <input className="field text-[11px]" placeholder="ทุน $" type="number" step="0.01" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} />
            <input className="field text-[11px]" placeholder="ราคา $" type="number" step="0.01" value={lastPrice} onChange={(e) => setLastPrice(e.target.value)} />
          </div>
          <div className="flex gap-1.5 mt-2">
            <button onClick={() => setAdding(false)} className="btn text-[10.5px] flex-1">ยกเลิก</button>
            <button onClick={add} className="btn btn-primary text-[10.5px] flex-1" disabled={!ticker.trim()}>เพิ่ม</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-lg py-2 text-[11px]"
          style={{ border: `1px dashed ${tone}55`, color: tone }}
        >
          + เพิ่มหุ้น
        </button>
      )}
    </div>
  )
}

// ─── Watchlist (รายการเฝ้ารอ) ──────────────────────────────────────────────
function WatchlistBlock({ watchlist, tone, onChange }) {
  const [adding, setAdding] = useState(false)
  const [ticker, setTicker] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [note, setNote] = useState('')

  function add() {
    const t = ticker.trim().toUpperCase()
    if (!t) return
    onChange([...watchlist, { ticker: t, targetPrice: Number(targetPrice) || 0, note: note.trim() }])
    setTicker(''); setTargetPrice(''); setNote(''); setAdding(false)
  }
  function remove(i) { onChange(watchlist.filter((_, idx) => idx !== i)) }
  function updateField(i, k, v) {
    onChange(watchlist.map((w, idx) => (idx === i ? { ...w, [k]: k === 'targetPrice' ? Number(v) || 0 : v } : w)))
  }

  return (
    <div className="space-y-2 text-[12px]">
      {watchlist.length === 0 && !adding && (
        <div className="text-center text-[11px] text-[var(--txt-faint)] italic py-6">
          ยังไม่มีหุ้นที่เฝ้ารอในธีมนี้
        </div>
      )}
      {watchlist.map((w, i) => (
        <div
          key={i}
          className="rounded-lg p-2 hairline"
          style={{ background: 'rgba(255,255,255,0.02)', borderColor: tone + '22' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px]">👁</span>
            <span className="font-mono font-semibold text-[13px] text-white">{w.ticker}</span>
            {w.targetPrice > 0 && (
              <span className="ml-auto text-[11px] font-mono" style={{ color: tone }}>
                เป้า ${fmtNumPlain(w.targetPrice)}
              </span>
            )}
            <button onClick={() => remove(i)} className="text-[var(--txt-faint)] hover:text-[#ff8aa0] text-[10px]">✕</button>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <input
              className="w-full bg-transparent text-[11px] text-[var(--txt-dim)] border-b border-[var(--line)] focus:border-[var(--txt-dim)] outline-none pb-0.5"
              placeholder="โน้ต / เหตุผล"
              value={w.note || ''}
              onChange={(e) => updateField(i, 'note', e.target.value)}
            />
            <input
              type="number"
              step="0.01"
              className="w-20 bg-transparent text-[11px] font-mono text-white text-right border-b border-[var(--line)] focus:border-[var(--txt-dim)] outline-none pb-0.5"
              placeholder="เป้า"
              value={w.targetPrice || ''}
              onChange={(e) => updateField(i, 'targetPrice', e.target.value)}
            />
          </div>
        </div>
      ))}

      {adding ? (
        <div className="rounded-lg p-2 hairline" style={{ background: 'rgba(255,255,255,0.03)', borderColor: tone + '44' }}>
          <input
            autoFocus
            className="field w-full text-[12px] mb-2"
            placeholder="สัญลักษณ์ เช่น NVDA"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <input className="field text-[11px]" placeholder="เป้าราคา $" type="number" step="0.01" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
            <input className="field text-[11px]" placeholder="โน้ต" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setAdding(false)} className="btn text-[10.5px] flex-1">ยกเลิก</button>
            <button onClick={add} className="btn btn-primary text-[10.5px] flex-1" disabled={!ticker.trim()}>เพิ่ม</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-lg py-2 text-[11px]"
          style={{ border: `1px dashed ${tone}55`, color: tone }}
        >
          + เพิ่มหุ้นเฝ้ารอ
        </button>
      )}
    </div>
  )
}
const fmtNumPlain = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })

function MiniInput({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="block text-[9.5px] uppercase tracking-wider text-[var(--txt-faint)]">{label}</span>
      <input
        type="number"
        step="0.01"
        className="w-full bg-transparent text-[11.5px] font-mono text-white border-b border-[var(--line)] focus:border-[var(--txt-dim)] outline-none"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

// ─── Avatar: สัตว์น่ารัก ──────────────────────────────────────────────────
function Avatar({ type = 'cat', color = '#f5c988', activeTone }) {
  // Idle sway animation
  const [sway, setSway] = useState(0)
  useEffect(() => {
    let raf
    const start = performance.now()
    const tick = (t) => {
      const elapsed = (t - start) / 1000
      setSway(Math.sin(elapsed * 1.5) * 2.5)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div style={{ width: 180, height: 220, position: 'relative' }}>
      <svg
        viewBox="0 0 200 260"
        width="180"
        height="220"
        style={{
          transform: `rotate(${sway}deg)`,
          transformOrigin: 'center bottom',
          transition: 'transform 100ms linear',
          filter: `drop-shadow(0 0 20px ${activeTone}55)`,
        }}
      >
        <AnimalBody type={type} color={color} />
      </svg>
    </div>
  )
}

function AnimalBody({ type, color }) {
  const dark = darken(color, 0.18)
  const belly = color === '#ffffff' || color === '#f5f0e8' ? darken(color, 0.06) : '#fffdf5'
  const bellyPanda = '#fffdf5'

  // Shared: cute eyes with sparkle + cheeks
  const Eyes = ({ cx1 = 82, cx2 = 118, cy = 80, r = 7 }) => (
    <g>
      <circle cx={cx1} cy={cy} r={r} fill="#1a1a2e" />
      <circle cx={cx2} cy={cy} r={r} fill="#1a1a2e" />
      <circle cx={cx1 + 2} cy={cy - 2} r={r * 0.35} fill="#fff" />
      <circle cx={cx2 + 2} cy={cy - 2} r={r * 0.35} fill="#fff" />
      <circle cx={cx1 - 1.5} cy={cy + 1.5} r={r * 0.2} fill="#fff" opacity="0.7" />
      <circle cx={cx2 - 1.5} cy={cy + 1.5} r={r * 0.2} fill="#fff" opacity="0.7" />
    </g>
  )
  const Cheeks = ({ y = 95 }) => (
    <g>
      <circle cx="68" cy={y} r="7" fill="#ff8aa0" opacity="0.5" />
      <circle cx="132" cy={y} r="7" fill="#ff8aa0" opacity="0.5" />
    </g>
  )
  // Body (round)
  const Body = ({ fill = color, bellyFill = belly }) => (
    <g>
      <ellipse cx="100" cy="190" rx="60" ry="55" fill={fill} stroke={dark} strokeWidth="2" />
      <ellipse cx="100" cy="200" rx="34" ry="30" fill={bellyFill} opacity="0.95" />
      {/* Arms */}
      <ellipse cx="46" cy="170" rx="14" ry="22" fill={fill} stroke={dark} strokeWidth="2" transform="rotate(20 46 170)" />
      <ellipse cx="154" cy="170" rx="14" ry="22" fill={fill} stroke={dark} strokeWidth="2" transform="rotate(-20 154 170)" />
      {/* Feet */}
      <ellipse cx="78" cy="238" rx="16" ry="10" fill={fill} stroke={dark} strokeWidth="2" />
      <ellipse cx="122" cy="238" rx="16" ry="10" fill={fill} stroke={dark} strokeWidth="2" />
    </g>
  )

  switch (type) {
    case 'cat':
      return (
        <g>
          <Body />
          {/* Ears */}
          <path d="M62,50 L55,15 L85,42 Z" fill={color} stroke={dark} strokeWidth="2" />
          <path d="M138,50 L145,15 L115,42 Z" fill={color} stroke={dark} strokeWidth="2" />
          <path d="M68,46 L64,25 L80,40 Z" fill="#ff8aa0" opacity="0.7" />
          <path d="M132,46 L136,25 L120,40 Z" fill="#ff8aa0" opacity="0.7" />
          {/* Head */}
          <circle cx="100" cy="80" r="48" fill={color} stroke={dark} strokeWidth="2" />
          <Eyes />
          {/* Nose + mouth */}
          <path d="M95,92 L105,92 L100,100 Z" fill="#ff8aa0" />
          <path d="M100,100 Q92,110 86,105" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M100,100 Q108,110 114,105" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Whiskers */}
          <line x1="50" y1="92" x2="72" y2="94" stroke={dark} strokeWidth="1.5" opacity="0.5" />
          <line x1="50" y1="100" x2="72" y2="100" stroke={dark} strokeWidth="1.5" opacity="0.5" />
          <line x1="150" y1="92" x2="128" y2="94" stroke={dark} strokeWidth="1.5" opacity="0.5" />
          <line x1="150" y1="100" x2="128" y2="100" stroke={dark} strokeWidth="1.5" opacity="0.5" />
          <Cheeks />
        </g>
      )

    case 'dog':
      return (
        <g>
          <Body />
          {/* Floppy ears */}
          <ellipse cx="54" cy="80" rx="18" ry="38" fill={dark} transform="rotate(-10 54 80)" />
          <ellipse cx="146" cy="80" rx="18" ry="38" fill={dark} transform="rotate(10 146 80)" />
          {/* Head */}
          <circle cx="100" cy="80" r="48" fill={color} stroke={dark} strokeWidth="2" />
          {/* Snout */}
          <ellipse cx="100" cy="98" rx="22" ry="16" fill={belly} />
          <Eyes cy="75" />
          {/* Nose */}
          <ellipse cx="100" cy="92" rx="7" ry="5" fill="#1a1a2e" />
          {/* Mouth */}
          <path d="M100,96 L100,106" stroke={dark} strokeWidth="2" />
          <path d="M100,106 Q93,113 88,108" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M100,106 Q107,113 112,108" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />
          <Cheeks />
        </g>
      )

    case 'bear':
      return (
        <g>
          <Body />
          {/* Round ears */}
          <circle cx="60" cy="40" r="15" fill={color} stroke={dark} strokeWidth="2" />
          <circle cx="140" cy="40" r="15" fill={color} stroke={dark} strokeWidth="2" />
          <circle cx="60" cy="40" r="8" fill={dark} />
          <circle cx="140" cy="40" r="8" fill={dark} />
          {/* Head */}
          <circle cx="100" cy="82" r="48" fill={color} stroke={dark} strokeWidth="2" />
          {/* Snout */}
          <ellipse cx="100" cy="100" rx="20" ry="15" fill={belly} />
          <Eyes cy="78" />
          <ellipse cx="100" cy="94" rx="6" ry="5" fill="#1a1a2e" />
          <path d="M100,99 Q93,106 89,102" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M100,99 Q107,106 111,102" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />
          <Cheeks y="102" />
        </g>
      )

    case 'fox':
      return (
        <g>
          <Body />
          {/* Pointed ears */}
          <path d="M60,45 L52,10 L82,38 Z" fill={color} stroke={dark} strokeWidth="2" />
          <path d="M140,45 L148,10 L118,38 Z" fill={color} stroke={dark} strokeWidth="2" />
          <path d="M66,40 L62,22 L78,38 Z" fill="#fff" />
          <path d="M134,40 L138,22 L122,38 Z" fill="#fff" />
          {/* Head */}
          <circle cx="100" cy="80" r="45" fill={color} stroke={dark} strokeWidth="2" />
          {/* White face mask */}
          <path d="M80,90 Q100,116 120,90 Q110,104 100,106 Q90,104 80,90 Z" fill="#fff" />
          <Eyes cy="78" />
          {/* Nose */}
          <path d="M94,100 L106,100 L100,110 Z" fill="#1a1a2e" />
          {/* Fluffy tail */}
          <ellipse cx="170" cy="180" rx="22" ry="34" fill={color} stroke={dark} strokeWidth="2" transform="rotate(-25 170 180)" />
          <ellipse cx="183" cy="155" rx="12" ry="18" fill="#fff" transform="rotate(-25 183 155)" />
          <Cheeks y="95" />
        </g>
      )

    case 'rabbit':
      return (
        <g>
          <Body />
          {/* Long ears up */}
          <ellipse cx="80" cy="20" rx="10" ry="28" fill={color} stroke={dark} strokeWidth="2" transform="rotate(-8 80 20)" />
          <ellipse cx="120" cy="20" rx="10" ry="28" fill={color} stroke={dark} strokeWidth="2" transform="rotate(8 120 20)" />
          <ellipse cx="80" cy="22" rx="5" ry="20" fill="#ff8aa0" opacity="0.6" transform="rotate(-8 80 22)" />
          <ellipse cx="120" cy="22" rx="5" ry="20" fill="#ff8aa0" opacity="0.6" transform="rotate(8 120 22)" />
          {/* Head */}
          <circle cx="100" cy="85" r="45" fill={color} stroke={dark} strokeWidth="2" />
          <Eyes cy="82" />
          {/* Nose + buck teeth */}
          <path d="M95,96 L105,96 L100,103 Z" fill="#ff8aa0" />
          <rect x="97" y="106" width="3" height="7" fill="#fff" stroke={dark} strokeWidth="0.5" />
          <rect x="100" y="106" width="3" height="7" fill="#fff" stroke={dark} strokeWidth="0.5" />
          <Cheeks y="98" />
        </g>
      )

    case 'panda':
      return (
        <g>
          <Body fill="#fff" bellyFill={bellyPanda} />
          {/* Black arm patches */}
          <ellipse cx="46" cy="170" rx="14" ry="22" fill="#1a1a2e" transform="rotate(20 46 170)" />
          <ellipse cx="154" cy="170" rx="14" ry="22" fill="#1a1a2e" transform="rotate(-20 154 170)" />
          <ellipse cx="78" cy="238" rx="16" ry="10" fill="#1a1a2e" />
          <ellipse cx="122" cy="238" rx="16" ry="10" fill="#1a1a2e" />
          {/* Round black ears */}
          <circle cx="60" cy="40" r="15" fill="#1a1a2e" />
          <circle cx="140" cy="40" r="15" fill="#1a1a2e" />
          {/* Head */}
          <circle cx="100" cy="82" r="48" fill="#fff" stroke="#1a1a2e" strokeWidth="2" />
          {/* Black eye patches */}
          <ellipse cx="82" cy="80" rx="12" ry="14" fill="#1a1a2e" transform="rotate(-15 82 80)" />
          <ellipse cx="118" cy="80" rx="12" ry="14" fill="#1a1a2e" transform="rotate(15 118 80)" />
          {/* Eyes inside patches */}
          <circle cx="82" cy="82" r="5" fill="#fff" />
          <circle cx="118" cy="82" r="5" fill="#fff" />
          <circle cx="83" cy="82" r="3" fill="#1a1a2e" />
          <circle cx="119" cy="82" r="3" fill="#1a1a2e" />
          <circle cx="84" cy="81" r="1" fill="#fff" />
          <circle cx="120" cy="81" r="1" fill="#fff" />
          {/* Nose + mouth */}
          <ellipse cx="100" cy="100" rx="6" ry="4" fill="#1a1a2e" />
          <path d="M100,104 Q94,112 90,108" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M100,104 Q106,112 110,108" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* ribbon tone shows via accessory using `color` */}
          <rect x="88" y="128" width="24" height="10" rx="2" fill={color} stroke={darken(color, 0.3)} strokeWidth="1.5" />
          <circle cx="100" cy="133" r="3" fill={darken(color, 0.3)} />
        </g>
      )

    case 'frog':
      return (
        <g>
          <Body />
          {/* Bulging eyes on top */}
          <circle cx="75" cy="40" r="20" fill={color} stroke={dark} strokeWidth="2" />
          <circle cx="125" cy="40" r="20" fill={color} stroke={dark} strokeWidth="2" />
          <circle cx="75" cy="40" r="12" fill="#fff" />
          <circle cx="125" cy="40" r="12" fill="#fff" />
          <circle cx="76" cy="42" r="7" fill="#1a1a2e" />
          <circle cx="126" cy="42" r="7" fill="#1a1a2e" />
          <circle cx="78" cy="40" r="2" fill="#fff" />
          <circle cx="128" cy="40" r="2" fill="#fff" />
          {/* Head (lower) */}
          <ellipse cx="100" cy="95" rx="50" ry="40" fill={color} stroke={dark} strokeWidth="2" />
          {/* Wide mouth */}
          <path d="M60,100 Q100,118 140,100" stroke={dark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <Cheeks y="100" />
        </g>
      )

    case 'penguin':
      return (
        <g>
          {/* Body */}
          <ellipse cx="100" cy="185" rx="58" ry="62" fill={color} stroke={dark} strokeWidth="2" />
          <ellipse cx="100" cy="195" rx="36" ry="46" fill={belly} />
          {/* Flippers */}
          <ellipse cx="42" cy="180" rx="12" ry="28" fill={color} stroke={dark} strokeWidth="2" transform="rotate(15 42 180)" />
          <ellipse cx="158" cy="180" rx="12" ry="28" fill={color} stroke={dark} strokeWidth="2" transform="rotate(-15 158 180)" />
          {/* Feet (orange) */}
          <ellipse cx="78" cy="242" rx="18" ry="8" fill="#ff9f43" />
          <ellipse cx="122" cy="242" rx="18" ry="8" fill="#ff9f43" />
          {/* Head */}
          <circle cx="100" cy="90" r="45" fill={color} stroke={dark} strokeWidth="2" />
          {/* White face */}
          <ellipse cx="100" cy="100" rx="30" ry="30" fill={belly} />
          <Eyes cy="88" r={6} />
          {/* Beak */}
          <path d="M90,108 L110,108 L100,122 Z" fill="#ff9f43" stroke={darken('#ff9f43', 0.2)} strokeWidth="1.5" />
          <Cheeks y="110" />
        </g>
      )

    case 'owl':
      return (
        <g>
          <Body />
          {/* Tuft ears */}
          <path d="M66,30 L78,5 L82,32 Z" fill={color} stroke={dark} strokeWidth="2" />
          <path d="M134,30 L122,5 L118,32 Z" fill={color} stroke={dark} strokeWidth="2" />
          {/* Head */}
          <circle cx="100" cy="82" r="50" fill={color} stroke={dark} strokeWidth="2" />
          {/* Big round eye discs */}
          <circle cx="78" cy="80" r="20" fill="#fff" stroke={dark} strokeWidth="2" />
          <circle cx="122" cy="80" r="20" fill="#fff" stroke={dark} strokeWidth="2" />
          <circle cx="78" cy="82" r="10" fill="#f7c948" />
          <circle cx="122" cy="82" r="10" fill="#f7c948" />
          <circle cx="78" cy="82" r="6" fill="#1a1a2e" />
          <circle cx="122" cy="82" r="6" fill="#1a1a2e" />
          <circle cx="80" cy="80" r="2" fill="#fff" />
          <circle cx="124" cy="80" r="2" fill="#fff" />
          {/* Beak */}
          <path d="M94,100 L106,100 L100,112 Z" fill="#ff9f43" stroke={darken('#ff9f43', 0.2)} strokeWidth="1.5" />
          {/* Feather pattern on belly */}
          <path d="M80,180 Q90,195 100,180 Q110,195 120,180" stroke={dark} strokeWidth="1.5" fill="none" opacity="0.4" />
          <path d="M80,200 Q90,215 100,200 Q110,215 120,200" stroke={dark} strokeWidth="1.5" fill="none" opacity="0.4" />
        </g>
      )

    case 'pig':
      return (
        <g>
          <Body />
          {/* Small triangle ears */}
          <path d="M66,52 L58,25 L82,45 Z" fill={color} stroke={dark} strokeWidth="2" />
          <path d="M134,52 L142,25 L118,45 Z" fill={color} stroke={dark} strokeWidth="2" />
          {/* Head */}
          <circle cx="100" cy="82" r="48" fill={color} stroke={dark} strokeWidth="2" />
          {/* Snout */}
          <ellipse cx="100" cy="98" rx="22" ry="16" fill={darken(color, 0.1)} stroke={dark} strokeWidth="2" />
          <ellipse cx="92" cy="98" rx="2.5" ry="4" fill={dark} />
          <ellipse cx="108" cy="98" rx="2.5" ry="4" fill={dark} />
          <Eyes cy="74" />
          <path d="M90,112 Q100,118 110,112" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />
          <Cheeks y="100" />
        </g>
      )

    default:
      return null
  }
}

// ─── Avatar editor (สัตว์น่ารัก) ──────────────────────────────────────────
function AvatarEditor({ avatar, onChange, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel rounded-2xl p-5 max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[16px] font-semibold">ปรับแต่งตัวละคร</div>
          <button onClick={onClose} className="text-[var(--txt-dim)] hover:text-white text-[20px]">✕</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
          {/* Preview */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <Avatar type={avatar.type} color={avatar.color} activeTone="#34e07a" />
            {avatar.name && (
              <div
                className="mt-2 text-[14px] font-semibold text-white text-center"
                style={{ textShadow: '0 0 10px rgba(52,224,122,0.5)' }}
              >
                {avatar.name}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--txt-faint)] mb-2">ชื่อ</div>
              <input
                type="text"
                className="field w-full"
                value={avatar.name || ''}
                onChange={(e) => onChange({ ...avatar, name: e.target.value })}
                placeholder="ตั้งชื่อตัวละคร เช่น เจ้าเหมียว, น้องแพนด้า"
                maxLength={30}
              />
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--txt-faint)] mb-2">สายพันธุ์</div>
              <div className="grid grid-cols-5 gap-2">
                {ANIMALS.map((a) => {
                  const active = avatar.type === a.key
                  return (
                    <button
                      key={a.key}
                      onClick={() => onChange({ ...avatar, type: a.key, color: a.defaultColor })}
                      title={a.label}
                      className="py-2 rounded-lg flex flex-col items-center gap-0.5 transition-all"
                      style={{
                        background: active ? 'rgba(52,224,122,0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${active ? 'rgba(52,224,122,0.6)' : 'var(--line)'}`,
                        boxShadow: active ? '0 0 12px rgba(52,224,122,0.3)' : 'none',
                      }}
                    >
                      <div className="text-[22px]">{a.emoji}</div>
                      <div className="text-[10px]" style={{ color: active ? '#34e07a' : 'var(--txt-dim)' }}>
                        {a.label}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--txt-faint)] mb-2">สี</div>
              <div className="flex gap-1.5 flex-wrap">
                {ANIMAL_COLORS.map((c) => {
                  const active = avatar.color === c
                  return (
                    <button
                      key={c}
                      onClick={() => onChange({ ...avatar, color: c })}
                      title={c}
                      style={{
                        width: 32, height: 32, borderRadius: 16, background: c,
                        border: active ? '3px solid #fff' : '1px solid rgba(255,255,255,0.15)',
                        boxShadow: active ? `0 0 12px ${c}` : 'none',
                        transition: 'all 200ms',
                      }}
                    />
                  )
                })}
              </div>
              <div className="mt-2 text-[10.5px] text-[var(--txt-faint)]">
                คลิกเลือกสี · ปัจจุบัน <span className="font-mono text-white">{avatar.color}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <button onClick={onClose} className="btn btn-primary">เสร็จ</button>
        </div>
      </div>
    </div>
  )
}

// ─── Theme settings modal ─────────────────────────────────────────────────
function ThemeSettingsModal({ theme, onClose, onUpdate }) {
  const fileRef = useRef(null)
  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('รูปใหญ่เกิน 2MB'); return }
    const reader = new FileReader()
    reader.onload = () => onUpdate({ image: reader.result })
    reader.readAsDataURL(file)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[16px] font-semibold">ตั้งค่าธีม</div>
          <button onClick={onClose} className="text-[var(--txt-dim)] hover:text-white text-[20px]">✕</button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--txt-faint)' }}>ชื่อธีม</span>
            <input type="text" className="field w-full" value={theme.name} onChange={(e) => onUpdate({ name: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="block">
              <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--txt-faint)' }}>ไอคอน (emoji)</span>
              <EmojiPicker value={theme.icon} tone={theme.tone} onChange={(icon) => onUpdate({ icon })} />
            </div>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--txt-faint)' }}>สีธีม</span>
              <input type="color" className="field w-full" value={theme.tone} onChange={(e) => onUpdate({ tone: e.target.value })} style={{ height: 40 }} />
            </label>
          </div>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--txt-faint)' }}>คำอธิบายธีม (subtitle)</span>
            <textarea
              rows={2}
              className="field w-full"
              value={theme.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="เช่น หุ้น AI, semiconductor, cloud ที่คาดว่าจะเติบโตสูง"
              style={{ resize: 'vertical', minHeight: 50 }}
            />
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--txt-faint)' }}>📰 ข่าวอัพเดต</span>
            <textarea
              rows={5}
              className="field w-full"
              value={theme.news || ''}
              onChange={(e) => onUpdate({ news: e.target.value })}
              placeholder="วางข่าว / ลิงก์ / highlight ของธีมนี้"
              style={{ resize: 'vertical', minHeight: 90 }}
            />
          </label>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--txt-faint)] mb-1">รูปธีม</div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <div className="flex items-center gap-2">
              <button className="btn text-[12px]" onClick={() => fileRef.current?.click()}>
                📷 {theme.image ? 'เปลี่ยนรูป' : 'อัพรูป'}
              </button>
              {theme.image && (
                <button className="btn text-[12px]" style={{ color: '#ff8aa0' }} onClick={() => onUpdate({ image: null })}>🗑 ลบรูป</button>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-5">
          <button onClick={onClose} className="btn btn-primary">เสร็จ</button>
        </div>
      </div>
    </div>
  )
}

// ─── Emoji picker ──────────────────────────────────────────────────────────
const EMOJI_GROUPS = [
  { label: 'เทค', items: ['🤖', '💻', '🖥️', '📱', '🔌', '🔋', '💾', '🧠', '🛰️', '📡', '🌐', '☁️', '🔐', '🕹️', '🎮', '🧬', '🔬', '⚙️', '🛠️', '🧲'] },
  { label: 'การเงิน', items: ['💰', '💵', '💴', '💶', '💷', '💳', '🏦', '📈', '📉', '📊', '💹', '🪙', '💎', '🏛️', '🧾', '⚖️', '🎯', '🏆', '🥇', '🔑'] },
  { label: 'อุตสาหกรรม', items: ['🏭', '🏗️', '⚡', '🛢️', '⛽', '☀️', '🌬️', '💡', '🚗', '🚙', '🚚', '🚢', '✈️', '🚀', '🚆', '🏠', '🏢', '🏨', '🛒', '📦'] },
  { label: 'สุขภาพ/อาหาร', items: ['🏥', '💊', '💉', '🩺', '🧪', '❤️', '🦷', '👓', '🍔', '🍕', '🍜', '🍣', '☕', '🍺', '🥤', '🍫', '🌾', '🥩', '🍎', '🧴'] },
  { label: 'อื่นๆ', items: ['🛡️', '🌱', '🌳', '🌍', '♻️', '💧', '🔥', '❄️', '⭐', '✨', '🌙', '🎬', '🎵', '📺', '📰', '🧭', '🐂', '🐻', '🦄', '👑'] },
]

function firstGrapheme(str) {
  if (!str) return ''
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const it = seg.segment(str)[Symbol.iterator]().next()
    return it.done ? '' : it.value.segment
  } catch { return Array.from(str)[0] || '' }
}

function EmojiPicker({ value, tone = '#7bd1ff', onChange }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(0)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="field w-full flex items-center gap-2 text-left"
        style={{ height: 40 }}
      >
        <span className="text-[22px] leading-none">{value || '✨'}</span>
        <span className="ml-auto text-[11px] text-[var(--txt-dim)]">{open ? 'ปิด ▲' : 'เลือก ▼'}</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 rounded-xl p-3"
          style={{ width: 300, background: '#0b111c', border: `1px solid ${tone}66`, boxShadow: `0 10px 30px rgba(0,0,0,0.6), 0 0 16px ${tone}33` }}
        >
          <div className="flex gap-1 flex-wrap mb-2">
            {EMOJI_GROUPS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setTab(i)}
                className="px-2 py-1 rounded-md text-[11px]"
                style={{
                  background: tab === i ? `${tone}33` : 'transparent',
                  color: tab === i ? tone : 'var(--txt-dim)',
                  border: `1px solid ${tab === i ? tone + '88' : 'transparent'}`,
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1 mb-2">
            {EMOJI_GROUPS[tab].items.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => { onChange(em); setOpen(false) }}
                className="aspect-square rounded-md flex items-center justify-center text-[20px] hover:scale-110 transition-transform"
                style={{ background: value === em ? `${tone}33` : 'rgba(255,255,255,0.03)', border: `1px solid ${value === em ? tone : 'transparent'}` }}
              >
                {em}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="field w-full text-[12px]"
            placeholder="หรือวาง emoji เอง (Windows: กด Win + .)"
            onChange={(e) => { const g = firstGrapheme(e.target.value.trim()); if (g) { onChange(g); setOpen(false) } }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Create theme modal ─────────────────────────────────────────────────
function CreateThemeModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('✨')
  const [tone, setTone] = useState('#7bd1ff')
  const PRESETS = [
    { icon: '🤖', tone: '#7bd1ff' }, { icon: '🛡️', tone: '#9bffae' }, { icon: '🏥', tone: '#ff8aa0' },
    { icon: '💊', tone: '#f7c948' }, { icon: '🍔', tone: '#ff9f43' }, { icon: '⚡', tone: '#c9a9ff' },
    { icon: '🌱', tone: '#34e07a' }, { icon: '🏦', tone: '#8be6ff' }, { icon: '🚀', tone: '#ff6a3d' },
    { icon: '💎', tone: '#a0e8ff' }, { icon: '🎮', tone: '#ff79c6' }, { icon: '✨', tone: '#f9ca24' },
  ]
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel rounded-2xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-[16px] font-semibold mb-4">สร้างธีมใหม่</div>
        <label className="block mb-3">
          <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--txt-faint)' }}>ชื่อธีม</span>
          <input type="text" className="field w-full" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="เช่น AI, Semiconductors, Clean Energy" />
        </label>
        <div className="block text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--txt-faint)' }}>ไอคอน + สี</div>
        <div className="grid grid-cols-6 gap-2 mb-4">
          {PRESETS.map((p, i) => {
            const active = icon === p.icon && tone === p.tone
            return (
              <button key={i} onClick={() => { setIcon(p.icon); setTone(p.tone) }}
                className="rounded-lg aspect-square flex items-center justify-center text-[22px] transition-all"
                style={{ background: active ? `${p.tone}22` : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? p.tone : 'var(--line)'}`, boxShadow: active ? `0 0 12px ${p.tone}66` : 'none' }}
              >
                {p.icon}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--txt-faint)' }}>เลือก emoji อื่น</span>
            <EmojiPicker value={icon} tone={tone} onChange={setIcon} />
          </div>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--txt-faint)' }}>สีธีม</span>
            <input type="color" className="field w-full" value={tone} onChange={(e) => setTone(e.target.value)} style={{ height: 40 }} />
          </label>
        </div>
        <div className="flex gap-2">
          <button className="btn flex-1" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary flex-1" onClick={() => onCreate(name, icon, tone)} disabled={!name.trim()}>สร้าง</button>
        </div>
      </div>
    </div>
  )
}

// ─── Cosmic backdrop — bright vertical light rays (FutureSkill-style) ─────
function CosmicBackdrop({ tone = '#7bd1ff' }) {
  const toneId = tone.replace('#', '')
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        background: `
          radial-gradient(ellipse at 50% 100%, ${tone}22 0%, transparent 60%),
          radial-gradient(ellipse at 20% 50%, ${tone}18 0%, transparent 55%),
          radial-gradient(ellipse at 80% 50%, ${tone}18 0%, transparent 55%),
          radial-gradient(ellipse at 50% 0%, ${tone}11 0%, transparent 50%),
          linear-gradient(180deg, #050810 0%, #0a0f1a 100%)
        `,
      }}
    >
      {/* Bright vertical rays */}
      <svg viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id={`ray-main-${toneId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={tone} stopOpacity="0" />
            <stop offset="40%" stopColor={tone} stopOpacity="0.4" />
            <stop offset="100%" stopColor={tone} stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id={`ray-soft-${toneId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={tone} stopOpacity="0" />
            <stop offset="100%" stopColor={tone} stopOpacity="0.25" />
          </linearGradient>
          <radialGradient id={`floor-glow-${toneId}`} cx="50%" cy="100%" r="80%">
            <stop offset="0%" stopColor={tone} stopOpacity="0.4" />
            <stop offset="60%" stopColor={tone} stopOpacity="0.05" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Dense vertical light beams */}
        {Array.from({ length: 24 }).map((_, i) => {
          const x = 50 + i * 48 + Math.sin(i * 1.3) * 10
          const w = 2 + (i % 3) * 1.5
          const main = i % 4 === 0
          return (
            <rect
              key={i}
              x={x}
              y={0}
              width={w}
              height={900}
              fill={`url(#ray-${main ? 'main' : 'soft'}-${toneId})`}
              opacity={main ? 0.9 : 0.5}
            />
          )
        })}

        {/* Floor glow at bottom */}
        <rect x="0" y="0" width="1200" height="900" fill={`url(#floor-glow-${toneId})`} />
      </svg>

      {/* Stars */}
      <div
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(1.5px 1.5px at 15% 20%, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 70% 40%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 30% 65%, rgba(255,255,255,0.5), transparent), radial-gradient(1.5px 1.5px at 85% 15%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 55% 80%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 10% 85%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 92% 70%, rgba(255,255,255,0.5), transparent)',
          opacity: 0.8,
        }}
      />
    </div>
  )
}

// ─── Utilities ────────────────────────────────────────────────────────────
function darken(hex, amt) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const d = (v) => Math.max(0, Math.round(v * (1 - amt)))
  return `rgb(${d(r)}, ${d(g)}, ${d(b)})`
}
const fmtUsd = (n) => {
  const v = Number(n || 0)
  return (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const fmtSigned = (n) => (Number(n) >= 0 ? '+' : '') + fmtUsd(n)
const fmtSignedPct = (n) => (Number(n) >= 0 ? '+' : '') + Number(n || 0).toFixed(2) + '%'
const fmtNum = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })
