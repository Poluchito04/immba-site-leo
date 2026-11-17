// The three marketplace tabs of "My account": My orders (buyer), My listings (seller) and Sales (seller orders + accounting).
import { esc } from './util.js'
import { t } from './i18n.js'
import { toast, skeletonList } from './ui.js'
import { available, money, salesSummary, monthStats, monthsWithSales, ordersToCsv, STATUS, stockState } from './trade.js'
import { orderCard, bindOrderActions, loadItems } from './trade-ui.js'

const CATS = [['books', 'Books', '書籍'], ['notes', 'Notes', '筆記'], ['electronics', 'Electronics', '電子產品'], ['other', 'Other', '其他']]
const download = (name, text) => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })), download: name })
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
const day = () => new Date().toISOString().slice(0, 10)
/** the seller accounts this person acts for: themself, plus the demo store when they are the super admin */
export const sellerIds = (ctx) => [ctx.uid, ...(ctx.role === 'super_admin' && ctx.storeId ? [ctx.storeId] : [])]
const run = (supabase) => async (id, to, ref) => (await supabase.rpc('advance_order', { p_order: id, p_to: to, p_ref: ref || null })).error?.message

/** number of orders that need the seller's attention (shown as a badge on the Sales tab) */
export async function sellerTodo(supabase, ctx) {
  const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).in('seller_id', sellerIds(ctx)).in('status', ['payment_confirmed', 'ready_to_ship'])
  return count || 0
}
/** orders waiting for the buyer's attention: unpaid ones, or shipped ones to confirm */
export async function buyerTodo(supabase, uid) {
  const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', uid).in('status', ['waiting_payment', 'shipped'])
  return count || 0
}

/* -------------------------------------------- buyer: My orders -------------------------------------------- */
const F = { buy: 'all', sell: 'todo' }

