import test from 'node:test'
import assert from 'node:assert/strict'
import { monthStats, monthsWithSales, platformStats, checkoutTotals, earned, STEPS, actionsFor, available, stockState, stalled, salesSummary, matchesOrder, ordersToCsv, cartAdd, cartLines, cartTotal, cartCount, cartLoad, cartSave, progress, STATUS, FLOW, DAY } from '../src/trade.js'

const o = (over = {}) => ({ id: 'aaaa1111', order_no: 1001, buyer_id: 'B', seller_id: 'S', buyer_name: 'Bea', buyer_email: 'b@x.tw', buyer_contact: 'LINE bea', seller_name: 'Sam', seller_email: 's@x.tw', status: 'waiting_payment', total: 500, created_at: '2026-11-01T10:00:00Z', status_at: '2026-11-01T10:00:00Z', ...over })
const tos = (order, uid) => actionsFor(order, uid).map((a) => a.to)

test('stock formula: available = inventory − purchased, never negative', () => {
  assert.equal(available({ quantity: 5, purchased: 2 }), 3)
  assert.equal(available({ quantity: 1, purchased: 3 }), 0)
  assert.equal(stockState({ quantity: 5, purchased: 5 }), 'out')
  assert.equal(stockState({ quantity: 5, purchased: 3 }), 'low')
  assert.equal(stockState({ quantity: 5, purchased: 0 }), 'in')
})

const B = { uid: 'B' }, S = { uid: 'S' }, ADMIN = { uid: 'ADMIN', admin: true }
const STORE = 'STORE'

test('buyer pays first: "I have paid" asks for a reference; nobody else can say it', () => {
  assert.deepEqual(tos(o(), B), ['payment_submitted', 'cancelled'])
  assert.equal(actionsFor(o(), B)[0].ask, 'ref')
  assert.deepEqual(tos(o(), S), ['cancelled'])
  assert.deepEqual(tos(o(), ADMIN), [])
})

test('only an administrator confirms (or rejects) the payment, never the seller or the buyer', () => {
  const sub = o({ status: 'payment_submitted' })
  assert.deepEqual(tos(sub, ADMIN), ['payment_confirmed', 'waiting_payment', 'cancelled'])
  assert.deepEqual(tos(sub, S), [])
  assert.deepEqual(tos(sub, B), [])
})

test('after confirmation the seller prepares and ships; the buyer confirms receipt', () => {
  assert.deepEqual(tos(o({ status: 'payment_confirmed' }), S), ['ready_to_ship', 'cancelled'])
  assert.deepEqual(tos(o({ status: 'ready_to_ship' }), S), ['shipped', 'cancelled'])
  assert.deepEqual(tos(o({ status: 'shipped' }), S), ['completed'])
  assert.deepEqual(tos(o({ status: 'shipped' }), B), ['completed'])
  assert.deepEqual(tos(o({ status: 'payment_confirmed' }), B), [])
})

test('administrators cannot ship or complete, and visitors get nothing (monitoring is not editing)', () => {
  for (const st of ['waiting_payment', 'payment_confirmed', 'ready_to_ship', 'shipped', 'completed', 'cancelled']) {
    const t = tos(o({ status: st }), ADMIN)
    assert.ok(!t.includes('ready_to_ship') && !t.includes('shipped') && !t.includes('completed'), st)
    assert.deepEqual(tos(o({ status: st }), null), [])
  }
})

test('the super admin runs the demo store as its seller', () => {
  const order = o({ seller_id: STORE, status: 'payment_confirmed' })
  assert.deepEqual(tos(order, { uid: 'ROOT', admin: true, superAdmin: true, storeId: STORE }), ['ready_to_ship', 'cancelled'])
  assert.deepEqual(tos(order, { uid: 'ADMIN2', admin: true, storeId: STORE }), ['cancelled'])
})

test('completed and cancelled orders are final', () => {
  assert.deepEqual(tos(o({ status: 'completed' }), S), [])
  assert.deepEqual(tos(o({ status: 'cancelled' }), B), [])
  assert.equal(progress('cancelled'), -1)
  assert.equal(progress('shipped'), 4)
})

test('every status has English and Chinese labels', () => {
  for (const s of [...FLOW, 'cancelled']) assert.equal(STATUS[s].length, 2)
})

