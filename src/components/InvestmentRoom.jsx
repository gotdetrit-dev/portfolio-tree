// ─────────────────────────────────────────────────────────────────────────────
// InvestmentRoom.jsx — ห้องลงทุน
// Landing page สไตล์ futuristic — hero + grid ธีมหุ้น (sector/custom)
// แต่ละธีมสามารถอัพรูป + ใส่หุ้นที่ติดตามได้
// MVP: เก็บใน localStorage (ย้ายไป Supabase ภายหลังถ้า user ต้องการ)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'

const LS_KEY = 'investment_room_themes_v1'

// ธีมแนะนำเริ่มต้น (user สามารถลบ/แก้/เพิ่มได้)
const STARTER_THEMES = [
  { id: 'ai',        name: 'AI & Technology', icon: '🤖', tone: '#7bd1ff', tickers: [] },
  { id: 'defense',   name: 'Defensive',       icon: '🛡️', tone: '#9bffae', tickers: [] },
  { id: 'hospital',  name: 'Hospital',        icon: '🏥', tone: '#ff8aa0', tickers: [] },
  { id: 'drug',      name: 'Drug / Pharma',   icon: '💊', tone: '#f7c948', tickers: [] },
  { id: 'fnb',       name: 'Food & Beverage', icon: '🍔', tone: '#ff9f43', tickers: [] },
]

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

function loadThemes() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return STARTER_THEMES.map((t) => ({ ...t, id: uid() }))
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : STARTER_THEMES.map((t) => ({ ...t, id: uid() }))
  } catch { return STARTER_THEMES.map((t) => ({ ...t, id: uid() })) }
}
function saveThemes(themes) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(themes)) } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function InvestmentRoom() {
  const [themes, setThemes] = useState(() => loadThemes())
  const [open, setOpen] = useState(null)    // theme ที่กำลังเปิด detail
  const [creating, setCreating] = useState(false)

  useEffect(() => { saveThemes(themes) }, [themes])

  const addTheme = (name, icon, tone) => {
    const t = { id: uid(), name: name.trim() || 'ธีมใหม่', icon: icon || '✨', tone: tone || '#7bd1ff', tickers: [], image: null }
    setThemes((arr) => [...arr, t])
    setCreating(false)
    setOpen(t)
  }
  const updateTheme = (id, patch) => setThemes((arr) => arr.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const deleteTheme = (id) => {
    if (!confirm('ลบธีมนี้ทิ้งถาวร? หุ้นที่เพิ่มในธีมจะหายทั้งหมด')) return
    setThemes((arr) => arr.filter((t) => t.id !== id))
    setOpen(null)
  }

  return (
    <section className="relative px-4 lg:px-10 pb-16" style={{ minHeight: '100vh' }}>
      <CosmicBackdrop />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center text-center pt-8 pb-12">
        <div className="flex items-center gap-2 mb-5 text-[10.5px] uppercase tracking-[0.3em]" style={{ color: '#7bd1ff' }}>
          <span>✦</span>
          <span>INVESTMENT ROOM</span>
          <span>✦</span>
        </div>
        <h1 className="text-[36px] sm:text-[44px] lg:text-[52px] font-bold leading-[1.1] text-white max-w-[820px]">
          จัดกลุ่มหุ้น<span style={{ color: '#34e07a', textShadow: '0 0 24px rgba(52,224,122,0.6)' }}>ตามธีม</span>
          <br />ติดตามเฉพาะที่สนใจจริงๆ
        </h1>
        <p className="text-[14px] sm:text-[15px] text-[var(--txt-dim)] mt-4 max-w-[640px] leading-relaxed">
          สร้างธีมเอง อัพรูปแทนธีม ใส่หุ้นที่กำลังศึกษาลงไป
          <br className="hidden sm:inline" />
          ไม่ต้องเก็บรวมในพอร์ตหลักให้ยุ่งเหยิง
        </p>
        <div className="flex items-center gap-3 flex-wrap justify-center mt-7">
          <button
            onClick={() => setCreating(true)}
            className="btn btn-primary px-6 py-3 text-[14px]"
            style={{
              background: 'linear-gradient(135deg, #34e07a, #3bd48a)',
              color: '#06110b',
              fontWeight: 600,
              boxShadow: '0 10px 30px rgba(52,224,122,0.25)',
            }}
          >
            + สร้างธีมใหม่
          </button>
          <div className="text-[11px] text-[var(--txt-faint)]">
            มี <span className="font-mono text-white">{themes.length}</span> ธีม ·{' '}
            <span className="font-mono text-white">{themes.reduce((s, t) => s + (t.tickers?.length || 0), 0)}</span> หุ้น
          </div>
        </div>
      </div>

      {/* ── Themes grid ─────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, var(--line-strong), transparent)' }} />
          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--txt-faint)]">ธีมของฉัน</div>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, var(--line-strong), transparent)' }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {themes.map((t) => (
            <ThemeCard key={t.id} theme={t} onClick={() => setOpen(t)} />
          ))}
          {/* + Add card */}
          <button
            onClick={() => setCreating(true)}
            className="rounded-2xl flex flex-col items-center justify-center text-center p-5 transition-all"
            style={{
              minHeight: 170,
              border: '2px dashed var(--line-strong)',
              background: 'rgba(255,255,255,0.02)',
              color: 'var(--txt-dim)',
            }}
          >
            <div className="text-[28px] mb-2 opacity-60">+</div>
            <div className="text-[12px]">สร้างธีมใหม่</div>
          </button>
        </div>
      </div>

      {/* Modals */}
      {creating && <CreateThemeModal onClose={() => setCreating(false)} onCreate={addTheme} />}
      {open && (
        <ThemeDetailModal
          theme={themes.find((t) => t.id === open.id) || open}
          onClose={() => setOpen(null)}
          onUpdate={(patch) => updateTheme(open.id, patch)}
          onDelete={() => deleteTheme(open.id)}
        />
      )}
    </section>
  )
}

// ─── Cosmic animated backdrop ───────────────────────────────────────────────
function CosmicBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(80,120,200,0.18) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(52,224,122,0.08) 0%, transparent 60%)',
      }}
    >
      {/* Light rays */}
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4 }}
      >
        <defs>
          <linearGradient id="ray1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7bd1ff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#7bd1ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ray2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34e07a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#34e07a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* diagonal rays coming down from top */}
        {[200, 380, 600, 820, 1000].map((x, i) => (
          <polygon
            key={i}
            points={`${x},0 ${x + 2},0 ${x + 180 + i * 20},800 ${x + 150 + i * 20},800`}
            fill={i % 2 ? 'url(#ray2)' : 'url(#ray1)'}
          />
        ))}
      </svg>
      {/* subtle stars */}
      <div
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,0.3), transparent), radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.3), transparent), radial-gradient(1px 1px at 85% 20%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 10% 70%, rgba(255,255,255,0.3), transparent)',
          opacity: 0.6,
        }}
      />
    </div>
  )
}

