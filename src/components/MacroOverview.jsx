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

// source: 'fred' = ใช้ FRED fredgraph.png (static image ฟรี, รองรับทุก FRED series)
//         'tv'   = TradingView mini widget (stocks/ETF/forex ที่มี widget license)
const SECTIONS = [
  {
    key: 'credit', title: 'Credit Spread', icon: '📊', tone: '#ff8aa0',
    source: 'fred',
    metrics: [
      { key: 'hy_spread',  label: 'High Yield Credit Spread (BAMLH0A0HYM2)',  fredId: 'BAMLH0A0HYM2' },
      { key: 'bbb_spread', label: 'BBB Credit Spread (BAMLC0A4CBBB)',          fredId: 'BAMLC0A4CBBB' },
      { key: 'ccc_spread', label: 'CCC & Lower Credit Spread (BAMLH0A3HYC)',   fredId: 'BAMLH0A3HYC' },
    ],
  },
  {
    key: 'inflation', title: 'CPI / Core CPI', icon: '📈', tone: '#f7c948',
    source: 'fred',
    metrics: [
      { key: 'sticky_cpi',       label: 'US Sticky CPI YoY% (STICKCPIM679SFRBATL)',       fredId: 'STICKCPIM679SFRBATL' },
      { key: 'core_sticky_mom',  label: 'Core Sticky CPI MoM% ann. (CORESTICKM159SFRBATL)', fredId: 'CORESTICKM159SFRBATL' },
    ],
  },
  {
    key: 'realyield', title: 'Real Yield', icon: '💰', tone: '#9bffae',
    source: 'fred',
    metrics: [
      { key: 'dfii10', label: '10-Year Real Yield (DFII10)', fredId: 'DFII10' },
    ],
  },
  {
    key: 'volatility', title: 'VIX / VXN', icon: '🌪', tone: '#7bd1ff',
    source: 'fred',
    metrics: [
      { key: 'vix', label: 'VIX — S&P 500 Volatility (VIXCLS)',    fredId: 'VIXCLS' },
      { key: 'vxn', label: 'VXN — NASDAQ-100 Volatility (VXNCLS)', fredId: 'VXNCLS' },
    ],
  },
  {
    key: 'overview', title: 'Overview Index And Price', icon: '🔭', tone: '#c9a9ff',
    source: 'tv',
    metrics: [
      { key: 'usdthb', label: 'USD/THB',                 tv: 'FX_IDC:USDTHB' },
      { key: 'usoil',  label: 'USOIL',                   tv: 'TVC:USOIL' },
      { key: 'gold',   label: 'GOLD',                    tv: 'TVC:GOLD' },
      { key: 'btc',    label: 'BTC',                     tv: 'BINANCE:BTCUSDT' },
      { key: 'spx',    label: 'S&P 500 (SPY ETF)',       tv: 'AMEX:SPY' },
      { key: 'ndx',    label: 'NASDAQ-100 (QQQ ETF)',    tv: 'NASDAQ:QQQ' },
      { key: 'dji',    label: 'Dow Jones (DIA ETF)',     tv: 'AMEX:DIA' },
      { key: 'rut',    label: 'Russell 2000 (IWM ETF)',  tv: 'AMEX:IWM' },
    ],
  },
]

// ─── FRED Chart ────────────────────────────────────────────────────────────
// FRED fredgraph.png endpoint = static server-rendered PNG, ฟรี, รองรับทุก series
// 5 ปีย้อนหลัง default range
function FredChart({ fredId, height = 300 }) {
  const today = new Date()
  const start = new Date(today)
  start.setFullYear(today.getFullYear() - 5)
  const cosd = start.toISOString().slice(0, 10)
  const coed = today.toISOString().slice(0, 10)
  const url = `https://fred.stlouisfed.org/graph/fredgraph.png?id=${encodeURIComponent(fredId)}&cosd=${cosd}&coed=${coed}&recession_bars=on`
  const siteUrl = `https://fred.stlouisfed.org/series/${encodeURIComponent(fredId)}`
  return (
    <a
      href={siteUrl}
      target="_blank" rel="noreferrer"
      title={`เปิด ${fredId} ใน FRED`}
      style={{ display: 'block', background: '#fff', borderRadius: 8, overflow: 'hidden' }}
    >
      <img
        src={url}
        alt={`FRED: ${fredId}`}
        loading="lazy"
        style={{ width: '100%', height, objectFit: 'contain', display: 'block' }}
      />
    </a>
  )
}

