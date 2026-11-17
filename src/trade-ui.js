// Shared markup for the marketplace: status pill, progress stepper, order card. One order, three views (buyer / seller / admin).
import { esc } from './util.js'
import { t } from './i18n.js'
import { FLOW, STATUS, STEPS, SHIPPING, actionsFor, progress, stalled, money } from './trade.js'

export const statusName = (s) => t(...(STATUS[s] || [s, s]))
const PILL = { waiting_payment: 'pending', payment_submitted: 'pending', payment_confirmed: '', ready_to_ship: '', shipped: '', completed: 'done', cancelled: 'rejected' }
export const statusPill = (s) => `<span class="pill ${PILL[s] ?? ''}">${esc(statusName(s))}</span>`

const when = (x) => (x ? new Date(x).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '')

/** Order placed → Payment sent → Payment confirmed → Ready to ship → Shipped → Completed */
export function stepper(o) {
  if (o.status === 'cancelled') return `<p class="cancelled-note">${t('Cancelled', '已取消')} · ${esc(when(o.cancelled_at || o.status_at))}</p>`
  const at = progress(o.status)
  const stamp = { 0: o.created_at, 1: o.payment_submitted_at, 2: o.paid_at, 3: o.ready_at, 4: o.shipped_at, 5: o.completed_at }
  return `<ol class="steps" aria-label="${t('Order progress', '訂單進度')}">${FLOW.map((s, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><i>${i < at ? '✓' : i + 1}</i><span>${esc(t(...STEPS[i]))}</span>${stamp[i] && i <= at ? `<small>${esc(new Date(stamp[i]).toLocaleDateString())}</small>` : ''}</li>`).join('')}</ol>`
}

/** Subtotal / Shipping / Platform fee / Total due (slide "Platform admin: All Platform Transactions") */
export const breakdown = (o) => `<dl class="obreak"><div><dt>${t('Subtotal', '小計')}</dt><dd>${money(o.subtotal ?? o.total)}</dd></div>
  <div><dt>${t('Shipping', '運費')}</dt><dd>${Number(o.shipping_fee) ? money(o.shipping_fee) : t('Free', '免費')}</dd></div>
  <div><dt>${t('Platform fee', '平台手續費')}</dt><dd>${money(o.platform_fee || 0)}</dd></div>
  <div class="due"><dt>${t('Total due', '應付總額')}</dt><dd>${money(o.total)}</dd></div></dl>`

/** side: 'buyer' (sees the seller and how to pay), 'seller' (sees buyer + contact), 'admin' (sees both, handles the money).
 *  who = { uid, admin, superAdmin, storeId }; settings = app_settings row (payment instructions) */
export function orderCard(o, items, { who, side, settings }) {
  const lines = (items || []).filter((i) => i.order_id === o.id)
  const acts = actionsFor(o, who)
  const stall = side === 'admin' ? stalled(o) : null
  const person = side === 'buyer'
    ? `${t('Seller', '賣家')}: <b>${esc(o.seller_name)}</b>`
    : side === 'seller'
      ? `${t('Buyer', '買家')}: <b>${esc(o.buyer_name)}</b> · ${esc(o.buyer_contact)}${o.buyer_email ? ` · ${esc(o.buyer_email)}` : ''}`
      : `${t('Buyer', '買家')}: <b>${esc(o.buyer_name)}</b> ${esc(o.buyer_email || '')} → ${t('Seller', '賣家')}: <b>${esc(o.seller_name)}</b> ${esc(o.seller_email || '')}`
  const paid = o.status === 'cancelled' ? t('Cancelled', '已取消') : ['payment_confirmed', 'ready_to_ship', 'shipped', 'completed'].includes(o.status) ? t('Payment received', '已收款') : o.status === 'payment_submitted' ? t('Waiting for confirmation', '等待確認') : t('Awaiting payment', '尚未付款')
  const ship = `${t(...SHIPPING[o.shipping_method || 'pickup'])}${o.shipping_address ? ` · ${esc(o.shipping_address)}` : ''}`
  // the buyer is told exactly how to pay, right where the "I have paid" button is
  const payBox = side === 'buyer' && o.status === 'waiting_payment' ? `<div class="paybox"><b>${t('How to pay', '付款方式')}</b><p>${esc(settings?.payment_instructions || t('Pay the Total Due to the platform, then press “I have paid”.', '請將應付總額付給平台，然後按「我已付款」。'))}</p><p class="paydue">${t('Total due', '應付總額')}: <b>${money(o.total)}</b> · ${t('Reference', '備註')}: <code>#${esc(o.order_no)}</code></p></div>`
    : o.payment_ref && side !== 'seller' ? `<p class="onote">${t('Payment reference', '付款參考')}: <b>${esc(o.payment_ref)}</b></p>` : ''
  const waitNote = side === 'buyer' && o.status === 'payment_submitted' ? `<div class="paybox wait"><b>${t('Thank you!', '謝謝！')}</b> ${t('An administrator is checking that your payment arrived. You will see “Payment confirmed” here and the seller will prepare your order.', '管理員正在確認您的款項。確認後這裡會顯示「已確認付款」，賣家便會開始備貨。')}</div>`
    : side === 'seller' && ['waiting_payment', 'payment_submitted'].includes(o.status) ? `<div class="paybox wait">${t('The buyer has not been confirmed as paid yet. Prepare the order once it shows “Payment confirmed”.', '買家尚未完成付款確認。顯示「已確認付款」後再備貨。')}</div>` : ''
  return `<article class="ocard ${stall ? 'stalled' : ''}" data-order="${esc(o.id)}">
    <div class="ohead"><div><b class="ono">#${esc(o.order_no)}</b> ${statusPill(o.status)} ${stall ? `<span class="pill pending" title="${t('No movement for', '已停留')} ${stall.days} ${t('days', '天')}">⚠ ${stall.days} ${t('days', '天')}</span>` : ''}</div><div class="otot">${money(o.total)}</div></div>
    <p class="owho">${person}</p>
    <ul class="olines">${lines.map((i) => `<li><span>${esc(i.title)} <small>× ${i.quantity}</small></span><span>${money(i.line_total)}</span></li>`).join('') || `<li><small>${t('Loading items…', '載入品項中…')}</small></li>`}</ul>
    ${breakdown(o)}
    <div class="ometa"><span>${t('Order date', '訂購日期')}: ${esc(when(o.created_at))}</span><span>${t('Last updated', '最後更新')}: ${esc(when(o.status_at))}</span><span>${t('Payment', '付款')}: <b>${esc(paid)}</b></span><span>${t('Delivery', '取貨')}: ${ship}</span></div>
    ${o.note ? `<p class="onote">“${esc(o.note)}”</p>` : ''}
    ${payBox}${waitNote}
    ${stepper(o)}
    ${acts.length ? `<p class="acts">${acts.map((a) => `<button class="btn sm ${a.danger ? 'danger' : a.primary ? '' : 'o'}" data-act="${a.to}" data-id="${esc(o.id)}" ${a.ask ? `data-ask="${a.ask}"` : ''}>${t(a.en, a.zh)}</button>`).join('')}</p>` : ''}
  </article>`
}

