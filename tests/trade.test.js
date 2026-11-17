import test from 'node:test'
import assert from 'node:assert/strict'
import { actionsFor, available, stockState, stalled, salesSummary, matchesOrder, ordersToCsv, cartAdd, cartLines, cartTotal, cartCount, cartLoad, cartSave, progress, STATUS, FLOW, DAY } from '../src/trade.js'

const o = (over = {}) => ({ id: 'aaaa1111', order_no: 1001, buyer_id: 'B', seller_id: 'S', buyer_name: 'Bea', buyer_email: 'b@x.tw', buyer_contact: 'LINE bea', seller_name: 'Sam', seller_email: 's@x.tw', status: 'waiting_payment', total: 500, created_at: '2026-11-01T10:00:00Z', status_at: '2026-11-01T10:00:00Z', ...over })
const tos = (order, uid) => actionsFor(order, uid).map((a) => a.to)

test('stock formula: available = inventory − purchased, never negative', () => {
  assert.equal(available({ quantity: 5, purchased: 2 }), 3)
  assert.equal(available({ quantity: 1, purchased: 3 }), 0)
  assert.equal(stockState({ quantity: 5, purchased: 5 }), 'out')
  assert.equal(stockState({ quantity: 5, purchased: 3 }), 'low')
  assert.equal(stockState({ quantity: 5, purchased: 0 }), 'in')
})

test('the seller drives the order forward step by step', () => {
  assert.deepEqual(tos(o(), 'S'), ['payment_confirmed', 'cancelled'])
  assert.deepEqual(tos(o({ status: 'payment_confirmed' }), 'S'), ['ready_to_ship', 'cancelled'])
  assert.deepEqual(tos(o({ status: 'ready_to_ship' }), 'S'), ['shipped', 'cancelled'])
  assert.deepEqual(tos(o({ status: 'shipped' }), 'S'), ['completed'])
})

test('the buyer can only cancel before payment and confirm receipt after shipping', () => {
  assert.deepEqual(tos(o(), 'B'), ['cancelled'])
  assert.deepEqual(tos(o({ status: 'payment_confirmed' }), 'B'), [])
  assert.deepEqual(tos(o({ status: 'shipped' }), 'B'), ['completed'])
})

test('administrators, visitors and strangers get no actions (monitoring is not editing)', () => {
  for (const s of FLOW.concat('cancelled')) { assert.deepEqual(tos(o({ status: s }), 'ADMIN'), []); assert.deepEqual(tos(o({ status: s }), null), []) }
})

test('completed and cancelled orders are final', () => {
  assert.deepEqual(tos(o({ status: 'completed' }), 'S'), [])
  assert.deepEqual(tos(o({ status: 'cancelled' }), 'B'), [])
  assert.equal(progress('cancelled'), -1)
  assert.equal(progress('shipped'), 3)
})

test('every status has English and Chinese labels', () => {
  for (const s of [...FLOW, 'cancelled']) assert.equal(STATUS[s].length, 2)
})

test('stalled orders are flagged by how long they sit in one state', () => {
  const now = new Date('2026-11-10T10:00:00Z').getTime()
  assert.deepEqual(stalled(o(), now), { days: 9, limit: 3 })
  assert.equal(stalled(o({ status_at: new Date(now - DAY).toISOString() }), now), null)
  assert.equal(stalled(o({ status: 'completed' }), now), null)
  assert.equal(stalled(o({ status: 'cancelled' }), now), null)
})

test('seller accounting: revenue counts completed sales of the month, pending money is separate', () => {
  const now = new Date(2026, 10, 17)
  const orders = [
    o({ status: 'completed', total: 300, completed_at: new Date(2026, 10, 3).toISOString() }),
    o({ status: 'completed', total: 200, completed_at: new Date(2026, 9, 20).toISOString() }),
    o({ status: 'waiting_payment', total: 100 }),
    o({ status: 'payment_confirmed', total: 50 }),
    o({ status: 'ready_to_ship', total: 25 }),
    o({ status: 'cancelled', total: 999 }),
  ]
  const s = salesSummary(orders, now)
  assert.equal(s.monthRevenue, 300)
  assert.equal(s.totalRevenue, 500)
  assert.equal(s.completedCount, 2)
  assert.deepEqual(s.pendingPayments, { count: 1, amount: 100 })
  assert.deepEqual(s.toShip, { count: 2, amount: 75 })
  assert.equal(s.months.length, 6)
  assert.equal(s.months.at(-1).revenue, 300)
  assert.equal(s.months.at(-2).revenue, 200)
})

test('admin search by order id accepts 1001, #1001, partial uuid, names', () => {
  assert.ok(matchesOrder(o(), '1001')); assert.ok(matchesOrder(o(), '#1001')); assert.ok(matchesOrder(o(), 'aaaa'))
  assert.ok(matchesOrder(o(), 'bea')); assert.ok(matchesOrder(o(), ''))
  assert.ok(!matchesOrder(o(), '2002'))
})

test('transaction CSV: seller columns, items joined, formulas defused, BOM for Excel', () => {
  const csv = ordersToCsv([o({ buyer_name: '=HYPERLINK("x")', status: 'completed', completed_at: '2026-11-05T00:00:00Z' })], [{ order_id: 'aaaa1111', title: 'Kotler', quantity: 2 }], 'seller')
  assert.ok(csv.startsWith('﻿Order ID,Order date,Status,Products,Total (NT$),Buyer,Buyer contact'))
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
