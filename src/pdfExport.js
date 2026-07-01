// ─────────────────────────────────────────────────────────────────────────────
// pdfExport.js — build a clean printable HTML report and open the browser
// print dialog. The user saves as PDF via the native "Save as PDF" option.
// Uses browser print (not a JS PDF library) so Thai text renders perfectly
// with the same fonts as the app.
// ─────────────────────────────────────────────────────────────────────────────

const CAT_LABEL = {
  cash: 'น้ำ (Cash)',
  core: 'ลำต้น (Core)',
  stab: 'กิ่งก้าน (Stabilizer)',
  boost: 'ใบ (Booster)',
}

const fmtUsd = (n, frac = 2) => {
  const v = Number(n || 0)
  return (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: frac, maximumFractionDigits: frac,
  })
}
const fmtSigned = (n) => (Number(n) >= 0 ? '+' : '') + fmtUsd(n)
const fmtPct = (n, frac = 2) => (Number(n) > 0 ? '+' : '') + Number(n || 0).toFixed(frac) + '%'
const fmtQty = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

export function downloadPortfolioReport({ holdings, agg, targets }) {
  const w = window.open('', '_blank', 'width=980,height=760')
  if (!w) {
    alert('เบราว์เซอร์บล็อกการเปิดหน้าต่างใหม่ — โปรดอนุญาต popup สำหรับเว็บนี้')
    return
  }

  const enriched = holdings
    .map((h) => {
      const mv = (Number(h.qty) || 0) * (Number(h.price) || 0)
      const cost = (Number(h.qty) || 0) * (Number(h.avg) || 0)
      const pl = mv - cost
      const plPct = cost ? (pl / cost) * 100 : 0
      const pct = agg?.total ? (mv / agg.total) * 100 : 0
      return { ...h, mv, cost, pl, plPct, pct }
    })
    .sort((a, b) => b.mv - a.mv)

  // Rollup by category
  const catRollup = ['cash', 'core', 'stab', 'boost'].map((k) => ({
    key: k,
    label: CAT_LABEL[k],
    mv: (agg?.byCat?.[k]) || 0,
    pct: (agg?.pct?.[k]) || 0,
    target: (targets?.[k]) || 0,
  }))

  const today = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const totalTone = (agg?.totalPL || 0) >= 0 ? 'pos' : 'neg'

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>ภาพรวมพอร์ต — พอร์ตต้นไม้</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Noto Sans Thai', system-ui, sans-serif; margin: 0; padding: 28px 32px; color: #1a1a1a; }
  h1 { font-size: 22px; margin: 0 0 2px; letter-spacing: -0.01em; }
  h2 { font-size: 14px; margin: 22px 0 8px; color: #444; text-transform: uppercase; letter-spacing: 0.06em; }
  .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .kpi { border: 1px solid #dcdcdc; border-radius: 8px; padding: 10px 12px; background: #fafafa; }
  .kpi .label { font-size: 9.5px; color: #666; text-transform: uppercase; letter-spacing: 0.08em; }
  .kpi .value { font-size: 16px; font-weight: 600; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }
  .kpi .value.pos { color: #128d3d; }
  .kpi .value.neg { color: #c1303a; }
  .kpi .sub-val { font-size: 10px; color: #666; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #ececec; }
  th { background: #f2f2f2; font-weight: 600; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; }
  tr:nth-child(even) td { background: #fbfbfb; }
  td.pos { color: #128d3d; }
  td.neg { color: #c1303a; }
  .cat-pill { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 10px; }
  .cat-cash { background: #dff5fb; color: #0a6b81; }
  .cat-core { background: #ddf5e5; color: #157a3a; }
  .cat-stab { background: #fdf1cc; color: #856d19; }
  .cat-boost { background: #fdd9df; color: #a01d33; }
  .print-btn { position: fixed; top: 14px; right: 16px; padding: 8px 16px; background: #34e07a; color: #fff; border: 0; border-radius: 6px; cursor: pointer; font-family: inherit; font-weight: 500; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .print-btn:hover { background: #2ac668; }
  .footer { margin-top: 20px; color: #999; font-size: 10px; }
  @media print {
    .print-btn { display: none; }
    body { padding: 12px 16px; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨 พิมพ์ / บันทึก PDF</button>

<h1>ภาพรวมพอร์ต · พอร์ตต้นไม้</h1>
<div class="sub">${esc(today)}</div>

<div class="kpis">
  <div class="kpi">
    <div class="label">มูลค่าพอร์ต</div>
    <div class="value">${fmtUsd(agg?.total, 2)}</div>
    <div class="sub-val">เงินสด ${fmtUsd(agg?.cash, 2)}</div>
  </div>
  <div class="kpi">
    <div class="label">ต้นทุน</div>
    <div class="value">${fmtUsd(agg?.costBasis, 2)}</div>
    <div class="sub-val">ลงทุน ${fmtUsd(agg?.invested, 2)}</div>
  </div>
  <div class="kpi">
    <div class="label">กำไรยังไม่รับรู้</div>
    <div class="value ${(agg?.unrealizedPL || 0) >= 0 ? 'pos' : 'neg'}">${fmtSigned(agg?.unrealizedPL || 0)}</div>
    <div class="sub-val">รับรู้แล้ว ${fmtSigned(agg?.realizedPL || 0)}</div>
  </div>
  <div class="kpi">
    <div class="label">กำไร/ขาดทุนรวม</div>
    <div class="value ${totalTone}">${fmtSigned(agg?.totalPL || 0)}</div>
    <div class="sub-val">${fmtPct(agg?.totalReturnPct || 0, 2)}</div>
  </div>
</div>

<h2>สรุปตามหมวด</h2>
<table>
  <thead>
    <tr>
      <th>หมวด</th>
      <th class="num">มูลค่า</th>
      <th class="num">สัดส่วนปัจจุบัน</th>
      <th class="num">เป้าหมาย</th>
      <th class="num">ส่วนต่าง</th>
    </tr>
  </thead>
  <tbody>
    ${catRollup.map((c) => {
      const diff = c.pct - c.target
      return `<tr>
      <td><span class="cat-pill cat-${c.key}">${esc(c.label)}</span></td>
      <td class="num">${fmtUsd(c.mv, 2)}</td>
      <td class="num">${c.pct.toFixed(2)}%</td>
      <td class="num">${c.target.toFixed(2)}%</td>
      <td class="num ${diff > 0 ? 'neg' : diff < 0 ? 'pos' : ''}">${fmtPct(diff, 2)}</td>
    </tr>`
    }).join('')}
  </tbody>
</table>

<h2>สินทรัพย์ในพอร์ต (${enriched.length} รายการ)</h2>
<table>
  <thead>
    <tr>
      <th>สินทรัพย์</th>
      <th>หมวด</th>
      <th class="num">จำนวน</th>
      <th class="num">ทุนเฉลี่ย</th>
      <th class="num">ราคาปัจจุบัน</th>
      <th class="num">ต้นทุนรวม</th>
      <th class="num">มูลค่า</th>
      <th class="num">สัดส่วน</th>
      <th class="num">กำไร/ขาดทุน</th>
      <th class="num">% กำไร</th>
    </tr>
  </thead>
  <tbody>
    ${enriched.map((r) => `<tr>
      <td><strong>${esc(r.symbol)}</strong>${r.name ? '<div style="font-size:9.5px;color:#666;margin-top:1px;">' + esc(r.name) + '</div>' : ''}</td>
      <td><span class="cat-pill cat-${esc(r.cat)}">${esc(CAT_LABEL[r.cat] || r.cat)}</span></td>
      <td class="num">${fmtQty(r.qty)}</td>
      <td class="num">${fmtUsd(r.avg, 2)}</td>
      <td class="num">${fmtUsd(r.price, 2)}</td>
      <td class="num">${fmtUsd(r.cost, 2)}</td>
      <td class="num">${fmtUsd(r.mv, 2)}</td>
      <td class="num">${r.pct.toFixed(2)}%</td>
      <td class="num ${r.pl >= 0 ? 'pos' : 'neg'}">${fmtSigned(r.pl)}</td>
      <td class="num ${r.plPct >= 0 ? 'pos' : 'neg'}">${fmtPct(r.plPct, 2)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="footer">ออกโดย พอร์ตต้นไม้ · ${esc(today)}</div>

<script>
  // Wait for the Thai font to load, then auto-open the browser's print dialog.
  document.fonts.ready.then(() => setTimeout(() => window.print(), 400));
</script>
</body>
</html>`

  w.document.open()
  w.document.write(html)
  w.document.close()
}
