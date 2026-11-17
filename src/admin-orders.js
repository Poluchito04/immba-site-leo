// Back office → Transactions: every marketplace order, read-only. "Monitoring does not always mean editing."
import { esc } from './util.js'
import { t } from './i18n.js'
import { toast } from './ui.js'
import { STATUS, FLOW, money, matchesOrder, stalled, ordersToCsv } from './trade.js'
import { statusPill, orderCard } from './trade-ui.js'
import { logTable } from './admin-activity.js'

const S = { q: '', status: '', abnormal: false } // filters survive re-renders
const when = (x) => new Date(x).toLocaleDateString([], { dateStyle: 'medium' })

export async function loadOrders(pane, { supabase }) {
  const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(2000)
  if (!pane.isConnected) return
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)} — did you run supabase/v6.sql?</div>`; return }
  const abn = orders.filter((o) => stalled(o))
  const done = orders.filter((o) => o.status === 'completed')
  const open = orders.filter((o) => !['completed', 'cancelled'].includes(o.status))
  const sum = (l) => l.reduce((a, o) => a + Number(o.total), 0)
  const kpi = (v, l, warn) => `<div class="kpi ${warn && v ? 'warn' : ''}"><b>${v}</b><span>${l}</span></div>`
  const repaint = () => loadOrders(pane, { supabase })
  const langHook = () => { if (pane.isConnected) repaint(); else window.removeEventListener('langchange', langHook) }
  window.removeEventListener('langchange', pane._lh); pane._lh = langHook; window.addEventListener('langchange', langHook)

  pane.innerHTML = `<div class="box"><div class="spread"><h3 style="margin:0">${t('Marketplace transactions', '市集交易')}</h3><span id="ocount" style="font-size:13px;color:var(--mut)"></span></div>
    <p style="font-size:13px;color:var(--mut);margin:6px 0 0">${t('Read-only view of every order between buyers and sellers. Administrators monitor transactions; only the buyer and the seller move an order. Completed orders are business records and can never be deleted.', '所有買賣訂單的唯讀檢視。管理員負責監看；只有買家與賣家能更動訂單。已完成的訂單屬於商業紀錄，永遠不能刪除。')}</p>
    <div class="kpis">${kpi(orders.length, t('Transactions', '交易數'))}${kpi(money(sum(done)), t('Completed value', '已完成金額'))}${kpi(open.length, t('In progress', '進行中'))}${kpi(abn.length, t('Abnormal / stalled', '異常 / 停滯'), true)}</div>
    <div class="afilters" style="grid-template-columns:2fr 1fr 1fr auto;align-items:end"><div><label>${t('Search by order ID, buyer or seller', '以訂單編號、買家或賣家搜尋')}</label><input id="oq" placeholder="#1001" value="${esc(S.q)}"></div>
      <div><label>${t('Status', '狀態')}</label><select id="os"><option value="">${t('All', '全部')}</option>${[...FLOW, 'cancelled'].map((s) => `<option value="${s}" ${S.status === s ? 'selected' : ''}>${esc(t(...STATUS[s]))}</option>`).join('')}</select></div>
      <div><label class="chk" style="margin:10px 0 0"><input type="checkbox" id="oab" ${S.abnormal ? 'checked' : ''}> ${t('Abnormal only', '只看異常')}</label></div>
      <div><button class="btn sm o" id="ocsv">${t('Download CSV', '下載 CSV')}</button></div></div>
    <div class="scroll" id="otable" style="margin-top:12px"></div></div>`

  let items = []
  const paint = () => {
    const list = orders.filter((o) => (!S.status || o.status === S.status) && (!S.abnormal || stalled(o)) && matchesOrder(o, S.q))
    pane.querySelector('#ocount').textContent = `${list.length} ${list.length === 1 ? t('order', '筆訂單') : t('orders', '筆訂單')}`
    pane.querySelector('#otable').innerHTML = list.length ? `<table><thead><tr><th>${t('Order', '訂單')}</th><th>${t('Date', '日期')}</th><th>${t('Buyer', '買家')}</th><th>${t('Seller', '賣家')}</th><th>${t('Status', '狀態')}</th><th style="text-align:right">${t('Amount', '金額')}</th><th></th></tr></thead><tbody>
      ${list.slice(0, 300).map((o) => { const st = stalled(o); return `<tr class="orow" data-id="${esc(o.id)}" tabindex="0"><td><b>#${esc(o.order_no)}</b></td><td>${esc(when(o.created_at))}</td><td>${esc(o.buyer_name)}<br><small style="color:var(--mut)">${esc(o.buyer_email || '')}</small></td><td>${esc(o.seller_name)}<br><small style="color:var(--mut)">${esc(o.seller_email || '')}</small></td><td>${statusPill(o.status)}</td><td style="text-align:right;white-space:nowrap">${money(o.total)}</td><td>${st ? `<span class="pill pending" title="${t('No movement for', '已停留')} ${st.days} ${t('days', '天')}">⚠ ${st.days}${t('d', '天')}</span>` : ''}</td></tr>` }).join('')}</tbody></table>${list.length > 300 ? `<p style="color:var(--mut);font-size:13px">${t('Showing the latest 300. Narrow the search to see others.', '僅顯示最新 300 筆，請縮小搜尋範圍。')}</p>` : ''}`
      : `<p style="color:var(--mut)">${orders.length ? t('No transaction matches these filters.', '沒有符合條件的交易。') : t('No transactions yet. Orders appear here as soon as a member checks out.', '尚無交易。會員結帳後訂單會顯示在這裡。')}</p>`
    pane.querySelectorAll('.orow').forEach((r) => { const go = () => detail(orders.find((o) => o.id === r.dataset.id)); r.onclick = go; r.onkeydown = (e) => { if (e.key === 'Enter') go() } })
    return list
  }
  const view = paint()
  void view
  pane.querySelector('#oq').oninput = (e) => { S.q = e.target.value; paint() }
  pane.querySelector('#os').onchange = (e) => { S.status = e.target.value; paint() }
  pane.querySelector('#oab').onchange = (e) => { S.abnormal = e.target.checked; paint() }
  pane.querySelector('#ocsv').onclick = async () => {
    const list = orders.filter((o) => (!S.status || o.status === S.status) && (!S.abnormal || stalled(o)) && matchesOrder(o, S.q))
    const { data } = await supabase.from('order_items').select('*').in('order_id', list.map((o) => o.id).slice(0, 500))
    items = data || []
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([ordersToCsv(list, items, 'admin')], { type: 'text/csv;charset=utf-8' })), download: `transactions-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click(); toast(`${list.length} ${t('transactions exported.', '筆交易已匯出。')}`)
  }

  async function detail(o) {
    document.getElementById('odlg')?.remove()
    const d = document.createElement('dialog'); d.id = 'odlg'; d.className = 'modal wide'
    d.innerHTML = `<button class="x" aria-label="Close">✕</button><div class="cartbody">…</div>`
    document.body.appendChild(d); d.querySelector('.x').onclick = () => d.close(); d.addEventListener('close', () => d.remove()); d.addEventListener('click', (e) => { if (e.target === d) d.close() })
    d.showModal()
    const [it, log] = await Promise.all([
      supabase.from('order_items').select('*').eq('order_id', o.id),
      supabase.from('audit_log').select('*').eq('table_name', 'orders').eq('record_id', o.id).order('created_at', { ascending: true }),
    ])
    d.querySelector('.cartbody').innerHTML = `${orderCard(o, it.data || [], { uid: null, side: 'admin' })}
      <h4 style="margin:18px 0 6px;color:var(--g)">${t('Transaction history', '交易歷程')}</h4><div class="scroll">${logTable(log.data || [], false)}</div>
      <p class="hint">${t('Read-only: administrators cannot change an order. If something looks wrong, contact the buyer and the seller.', '唯讀：管理員無法更動訂單。如有異常，請聯絡買家與賣家。')}</p>`
  }
}
