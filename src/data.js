// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Tree — data, defaults, calculations
// Structured so storage can later be swapped out for Google Sheets.
// ─────────────────────────────────────────────────────────────────────────────

export const CATS = {
  cash: { key: 'cash', name: 'น้ำ (Cash)', th: 'เงินสด / สภาพคล่อง', color: 'cash', hex: '#2dd4ff', label: 'น้ำ (Cash)' },
  core: { key: 'core', name: 'ลำต้น (Core)', th: 'สินทรัพย์หลัก ถือระยะยาว', color: 'core', hex: '#34e07a', label: 'ลำต้น (Core)' },
  stab: { key: 'stab', name: 'กิ่งก้าน (Stabilizer)', th: 'พยุงพอร์ต ลดความผันผวน', color: 'stab', hex: '#f7c948', label: 'กิ่งก้าน (Stabilizer)' },
  boost: { key: 'boost', name: 'ใบ (Booster)', th: 'เติบโตสูง เร่งผลตอบแทน แต่ความผันผวนสูง', color: 'boost', hex: '#ff4d6d', label: 'ใบ (Booster)' },
}

// Right-side card stack (top-down)
export const CAT_ORDER_TOP = ['boost', 'stab', 'core', 'cash']

// Seasonal modes — Thai metaphor
export const MODES = {
  rain: {
    key: 'rain', th: 'ฤดูฝน', en: 'ขาขึ้น', sub: 'ลดสัดส่วนน้ำ เพิ่มสินทรัพย์',
    icon: '🌧', tone: '#7bd1ff',
    targets: { cash: 10, core: 65, stab: 15, boost: 10 },
  },
  cool: {
    key: 'cool', th: 'ฤดูหนาว', en: 'สมดุล', sub: 'ถือสัดส่วนกลาง รอจังหวะ',
    icon: '❄', tone: '#cfe3ff',
    targets: { cash: 25, core: 50, stab: 15, boost: 10 },
  },
  hot: {
    key: 'hot', th: 'ฤดูร้อน', en: 'ขาลง', sub: 'เพิ่มสัดส่วนน้ำ ลดความเสี่ยง',
    icon: '☀', tone: '#ffb37a',
    targets: { cash: 35, core: 40, stab: 20, boost: 5 },
  },
}

// Mock holdings (mid-2026-ish illustrative prices)
export const INITIAL_HOLDINGS = [
  // Core
  { id: 'h-nvda', cat: 'core', symbol: 'NVDA', name: 'NVIDIA Corp.', qty: 40, avg: 108.20, price: 142.80, addPlan: [120, 110, 98], trimPlan: [160, 180, 210], note: 'Long-term AI compute compounder' },
  { id: 'h-tsm', cat: 'core', symbol: 'TSM', name: 'TSMC', qty: 60, avg: 172.40, price: 198.50, addPlan: [180, 165, 150], trimPlan: [230, 250, 280], note: 'Foundry monopoly' },
  { id: 'h-asml', cat: 'core', symbol: 'ASML', name: 'ASML Holding', qty: 8, avg: 780.00, price: 842.10, addPlan: [760, 700, 640], trimPlan: [950, 1050, 1180], note: 'EUV moat' },
  { id: 'h-msft', cat: 'core', symbol: 'MSFT', name: 'Microsoft', qty: 30, avg: 412.60, price: 458.30, addPlan: [420, 395, 360], trimPlan: [500, 540, 600], note: 'Cloud + AI flywheel' },
  { id: 'h-amzn', cat: 'core', symbol: 'AMZN', name: 'Amazon', qty: 55, avg: 182.30, price: 212.40, addPlan: [195, 180, 165], trimPlan: [240, 265, 295], note: 'AWS reaccelerating' },

  // Stabilizer
  { id: 'h-brk', cat: 'stab', symbol: 'BRK.B', name: 'Berkshire Hathaway B', qty: 25, avg: 412.00, price: 472.80, addPlan: [440, 410, 380], trimPlan: [520, 560, 610], note: 'Quality ballast' },
  { id: 'h-voo', cat: 'stab', symbol: 'VOO', name: 'Vanguard S&P 500', qty: 18, avg: 498.00, price: 572.40, addPlan: [540, 500, 460], trimPlan: [620, 660, 710], note: 'Index core' },
  { id: 'h-qqqm', cat: 'stab', symbol: 'QQQM', name: 'Invesco NASDAQ-100', qty: 32, avg: 198.00, price: 224.60, addPlan: [210, 195, 178], trimPlan: [250, 275, 300], note: 'Growth tilt' },
  { id: 'h-gld', cat: 'stab', symbol: 'GLD', name: 'SPDR Gold Shares', qty: 22, avg: 248.40, price: 271.20, addPlan: [260, 245, 225], trimPlan: [290, 315, 340], note: 'Macro hedge' },

  // Booster
  { id: 'h-pltr', cat: 'boost', symbol: 'PLTR', name: 'Palantir', qty: 80, avg: 42.10, price: 78.40, addPlan: [60, 50, 40], trimPlan: [95, 115, 140], note: 'Speculative AI ops' },
  { id: 'h-rklb', cat: 'boost', symbol: 'RKLB', name: 'Rocket Lab', qty: 200, avg: 18.20, price: 25.80, addPlan: [22, 18, 15], trimPlan: [32, 40, 50], note: 'Space launch optionality' },
  { id: 'h-ionq', cat: 'boost', symbol: 'IONQ', name: 'IonQ', qty: 120, avg: 22.30, price: 31.40, addPlan: [26, 21, 17], trimPlan: [40, 55, 75], note: 'Quantum moonshot' },
  { id: 'h-crdo', cat: 'boost', symbol: 'CRDO', name: 'Credo Technology', qty: 90, avg: 48.20, price: 76.10, addPlan: [62, 52, 42], trimPlan: [92, 115, 140], note: 'AI interconnect' },
]