test('stalled orders are flagged by how long they sit in one state', () => {
  const now = new Date('2026-11-10T10:00:00Z').getTime()
  assert.deepEqual(stalled(o(), now), { days: 9, limit: 3 })
  assert.deepEqual(stalled(o({ status: 'payment_submitted', status_at: new Date(now - 2 * DAY).toISOString() }), now), { days: 2, limit: 1 })
  assert.equal(stalled(o({ status_at: new Date(now - DAY).toISOString() }), now), null)
  assert.equal(stalled(o({ status: 'completed' }), now), null)
  assert.equal(stalled(o({ status: 'cancelled' }), now), null)
})

test('seller accounting: revenue counts completed sales of the month, pending money is separate', () => {
  const now = new Date(2026, 10, 17)
  const orders = [
    o({ status: 'completed', total: 384, subtotal: 300, shipping_fee: 80, platform_fee: 4, completed_at: new Date(2026, 10, 3).toISOString() }),
    o({ status: 'completed', total: 200, completed_at: new Date(2026, 9, 20).toISOString() }),
    o({ status: 'waiting_payment', total: 100 }),
    o({ status: 'payment_confirmed', total: 50 }),
    o({ status: 'ready_to_ship', total: 25 }),
    o({ status: 'cancelled', total: 999 }),
  ]
  const s = salesSummary(orders, now)
  assert.equal(s.monthRevenue, 380, 'seller earns goods + shipping, not the platform fee')
  assert.equal(s.totalRevenue, 580)
  assert.equal(s.completedCount, 2)
  assert.deepEqual(s.pendingPayments, { count: 1, amount: 100 })
  assert.deepEqual(s.toShip, { count: 2, amount: 75 })
  assert.equal(s.months.length, 6)
  assert.equal(s.months.at(-1).revenue, 380)
  assert.equal(s.months.at(-2).revenue, 200)
})

test('admin search by order id accepts 1001, #1001, partial uuid, names', () => {
  assert.ok(matchesOrder(o(), '1001')); assert.ok(matchesOrder(o(), '#1001')); assert.ok(matchesOrder(o(), 'aaaa'))
  assert.ok(matchesOrder(o(), 'bea')); assert.ok(matchesOrder(o(), ''))
  assert.ok(!matchesOrder(o(), '2002'))
})

test('transaction CSV: seller columns, items joined, formulas defused, BOM for Excel', () => {
  const csv = ordersToCsv([o({ buyer_name: '=HYPERLINK("x")', status: 'completed', completed_at: '2026-11-05T00:00:00Z' })], [{ order_id: 'aaaa1111', title: 'Kotler', quantity: 2 }], 'seller')
  assert.ok(csv.startsWith('﻿Order ID,Order date,Status,Products,Shipping,Subtotal (NT$),Shipping fee (NT$),Revenue (NT$),Buyer,Buyer contact'))
  assert.match(csv, /#1001/); assert.match(csv, /Kotler × 2/); assert.match(csv, /Completed/)
  assert.ok(csv.includes("'=HYPERLINK"), 'formula must be neutralised')
  assert.ok(ordersToCsv([], [], 'admin').includes('Order ID'))
  assert.ok(ordersToCsv([o()], [], 'admin').includes('Seller email'))
})

test('cart: adds are capped by stock, merge lines, and survive storage', () => {
  const l = { id: 'L1', quantity: 3, purchased: 1, price: 100 }
  let r = cartAdd([], l, 1); assert.deepEqual(r.items, [{ id: 'L1', qty: 1 }])
  r = cartAdd(r.items, l, 5); assert.deepEqual(r.items, [{ id: 'L1', qty: 2 }]); assert.equal(r.added, 1)
  r = cartAdd(r.items, l, 1); assert.equal(r.added, 0)
  assert.equal(cartCount(r.items), 2)
  const mem = {}; const s = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = v) }
  cartSave('u1', r.items, s); assert.deepEqual(cartLoad('u1', s), r.items); assert.deepEqual(cartLoad('u2', s), [])
  mem['immba-cart:u3'] = '{bad json'; assert.deepEqual(cartLoad('u3', s), [])
})

