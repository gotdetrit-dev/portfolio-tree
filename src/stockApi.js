// ─────────────────────────────────────────────────────────────────────────────
// stockApi.js — live stock data via Finnhub (https://finnhub.io)
//
// Free tier: 60 requests/minute, real-time US quotes + company profiles.
// The key ships in the browser bundle; a free Finnhub key is low-risk
// (worst case someone uses your request quota). To hide it fully, move
// these calls behind a serverless function later.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = import.meta.env.VITE_FINNHUB_API_KEY
const BASE = 'https://finnhub.io/api/v1'

// True only when the API key is present. Stock features stay dormant otherwise.
export const isStockApiConfigured = Boolean(KEY)

// Finnhub free tier ≈ 60 requests/minute. Use a rolling 60-second window capped
// at MAX_PER_MIN: a small batch (e.g. just the 14 holdings) fires immediately,
// and only a large burst (e.g. a big watching list) gets spread out. This is
// much faster than fixed spacing, which made every refresh slow.
const MAX_PER_MIN = 55
const WINDOW_MS = 60000
const recent = []
async function reserveSlot() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = Date.now()
    while (recent.length && recent[0] <= now - WINDOW_MS) recent.shift()
    if (recent.length < MAX_PER_MIN) {
      recent.push(now)
      return
    }
    await new Promise((r) => setTimeout(r, recent[0] + WINDOW_MS - now + 50))
  }
}

async function call(path) {
  if (!isStockApiConfigured) throw new Error('ยังไม่ได้ตั้งค่า Finnhub API key')
  await reserveSlot()
  let res
  try {
    res = await fetch(`${BASE}${path}&token=${KEY}`)
  } catch {
    throw new Error('เชื่อมต่อบริการข้อมูลหุ้นไม่ได้ — ตรวจอินเทอร์เน็ต')
  }
  if (res.status === 429) throw new Error('เรียกข้อมูลถี่เกินไป รอสักครู่แล้วลองใหม่')
  if (res.status === 401 || res.status === 403) throw new Error('Finnhub API key ไม่ถูกต้อง')
  if (!res.ok) throw new Error('ดึงข้อมูลหุ้นไม่สำเร็จ')
  return res.json()
}

// Full quote: price + day change. Finnhub /quote returns c/d/dp/pc out of the box.
// คริปโต: ใส่แบบ "BTC-USD", "ETH-USD" → ดึงราคาสดจาก Binance (ไม่ต้องใช้ key, ซื้อขาย 24 ชม.)
// (ไม่ใช้ "BTC" เฉยๆ เพราะเป็นชื่อย่อ ETF ในตลาด US)
const CRYPTO_RE = /^([A-Z0-9]{2,10})-USDT?$/
export function isCryptoSymbol(symbol) {
  return CRYPTO_RE.test((symbol || '').trim().toUpperCase())
}
async function getCryptoQuote(sym) {
  const base = sym.match(CRYPTO_RE)[1]
  let res
  try {
    res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${base}USDT`)
  } catch {
    res = null
  }
  if (res && res.ok) {
    const d = await res.json()
    const price = Number(d.lastPrice) || 0
    return {
      price,
      dayChange: Number(d.priceChange) || 0,
      dayChangePct: Number(d.priceChangePercent) || 0,
      prevClose: price - (Number(d.priceChange) || 0),
    }
  }
  // สำรอง: Finnhub (ไม่มี % รายวันสำหรับคริปโตในแพ็กฟรี)
  const d = await call(`/quote?symbol=${encodeURIComponent(`BINANCE:${base}USDT`)}`)
  if (!(Number(d.c) > 0)) throw new Error(`ไม่พบราคาเหรียญ "${base}"`)
  return { price: Number(d.c) || 0, dayChange: Number(d.d) || 0, dayChangePct: Number(d.dp) || 0, prevClose: Number(d.pc) || 0 }
}

export async function getQuoteFull(symbol) {
  const sym = (symbol || '').trim().toUpperCase()
  if (!sym) return null
  if (CRYPTO_RE.test(sym)) return getCryptoQuote(sym)
  const d = await call(`/quote?symbol=${encodeURIComponent(sym)}`)
  return {
    price: Number(d.c) || 0,
    dayChange: Number(d.d) || 0,
    dayChangePct: Number(d.dp) || 0,
    prevClose: Number(d.pc) || 0,
  }
}

// Current price for a symbol (0 if unknown). Backward-compat helper.
export async function getQuote(symbol) {
  const q = await getQuoteFull(symbol)
  return q?.price || 0
}

// Company display name for a symbol ('' if unknown).
export async function getProfile(symbol) {
  const sym = (symbol || '').trim().toUpperCase()
  if (!sym) return ''
  if (CRYPTO_RE.test(sym)) return sym.replace(/-USDT?$/, '') + ' (crypto)'
  const d = await call(`/stock/profile2?symbol=${encodeURIComponent(sym)}`)
  return (d && d.name) || ''
}

// Combined lookup used by the holding form: name + current price.
export async function lookupSymbol(symbol) {
  const sym = (symbol || '').trim().toUpperCase()
  if (!sym) return null
  const [price, name] = await Promise.all([getQuote(sym), getProfile(sym)])
  if (!price && !name) throw new Error(`ไม่พบข้อมูลหุ้น "${sym}" — ตรวจชื่อย่ออีกครั้ง`)
  return { symbol: sym, price, name }
}