// ─── TradingView Mini Chart ──────────────────────────────────────────────────
// embed TradingView mini-symbol-overview widget (ฟรี, ไม่ต้องมี key)
// StrictMode-safe: cleanup innerHTML เมื่อ unmount/symbol เปลี่ยน
// Advanced chart ที่ overlay หลาย symbols — ใช้สำหรับ combined chart ที่ section header
function TradingViewAdvanced({ symbol, compare = [], height = 380 }) {
  const containerRef = useRef(null)
  useEffect(() => {
    if (!containerRef.current || !symbol) return
    const container = containerRef.current
    container.innerHTML = '<div class="tradingview-widget-container__widget"></div>'
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'W',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '2',                           // 2 = line
      locale: 'en',
      backgroundColor: 'rgba(0,0,0,0)',
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      compare_symbols: compare.map((s) => ({ symbol: s, position: 'SameScale' })),
      support_host: 'https://www.tradingview.com',
    })
    container.appendChild(script)
    return () => {
      try { container.innerHTML = '' } catch { /* ignore */ }
    }
  }, [symbol, compare.join('|'), height]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="tradingview-widget-container" ref={containerRef} style={{ height, minHeight: height }}>
      <div className="tradingview-widget-container__widget" style={{ height: '100%' }} />
    </div>
  )
}

// SVG ธงไทย (3:2 ratio) — แดง/ขาว/น้ำเงิน/ขาว/แดง
const THAI_FLAG_SVG = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 4' preserveAspectRatio='xMidYMid slice'>
  <rect width='6' height='4' fill='#A51931'/>
  <rect y='0.667' width='6' height='2.667' fill='#F4F5F8'/>
  <rect y='1.333' width='6' height='1.333' fill='#2D2A4A'/>
  <rect y='2.667' width='6' height='0.667' fill='#F4F5F8'/>
  <rect y='3.333' width='6' height='0.667' fill='#A51931'/>
</svg>`.replace(/\s+/g, ' ').trim()

// SVG ธงอเมริกา (19:10 ratio) — 13 stripes + blue canton พร้อม stars เป็น dots
const US_FLAG_SVG = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 190 100' preserveAspectRatio='xMidYMid slice'>
  <rect width='190' height='100' fill='#F5F5F5'/>
  <g fill='#B22234'>
    <rect y='0'    width='190' height='7.7'/>
    <rect y='15.4' width='190' height='7.7'/>
    <rect y='30.8' width='190' height='7.7'/>
    <rect y='46.2' width='190' height='7.7'/>
    <rect y='61.5' width='190' height='7.7'/>
    <rect y='76.9' width='190' height='7.7'/>
    <rect y='92.3' width='190' height='7.7'/>
  </g>
  <rect width='76' height='53.8' fill='#3C3B6E'/>
  <g fill='#F5F5F5'>
    ${(() => {
      const dots = []
      // 9 rows of alternating 6/5 stars ≈ 50 stars
      for (let r = 0; r < 9; r++) {
        const y = 4.8 + r * 5.4
        const isLong = r % 2 === 0
        const n = isLong ? 6 : 5
        const xOffset = isLong ? 5.5 : 11.5
        for (let c = 0; c < n; c++) {
          const x = xOffset + c * 12
          dots.push(`<circle cx='${x.toFixed(2)}' cy='${y.toFixed(2)}' r='1.6'/>`)
        }
      }
      return dots.join('')
    })()}
  </g>
</svg>`.replace(/\s+/g, ' ').trim()

const THAI_BG = `url("data:image/svg+xml;utf8,${encodeURIComponent(THAI_FLAG_SVG)}")`
const US_BG = `url("data:image/svg+xml;utf8,${encodeURIComponent(US_FLAG_SVG)}")`