// ─── Theme card ─────────────────────────────────────────────────────────────
function ThemeCard({ theme, onClick }) {
  const hasImage = !!theme.image
  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-4 text-left transition-all hover:scale-[1.02]"
      style={{
        minHeight: 170,
        background: hasImage ? '#0a0e18' : `linear-gradient(135deg, ${theme.tone}11, rgba(255,255,255,0.02))`,
        border: `1px solid ${theme.tone}44`,
        boxShadow: `inset 0 0 40px ${theme.tone}18, 0 8px 24px rgba(0,0,0,0.3)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {hasImage && (
        <>
          <img
            src={theme.image}
            alt={theme.name}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', opacity: 0.4,
            }}
          />
          <div
            style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(180deg, transparent 40%, #0a0e18ee)`,
            }}
          />
        </>
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="text-[32px] mb-2" style={{ filter: `drop-shadow(0 0 10px ${theme.tone}88)` }}>
          {theme.icon}
        </div>
        <div className="font-semibold text-white text-[14px] leading-tight mb-1">{theme.name}</div>
        <div className="text-[10.5px] mt-2" style={{ color: theme.tone }}>
          {(theme.tickers?.length || 0)} หุ้น
        </div>
        {theme.tickers?.length > 0 && (
          <div className="text-[9.5px] font-mono text-[var(--txt-faint)] mt-1 truncate">
            {theme.tickers.slice(0, 5).join(' · ')}{theme.tickers.length > 5 ? ' · ...' : ''}
          </div>
        )}
      </div>
    </button>
  )
}

