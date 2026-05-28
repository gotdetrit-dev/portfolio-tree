// Vercel serverless function — near-realtime USD/THB rate.
//
// Runs server-side so it can reach Yahoo Finance (which blocks browser CORS),
// giving intraday rates instead of the once-a-day no-key APIs. The client calls
// this same-origin (/api/fxrate), so no CORS and no third-party network blocks.
// Falls back to a daily source if Yahoo is unavailable.

async function fromYahoo() {
  const r = await fetch(
    'https://query1.finance.yahoo.com/v8/finance/chart/THB=X?interval=1m&range=1d',
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
  )
  if (!r.ok) throw new Error('yahoo ' + r.status)
  const d = await r.json()
  const meta = d?.chart?.result?.[0]?.meta
  const rate = Number(meta?.regularMarketPrice)
  if (!(rate > 0)) throw new Error('yahoo no rate')
  return { rate, time: meta.regularMarketTime || null, source: 'yahoo' }
}

async function fromErApi() {
  const r = await fetch('https://open.er-api.com/v6/latest/USD')
  if (!r.ok) throw new Error('er-api ' + r.status)
  const d = await r.json()
  const rate = Number(d?.rates?.THB)
  if (!(rate > 0)) throw new Error('er-api no rate')
  return { rate, time: null, source: 'er-api' }
}

export default async function handler(req, res) {
  for (const fn of [fromYahoo, fromErApi]) {
    try {
      const out = await fn()
      // Edge-cache 60s so it's ~realtime without hammering the source.
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600')
      return res.status(200).json(out)
    } catch {
      /* try next */
    }
  }
  return res.status(502).json({ error: 'no rate' })
}
