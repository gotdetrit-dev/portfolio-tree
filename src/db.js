// ─────────────────────────────────────────────────────────────────────────────
// db.js — Supabase data access for Portfolio Tree.
//
// The app objects use camelCase (addPlan, realizedPL, ...); the database
// columns use snake_case. The to*/from* helpers translate between them.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient.js'
import { MODES, INITIAL_HOLDINGS, INITIAL_TRANSACTIONS, INITIAL_CASH_ACTIVITY, INITIAL_CASH } from './data.js'

export function defaultTargets() {
  const t = {}
  for (const m of Object.values(MODES)) t[m.key] = { ...m.targets }
  return t
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

const num = (v) => Number(v || 0)
const optNum = (v) => (v == null ? undefined : Number(v))

const toHoldingRow = (h, userId) => ({
  id: h.id, user_id: userId, cat: h.cat, symbol: h.symbol, name: h.name ?? '',
  qty: num(h.qty), avg: num(h.avg), price: num(h.price),
  add_plan: h.addPlan ?? [0, 0, 0], trim_plan: h.trimPlan ?? [0, 0, 0], note: h.note ?? '',
})

const fromHoldingRow = (r) => ({
  id: r.id, cat: r.cat, symbol: r.symbol, name: r.name ?? '',
  qty: num(r.qty), avg: num(r.avg), price: num(r.price),
  addPlan: r.add_plan ?? [0, 0, 0], trimPlan: r.trim_plan ?? [0, 0, 0], note: r.note ?? '',
})

const toTxnRow = (t, userId) => ({
  id: t.id, user_id: userId, date: t.date, type: t.type, symbol: t.symbol ?? null, cat: t.cat ?? null,
  qty: t.qty ?? null, price: t.price ?? null, fee: t.fee ?? 0, note: t.note ?? '', total: t.total ?? null,
  amount: t.amount ?? null, realized_pl: t.realizedPL ?? null,
  average_cost_at_sell_time: t.averageCostAtSellTime ?? null,
  gross_proceeds: t.grossProceeds ?? null, net_proceeds: t.netProceeds ?? null,
})

const fromTxnRow = (r) => ({
  id: r.id, date: r.date, type: r.type, symbol: r.symbol, cat: r.cat,
  qty: num(r.qty), price: num(r.price), fee: num(r.fee), note: r.note ?? '', total: num(r.total),
  amount: optNum(r.amount), realizedPL: optNum(r.realized_pl),
  averageCostAtSellTime: optNum(r.average_cost_at_sell_time),
  grossProceeds: optNum(r.gross_proceeds), netProceeds: optNum(r.net_proceeds),
})

const toCashRow = (c, userId) => ({
  id: c.id, user_id: userId, date: c.date, type: c.type, amount: num(c.amount), note: c.note ?? '',
})

const fromCashRow = (r) => ({
  id: r.id, date: r.date, type: r.type, amount: num(r.amount), note: r.note ?? '',
})

// ─── Settings ─────────────────────────────────────────────────────────────────

// Insert a default settings row if the user has none, then return the settings.
export async function ensureSettings(userId) {
  await supabase
    .from('portfolio_settings')
    .upsert(
      { user_id: userId, cash: 0, mode: 'cool', targets: defaultTargets() },
      { onConflict: 'user_id', ignoreDuplicates: true },
    )
  const { data, error } = await supabase
    .from('portfolio_settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return {
    cash: num(data.cash),
    mode: data.mode || 'cool',
    targets: data.targets && Object.keys(data.targets).length ? data.targets : defaultTargets(),
  }
}

export async function updateSettings(userId, patch) {
  const row = { user_id: userId, updated_at: new Date().toISOString() }
  if ('cash' in patch) row.cash = patch.cash
  if ('mode' in patch) row.mode = patch.mode
  if ('targets' in patch) row.targets = patch.targets
  const { error } = await supabase.from('portfolio_settings').upsert(row, { onConflict: 'user_id' })
  if (error) throw error
}

// ─── Load everything ──────────────────────────────────────────────────────────

export async function loadAll(userId) {
  const settings = await ensureSettings(userId)
  const [h, t, c] = await Promise.all([
    supabase.from('holdings').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('transactions').select('*').eq('user_id', userId).order('date').order('created_at'),
    supabase.from('cash_activity').select('*').eq('user_id', userId).order('date').order('created_at'),
  ])
  if (h.error) throw h.error
  if (t.error) throw t.error
  if (c.error) throw c.error
  return {
    settings,
    holdings: h.data.map(fromHoldingRow),
    transactions: t.data.map(fromTxnRow),
    cashActivity: c.data.map(fromCashRow),
  }
}

// ─── Holdings ─────────────────────────────────────────────────────────────────

export async function insertHolding(userId, holding) {
  const { error } = await supabase.from('holdings').insert(toHoldingRow(holding, userId))
  if (error) throw error
}

export async function updateHolding(holding) {
  const { id, ...rest } = toHoldingRow(holding, null)
  delete rest.user_id
  const { error } = await supabase.from('holdings').update(rest).eq('id', id)
  if (error) throw error
}

export async function deleteHolding(id) {
  const { error } = await supabase.from('holdings').delete().eq('id', id)
  if (error) throw error
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function insertTransaction(userId, txn) {
  const { error } = await supabase.from('transactions').insert(toTxnRow(txn, userId))
  if (error) throw error
}

// ─── Cash activity ────────────────────────────────────────────────────────────

export async function insertCashActivity(userId, activity) {
  const { error } = await supabase.from('cash_activity').insert(toCashRow(activity, userId))
  if (error) throw error
}

// ─── Sample data ──────────────────────────────────────────────────────────────

// One-time helper to fill an empty account with the demo portfolio.
export async function seedSampleData(userId) {
  const h = await supabase.from('holdings').insert(INITIAL_HOLDINGS.map((x) => toHoldingRow(x, userId)))
  if (h.error) throw h.error
  const t = await supabase.from('transactions').insert(INITIAL_TRANSACTIONS.map((x) => toTxnRow(x, userId)))
  if (t.error) throw t.error
  const c = await supabase.from('cash_activity').insert(INITIAL_CASH_ACTIVITY.map((x) => toCashRow(x, userId)))
  if (c.error) throw c.error
  await updateSettings(userId, { cash: INITIAL_CASH })
}