// ลูกโลก 3D หมุน — 2 หน้า: ไทย ⟷ อเมริกา (rotateY coin-flip)
function SpinningGlobe({ size = 340 }) {
  // (unused world map SVG — kept for ref) ↓↓↓
  const _unusedWorldSvg = `
<svg xmlns='http://www.w3.org/2000/svg' width='1360' height='680' viewBox='0 0 1360 680'>
  <g fill='#4ea764'>
    <!-- North America (ซ้ายบน) -->
    <path d='M80,120 Q130,80 210,90 Q290,100 320,150 Q330,200 310,250 L280,290 L240,330 Q200,350 160,340 Q120,320 100,280 Q75,230 70,180 Q75,145 80,120 Z'/>
    <!-- Alaska peninsula -->
    <path d='M30,100 Q60,85 95,100 Q100,125 75,140 Q50,135 30,120 Z'/>
    <!-- Greenland -->
    <path d='M370,70 Q420,55 465,80 Q475,120 445,145 Q400,145 375,125 Q355,95 370,70 Z'/>
    <!-- Central America -->
    <path d='M250,340 Q280,345 300,370 L310,395 Q295,415 275,410 Q245,395 230,370 Q235,345 250,340 Z'/>
    <!-- South America -->
    <path d='M310,400 Q345,395 365,430 Q380,490 365,550 L345,595 Q320,620 290,610 Q265,585 260,540 Q257,480 275,430 Q290,405 310,400 Z'/>
    <!-- Europe -->
    <path d='M620,160 Q665,145 715,160 Q745,175 740,205 Q720,230 680,235 L645,225 Q615,215 610,195 Q610,175 620,160 Z'/>
    <!-- Scandinavia -->
    <path d='M680,105 Q710,95 735,120 Q730,150 705,160 Q680,152 675,130 Z'/>
    <!-- UK/Ireland -->
    <path d='M595,180 Q610,175 618,195 Q612,215 598,215 Q585,205 595,180 Z'/>
    <!-- Africa -->
    <path d='M635,250 Q700,235 755,275 L785,320 Q800,390 780,460 L745,530 Q710,560 670,545 Q635,510 620,440 Q610,370 620,310 Q625,275 635,250 Z'/>
    <!-- Middle East / Arabia -->
    <path d='M780,270 Q825,260 855,290 L865,330 Q850,370 820,375 Q785,355 775,320 Q770,290 780,270 Z'/>
    <!-- Asia main -->
    <path d='M760,120 Q870,100 980,120 Q1070,140 1100,185 Q1110,230 1070,265 L1010,280 Q930,285 850,275 Q790,260 760,220 Q745,170 760,120 Z'/>
    <!-- Russia far east tail -->
    <path d='M1100,145 Q1150,135 1185,160 Q1180,195 1150,205 Q1115,200 1095,180 Z'/>
    <!-- India -->
    <path d='M905,300 Q945,295 965,330 L970,380 Q950,425 925,420 Q895,400 895,360 Q895,325 905,300 Z'/>
    <!-- Southeast Asia -->
    <path d='M1000,320 Q1035,315 1055,340 Q1050,380 1025,385 Q995,370 995,345 Z'/>
    <!-- Indonesia (archipelago) -->
    <path d='M1010,410 Q1070,400 1115,420 L1115,445 Q1070,460 1020,450 Q1000,435 1010,410 Z'/>
    <path d='M1120,420 Q1150,418 1160,435 Q1150,450 1130,448 Q1115,440 1120,420 Z'/>
    <!-- Japan -->
    <path d='M1160,195 Q1175,190 1182,210 Q1178,230 1168,230 Q1155,215 1160,195 Z'/>
    <!-- Australia -->
    <path d='M1070,490 Q1160,480 1225,510 L1245,540 Q1230,580 1180,590 Q1120,590 1080,575 Q1055,550 1060,520 Q1060,500 1070,490 Z'/>
    <!-- New Zealand -->
    <path d='M1245,575 Q1260,570 1268,590 Q1262,610 1250,608 Q1240,595 1245,575 Z'/>
    <!-- Antarctica strip bottom -->
    <path d='M40,645 Q400,635 800,640 Q1150,635 1320,650 Q1320,675 800,678 Q360,676 40,678 Z' opacity='0.65'/>
  </g>
</svg>`.replace(/\s+/g, ' ').trim()
  void _unusedWorldSvg // mark used

  // Face สองด้าน: ไทย = front (0°), อเมริกา = back (180°)
  // หมุนรอบ Y-axis ต่อเนื่อง → เห็นสลับไปมา เหมือนเหรียญหมุน
  const face = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    boxShadow: `
      inset -${size * 0.13}px -${size * 0.14}px ${size * 0.28}px rgba(0,0,0,0.55),
      inset ${size * 0.07}px ${size * 0.07}px ${size * 0.14}px rgba(255,255,255,0.2)
    `,
  }

  return (
    <>
      <style>{`
        @keyframes macro-coin-spin {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(360deg); }
        }
      `}</style>
      {/* Container glow + drop shadow (ไม่หมุน) */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          perspective: '1600px',
          filter: `drop-shadow(0 0 ${size * 0.1}px rgba(52,224,122,0.5)) drop-shadow(0 ${size * 0.04}px ${size * 0.1}px rgba(0,0,0,0.5))`,
        }}
      >
        {/* Rotating 3D core */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            animation: 'macro-coin-spin 7s linear infinite',
          }}
        >
          {/* หน้าธงไทย (front) */}
          <div
            style={{
              ...face,
              backgroundImage: THAI_BG,
            }}
          />
          {/* หน้าธงอเมริกา (back, rotated 180°) */}
          <div
            style={{
              ...face,
              backgroundImage: US_BG,
              transform: 'rotateY(180deg)',
            }}
          />
          {/* Overlay 3D shading (ยึดกับแกนหมุน) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at 30% 22%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 25%, transparent 55%)',
              pointerEvents: 'none',
              mixBlendMode: 'screen',
              transform: 'translateZ(1px)', // อยู่หน้าสุด
            }}
          />
        </div>
      </div>
    </>
  )
}

// Ticker widget — แสดงแค่ราคา + % เปลี่ยนแปลง ไม่มีกราฟ
function TradingViewTicker({ symbol }) {
  const containerRef = useRef(null)
  useEffect(() => {
    if (!containerRef.current || !symbol) return
    const container = containerRef.current
    container.innerHTML = '<div class="tradingview-widget-container__widget"></div>'
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-single-ticker.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol,
      width: '100%',
      colorTheme: 'dark',
      isTransparent: true,
      locale: 'en',
    })
    container.appendChild(script)
    return () => { try { container.innerHTML = '' } catch { /* ignore */ } }
  }, [symbol])
  return (
    <div className="tradingview-widget-container" ref={containerRef} style={{ minHeight: 72 }}>
      <div className="tradingview-widget-container__widget" />
    </div>
  )
}