/** small dialog asking for the payment reference when the buyer presses "I have paid" (resolves to a string, '' or null if dismissed) */
export function askReference(order) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog'); d.className = 'modal'
    d.innerHTML = `<button class="x" aria-label="${t('Close', '關閉')}">✕</button><h3 style="margin-top:0">${t('Confirm your payment', '回報付款')}</h3>
      <p>${t('Order', '訂單')} <b>#${esc(order.order_no)}</b> · ${t('Total due', '應付總額')} <b>${money(order.total)}</b></p>
      <label for="pref">${t('Payment reference (optional)', '付款參考（選填）')}</label>
      <input id="pref" maxlength="120" placeholder="${t('e.g. last 5 digits of the transfer, or LINE Pay transaction ID', '例如：轉帳末五碼或 LINE Pay 交易編號')}" autocomplete="off">
      <p class="hint">${t('An administrator will check that the money arrived before the seller is asked to prepare your order.', '管理員確認款項入帳後，才會通知賣家備貨。')}</p>
      <p class="acts"><button class="btn" id="pok">${t('I have paid', '我已付款')}</button><button class="btn o" id="pno">${t('Cancel', '取消')}</button></p>`
    document.body.appendChild(d)
    let out = null
    d.querySelector('#pok').onclick = () => { out = d.querySelector('#pref').value.trim(); d.close() }
    d.querySelector('#pno').onclick = () => d.close(); d.querySelector('.x').onclick = () => d.close()
    d.addEventListener('close', () => { d.remove(); resolve(out) })
    d.showModal(); d.querySelector('#pref').focus()
  })
}

/** wire the action buttons inside `root`; `run(orderId, to, ref)` returns an error message or falsy; `find(id)` returns the order */
export function bindOrderActions(root, run, onDone, find) {
  root.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async () => {
    let ref
    if (b.dataset.ask === 'ref') { ref = await askReference(find(b.dataset.id)); if (ref === null) return }
    else if (b.dataset.act === 'cancelled' && !confirm(t('Cancel this order? The stock goes back to the listing.', '確定取消此訂單？庫存會回到商品。'))) return
    else if (b.dataset.act === 'waiting_payment' && !confirm(t('Mark this payment as NOT received? The buyer will be asked to pay again.', '確定標記為「尚未收到款項」？買家需重新付款。'))) return
    root.querySelectorAll('[data-act]').forEach((x) => (x.disabled = true))
    const err = await run(b.dataset.id, b.dataset.act, ref)
    onDone(err, b.dataset.act)
  }))
}

/** fetch the lines of many orders in one query */
export async function loadItems(supabase, orders) {
  if (!orders.length) return []
  const { data } = await supabase.from('order_items').select('*').in('order_id', orders.map((o) => o.id))
  return data || []
}

/** marketplace settings (fees, payment instructions, demo store id); safe defaults if v7 has not run yet */
export async function loadSettings(supabase) {
  const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()
  return data || { platform_fee: 4, delivery_fee: 80, payment_instructions: '', demo_store_id: null }
}