test('cart lines re-check stock and flag vanished or sold-out items; total skips them', () => {
  const stock = [{ id: 'A', quantity: 2, purchased: 0, price: 100 }, { id: 'B', quantity: 1, purchased: 1, price: 50 }]
  const lines = cartLines([{ id: 'A', qty: 5 }, { id: 'B', qty: 1 }, { id: 'GONE', qty: 1 }], stock)
  assert.deepEqual(lines.map((x) => [x.ok, x.qty]), [[true, 2], [false, 0], [false, 0]])
  assert.equal(cartTotal(lines), 200)
})

test('financial report by month, and the months that have sales', () => {
  const orders = [o({ status: 'completed', subtotal: 100, total: 104, platform_fee: 4, completed_at: '2026-11-03T00:00:00Z' }), o({ status: 'completed', total: 50, completed_at: '2026-10-03T00:00:00Z' }), o({ status: 'shipped', total: 999 })]
  assert.equal(monthStats(orders, 'all').revenue, 150)
  assert.deepEqual(monthStats(orders, '2026-11').count, 1)
  assert.deepEqual(monthsWithSales(orders), ['2026-11', '2026-10'])
  assert.equal(earned(orders[0]), 100)
})

test('platform view: transactions, amount, fees only once paid, payments waiting for an admin', () => {
  const orders = [o({ status: 'payment_submitted', total: 104, platform_fee: 4 }), o({ status: 'completed', total: 204, platform_fee: 4 }), o({ status: 'cancelled', total: 500, platform_fee: 4 }), o({ status: 'waiting_payment', total: 10, platform_fee: 4 })]
  assert.deepEqual(platformStats(orders), { count: 4, amount: 318, fees: 4, toConfirm: 1 })
})

test('checkout totals: shipping and platform fee are charged once per seller order', () => {
  const lines = [{ ok: true, qty: 2, listing: { seller_id: 'S1', price: 100 } }, { ok: true, qty: 1, listing: { seller_id: 'S2', price: 50 } }, { ok: false, qty: 0, listing: null }]
  assert.deepEqual(checkoutTotals(lines, 'pickup', { platform_fee: 4, delivery_fee: 80 }), { orders: 2, subtotal: 250, shipping: 0, fee: 8, total: 258 })
  assert.deepEqual(checkoutTotals(lines, 'delivery', { platform_fee: 4, delivery_fee: 80 }), { orders: 2, subtotal: 250, shipping: 160, fee: 8, total: 418 })
})

test('the stepper has one label per step of the lifecycle', () => assert.equal(STEPS.length, FLOW.length))

/* ------------------------------ class 11: testing & verification (boundary + negative + access) ------------------------------ */
import { readFileSync } from 'node:fs'
const L = (over = {}) => ({ id: 'L1', price: 100, quantity: 5, purchased: 0, seller_id: 'S', ...over })

test('B09 boundary: quantity 1 and the maximum stock are added; 0, -1, decimals, NaN and text add nothing', () => {
  assert.equal(cartAdd([], L(), 1).added, 1)
  assert.equal(cartAdd([], L(), 5).added, 5)                       // = maximum stock
  for (const bad of [0, -1, -100, 0.4, NaN, undefined === 1 ? 1 : 'abc', null]) {
    const r = cartAdd([], L(), bad)
    assert.equal(r.added, 0, `qty ${bad}`)
    assert.deepEqual(r.items, [], `qty ${bad}`)
  }
  assert.equal(cartAdd([], L(), '3').added, 3)                     // a numeric string from an input box
  assert.equal(cartAdd([], L(), 2.9).added, 2)                     // decimals are floored, never rounded up past stock
})

test('B09 boundary: above available stock is capped, the stock cap of 99 holds, sold out adds nothing', () => {
  assert.equal(cartAdd([], L(), 6).added, 5)
  assert.equal(cartAdd([], L({ quantity: 500 }), 300).added, 99)
  assert.equal(cartAdd([], L({ quantity: 5, purchased: 5 }), 1).added, 0)
  const once = cartAdd([], L(), 3)
  assert.equal(cartAdd(once.items, L(), 3).added, 2)               // 3 already in the cart + 3 more, only 2 fit
  assert.equal(cartAdd(cartAdd(once.items, L(), 2).items, L(), 1).added, 0)
})

