// Shared markup for the marketplace: status pill, progress stepper, order card. One order, three views (buyer / seller / admin).
import { esc } from './util.js'
import { t } from './i18n.js'
import { FLOW, STATUS, actionsFor, progress, stalled, money } from './trade.js'

export const statusName = (s) => t(...(STATUS[s] || [s, s]))
const PILL = { waiting_payment: 'pending', payment_confirmed: '', ready_to_ship: '', shipped: '', completed: 'done', cancelled: 'rejected' }
export const statusPill = (s) => `<span class="pill ${PILL[s] ?? ''}">${esc(statusName(s))}</span>`

const when = (x) => (x ? new Date(x).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '')

/** Order Placed → Waiting for payment → Payment confirmed → Ready to ship → Shipped → Completed */
export function stepper(o) {
  if (o.status === 'cancelled') return `<p class="cancelled-note">${t('Cancelled', '已取消')} · ${esc(when(o.cancelled_at || o.status_at))}</p>`
  const at = progress(o.status)
  const stamp = { 1: o.paid_at, 2: o.ready_at, 3: o.shipped_at, 4: o.completed_at }
  return `<ol class="steps" aria-label="${t('Order progress', '訂單進度')}">${FLOW.map((s, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><i>${i < at ? '✓' : i + 1}</i><span>${esc(statusName(s))}</span>${stamp[i] ? `<small>${esc(new Date(stamp[i]).toLocaleDateString())}</small>` : ''}</li>`).join('')}</ol>`
}

/** side: 'buyer' (sees the seller), 'seller' (sees buyer + contact), 'admin' (sees both, cannot act) */
export function orderCard(o, items, { uid, side }) {
  const lines = (items || []).filter((i) => i.order_id === o.id)
  const acts = side === 'admin' ? [] : actionsFor(o, uid)
  const stall = side === 'admin' ? stalled(o) : null
  const who = side === 'buyer'
    ? `${t('Seller', '賣家')}: <b>${esc(o.seller_name)}</b>`
    : side === 'seller'
      ? `${t('Buyer', '買家')}: <b>${esc(o.buyer_name)}</b> · ${esc(o.buyer_contact)}${o.buyer_email ? ` · ${esc(o.buyer_email)}` : ''}`
      : `${t('Buyer', '買家')}: <b>${esc(o.buyer_name)}</b> ${esc(o.buyer_email || '')} → ${t('Seller', '賣家')}: <b>${esc(o.seller_name)}</b> ${esc(o.seller_email || '')}`
  const paid = o.status === 'cancelled' ? t('Cancelled', '已取消') : ['payment_confirmed', 'ready_to_ship', 'shipped', 'completed'].includes(o.status) ? t('Payment received', '已收款') : t('Awaiting payment', '尚未付款')
  return `<article class="ocard ${stall ? 'stalled' : ''}" data-order="${esc(o.id)}">
    <div class="ohead"><div><b class="ono">#${esc(o.order_no)}</b> ${statusPill(o.status)} ${stall ? `<span class="pill pending" title="${t('No movement for', '已停留')} ${stall.days} ${t('days', '天')}">⚠ ${stall.days} ${t('days', '天')}</span>` : ''}</div><div class="otot">${money(o.total)}</div></div>
    <p class="owho">${who}</p>
    <ul class="olines">${lines.map((i) => `<li><span>${esc(i.title)} <small>× ${i.quantity}</small></span><span>${money(i.line_total)}</span></li>`).join('') || `<li><small>${t('Loading items…', '載入品項中…')}</small></li>`}</ul>
    ${o.note ? `<p class="onote">“${esc(o.note)}”</p>` : ''}
    <div class="ometa"><span>${t('Order date', '訂購日期')}: ${esc(when(o.created_at))}</span><span>${t('Payment', '付款')}: <b>${esc(paid)}</b></span></div>
    ${stepper(o)}
    ${acts.length ? `<p class="acts">${acts.map((a) => `<button class="btn sm ${a.danger ? 'danger' : a.primary ? '' : 'o'}" data-act="${a.to}" data-id="${esc(o.id)}">${t(a.en, a.zh)}</button>`).join('')}</p>` : ''}
  </article>`
}

/** wire the action buttons inside `root`; `run(orderId, to)` returns an error message or falsy */
export function bindOrderActions(root, run, onDone) {
  root.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async () => {
    if (b.dataset.act === 'cancelled' && !confirm(t('Cancel this order? The stock goes back to the listing.', '確定取消此訂單？庫存會回到商品。'))) return
    root.querySelectorAll('[data-act]').forEach((x) => (x.disabled = true))
    const err = await run(b.dataset.id, b.dataset.act)
    onDone(err, b.dataset.act)
  }))
}

/** fetch the lines of many orders in one query */
export async function loadItems(supabase, orders) {
  if (!orders.length) return []
  const { data } = await supabase.from('order_items').select('*').in('order_id', orders.map((o) => o.id))
  return data || []
}
