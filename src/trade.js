// Marketplace business rules shared by the shop, the account hub and the back office. Pure functions (no DOM, no network)
// so they can be unit-tested. The database enforces the same rules again (supabase/v6.sql): this file only drives the UI.
import { toCsv } from './alumni-csv.js'

/** Order lifecycle (slide "What happens after an order is submitted?"): Placed → Waiting for payment → … → Completed */
export const FLOW = ['waiting_payment', 'payment_confirmed', 'ready_to_ship', 'shipped', 'completed']
export const STATUS = {
  waiting_payment: ['Waiting for payment', '等待付款確認'],
  payment_confirmed: ['Payment confirmed', '已確認付款'],
  ready_to_ship: ['Ready to ship', '待出貨'],
  shipped: ['Shipped', '已出貨'],
  completed: ['Completed', '已完成'],
  cancelled: ['Cancelled', '已取消'],
}
export const STATUS_EN = (s) => (STATUS[s] || [s])[0]

export const DAY = 86400000
export const money = (n) => 'NT$ ' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })

/** Available Stock = Current Inventory − Purchased Quantity */
export const available = (l) => Math.max(0, Number(l.quantity ?? 0) - Number(l.purchased ?? 0))
export const stockState = (l) => { const a = available(l); return a === 0 ? 'out' : a <= 2 ? 'low' : 'in' }

/**
 * What can `uid` do to this order right now? Mirrors advance_order() in the database.
 * Administrators get nothing here on purpose: "monitoring does not always mean editing".
 */
export function actionsFor(order, uid) {
  if (!uid) return []
  const seller = order.seller_id === uid, buyer = order.buyer_id === uid
  const out = []
  const s = order.status
  if (seller && s === 'waiting_payment') out.push({ to: 'payment_confirmed', en: 'Confirm payment', zh: '確認收款' })
  if (seller && s === 'payment_confirmed') out.push({ to: 'ready_to_ship', en: 'Mark ready to ship', zh: '標記待出貨' })
  if (seller && s === 'ready_to_ship') out.push({ to: 'shipped', en: 'Confirm shipment', zh: '確認出貨' })
  if (s === 'shipped' && buyer) out.push({ to: 'completed', en: 'Confirm received', zh: '確認收貨', primary: true })
  if (s === 'shipped' && seller) out.push({ to: 'completed', en: 'Mark completed', zh: '標記完成' })
  if ((buyer || seller) && s === 'waiting_payment') out.push({ to: 'cancelled', en: 'Cancel order', zh: '取消訂單', danger: true })
  if (seller && (s === 'payment_confirmed' || s === 'ready_to_ship')) out.push({ to: 'cancelled', en: 'Cancel and refund', zh: '取消並退款', danger: true })
  return out
}

/** 0-based progress through the five steps (for the stepper). A cancelled order has none. */
export const progress = (status) => FLOW.indexOf(status)

/** Monitoring: an order that has sat in one state too long is "abnormal or incomplete" (admin view). */
export const STALL_DAYS = { waiting_payment: 3, payment_confirmed: 3, ready_to_ship: 4, shipped: 7 }
export function stalled(order, now = Date.now()) {
  const limit = STALL_DAYS[order.status]
  if (!limit) return null
  const days = Math.floor((now - new Date(order.status_at || order.created_at).getTime()) / DAY)
  return days >= limit ? { days, limit } : null
}

