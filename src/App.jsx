import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CAT_ORDER_TOP, MODES, aggregate, holdingCost, holdingMV, uid } from './data.js'
import * as db from './db.js'
import { getQuote, isStockApiConfigured } from './stockApi.js'
import WeatherOverlay from './components/WeatherOverlay.jsx'
import PortfolioTree from './components/PortfolioTree.jsx'
import CategoryCard from './components/CategoryCard.jsx'
import SummaryBar from './components/SummaryBar.jsx'
import HoldingsTable from './components/HoldingsTable.jsx'
import RebalancePanel from './components/RebalancePanel.jsx'
import CashManagement from './components/CashManagement.jsx'
import TransactionHistory from './components/TransactionHistory.jsx'
import TradeJournal from './components/TradeJournal.jsx'
import WatchingList from './components/WatchingList.jsx'
import { HoldingModal, PricePlanModal, TargetsModal, TransactionModal } from './components/Modals.jsx'
import { makeWatchingRecord } from './watchingList.js'

function defaultTargets() {
  const t = {}
  for (const m of Object.values(MODES)) t[m.key] = { ...m.targets }
  return t
}

export default function App({ user, onSignOut }) {
  // ─── State ─────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState('cool')
  const [allTargets, setAllTargets] = useState(defaultTargets)
  const [holdings, setHoldings] = useState([])
  const [cash, setCash] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [cashActivity, setCashActivity] = useState([])
  const [tradeJournal, setTradeJournal] = useState([])

  // Views, Watching List (localStorage), and toast
  const [view, setView] = useState('dashboard')
  const [watchingList, setWatchingList] = useState([])
  const [toast, setToast] = useState('')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [seeding, setSeeding] = useState(false)
  const [refreshingPrices, setRefreshingPrices] = useState(false)
  const autoRefreshedRef = useRef(false)
  const toastTimer = useRef(null)

  // Modal state
  const [txnModal, setTxnModal] = useState(null)
  const [planModal, setPlanModal] = useState(null)
  const [holdModal, setHoldModal] = useState(null)
  const [tgtModal, setTgtModal] = useState(false)

  // ─── Data loading ──────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const data = await db.loadAll(user.id)
    setHoldings(data.holdings)
    setTransactions(data.transactions)
    setCashActivity(data.cashActivity)
    setTradeJournal(data.tradeJournal || [])
    setWatchingList(data.watchingList || [])
    setCash(data.settings.cash)
    setMode(data.settings.mode)
    setAllTargets(data.settings.targets)
  }, [user.id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    refresh()
      .catch((e) => { if (!cancelled) setLoadError(e.message || String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refresh])

  // Auto-refresh live prices once, right after the initial data load.
  useEffect(() => {
    if (loading || autoRefreshedRef.current || !isStockApiConfigured) return
    autoRefreshedRef.current = true
    refreshPrices()
  }, [loading])

  function reportError(e) {
    alert('บันทึกข้อมูลไม่สำเร็จ: ' + (e?.message || e))
  }

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 4000)
  }

  // ─── Derived ───────────────────────────────────────────────────────────────
  const targets = allTargets[mode] || allTargets.cool
  const agg = useMemo(() => {
    const a = aggregate(holdings, cash, transactions, cashActivity)
    a.plByCat = { cash: { pl: 0, pct: 0 }, core: {}, stab: {}, boost: {} }
    for (const k of ['core', 'stab', 'boost']) {
      const hs = holdings.filter((h) => h.cat === k)
      const cost = hs.reduce((s, h) => s + holdingCost(h), 0)
      const mv = hs.reduce((s, h) => s + holdingMV(h), 0)
      a.plByCat[k] = { pl: mv - cost, pct: cost ? ((mv - cost) / cost) * 100 : 0 }
    }
    return a
  }, [holdings, cash, transactions, cashActivity])

  const rebalancing = useMemo(() => {
    let offCount = 0
    for (const k of ['cash', 'core', 'stab', 'boost']) {
      const diff = (agg.pct[k] || 0) - (targets[k] || 0)
      if (Math.abs(diff) > 1.5) offCount++
    }
    return { offCount, balanced: offCount === 0 }
  }, [agg, targets])

  // ─── Actions ───────────────────────────────────────────────────────────────
  async function commitTxn(t) {
    setTxnModal(null)
    const isBuy = t.type === 'buy'
    const existing = holdings.find((x) => x.symbol === t.symbol)

    let realizedPL = 0
    let averageCostAtSellTime = 0
    if (!isBuy && existing) {
      averageCostAtSellTime = existing.avg
      realizedPL = (t.price - averageCostAtSellTime) * t.qty - (t.fee || 0)
    }
    const grossProceeds = (t.price || 0) * (t.qty || 0)
    const feeAmount = t.fee || 0
    const netProceeds = isBuy ? grossProceeds + feeAmount : grossProceeds - feeAmount
    const newCash = isBuy ? cash - t.total : cash + t.total

    const txnRow = {
      id: uid('t'), date: t.date, type: t.type, symbol: t.symbol, cat: t.cat,
      qty: t.qty, price: t.price, fee: feeAmount, note: t.note, total: t.total,
      realizedPL, averageCostAtSellTime, grossProceeds, netProceeds,
    }

    // Resolve the holding change
    let nextHoldings = holdings
    let holdingOp = null
    if (isBuy) {
      if (existing) {
        const newQty = existing.qty + t.qty
        const newAvg = (existing.qty * existing.avg + t.qty * t.price) / newQty
        const updated = { ...existing, qty: newQty, avg: newAvg, price: t.price }
        nextHoldings = holdings.map((h) => (h.id === existing.id ? updated : h))
        holdingOp = { kind: 'update', holding: updated }
      } else {
        const created = {
          id: uid('h'), cat: t.cat, symbol: t.symbol, name: t.symbol, qty: t.qty,
          avg: t.price, price: t.price, addPlan: [0, 0, 0], trimPlan: [0, 0, 0], note: t.note || '',
        }
        nextHoldings = [...holdings, created]
        holdingOp = { kind: 'insert', holding: created }
      }
    } else if (existing) {
      const newQty = Math.max(0, existing.qty - t.qty)
      if (newQty === 0) {
        nextHoldings = holdings.filter((h) => h.id !== existing.id)
        holdingOp = { kind: 'delete', id: existing.id }
      } else {
        const updated = { ...existing, qty: newQty, price: t.price }
        nextHoldings = holdings.map((h) => (h.id === existing.id ? updated : h))
        holdingOp = { kind: 'update', holding: updated }
      }
    }

    // Optimistic local update
    setCash(newCash)
    setHoldings(nextHoldings)
    setTransactions((ts) => [...ts, txnRow])

    // Persist
    try {
      await db.insertTransaction(user.id, txnRow)
      if (holdingOp?.kind === 'insert') await db.insertHolding(user.id, holdingOp.holding)
      else if (holdingOp?.kind === 'update') await db.updateHolding(holdingOp.holding)
      else if (holdingOp?.kind === 'delete') await db.deleteHolding(holdingOp.id)
      await db.updateSettings(user.id, { cash: newCash })
    } catch (e) {
      reportError(e)
    }
  }

  async function commitHolding(h) {
    const exists = holdings.some((x) => x.id === h.id)
    setHoldings((hs) => (exists ? hs.map((x) => (x.id === h.id ? h : x)) : [...hs, h]))
    setHoldModal(null)
    try {
      if (exists) {
        await db.updateHolding(h)
      } else {
        await db.insertHolding(user.id, h)
        autoRemoveFromWatching(h.symbol)
      }
    } catch (e) {
      reportError(e)
    }
  }

  async function commitPlan(p) {
    const current = holdings.find((x) => x.id === planModal.id)
    if (!current) { setPlanModal(null); return }
    const updated = { ...current, addPlan: p.addPlan, trimPlan: p.trimPlan, note: p.note }
    setHoldings((hs) => hs.map((x) => (x.id === current.id ? updated : x)))
    setPlanModal(null)
    try {
      await db.updateHolding(updated)
    } catch (e) {
      reportError(e)
    }
  }

  async function commitCash(c) {
    const sign = { deposit: 1, withdraw: -1, dividend: 1, interest: 1, other: 1 }[c.type] || 1
    const newCash = cash + sign * c.amount
    setCash(newCash)
    setCashActivity((arr) => [...arr, c])
    try {
      await db.insertCashActivity(user.id, c)
      await db.updateSettings(user.id, { cash: newCash })
    } catch (e) {
      reportError(e)
    }
  }

  async function commitTradeRecord(record) {
    setTradeJournal((arr) => [record, ...arr])
    try {
      await db.insertTradeRecord(user.id, record)
    } catch (e) {
      reportError(e)
    }
  }

  async function deleteTradeRecord(id) {
    if (!confirm('ลบบันทึกนี้?')) return
    setTradeJournal((arr) => arr.filter((r) => r.id !== id))
    try {
      await db.deleteTradeRecord(id)
    } catch (e) {
      reportError(e)
    }
  }

  // ─── Watching List (synced via Supabase) ─────────────────────────────────────
  async function addWatching(input) {
    const t = (input.ticker || '').trim().toUpperCase()
    const existing = watchingList.find((w) => w.ticker.toUpperCase() === t)
    if (existing) {
      if (!confirm(`มี ${t} อยู่ใน Watching List แล้ว — อัปเดตรายการเดิมแทนไหม?`)) return
      const rec = makeWatchingRecord(input, existing)
      setWatchingList((arr) => arr.map((w) => (w.id === rec.id ? rec : w)))
      showToast(`อัปเดต ${t} ใน Watching List แล้ว`)
      try { await db.updateWatchingRow(rec) } catch (e) { reportError(e) }
    } else {
      const rec = makeWatchingRecord(input)
      setWatchingList((arr) => [...arr, rec])
      showToast(`เพิ่ม ${t} เข้า Watching List แล้ว`)
      try { await db.insertWatchingItem(user.id, rec) } catch (e) { reportError(e) }
    }
  }

  async function editWatching(id, updated) {
    const existing = watchingList.find((w) => w.id === id)
    if (!existing) return
    const rec = makeWatchingRecord(updated, existing)
    setWatchingList((arr) => arr.map((w) => (w.id === id ? rec : w)))
    try { await db.updateWatchingRow(rec) } catch (e) { reportError(e) }
  }

  async function deleteWatching(id) {
    setWatchingList((arr) => arr.filter((w) => w.id !== id))
    try { await db.deleteWatchingRow(id) } catch (e) { reportError(e) }
  }

  function markWatchingAsBought(item) {
    const catMap = { Core: 'core', Stabilizer: 'stab', Booster: 'boost' }
    setHoldModal({
      cat: catMap[item.category] || 'core',
      symbol: item.ticker,
      name: item.assetName || item.ticker,
      price: item.currentPrice || 0,
      avg: item.currentPrice || 0,
      qty: 0,
      note: item.note || '',
    })
  }

  // Remove a ticker from the Watching List after it is added to the portfolio.
  // Called only once the portfolio save has succeeded.
  async function autoRemoveFromWatching(ticker) {
    const t = (ticker || '').toUpperCase()
    if (!watchingList.some((w) => w.ticker.toUpperCase() === t)) return
    setWatchingList((arr) => arr.filter((w) => w.ticker.toUpperCase() !== t))
    showToast(`${t} ถูกเพิ่มเข้าพอร์ตแล้ว จึงลบออกจาก Watching List อัตโนมัติ`)
    try { await db.deleteWatchingByTicker(user.id, t) } catch (e) { reportError(e) }
  }

  async function deleteHolding(h) {
    if (!confirm(`ลบ ${h.symbol}? ตำแหน่งจะถูกลบออก (ไม่กระทบน้ำ)`)) return
    setHoldings((hs) => hs.filter((x) => x.id !== h.id))
    try {
      await db.deleteHolding(h.id)
    } catch (e) {
      reportError(e)
    }
  }

  async function commitTargets(t) {
    setAllTargets(t)
    setTgtModal(false)
    try {
      await db.updateSettings(user.id, { targets: t })
    } catch (e) {
      reportError(e)
    }
  }

  async function changeMode(m) {
    setMode(m)
    try {
      await db.updateSettings(user.id, { mode: m })
    } catch (e) {
      reportError(e)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      await db.seedSampleData(user.id)
      await refresh()
    } catch (e) {
      reportError(e)
    } finally {
      setSeeding(false)
    }
  }

  // Refresh the current price of every holding from the live stock API.
  async function refreshPrices() {
    if (!isStockApiConfigured || holdings.length === 0 || refreshingPrices) return
    setRefreshingPrices(true)
    try {
      const results = await Promise.all(
        holdings.map(async (h) => {
          try {
            const price = await getQuote(h.symbol)
            return price > 0 ? { ...h, price } : h
          } catch {
            return h
          }
        }),
      )
      const changed = results.filter((h, i) => h.price !== holdings[i].price)
      setHoldings(results)
      await Promise.all(changed.map((h) => db.updateHolding(h)))
    } catch (e) {
      reportError(e)
    } finally {
      setRefreshingPrices(false)
    }
  }

  function doRebalance(row, pct) {
    const usd = Math.abs(row.diffUsd) * (pct / 100)
    if (row.action === 'สมดุล') return
    if (row.key === 'cash') {
      alert('น้ำจะถูกปรับอัตโนมัติเมื่อคุณเพิ่ม/ลดหมวดอื่น กรุณาเลือก ลำต้น / กิ่งก้าน / ใบ')
      return
    }
    const inCat = holdings.filter((h) => h.cat === row.key)
    if (inCat.length === 0) return
    const target = inCat.reduce((a, b) => (holdingMV(a) > holdingMV(b) ? a : b))
    const qty = +(usd / target.price).toFixed(4)
    const type = row.action === 'ควรลด' ? 'sell' : 'buy'
    setTxnModal({
      type, symbol: target.symbol, cat: target.cat, price: target.price, qty,
      note: `ปรับสมดุลอัตโนมัติ ${pct}% เข้าใกล้เป้า${row.cat.name}`,
    })
  }

  function clickCard(catKey) {
    if (catKey === 'cash') {
      const el = document.getElementById('water-section')
      window.scrollTo({ top: el ? el.getBoundingClientRect().top + window.scrollY - 20 : 0, behavior: 'smooth' })
      return
    }
    const inCat = holdings.filter((h) => h.cat === catKey)
    if (inCat.length === 0) return
    const target = inCat.reduce((a, b) => (holdingMV(a) > holdingMV(b) ? a : b))
    const cur = agg.pct[catKey] || 0
    const tgt = targets[catKey] || 0
    const action = cur > tgt + 1.5 ? 'sell' : 'buy'
    setTxnModal({ type: action, symbol: target.symbol, cat: target.cat, price: target.price, qty: '' })
  }

  // ─── Loading / error gates ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-thai" style={{ color: 'var(--txt-dim)' }}>
        <div className="text-[13px]">กำลังโหลดข้อมูลพอร์ต…</div>
      </div>
    )
  }
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 font-thai" style={{ color: 'var(--txt)' }}>
        <div className="panel rounded-2xl p-6 max-w-[440px]">
          <div className="text-[14px] font-semibold mb-1" style={{ color: '#ff8aa0' }}>โหลดข้อมูลไม่สำเร็จ</div>
          <div className="text-[12px] text-[var(--txt-dim)] mb-3">{loadError}</div>
          <div className="text-[11px] text-[var(--txt-faint)] mb-4">
            ตรวจว่ารัน <span className="font-mono">supabase/schema.sql</span> ในโปรเจกต์ Supabase แล้ว
          </div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>ลองใหม่</button>
        </div>
      </div>
    )
  }

  const isEmpty = holdings.length === 0 && transactions.length === 0 && cashActivity.length === 0

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-[13px] font-thai" style={{ color: 'var(--txt)' }}>
      {/* Top bar */}
      <header className="px-6 lg:px-10 pt-7 pb-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center relative"
            style={{
              background: 'radial-gradient(circle at 40% 30%, rgba(52,224,122,0.4), transparent 60%)',
              border: '1px solid rgba(52,224,122,0.5)',
              boxShadow: '0 0 16px rgba(52,224,122,0.4)',
            }}
          >
            <span style={{ filter: 'drop-shadow(0 0 4px #34e07a)' }}>🌳</span>
          </div>
          <div>
            <div className="text-[18px] font-semibold tracking-tight" style={{ color: '#fff' }}>
              พอร์ต<span style={{ color: '#34e07a', textShadow: '0 0 10px rgba(52,224,122,0.55)' }}>ต้นไม้</span>
              <span className="text-[12px] font-normal text-[var(--txt-dim)]"> by หมอก๊อต</span>
            </div>
            <div className="text-[11px] text-[var(--txt-dim)] font-thai">ระบบจัดการพอร์ตลงทุน · ใช้ต้นไม้เป็นภาพแทน</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--txt-dim)] font-mono hidden sm:inline">
            {new Date().toLocaleDateString('th-TH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="text-[11px] text-[var(--txt-dim)] hidden md:inline">{user.email}</span>
          <button
            className="btn whitespace-nowrap"
            style={view === 'dashboard' ? { borderColor: 'rgba(52,224,122,0.5)', color: '#34e07a', background: 'rgba(52,224,122,0.08)' } : {}}
            onClick={() => setView('dashboard')}
          >
            แดชบอร์ด
          </button>
          <button
            className="btn whitespace-nowrap"
            style={view === 'watching' ? { borderColor: 'rgba(52,224,122,0.5)', color: '#34e07a', background: 'rgba(52,224,122,0.08)' } : {}}
            onClick={() => setView('watching')}
          >
            Watching List
          </button>
          <a
            href="https://wethaiinvest.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn whitespace-nowrap inline-flex items-center gap-1"
            title="เปิดเว็บแหล่งข่าวการลงทุน (แท็บใหม่)"
          >
            📰 แหล่งข่าว
          </a>
          <button className="btn btn-ghost whitespace-nowrap" onClick={onSignOut}>ออกจากระบบ</button>
        </div>
      </header>

      {view === 'watching' && (
        <section className="px-4 lg:px-10 mt-5">
          <WatchingList
            watchingList={watchingList}
            onAdd={addWatching}
            onEdit={editWatching}
            onDelete={deleteWatching}
            onMarkAsBought={markWatchingAsBought}
          />
        </section>
      )}

      {view === 'dashboard' && (
        <>
      {/* KPI ribbon — โหมดตลาดเลือกจาก dropdown ในกล่องเดียวกัน */}
      <div className="px-6 lg:px-10 relative" style={{ zIndex: 60 }}>
        <SummaryBar
          agg={agg}
          mode={mode}
          rebalancing={rebalancing}
          onModeChange={changeMode}
          onEditTargets={() => setTgtModal(true)}
        />
      </div>

      {/* Empty-state banner */}
      {isEmpty && (
        <div className="px-6 lg:px-10 mt-4">
          <div className="panel rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[14px] font-semibold">เริ่มต้นใช้งาน</div>
              <div className="text-[12px] text-[var(--txt-dim)]">
                พอร์ตยังว่างอยู่ — เพิ่มสินทรัพย์เองได้จากตารางด้านล่าง หรือโหลดข้อมูลตัวอย่างเพื่อทดลองใช้ก่อน
              </div>
            </div>
            <button className="btn btn-primary whitespace-nowrap" onClick={handleSeed} disabled={seeding}>
              {seeding ? 'กำลังโหลด…' : 'โหลดข้อมูลตัวอย่าง'}
            </button>
          </div>
        </div>
      )}

      {/* Hero — Tree + cards */}
      <section className="px-4 lg:px-10 mt-5">
        <div
          className="rounded-3xl p-4 lg:p-6 panel-tree"
          style={{
            background: `
              radial-gradient(60% 60% at 30% 50%, rgba(52,224,122,0.05), transparent 70%),
              radial-gradient(50% 50% at 30% 88%, rgba(45,212,255,0.05), transparent 70%),
              radial-gradient(55% 55% at 30% 18%, rgba(255,77,109,0.035), transparent 70%),
              transparent
            `,
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div className="relative" style={{ minHeight: 780 }}>
            {/* Weather overlay — left side, changes with mode */}
            <div className="absolute inset-y-0 left-0 z-10" style={{ width: 'clamp(220px, 30%, 380px)' }}>
              <WeatherOverlay mode={mode} />
            </div>
            {/* Tree — fills the entire panel width */}
            <div className="absolute inset-0 flex items-center justify-center">
              <PortfolioTree />
            </div>
            {/* Whisper text */}
            <div className="absolute left-3 top-3 text-[10px] uppercase tracking-[0.18em] text-[var(--txt-faint)] font-mono z-30">
              ◇ ติดตามสด · โหมด <span className="text-[var(--txt-dim)]">{MODES[mode].th}</span>
            </div>
            {/* Cards stack — floats on the right ABOVE the tree */}
            <div
              className="absolute top-2 bottom-2 right-2 lg:right-4 flex flex-col gap-3 z-20"
              style={{ width: 'clamp(300px, 32%, 400px)' }}
            >
              {CAT_ORDER_TOP.map((k) => (
                <div key={k} className="flex-1 min-h-0">
                  <CategoryCard catKey={k} agg={agg} targets={targets} onClick={() => clickCard(k)} fillHeight />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Holdings */}
      <section className="px-4 lg:px-10 mt-6">
        <HoldingsTable
          holdings={holdings}
          agg={agg}
          onAddTxn={(h) => setTxnModal({ type: h.type || 'buy', symbol: h.symbol, cat: h.cat, price: h.price, qty: '' })}
          onEdit={(h) => setHoldModal(h)}
          onDelete={(h) => deleteHolding(h)}
          onPlan={(h) => setPlanModal(h)}
          onAddHolding={() => setHoldModal({})}
          onRefreshPrices={isStockApiConfigured ? refreshPrices : undefined}
          refreshing={refreshingPrices}
        />
      </section>

      {/* Rebalance + Water + History */}
      <section className="px-4 lg:px-10 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <RebalancePanel targets={targets} agg={agg} onAct={doRebalance} />
          <div className="mt-6">
            <TransactionHistory transactions={transactions} />
          </div>
        </div>
        <div className="lg:col-span-5" id="water-section">
          <CashManagement cash={cash} activity={cashActivity} onAdd={commitCash} />
          <div className="mt-6">
            <TradeJournal records={tradeJournal} onAdd={commitTradeRecord} onDelete={deleteTradeRecord} />
          </div>
        </div>
      </section>
        </>
      )}

      {/* Footer note */}
      <footer className="px-6 lg:px-10 py-10 mt-6">
        <div className="text-[11px] text-[var(--txt-faint)] font-mono flex items-center gap-3 justify-between flex-wrap">
          <span>◇ ข้อมูลซิงก์กับ Supabase · บัญชี {user.email}</span>
          <span>v 0.2</span>
        </div>
      </footer>

      {/* Modals */}
      {txnModal && (
        <TransactionModal initial={txnModal} holdings={holdings} onClose={() => setTxnModal(null)} onSubmit={commitTxn} />
      )}
      {holdModal && (
        <HoldingModal initial={holdModal} onClose={() => setHoldModal(null)} onSubmit={commitHolding} />
      )}
      {planModal && (
        <PricePlanModal initial={planModal} onClose={() => setPlanModal(null)} onSubmit={commitPlan} />
      )}
      {tgtModal && (
        <TargetsModal mode={mode} allTargets={allTargets} onClose={() => setTgtModal(false)} onSubmit={commitTargets} />
      )}

      {toast && (
        <div
          className="fixed left-1/2 bottom-6 -translate-x-1/2 panel rounded-xl px-4 py-3 text-[13px] fade-in"
          style={{ zIndex: 300, boxShadow: '0 20px 50px rgba(0,0,0,0.6)', maxWidth: 'calc(100vw - 32px)' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
