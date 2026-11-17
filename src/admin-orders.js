// Back office → Transactions: every marketplace order. The administrator handles the money (confirm / reject a payment) and nothing else.
import { esc } from './util.js'
import { t } from './i18n.js'
import { toast } from './ui.js'
import { STATUS, FLOW, money, matchesOrder, stalled, ordersToCsv, platformStats } from './trade.js'
import { statusPill, orderCard, bindOrderActions, loadSettings } from './trade-ui.js'
import { logTable } from './admin-activity.js'

const S = { q: '', status: '', abnormal: false, confirm: false } // filters survive re-renders
const when = (x) => new Date(x).toLocaleDateString([], { dateStyle: 'medium' })

export async function loadOrders(pane, { supabase }) {
  const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(2000)
  if (!pane.isConnected) return
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)} — did you run supabase/v6.sql?</div>`; return }
  const { data: { session } } = await supabase.auth.getSession()
  const [{ data: me }, settings] = await Promise.all([supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle(), loadSettings(supabase)])
  const superAdmin = me?.role === 'super_admin'
  const who = { uid: session.user.id, admin: true, superAdmin, storeId: settings.demo_store_id }
  const ps = platformStats(orders)
  const abn = orders.filter((o) => stalled(o))
  const done = orders.filter((o) => o.status === 'completed')
  const open = orders.filter((o) => !['completed', 'cancelled'].includes(o.status))
  const sum = (l) => l.reduce((a, o) => a + Number(o.total), 0)
  const kpi = (v, l, warn) => `<div class="kpi ${warn && v ? 'warn' : ''}"><b>${v}</b><span>${l}</span></div>`
  const repaint = () => loadOrders(pane, { supabase })
  const langHook = () => { if (pane.isConnected) repaint(); else window.removeEventListener('langchange', langHook) }
  window.removeEventListener('langchange', pane._lh); pane._lh = langHook; window.addEventListener('langchange', langHook)

  pane.innerHTML = `<div class="box"><div class="spread"><h3 style="margin:0">${t('Marketplace transactions', '市集交易')}</h3><span id="ocount" style="font-size:13px;color:var(--mut)"></span></div>
    <p style="font-size:13px;color:var(--mut);margin:6px 0 0">${t('Every order between buyers and sellers. When a buyer presses “I have paid”, the administrator checks the money arrived and confirms it; only then does the seller prepare the order. Completed orders are business records and can never be deleted.', '所有買賣訂單。買家按「我已付款」後，由管理員確認款項入帳，賣家才會備貨。已完成的訂單屬於商業紀錄，永遠不能刪除。')}</p>
    <div class="kpis">${kpi(ps.count, t('Number of transactions', '交易筆數'))}${kpi(money(ps.amount), t('Total transaction amount', '交易總金額'))}${kpi(money(ps.fees), t('Total platform fees', '平台手續費總額'))}${kpi(ps.toConfirm, t('Payments to confirm', '待確認款項'), true)}${kpi(money(sum(done)), t('Completed value', '已完成金額'))}${kpi(open.length, t('In progress', '進行中'))}${kpi(abn.length, t('Abnormal / stalled', '異常 / 停滯'), true)}</div>
    ${superAdmin ? `<details class="box" style="margin:12px 0 0"><summary style="cursor:pointer;font-weight:600">${t('Marketplace settings (fees and payment instructions)', '市集設定（手續費與付款方式）')}</summary>
      <form id="sform" style="margin-top:10px"><div class="row2"><div><label>${t('Platform fee per order (NT$)', '每筆訂單平台手續費 (NT$)')}</label><input name="platform_fee" type="number" min="0" max="10000" step="1" required value="${esc(settings.platform_fee ?? 4)}"></div>
      <div><label>${t('Home delivery fee per seller (NT$)', '宅配運費（每位賣家）(NT$)')}</label><input name="delivery_fee" type="number" min="0" max="10000" step="1" required value="${esc(settings.delivery_fee ?? 80)}"></div></div>
      <label>${t('How buyers pay (shown at checkout and next to "I have paid")', '買家付款方式（顯示於結帳與「我已付款」旁）')}</label><textarea name="payment_instructions" rows="4" maxlength="1000">${esc(settings.payment_instructions || '')}</textarea>
      <p class="acts"><button class="btn sm">${t('Save settings', '儲存設定')}</button></p></form></details>` : ''}
    <div class="afilters" style="grid-template-columns:2fr 1fr 1fr auto;align-items:end"><div><label>${t('Search by order ID, buyer or seller', '以訂單編號、買家或賣家搜尋')}</label><input id="oq" placeholder="#1001" value="${esc(S.q)}"></div>
      <div><label>${t('Status', '狀態')}</label><select id="os"><option value="">${t('All', '全部')}</option>${[...FLOW, 'cancelled'].map((s) => `<option value="${s}" ${S.status === s ? 'selected' : ''}>${esc(t(...STATUS[s]))}</option>`).join('')}</select></div>
      <div><label class="chk" style="margin:10px 0 0"><input type="checkbox" id="oab" ${S.abnormal ? 'checked' : ''}> ${t('Abnormal only', '只看異常')}</label><label class="chk" style="margin:4px 0 0"><input type="checkbox" id="ocf" ${S.confirm ? 'checked' : ''}> ${t('Payments to confirm', '待確認款項')}</label></div>
      <div><button class="btn sm o" id="ocsv">${t('Download CSV', '下載 CSV')}</button></div></div>
    <div class="scroll" id="otable" style="margin-top:12px"></div></div>`

  let items = []
  const filtered = () => orders.filter((o) => (!S.status || o.status === S.status) && (!S.abnormal || stalled(o)) && (!S.confirm || o.status === 'payment_submitted') && matchesOrder(o, S.q))
  const advance = async (id, to, ref) => (await supabase.rpc('advance_order', { p_order: id, p_to: to, p_ref: ref || null })).error?.message
  const paint = () => {
    const list = filtered()
    pane.querySelector('#ocount').textContent = `${list.length} ${list.length === 1 ? t('order', '筆訂單') : t('orders', '筆訂單')}`
    pane.querySelector('#otable').innerHTML = list.length ? `<table><thead><tr><th>${t('Order', '訂單')}</th><th>${t('Date', '日期')}</th><th>${t('Buyer', '買家')}</th><th>${t('Seller', '賣家')}</th><th>${t('Status', '狀態')}</th><th style="text-align:right">${t('Amount', '金額')}</th><th></th></tr></thead><tbody>
      ${list.slice(0, 300).map((o) => { const st = stalled(o); return `<tr class="orow" data-id="${esc(o.id)}" tabindex="0"><td><b>#${esc(o.order_no)}</b></td><td>${esc(when(o.created_at))}</td><td>${esc(o.buyer_name)}<br><small style="color:var(--mut)">${esc(o.buyer_email || '')}</small></td><td>${esc(o.seller_name)}<br><small style="color:var(--mut)">${esc(o.seller_email || '')}</small></td><td>${statusPill(o.status)}</td><td style="text-align:right;white-space:nowrap">${money(o.total)}</td><td style="white-space:nowrap">${o.status === 'payment_submitted' ? `<button class="btn sm qc" data-id="${esc(o.id)}">${t('Confirm payment', '確認收款')}</button> ` : ''}${st ? `<span class="pill pending" title="${t('No movement for', '已停留')} ${st.days} ${t('days', '天')}">⚠ ${st.days}${t('d', '天')}</span>` : ''}</td></tr>` }).join('')}</tbody></table>${list.length > 300 ? `<p style="color:var(--mut);font-size:13px">${t('Showing the latest 300. Narrow the search to see others.', '僅顯示最新 300 筆，請縮小搜尋範圍。')}</p>` : ''}`
      : `<p style="color:var(--mut)">${orders.length ? t('No transaction matches these filters.', '沒有符合條件的交易。') : t('No transactions yet. Orders appear here as soon as a member checks out.', '尚無交易。會員結帳後訂單會顯示在這裡。')}</p>`
    pane.querySelectorAll('.qc').forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation(); b.disabled = true
      const err = await advance(b.dataset.id, 'payment_confirmed')
      if (err) { toast(err, 'err', 6000); b.disabled = false } else { toast(t('Payment confirmed. The seller can now prepare the order.', '已確認收款，賣家可開始備貨。')); repaint() }
    }))
    pane.querySelectorAll('.orow').forEach((r) => { const go = () => detail(orders.find((o) => o.id === r.dataset.id)); r.onclick = go; r.onkeydown = (e) => { if (e.key === 'Enter') go() } })
    return list
  }
  const view = paint()
  void view
  pane.querySelector('#oq').oninput = (e) => { S.q = e.target.value; paint() }
  pane.querySelector('#os').onchange = (e) => { S.status = e.target.value; paint() }
  pane.querySelector('#oab').onchange = (e) => { S.abnormal = e.target.checked; paint() }
  pane.querySelector('#ocf').onchange = (e) => { S.confirm = e.target.checked; paint() }
  const sf = pane.querySelector('#sform')
  if (sf) sf.onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(sf)
    const { error } = await supabase.from('app_settings').update({ platform_fee: Number(f.get('platform_fee')), delivery_fee: Number(f.get('delivery_fee')), payment_instructions: String(f.get('payment_instructions') || '').trim() }).eq('id', 1)
    if (error) toast(error.message, 'err', 6000); else { toast(t('Settings saved. New orders use them from now on.', '設定已儲存，新訂單即適用。')); repaint() }
  }
  pane.querySelector('#ocsv').onclick = async () => {
    const list = filtered()
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
    d.querySelector('.cartbody').innerHTML = `${orderCard(o, it.data || [], { who, side: 'admin', settings })}
      <h4 style="margin:18px 0 6px;color:var(--g)">${t('Transaction history', '交易歷程')}</h4><div class="scroll">${logTable(log.data || [], false)}</div>
      <p class="hint">${t('Administrators only handle the payment. Shipping and completion belong to the seller and the buyer.', '管理員只處理付款；出貨與完成由賣家與買家負責。')}</p>`
    bindOrderActions(d, advance, (err) => { if (err) return toast(err, 'err', 6000); toast(t('Order updated.', '訂單已更新。')); d.close(); repaint() }, () => o)
  }
}