export async function loadPurchases(pane, ctx) {
  const { supabase, uid } = ctx
  pane.innerHTML = skeletonList(4)
  const { data: orders, error } = await supabase.from('orders').select('*').eq('buyer_id', uid).order('created_at', { ascending: false })
  if (!pane.isConnected) return
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)} — ${t('did you run supabase/v6.sql?', '是否已執行 supabase/v6.sql？')}</div>`; return }
  const items = await loadItems(supabase, orders)
  if (!pane.isConnected) return
  const groups = { all: () => true, active: (o) => !['completed', 'cancelled'].includes(o.status), completed: (o) => o.status === 'completed', cancelled: (o) => o.status === 'cancelled' }
  const label = { all: ['All', '全部'], active: ['In progress', '進行中'], completed: ['Completed', '已完成'], cancelled: ['Cancelled', '已取消'] }
  const list = orders.filter(groups[F.buy])
  const fresh = new URLSearchParams(location.search).get('placed')
  pane.innerHTML = `${fresh ? `<div class="msg ok" style="margin-bottom:0">${t(`Order ${esc(fresh)} placed. Pay the Total Due as shown below and press “I have paid”.`, `訂單 ${esc(fresh)} 已成立。請依下方說明付款，然後按「我已付款」。`)}</div>` : ''}<div class="spread" style="margin-top:22px"><h3 style="margin:0">${t('My orders', '我的訂單')} (${orders.length})</h3>
      <span class="acts"><a class="btn sm" href="/marketplace.html">${t('Keep shopping', '繼續購物')}</a>${orders.length ? `<button class="btn sm o" id="csv">${t('Download purchase history (CSV)', '下載購買紀錄 (CSV)')}</button>` : ''}</span></div>
    <div class="chips" style="margin:12px 0">${Object.keys(groups).map((k) => `<button data-f="${k}" class="${F.buy === k ? 'on' : ''}">${t(...label[k])} ${orders.filter(groups[k]).length}</button>`).join('')}</div>
    ${list.length ? `<div class="olist">${list.map((o) => orderCard(o, items, { who: ctx.who, side: 'buyer', settings: ctx.settings })).join('')}</div>`
      : `<div class="msg">${orders.length ? t('No orders in this group.', '此分類沒有訂單。') : t('You have not bought anything yet. Browse the marketplace and add products to your cart.', '您還沒有購買任何商品。到市集逛逛，把商品加入購物車吧。')}</div>`}`
  pane.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { F.buy = b.dataset.f; loadPurchases(pane, ctx) }))
  const csv = pane.querySelector('#csv'); if (csv) csv.onclick = () => { download(`my-purchases-${day()}.csv`, ordersToCsv(orders, items, 'buyer')); toast(t('Purchase history downloaded.', '已下載購買紀錄。')) }
  bindOrderActions(pane, run(supabase), (err, to) => {
    err ? toast(err, 'err', 6000) : toast(to === 'completed' ? t('Thanks! The order is completed and kept in your history.', '謝謝！訂單已完成，並保留在您的紀錄中。') : to === 'payment_submitted' ? t('Payment reported. An administrator will confirm it shortly.', '已回報付款，管理員會盡快確認。') : t('Order updated.', '訂單已更新。'))
    loadPurchases(pane, ctx); ctx.badges?.()
  }, (id) => orders.find((o) => o.id === id))
}

/* --------------------------------------- seller: Sales dashboard + orders --------------------------------------- */
const M = { month: 'all' } // month filter of the financial report

export async function loadSales(pane, ctx) {
  const { supabase } = ctx
  pane.innerHTML = skeletonList(4)
  const { data: orders, error } = await supabase.from('orders').select('*').in('seller_id', sellerIds(ctx)).order('created_at', { ascending: false })
  if (!pane.isConnected) return
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)} — ${t('did you run supabase/v7.sql?', '是否已執行 supabase/v7.sql？')}</div>`; return }
  const items = await loadItems(supabase, orders)
  if (!pane.isConnected) return
  const s = salesSummary(orders)
  const months = monthsWithSales(orders)
  if (M.month !== 'all' && !months.includes(M.month)) M.month = 'all'
  const rep = monthStats(orders, M.month)
  const sold = items.filter((i) => rep.orders.some((o) => o.id === i.order_id)).reduce((a, i) => a + i.quantity, 0)
  const max = Math.max(1, ...s.months.map((m) => m.revenue))
  const kpi = (v, l, warn) => `<div class="kpi ${warn && v ? 'warn' : ''}"><b>${v}</b><span>${l}</span></div>`
  const sections = {
    todo: [t('To process', '待處理'), (o) => ['payment_confirmed', 'ready_to_ship'].includes(o.status)],
    pay: [t('Pending payments', '待付款'), (o) => ['waiting_payment', 'payment_submitted'].includes(o.status)],
    ship: [t('Pending shipments', '待出貨'), (o) => ['payment_confirmed', 'ready_to_ship'].includes(o.status)],
    transit: [t('Shipped', '已出貨'), (o) => o.status === 'shipped'],
    done: [t('Completed orders', '已完成訂單'), (o) => o.status === 'completed'],
    all: [t('All orders', '全部訂單'), () => true],
  }
  if (!sections[F.sell]) F.sell = 'todo'
  const list = orders.filter(sections[F.sell][1])
  pane.innerHTML = `<div class="spread" style="margin-top:22px"><h3 style="margin:0">${t('Seller order management', '賣家訂單管理')}</h3>
      ${orders.length ? `<button class="btn sm o" id="csv">${t('Download transaction records (CSV)', '下載交易紀錄 (CSV)')}</button>` : ''}</div>
    ${ctx.role === 'super_admin' && ctx.storeId ? `<p class="hint">${t('As super administrator you also run the “imMBA Demo Store”: its orders appear here.', '身為超級管理員，您也負責營運「imMBA Demo Store」：其訂單會顯示在這裡。')}</p>` : ''}
    <div class="kpis">${kpi(money(s.monthRevenue), t('Revenue this month', '本月營收'))}${kpi(s.completedCount, t('Completed orders', '已完成訂單'))}${kpi(`${s.pendingPayments.count} <small style="font-size:.9rem;color:var(--mut)">${money(s.pendingPayments.amount)}</small>`, t('Pending payments', '待付款'), true)}${kpi(s.toShip.count, t('Waiting for shipment', '等待出貨'), true)}</div>
    <div class="box" style="margin-top:8px;padding:16px 20px"><div class="spread"><b style="color:var(--g)">${t('Financial management (monthly report)', '財務管理（月報）')}</b>
        <span class="acts"><label class="chk" style="margin:0">${t('Filter by month', '依月份篩選')}<select id="mf" style="width:auto;margin-left:8px"><option value="all">${t('All months', '全部月份')}</option>${months.map((m) => `<option value="${m}" ${M.month === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label></span></div>
      <div class="repline"><span>${M.month === 'all' ? t('All months', '全部月份') : esc(M.month)}</span><span>${t(`${sold} items sold · ${rep.count} orders`, `售出 ${sold} 件 · ${rep.count} 筆訂單`)}</span><b>${t('Revenue', '營收')}: ${money(rep.revenue)}</b></div>
      <div class="bars">${s.months.map((m) => `<div style="height:${Math.max(2, (m.revenue / max) * 100)}%" title="${esc(m.key)}: ${money(m.revenue)}"><span>${m.revenue ? Math.round(m.revenue) : ''}</span></div>`).join('')}</div><div class="bl">${s.months.map((m) => `<span>${esc(m.label)}</span>`).join('')}</div>
      <small style="color:var(--mut)">${t('Revenue = goods + shipping of completed orders; the platform fee is not included.', '營收＝已完成訂單的商品金額＋運費，不含平台手續費。')}</small></div>
    <div class="chips" style="margin:18px 0 12px">${Object.entries(sections).map(([k, [l, f]]) => `<button data-f="${k}" class="${F.sell === k ? 'on' : ''}">${esc(l)} ${orders.filter(f).length}</button>`).join('')}</div>
    ${list.length ? `<div class="olist">${list.map((o) => orderCard(o, items, { who: ctx.who, side: 'seller', settings: ctx.settings })).join('')}</div>`
      : `<div class="msg">${orders.length ? t('Nothing here. You are all caught up.', '這裡沒有項目，全部處理完了。') : t('No orders yet. When a buyer orders one of your listings it shows up here.', '還沒有訂單。買家下單後會顯示在這裡。')}</div>`}`
  pane.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { F.sell = b.dataset.f; loadSales(pane, ctx) }))
  pane.querySelector('#mf').onchange = (e) => { M.month = e.target.value; loadSales(pane, ctx) }
  const csv = pane.querySelector('#csv'); if (csv) csv.onclick = () => { download(`my-sales-${day()}.csv`, ordersToCsv(orders, items, 'seller')); toast(t('Transaction records downloaded.', '已下載交易紀錄。')) }
  bindOrderActions(pane, run(supabase), (err, to) => {
    err ? toast(err, 'err', 6000) : toast(t(`Order moved to “${t(...STATUS[to])}”.`, `訂單已更新為「${t(...STATUS[to])}」。`))
    loadSales(pane, ctx); ctx.badges?.()
  }, (id) => orders.find((o) => o.id === id))
}

/* ------------------------------------------ seller: listings + inventory ------------------------------------------ */
let editing = null // listing being edited, 'new', or null
const wantsNew = () => /new=1/.test(location.hash)

export async function loadSelling(pane, ctx) {
  const { supabase, uid, email } = ctx
  pane.innerHTML = skeletonList(4)
  const { data: rows, error } = await supabase.from('listings').select('*').in('seller_id', sellerIds(ctx)).order('created_at', { ascending: false })
  if (!pane.isConnected) return
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)} — ${t('did you run supabase/v6.sql?', '是否已執行 supabase/v6.sql？')}</div>`; return }
  const state = (l) => !l.active ? ['hidden', t('Hidden', '已隱藏')] : l.status === 'approved' ? ['', t('Live', '上架中')] : l.status === 'pending' ? ['pending', t('In review', '審核中')] : ['rejected', t('Rejected', '未通過')]
  const reload = () => loadSelling(pane, ctx)
  pane.innerHTML = `<div class="spread" style="margin-top:22px"><div><h3 style="margin:0">${t('My listings', '我的商品')} (${rows.length})</h3><small style="color:var(--mut)">${t('Total available stock', '可售庫存總計')}: <b>${rows.filter((l) => l.active && l.status === 'approved').reduce((a, l) => a + available(l), 0)}</b> ${t('items', '件')}</small></div><button class="btn sm" id="new">${t('+ New listing', '+ 新增商品')}</button></div>
    <p class="hint">${t('New and edited listings are reviewed by an administrator before buyers see them. Stock, hiding and removing take effect at once.', '新增或修改的商品需經管理員審核後買家才看得到；庫存、隱藏與移除會立即生效。')}</p>
    <div id="lform"></div>
    <div class="mlist">${rows.map((l) => { const [cls, name] = state(l); return `<article class="mrow ${l.active ? '' : 'off'}" data-id="${l.id}">
      ${l.image_url ? `<img class="cph" src="${esc(l.image_url)}" alt="">` : '<div class="cph none">📦</div>'}
      <div class="mi"><b>${esc(l.title)}</b> <span class="pill ${cls}">${esc(name)}</span><br><small>${esc(t(...(CATS.find((c) => c[0] === l.category) || CATS[3]).slice(1)))} · ${money(l.price)}</small>
        <div class="stockline"><span>${t('Available', '可售')}: <b>${available(l)}</b> = ${t('inventory', '庫存')} ${l.quantity} − ${t('purchased', '已售')} ${l.purchased}</span>${stockState(l) === 'low' ? ` <span class="stock low">${t(`Low stock alert: only ${available(l)} left`, `庫存警示：僅剩 ${available(l)} 件`)}</span>` : stockState(l) === 'out' ? ` <span class="stock out">${t('Sold out', '已售完')}</span>` : ''}</div></div>
      <div class="mact"><div class="stepq sm" title="${t('Inventory', '庫存')}"><button data-q="-1" aria-label="−">−</button><span>${l.quantity}</span><button data-q="1" aria-label="+">+</button></div>
        <button class="btn sm o" data-edit="${l.id}">${t('Edit item', '編輯商品')}</button>${available(l) > 0 ? `<button class="btn sm o" data-sold="${l.id}">${t('Mark as sold', '標記售完')}</button>` : ''}<button class="btn sm o" data-hide="${l.id}">${l.active ? t('Hide', '隱藏') : t('Show', '重新上架')}</button><button class="btn sm danger" data-rm="${l.id}">${t('Remove', '移除')}</button></div></article>` }).join('') || `<div class="msg">${t('You have no listings yet. Create your first one.', '您還沒有商品，新增第一則吧。')}</div>`}</div>`

  const form = pane.querySelector('#lform')
  if (wantsNew()) { editing = 'new'; history.replaceState(null, '', '#selling') }
  const open = (l) => { editing = l; paintForm() }
  pane.querySelector('#new').onclick = () => open('new')
  const find = (id) => rows.find((r) => r.id === id)
  const upd = async (id, patch, ok) => { const { error: e } = await supabase.from('listings').update(patch).eq('id', id); e ? toast(friendly(e, find(id)), 'err', 6000) : (toast(ok), reload(), ctx.badges?.()) }
  pane.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => { open(find(b.dataset.edit)); form.scrollIntoView({ behavior: 'smooth', block: 'center' }) }))
  pane.querySelectorAll('[data-sold]').forEach((b) => (b.onclick = () => { const l = find(b.dataset.sold); if (confirm(t(`Mark “${l.title}” as sold? Its inventory is set to what was already purchased.`, `將「${l.title}」標記為售完？庫存會改為已售出數量。`))) upd(l.id, { quantity: l.purchased }, t('Marked as sold.', '已標記為售完。')) }))
  pane.querySelectorAll('[data-hide]').forEach((b) => (b.onclick = () => { const l = find(b.dataset.hide); upd(l.id, { active: !l.active }, l.active ? t('Listing hidden from buyers.', '商品已對買家隱藏。') : t('Listing is visible again.', '商品已重新上架。')) }))
  pane.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { const l = find(b.closest('.mrow').dataset.id); const q = l.quantity + Number(b.dataset.q); if (q < l.purchased) return toast(t(`Inventory cannot go below what is already purchased (${l.purchased}).`, `庫存不能低於已售數量（${l.purchased}）。`), 'err'); if (q > 9999) return; upd(l.id, { quantity: q }, t('Inventory updated.', '庫存已更新。')) }))
  pane.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = async () => {
    const l = find(b.dataset.rm)
    if (!confirm(t(`Remove “${l.title}”? This cannot be undone.`, `移除「${l.title}」？此動作無法復原。`))) return
    const { error: e } = await supabase.from('listings').delete().eq('id', l.id)
    if (!e) { toast(t('Listing removed.', '商品已移除。')); return reload() }
    // sold items are business records: they cannot disappear, so we hide them instead
    if (e.code === '23503') { await supabase.from('listings').update({ active: false }).eq('id', l.id); toast(t('This listing has orders, so it was hidden instead of deleted (sales records are kept).', '此商品已有訂單，因此改為隱藏而非刪除（銷售紀錄會保留）。'), 'ok', 6500); return reload() }
    toast(e.message, 'err', 6000)
  }))

  function paintForm() {
    if (!editing) { form.innerHTML = ''; return }
    const l = editing === 'new' ? { title: '', category: 'books', price: 0, quantity: 1, description: '', seller_name: email.split('@')[0] } : editing
    form.innerHTML = `<form class="box" id="lf" style="margin-top:14px"><h3 style="margin-top:0">${editing === 'new' ? t('New listing', '新增商品') : t('Edit listing', '編輯商品')}</h3>
      <div class="row2"><div><label>${t('Product name', '商品名稱')} *</label><input name="title" required minlength="3" maxlength="120" value="${esc(l.title)}"></div>
      <div><label>${t('Category', '類別')}</label><select name="category">${CATS.map(([k, en, zh]) => `<option value="${k}" ${l.category === k ? 'selected' : ''}>${t(en, zh)}</option>`).join('')}</select></div>
      <div><label>${t('Price (NT$)', '價格 (NT$)')} *</label><input type="number" name="price" min="0" max="100000" step="1" required value="${l.price}"></div>
      <div><label>${t('Quantity in stock', '庫存數量')} *</label><input type="number" name="quantity" min="${l.purchased || 0}" max="9999" step="1" required value="${l.quantity}"></div>
      <div><label>${t('Seller name shown to buyers', '顯示給買家的賣家名稱')} *</label><input name="seller_name" required minlength="2" maxlength="80" value="${esc(l.seller_name)}"></div>
      <div><label>${t('Product image (JPG/PNG/WebP, max 2 MB)', '商品圖片（JPG/PNG/WebP，最大 2 MB）')}</label><input type="file" name="image" accept="image/jpeg,image/png,image/webp"></div></div>
      ${l.image_url ? `<p class="hint">${t('Current image kept unless you choose a new one.', '除非選擇新圖片，否則保留目前圖片。')}</p>` : ''}
      <label>${t('Description', '說明')}</label><textarea name="description" rows="3" maxlength="1000">${esc(l.description || '')}</textarea>
      <p class="acts"><button class="btn" type="submit">${editing === 'new' ? t('Submit for review', '送出審核') : t('Save changes', '儲存變更')}</button><button class="btn o" type="button" id="lc">${t('Cancel', '取消')}</button></p></form>`
    form.querySelector('#lc').onclick = () => { editing = null; paintForm() }
    form.querySelector('#lf').onsubmit = async (e) => {
      e.preventDefault()
      const f = e.target, btn = f.querySelector('[type=submit]')
      const file = f.image.files[0]
      if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) return toast(t('The image must be JPG, PNG or WebP and at most 2 MB.', '圖片須為 JPG、PNG 或 WebP，且不超過 2 MB。'), 'err')
      btn.disabled = true
      const row = { title: f.title.value.trim(), category: f.category.value, price: Number(f.price.value), quantity: Number(f.quantity.value), seller_name: f.seller_name.value.trim(), description: f.description.value.trim() || null }
      if (file) {
        const path = `${uid}/${crypto.randomUUID()}.${file.type.split('/')[1].replace('jpeg', 'jpg')}`
        const up = await supabase.storage.from('listing-images').upload(path, file, { contentType: file.type })
        if (up.error) { btn.disabled = false; return toast(up.error.message, 'err', 6000) }
        row.image_url = supabase.storage.from('listing-images').getPublicUrl(path).data.publicUrl
      }
      const res = editing === 'new' ? await supabase.from('listings').insert({ ...row, seller_id: uid, status: 'pending' }) : await supabase.from('listings').update(row).eq('id', editing.id)
      if (res.error) { btn.disabled = false; return toast(friendly(res.error, editing === 'new' ? null : editing), 'err', 6000) }
      const wasNew = editing === 'new'; editing = null
      toast(wasNew ? t('Submitted! It appears in the marketplace once an administrator approves it.', '已送出！管理員核准後就會出現在市集。') : t('Saved. Changes to what buyers read go back to review.', '已儲存。影響買家閱讀的修改會重新送審。'), 'ok', 5500)
      reload(); ctx.badges?.()
    }
  }
  paintForm()
}

function friendly(e, l) {
  if (e.code === '23514' && /stock/.test(e.message)) return t(`Inventory cannot be lower than what is already purchased (${l?.purchased ?? 0}).`, `庫存不能低於已售數量（${l?.purchased ?? 0}）。`)
  return e.message
}