function TradingViewMini({ symbol, height = 220 }) {
  const containerRef = useRef(null)
  useEffect(() => {
    if (!containerRef.current || !symbol) return
    const container = containerRef.current
    container.innerHTML = '<div class="tradingview-widget-container__widget"></div>'
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol,
      width: '100%',
      height,
      locale: 'en',
      dateRange: '12M',
      colorTheme: 'dark',
      trendLineColor: 'rgba(52, 224, 122, 1)',
      underLineColor: 'rgba(52, 224, 122, 0.3)',
      underLineBottomColor: 'rgba(52, 224, 122, 0)',
      isTransparent: true,
      autosize: true,
      largeChartUrl: '',
    })
    container.appendChild(script)
    return () => {
      try { container.innerHTML = '' } catch { /* ignore */ }
    }
  }, [symbol, height])
  return (
    <div className="tradingview-widget-container" ref={containerRef} style={{ minHeight: height }}>
      <div className="tradingview-widget-container__widget" />
    </div>
  )
}

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
  const [openCharts, setOpenCharts] = useState(() => new Set())  // metric.key ที่ chart เปิดอยู่
  const toggleChart = (k) => setOpenCharts((s) => {
    const n = new Set(s)
    n.has(k) ? n.delete(k) : n.add(k)
    return n
  })
  const [openCombined, setOpenCombined] = useState(() => new Set()) // section.key ที่ chart รวมเปิดอยู่
  const toggleCombined = (k) => setOpenCombined((s) => {
    const n = new Set(s)
    n.has(k) ? n.delete(k) : n.add(k)
    return n
  })

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

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start max-w-[1200px]">
        {/* ── Globe (ซ้าย) ──────────────────────────────────────────── */}
        <div className="lg:w-[380px] lg:sticky lg:top-4 flex justify-center items-center" style={{ minHeight: 360 }}>
          <SpinningGlobe size={340} />
        </div>

        {/* ── Macro-Overview panel (ขวา) ────────────────────────────── */}
        <div>
          <div className="panel rounded-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-[var(--line)]">
              <div className="text-[18px] font-semibold text-white">Macro-Overview</div>
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

      {/* ── Charts sections ───────────────────────────────────────────── */}
      <div className="mt-6 space-y-4">
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
              <span className="text-[10.5px] text-[var(--txt-faint)]">
                · {section.source === 'fred' ? 'FRED Embedded Chart' : 'TradingView Widget'}
              </span>
              <span className="ml-auto text-[10.5px] text-[var(--txt-faint)]">{section.metrics.length} รายการ</span>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {section.metrics.map((m, mi) => (
                <div key={m.key} className="px-4 pt-3 pb-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[10.5px] text-[var(--txt-faint)] font-mono">{si + 1}.{mi + 1}</span>
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--txt-bright)' }}>
                      {m.label}
                    </span>
                  </div>
                  {section.source === 'fred' && m.fredId && (
                    <FredChart fredId={m.fredId} height={300} />
                  )}
                  {section.source === 'tv' && m.tv && (
                    <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)' }}>
                      <TradingViewMini symbol={m.tv} height={240} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
