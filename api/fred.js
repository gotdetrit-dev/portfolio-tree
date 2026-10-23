// Vercel serverless proxy — ดึง CSV ของ FRED series มาให้ frontend plot
// ป้องกัน CORS + cache ที่ edge 1 ชม.
//
// Usage: /api/fred?id=BAMLH0A0HYM2&cosd=2020-01-01

export default async function handler(req, res) {
  const { id, cosd, coed } = req.query || {}
  if (!id || typeof id !== 'string' || !/^[A-Z0-9]{3,32}$/.test(id)) {
    return res.status(400).json({ error: 'invalid id' })
  }
  const safe = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null)
  const sanCosd = safe(cosd)
  const sanCoed = safe(coed)

  const u = new URL('https://fred.stlouisfed.org/graph/fredgraph.csv')
  u.searchParams.set('id', id)
  if (sanCosd) u.searchParams.set('cosd', sanCosd)
  if (sanCoed) u.searchParams.set('coed', sanCoed)

  try {
    const r = await fetch(u.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Portfolio-Tree)' },
    })
    if (!r.ok) return res.status(502).json({ error: `fred ${r.status}` })
    const text = await r.text()
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.status(200).send(text)
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}