// ─── Create theme modal ─────────────────────────────────────────────────────
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
          <input
            type="text" className="field w-full" value={name} autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น AI, Semiconductors, Luxury, Clean Energy"
          />
        </label>
        <div className="block text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--txt-faint)' }}>ไอคอน + สี</div>
        <div className="grid grid-cols-6 gap-2 mb-4">
          {PRESETS.map((p, i) => {
            const active = icon === p.icon && tone === p.tone
            return (
              <button
                key={i}
                onClick={() => { setIcon(p.icon); setTone(p.tone) }}
                className="rounded-lg aspect-square flex items-center justify-center text-[22px] transition-all"
                style={{
                  background: active ? `${p.tone}22` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? p.tone : 'var(--line)'}`,
                  boxShadow: active ? `0 0 12px ${p.tone}66` : 'none',
                }}
              >
                {p.icon}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <button className="btn flex-1" onClick={onClose}>ยกเลิก</button>
          <button
            className="btn btn-primary flex-1"
            onClick={() => onCreate(name, icon, tone)}
            disabled={!name.trim()}
          >
            สร้าง
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Theme detail modal ────────────────────────────────────────────────────
function ThemeDetailModal({ theme, onClose, onUpdate, onDelete }) {
  const [newTicker, setNewTicker] = useState('')
  const fileRef = useRef(null)

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('รูปใหญ่เกิน 2MB — ลองย่อก่อน'); return }
    const reader = new FileReader()
    reader.onload = () => onUpdate({ image: reader.result })
    reader.readAsDataURL(file)
  }

  function addTicker() {
    const t = newTicker.trim().toUpperCase()
    if (!t) return
    if ((theme.tickers || []).includes(t)) { setNewTicker(''); return }
    onUpdate({ tickers: [...(theme.tickers || []), t] })
    setNewTicker('')
  }

  function removeTicker(t) {
    onUpdate({ tickers: (theme.tickers || []).filter((x) => x !== t) })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel rounded-2xl p-0 max-w-xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ borderColor: theme.tone + '55' }}>
        {/* Header with image or gradient */}
        <div
          className="px-5 pt-5 pb-4 relative"
          style={{
            background: theme.image
              ? `linear-gradient(180deg, transparent 0%, #080b12 100%), url(${theme.image})`
              : `linear-gradient(135deg, ${theme.tone}22, rgba(255,255,255,0.02))`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: theme.image ? 180 : 100,
          }}
        >
          <div className="flex items-start gap-3 relative z-10">
            <span className="text-[32px]" style={{ filter: `drop-shadow(0 0 10px ${theme.tone}88)` }}>{theme.icon}</span>
            <div className="flex-1">
              <input
                className="w-full bg-transparent text-white text-[18px] font-semibold border-b border-transparent hover:border-[var(--line)] focus:border-[var(--txt-dim)] outline-none pb-1"
                value={theme.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
              />
              <div className="text-[11px] mt-1" style={{ color: theme.tone }}>{(theme.tickers || []).length} หุ้นในธีม</div>
            </div>
            <button
              onClick={onClose}
              className="text-[var(--txt-dim)] hover:text-white"
              style={{ fontSize: 20, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Image upload */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--txt-faint)] mb-2">รูปธีม</div>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
              <button className="btn text-[12px]" onClick={() => fileRef.current?.click()}>
                📷 {theme.image ? 'เปลี่ยนรูป' : 'อัพรูปธีม'}
              </button>
              {theme.image && (
                <button className="btn text-[12px]" onClick={() => onUpdate({ image: null })} style={{ color: '#ff8aa0' }}>
                  🗑 ลบรูป
                </button>
              )}
              <div className="text-[10px] text-[var(--txt-faint)] ml-auto">ไฟล์ไม่เกิน 2MB</div>
            </div>
          </div>

          {/* Add ticker */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--txt-faint)] mb-2">เพิ่มหุ้น</div>
            <div className="flex gap-2">
              <input
                type="text"
                className="field flex-1"
                placeholder="เช่น NVDA, PLTR, QQQ"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTicker()}
              />
              <button className="btn btn-primary" onClick={addTicker} disabled={!newTicker.trim()}>+ เพิ่ม</button>
            </div>
          </div>

          {/* Tickers list */}
          {(theme.tickers || []).length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--txt-faint)] mb-2">
                หุ้นในธีม ({theme.tickers.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {theme.tickers.map((t) => (
                  <div
                    key={t}
                    className="rounded-full px-3 py-1 flex items-center gap-2 text-[12px] font-mono"
                    style={{
                      background: `${theme.tone}18`,
                      border: `1px solid ${theme.tone}66`,
                      color: '#fff',
                    }}
                  >
                    <span>{t}</span>
                    <button
                      onClick={() => removeTicker(t)}
                      className="text-[var(--txt-faint)] hover:text-[#ff8aa0]"
                      style={{ fontSize: 12 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete */}
          <div className="pt-3 border-t border-[var(--line)]">
            <button
              onClick={onDelete}
              className="btn text-[11px]"
              style={{ color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.3)' }}
            >
              🗑 ลบธีมนี้ทิ้ง
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