export const INITIAL_CASH = 25000

export const INITIAL_TRANSACTIONS = [
  { id: 't-001', date: '2026-05-08', type: 'buy', symbol: 'NVDA', cat: 'core', qty: 10, price: 135.50, fee: 1.50, note: 'Add on dip' },
  // Seed sell: 20 × PLTR @ $82, avg cost at sell time $42.10 → realized (82 − 42.10) × 20 − 1.20 = $796.80
  { id: 't-002', date: '2026-05-12', type: 'sell', symbol: 'PLTR', cat: 'boost', qty: 20, price: 82.00, fee: 1.20, note: 'Trim L1',
    realizedPL: 796.80, averageCostAtSellTime: 42.10, grossProceeds: 1640.00, netProceeds: 1638.80 },
  { id: 't-003', date: '2026-05-15', type: 'div', symbol: 'MSFT', cat: 'core', qty: 0, price: 0, fee: 0, note: 'Dividend $52.40', amount: 52.40 },
]

export const INITIAL_CASH_ACTIVITY = [
  { id: 'c-001', date: '2026-04-30', type: 'deposit', amount: 5000, note: 'Monthly DCA top-up' },
  { id: 'c-002', date: '2026-05-15', type: 'dividend', amount: 52.40, note: 'MSFT Q2' },
  { id: 'c-003', date: '2026-05-18', type: 'interest', amount: 74.20, note: 'HYSA' },
]

// ─── Calculations ─────────────────────────────────────────────────────────────

export function holdingMV(h) { return h.qty * h.price }
export function holdingCost(h) { return h.qty * h.avg }

// Returns aggregated market values and totals by category
export function aggregate(holdings, cash, transactions = []) {
  const invested = holdings.reduce((s, h) => s + holdingMV(h), 0)
  const total = invested + cash
  const byCat = { cash, core: 0, stab: 0, boost: 0 }
  for (const h of holdings) byCat[h.cat] += holdingMV(h)
  const pct = {}
  for (const k of Object.keys(byCat)) pct[k] = total === 0 ? 0 : (byCat[k] / total) * 100
  const cost = holdings.reduce((s, h) => s + holdingCost(h), 0)
  const unrealizedPL = invested - cost
  const realizedPL = transactions.reduce((s, t) => s + (t.type === 'sell' ? t.realizedPL || 0 : 0), 0)
  const totalPL = unrealizedPL + realizedPL
  // Backwards-compat alias `pl` (still used in CategoryCard / row sort)
  const pl = unrealizedPL
  const plPct = cost === 0 ? 0 : (pl / cost) * 100
  const totalReturnPct = cost === 0 ? 0 : (totalPL / cost) * 100
  return { total, invested, cash, byCat, pct, pl, plPct, cost, unrealizedPL, realizedPL, totalPL, totalReturnPct }
}

// Returns next "add" and next "trim" plan levels based on current price
export function nextPlan(h) {
  const sortedAdd = [...(h.addPlan || [])].sort((a, b) => b - a) // higher first
  const sortedTrim = [...(h.trimPlan || [])].sort((a, b) => a - b) // lower first
  const nextAdd = sortedAdd.find((p) => h.price >= p) ?? sortedAdd[sortedAdd.length - 1]
  const nextTrim = sortedTrim.find((p) => h.price <= p) ?? sortedTrim[sortedTrim.length - 1]
  // Zone heuristic: within 3% of nearest level
  let zone = 'Hold'
  if (nextAdd && h.price <= nextAdd * 1.03) zone = 'Add Zone'
  if (nextTrim && h.price >= nextTrim * 0.97) zone = 'Trim Zone'
  // zone labels stay English internally; ZoneBadge maps to Thai
  return { nextAdd, nextTrim, zone }
}

export const fmtUsd = (n, frac = 2) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(Number(n || 0)).toLocaleString('en-US', { minimumFractionDigits: frac, maximumFractionDigits: frac })

export const fmtUsdK = (n) => {
  const a = Math.abs(n || 0)
  if (a >= 1_000_000) return (n < 0 ? '-' : '') + '$' + (a / 1_000_000).toFixed(2) + 'M'
  if (a >= 10_000) return (n < 0 ? '-' : '') + '$' + (a / 1000).toFixed(1) + 'k'
  return fmtUsd(n)
}

export const fmtPct = (n, frac = 2) => (n > 0 ? '+' : '') + Number(n || 0).toFixed(frac) + '%'
export const fmtPctPlain = (n, frac = 1) => Number(n || 0).toFixed(frac) + '%'
export const fmtQty = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })

export function uid(prefix = 'id') { return prefix + '-' + Math.random().toString(36).slice(2, 9) }