test('a cart must never carry a NaN or negative line into checkout', () => {
  assert.deepEqual(cartLoad('u', { getItem: () => JSON.stringify([{ id: 'a', qty: NaN }, { id: 'b', qty: -2 }, { id: 'c', qty: 0 }, { id: 'd', qty: 2 }]) }), [{ id: 'd', qty: 2 }])
  assert.deepEqual(cartLoad('u', { getItem: () => 'not json' }), [])
  const lines = cartLines([{ id: 'L1', qty: 9 }], [L({ quantity: 3 })])
  assert.equal(lines[0].qty, 3); assert.equal(lines[0].wanted, 9); assert.equal(lines[0].ok, true)   // stock fell after adding: shown as "only 3 left"
})

test('checkout totals: an empty cart costs nothing, and odd settings fall back to the defaults', () => {
  assert.deepEqual(checkoutTotals([], 'pickup', {}), { orders: 0, subtotal: 0, shipping: 0, fee: 0, total: 0 })
  const lines = [{ ok: true, qty: 2, listing: { seller_id: 'S', price: 100 } }]
  assert.equal(checkoutTotals(lines, 'pickup', {}).total, 204)                       // 200 + default fee 4
  assert.equal(checkoutTotals(lines, 'delivery', { delivery_fee: '120', platform_fee: '0' }).total, 320)   // numeric strings from the database
  assert.equal(checkoutTotals(lines, 'delivery', {}).total, 284)                     // 200 + default shipping 80 + default fee 4
})

test('access control: someone who is neither buyer, seller nor admin gets no action on any state', () => {
  for (const st of FLOW.concat(['cancelled'])) assert.deepEqual(tos(o({ status: st }), { uid: 'STRANGER' }), [], st)
  assert.deepEqual(tos(o({ status: 'payment_submitted' }), { uid: 'STRANGER', admin: false, superAdmin: true, storeId: 'S' }), [], 'superAdmin without admin flag')
  assert.deepEqual(tos(o({ status: 'shipped' }), {}), [])
})

test('access control: a plain admin cannot operate the demo store; only the super admin can', () => {
  const order = o({ seller_id: 'STORE', status: 'ready_to_ship' })
  assert.deepEqual(tos(order, { uid: 'A', admin: true, storeId: 'STORE' }), ['cancelled'])
  assert.deepEqual(tos(order, { uid: 'ROOT', admin: true, superAdmin: true, storeId: 'STORE' }), ['shipped', 'cancelled'])
  assert.deepEqual(tos(order, { uid: 'ROOT', admin: true, superAdmin: true, storeId: null }), ['cancelled'])
})

test('the lifecycle has no way back except "payment not received": nothing offers a backwards move', () => {
  const rank = (s) => FLOW.indexOf(s)
  for (const st of FLOW) for (const who of [B, S, ADMIN, { uid: 'R', admin: true, superAdmin: true, storeId: 'S' }]) {
    for (const a of actionsFor(o({ status: st }), who)) {
      if (a.to === 'cancelled') continue
      assert.ok(rank(a.to) > rank(st) || (st === 'payment_submitted' && a.to === 'waiting_payment'), `${st} → ${a.to}`)
    }
  }
})

test('a stalled order is only flagged for open states, never for completed or cancelled', () => {
  const old = '2020-01-01T00:00:00Z'
  assert.equal(stalled(o({ status: 'completed', status_at: old })), null)
  assert.equal(stalled(o({ status: 'cancelled', status_at: old })), null)
  assert.ok(stalled(o({ status: 'payment_submitted', status_at: old })))
})

test('search by order id: empty finds everything, a missing order finds nothing, "#" is ignored', () => {
  assert.equal(matchesOrder(o(), ''), true)
  assert.equal(matchesOrder(o(), '   '), true)
  assert.equal(matchesOrder(o(), '#1001'), true)
  assert.equal(matchesOrder(o(), '9999'), false)
})

test('regression (class 11 bug): marketplace cards show the whole description, never cut at a fixed length', () => {
  const src = readFileSync(new URL('../src/marketplace.js', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /description[^`]*slice\(0,\s*\d+\)/)
  assert.match(readFileSync(new URL('../src/ui.css', import.meta.url), 'utf8'), /\.lcard\.shop \.desc\{[^}]*line-clamp/)
})

test('regression (class 11): members can reset a forgotten password from the sign-in page, in English and Chinese', () => {
  const src = readFileSync(new URL('../src/account.js', import.meta.url), 'utf8')
  assert.match(src, /resetPasswordForEmail/)
  assert.match(src, /PASSWORD_RECOVERY/)
  assert.match(src, /Forgot password\?', '忘記密碼？'/)
})
