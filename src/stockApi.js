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

async function call(path) {
  if (!isStockApiConfigured) throw new Error('ยังไม่ได้ตั้งค่า Finnhub API key')
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

// Current price for a symbol (0 if unknown).
export async function getQuote(symbol) {
  const sym = (symbol || '').trim().toUpperCase()
  if (!sym) return 0
  const d = await call(`/quote?symbol=${encodeURIComponent(sym)}`)
  return Number(d.c) || 0
}

// Company display name for a symbol ('' if unknown).
export async function getProfile(symbol) {
  const sym = (symbol || '').trim().toUpperCase()
  if (!sym) return ''
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