const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` }

/** Seller accounting: monthly revenue counts completed sales only; money still in play is shown separately. */
export function salesSummary(orders, now = new Date()) {
  const completed = orders.filter((o) => o.status === 'completed')
  const waiting = orders.filter((o) => o.status === 'waiting_payment')
  const toShip = orders.filter((o) => o.status === 'payment_confirmed' || o.status === 'ready_to_ship')
  const sum = (l) => l.reduce((a, o) => a + Number(o.total), 0)
  const thisMonth = monthKey(now)
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const k = monthKey(d)
    months.push({ key: k, label: d.toLocaleString('en-US', { month: 'short' }), revenue: sum(completed.filter((o) => monthKey(o.completed_at || o.status_at) === k)) })
  }
  return {
    monthRevenue: sum(completed.filter((o) => monthKey(o.completed_at || o.status_at) === thisMonth)),
    totalRevenue: sum(completed),
    completedCount: completed.length,
    pendingPayments: { count: waiting.length, amount: sum(waiting) },
    toShip: { count: toShip.length, amount: sum(toShip) },
    months,
  }
}

/** "Search by order ID" accepts 1042, #1042 or part of the internal id. */
export const matchesOrder = (o, q) => {
  const s = String(q || '').trim().toLowerCase().replace(/^#/, '')
  if (!s) return true
  return String(o.order_no).includes(s) || String(o.id).toLowerCase().startsWith(s) ||
    [o.buyer_name, o.buyer_email, o.seller_name, o.seller_email].some((v) => (v || '').toLowerCase().includes(s))
}

const stamp = (t) => (t ? new Date(t).toISOString().slice(0, 19).replace('T', ' ') : '')
/** CSV of transactions. `items` is optional (order_items rows); `side` picks the columns each role needs. */
export function ordersToCsv(orders, items = [], side = 'seller') {
  const lines = (o) => items.filter((i) => i.order_id === o.id).map((i) => `${i.title} × ${i.quantity}`).join('; ')
  const base = (o) => ({
    'Order ID': '#' + o.order_no, 'Order date': stamp(o.created_at), 'Status': STATUS_EN(o.status), 'Products': lines(o),
    'Total (NT$)': Number(o.total),
  })
  const rows = orders.map((o) => {
    if (side === 'seller') return { ...base(o), 'Buyer': o.buyer_name, 'Buyer contact': o.buyer_contact, 'Paid at': stamp(o.paid_at), 'Shipped at': stamp(o.shipped_at), 'Completed at': stamp(o.completed_at) }
    if (side === 'buyer') return { ...base(o), 'Seller': o.seller_name, 'Completed at': stamp(o.completed_at) }
    return { ...base(o), 'Buyer': o.buyer_name, 'Buyer email': o.buyer_email, 'Seller': o.seller_name, 'Seller email': o.seller_email, 'Last change': stamp(o.status_at) }
  })
  const cols = rows[0] ? Object.keys(rows[0]) : ['Order ID', 'Order date', 'Status', 'Products', 'Total (NT$)']
  return toCsv(rows, cols)
}

/* ------------------------------------ cart (kept in the browser, per account) ------------------------------------ */
const CART_KEY = (uid) => 'immba-cart:' + (uid || 'guest')
const store = () => { try { return globalThis.localStorage } catch { return null } }
export function cartLoad(uid, s = store()) {
  try { const v = JSON.parse(s?.getItem(CART_KEY(uid)) || '[]'); return Array.isArray(v) ? v.filter((x) => x && x.id && x.qty > 0) : [] } catch { return [] }
}
export function cartSave(uid, items, s = store()) { try { s?.setItem(CART_KEY(uid), JSON.stringify(items)) } catch { /* private mode */ } }
/** add `qty` of a listing, never above what is in stock; returns the new cart and what was really added */
export function cartAdd(items, listing, qty = 1) {
  const max = Math.min(available(listing), 99)
  const cur = items.find((x) => x.id === listing.id)
  const next = Math.min(max, (cur?.qty || 0) + qty)
  const added = next - (cur?.qty || 0)
  if (added <= 0) return { items, added: 0 }
  return { items: cur ? items.map((x) => (x.id === listing.id ? { ...x, qty: next } : x)) : [...items, { id: listing.id, qty: next }], added }
}
export const cartCount = (items) => items.reduce((a, x) => a + x.qty, 0)
/** join the stored cart with fresh listing rows; lines whose listing vanished or sold out are flagged */
export function cartLines(items, listings) {
  return items.map((x) => {
    const l = listings.find((r) => r.id === x.id)
    const max = l ? Math.min(available(l), 99) : 0
    return { id: x.id, listing: l || null, qty: Math.min(x.qty, Math.max(max, 0)) || 0, wanted: x.qty, max, ok: Boolean(l) && max > 0 }
  })
}
export const cartTotal = (lines) => lines.filter((l) => l.ok).reduce((a, l) => a + l.qty * Number(l.listing.price), 0)
