// ─────────────────────────────────────────────────────────────────────────────
// watchingList.js — Watching List pure logic.
//
// Storage is in Supabase (see db.js) so the list syncs per user across
// devices. This file holds only the alert rule and the record normaliser.
// ─────────────────────────────────────────────────────────────────────────────

export function checkWatchingAlert(item) {
  if (item.currentPrice <= item.supportPrice) {
    return 'Alert'
  }
  const distance = ((item.currentPrice - item.supportPrice) / item.supportPrice) * 100
  if (distance <= 5) {
    return 'Near Support'
  }
  return 'Normal'
}

// Build a normalised watching record from raw form input.
// Pass the existing record as `base` when updating (keeps id + createdAt).
export function makeWatchingRecord(input, base) {
  const ts = new Date().toISOString()
  const rec = {
    id: base?.id || input.id || 'watch_' + Math.random().toString(36).slice(2, 9),
    ticker: (input.ticker ?? base?.ticker ?? '').trim().toUpperCase(),
    assetName: (input.assetName ?? base?.assetName ?? '').trim(),
    category: input.category ?? base?.category ?? 'Core',
    supportPrice: Number(input.supportPrice ?? base?.supportPrice) || 0,
    currentPrice: Number(input.currentPrice ?? base?.currentPrice) || 0,
    note: (input.note ?? base?.note ?? '').trim(),
    createdAt: base?.createdAt || ts,
    updatedAt: ts,
  }
  rec.alertStatus = checkWatchingAlert(rec)
  return rec
}
