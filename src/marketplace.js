import { supabase, configured, esc } from './supabase.js'
import { mountChrome } from './chrome.js'
import { t } from './i18n.js'
import { toast, skeletonCards, autoReveal } from './ui.js'
import { available, stockState, money, cartLoad, cartSave, cartAdd, cartCount, cartLines, checkoutTotals } from './trade.js'
import { loadSettings } from './trade-ui.js'

mountChrome()
const app = document.getElementById('app')
const CATS = [['books', 'Books', '書籍'], ['notes', 'Notes', '筆記'], ['electronics', 'Electronics', '電子產品'], ['other', 'Other', '其他']]
const catName = (k) => t(...(CATS.find((c) => c[0] === k)?.slice(1) || ['Other', '其他']))
const S = { q: '', cat: 'all', sort: 'new', stock: false }
let settings = {}, rows = [], session = null, role = null, cart = [], loaded = false, ver = 0
const canTrade = () => Boolean(session) && ['member', 'admin', 'super_admin'].includes(role)

const stockBadge = (l) => {
  const a = available(l), s = stockState(l)
  return s === 'out' ? `<span class="stock out">${t('Sold out', '已售完')}</span>` : `<span class="stock ${s}">${s === 'low' ? t(`Only ${a} left`, `僅剩 ${a} 件`) : t(`${a} in stock`, `庫存 ${a} 件`)}</span>`
}
const photo = (l, cls = 'lph') => (l.image_url ? `<img class="${cls}" src="${esc(l.image_url)}" alt="${esc(l.title)}" loading="lazy">` : `<div class="${cls} none" aria-hidden="true">${{ books: '📚', notes: '📝', electronics: '🔌' }[l.category] || '🎁'}</div>`)

/* -------------------------------------------- browse -------------------------------------------- */
function filtered() {
  const q = S.q.trim().toLowerCase()
  const list = rows.filter((r) => (S.cat === 'all' || r.category === S.cat) && (!S.stock || available(r) > 0) &&
    (!q || (r.title + ' ' + (r.description || '') + ' ' + r.seller_name).toLowerCase().includes(q)))
  return list.sort(S.sort === 'low' ? (a, b) => a.price - b.price : S.sort === 'high' ? (a, b) => b.price - a.price : (a, b) => (a.created_at < b.created_at ? 1 : -1))
}

function banner() {
  if (!session) return `<div class="rolebar"><span><b>${t('Browsing as a visitor', '以訪客身分瀏覽')}</b> · ${t('sign in to buy or sell', '登入後即可購買或刊登')}</span><a class="btn sm" href="/account.html">${t('Sign in', '登入')}</a></div>`
  if (!canTrade()) return `<div class="rolebar"><span>${t('Your account cannot trade yet.', '您的帳號目前無法交易。')}</span></div>`
  const staff = role === 'admin' || role === 'super_admin'
  // the navigation buttons of the slide "Seller: Product Listing": Member Center | Platform Transactions | Admin Approval | Add New Item
  return `<div class="rolebar"><span><b>${esc(session.user.email)}</b> · ${staff ? t('buyer, seller and administrator', '買家、賣家與管理員') : t('you can buy and sell', '可購買與刊登')}</span>
    <span class="acts"><a class="btn sm o" href="/account.html#purchases">${t('Member center', '會員中心')}</a>${staff ? `<a class="btn sm o" href="/admin.html#orders">${t('Platform transactions', '平台交易')}</a><a class="btn sm o" href="/admin.html#marketplace">${t('Admin approval', '管理員審核')}</a>` : ''}<a class="btn sm" href="/account.html#selling?new=1">${t('Add new item', '新增商品')}</a></span></div>`
}

function render() {
  document.title = t('Marketplace · imMBA', '書籍教材市集 · imMBA')
  document.getElementById('h-title').textContent = t('Student marketplace', '書籍教材市集')
  document.getElementById('h-sub').textContent = t('Buy and sell books and course materials with other imMBA students. Every listing is reviewed by an administrator before it appears.', '與 imMBA 同學買賣書籍與教材。每則刊登皆經管理員審核後才會公開。')
  const chips = [['all', 'All', '全部'], ...CATS].map(([k, en, zh]) => `<button data-c="${k}" class="${S.cat === k ? 'on' : ''}">${t(en, zh)}</button>`).join('')
  const n = cartCount(cart)
  app.innerHTML = `${banner()}
    <div class="shopbar"><input id="q" type="search" placeholder="${t('Search books, notes, sellers…', '搜尋書籍、筆記、賣家…')}" value="${esc(S.q)}" aria-label="${t('Search', '搜尋')}">
      <select id="sort" aria-label="${t('Sort', '排序')}"><option value="new" ${S.sort === 'new' ? 'selected' : ''}>${t('Newest', '最新')}</option><option value="low" ${S.sort === 'low' ? 'selected' : ''}>${t('Price: low to high', '價格：低到高')}</option><option value="high" ${S.sort === 'high' ? 'selected' : ''}>${t('Price: high to low', '價格：高到低')}</option></select>
      <label class="chk"><input type="checkbox" id="stk" ${S.stock ? 'checked' : ''}> ${t('In stock only', '僅顯示有庫存')}</label>
      <span class="grow"></span>
      <button class="btn" id="cartbtn">🛒 ${t('Cart', '購物車')}${n ? ` <b class="cb">${n}</b>` : ''}</button></div>
    <div class="chips" style="margin:14px 0 0">${chips}</div>
    <div class="grid" id="grid" style="margin-top:18px"></div>`
  app.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { S.cat = b.dataset.c; render() }))
  const q = document.getElementById('q')
  q.oninput = () => { S.q = q.value; paintGrid() }
  document.getElementById('sort').onchange = (e) => { S.sort = e.target.value; paintGrid() }
  document.getElementById('stk').onchange = (e) => { S.stock = e.target.checked; paintGrid() }
  document.getElementById('cartbtn').onclick = openCart
  paintGrid()
  autoReveal(app)
}

function paintGrid() {
  const list = filtered()
  const g = document.getElementById('grid')
  g.innerHTML = `${list.map((r) => `<article class="lcard shop" tabindex="0" data-id="${r.id}" role="button" aria-label="${esc(r.title)}"><div class="imgwrap">${stockState(r) === 'out' ? `<span class="ribbon out">${t('Sold out', '已售完')}</span>` : stockState(r) === 'low' ? `<span class="ribbon">${t(`Low stock (${available(r)} left)`, `庫存偏低（剩 ${available(r)} 件）`)}</span>` : ''}${photo(r)}</div>
      <small>${esc(catName(r.category))}</small><h4>${esc(r.title)}</h4>
      <div class="spread"><div class="price">${money(r.price)}</div>${stockBadge(r)}</div>
      <p class="desc">${esc(r.description || '')}</p><small>${t('Seller', '賣家')}: ${esc(r.seller_name)}</small></article>`).join('') || `<div class="msg" style="grid-column:1/-1">${rows.length ? t('Nothing matches your filters.', '沒有符合條件的商品。') : t('No listings yet.', '目前沒有商品。')}</div>`}`
  g.querySelectorAll('.shop').forEach((c) => { c.onclick = () => openDetail(c.dataset.id); c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(c.dataset.id) } } })
}

/* ----------------------------------------- shared dialog ----------------------------------------- */
function dialog(html, cls = '') {
  document.getElementById('dlg')?.remove()
  const d = document.createElement('dialog'); d.id = 'dlg'; d.className = 'modal ' + cls
  d.innerHTML = `<button class="x" aria-label="${t('Close', '關閉')}">✕</button>${html}`
  document.body.appendChild(d)
  d.querySelector('.x').onclick = () => d.close()
  d.addEventListener('click', (e) => { if (e.target === d) d.close() })
  d.addEventListener('close', () => d.remove())
  d.showModal()
  return d
}

/* ------------------------------------------- product detail ------------------------------------------- */
function openDetail(id) {
  const l = rows.find((r) => r.id === id); if (!l) return
  const mine = session && l.seller_id === session.user.id
  const a = available(l), demo = !l.seller_id
  const d = dialog(`<div class="det">${photo(l, 'dph')}<div><small>${esc(catName(l.category))}</small><h3 style="margin:2px 0 8px">${esc(l.title)}</h3>
      <div class="spread"><div class="price" style="font-size:1.6rem">${money(l.price)}</div>${stockBadge(l)}</div>
      <p style="white-space:pre-wrap;margin:12px 0">${esc(l.description || t('No description.', '沒有說明。'))}</p>
      <p><small>${t('Seller', '賣家')}: <b>${esc(l.seller_name)}</b>${l.contact ? ` · ${esc(l.contact)}` : ''}</small></p>
      <div id="buy">${mine ? `<div class="msg">${t('This is your listing. Manage it from your account.', '這是您的商品，請至帳號管理。')} <a href="/account.html#selling">${t('Open', '前往')}</a></div>`
        : demo ? `<div class="msg">${t('Demo listing — it cannot be ordered.', '示範商品，無法下單。')}</div>`
        : !session ? `<a class="btn" href="/account.html">${t('Sign in to buy', '登入後購買')}</a>`
        : !canTrade() ? `<div class="msg">${t('Your account cannot buy yet.', '您的帳號目前無法購買。')}</div>`
        : a === 0 ? `<button class="btn" disabled>${t('Sold out', '已售完')}</button>`
        : `<div class="qty"><label for="qn" style="margin:0">${t('Quantity', '數量')}</label><div class="stepq"><button type="button" id="qm" aria-label="−">−</button><input id="qn" type="number" min="1" max="${Math.min(a, 99)}" value="1" inputmode="numeric"><button type="button" id="qp" aria-label="+">+</button></div></div>
           <p class="acts"><button class="btn" id="add">${t('Add to cart', '加入購物車')}</button></p>`}</div></div></div>`)
  const qn = d.querySelector('#qn')
  if (qn) {
    const clamp = (v) => Math.max(1, Math.min(Number(qn.max), v || 1))
    d.querySelector('#qm').onclick = () => (qn.value = clamp(+qn.value - 1))
    d.querySelector('#qp').onclick = () => (qn.value = clamp(+qn.value + 1))
    qn.onchange = () => (qn.value = clamp(+qn.value))
    d.querySelector('#add').onclick = () => {
      const r = cartAdd(cart, l, clamp(+qn.value))
      if (!r.added) return toast(t('All the available stock is already in your cart.', '購物車中已有全部可購買的庫存。'), 'err')
      cart = r.items; cartSave(session.user.id, cart); d.close(); render(); openCart()
    }
  }
}

/* ----------------------------------------------- cart drawer ----------------------------------------------- */
function openCart() {
  if (!session) return dialog(`<h3 style="margin-top:0">${t('Your cart', '購物車')}</h3><p>${t('Sign in to add products to your cart and place orders.', '請先登入才能加入購物車並下單。')}</p><p><a class="btn" href="/account.html">${t('Sign in', '登入')}</a></p>`)
  const draw = () => {
    const lines = cartLines(cart, rows), tot = checkoutTotals(lines, 'pickup', settings), good = lines.filter((x) => x.ok)
    const d = document.getElementById('dlg'); if (!d) return
    const body = d.querySelector('.cartbody')
    body.innerHTML = !lines.length ? `<div class="msg" style="text-align:center">${t('Your cart is empty.', '購物車是空的。')}<br><br><button class="btn o" id="keep">${t('Continue shopping', '繼續購物')}</button></div>` : `<ul class="clines">${lines.map((x) => `<li class="${x.ok ? '' : 'bad'}" data-id="${x.id}">
        ${x.listing ? photo(x.listing, 'cph') : '<div class="cph none">?</div>'}
        <div class="cinfo"><b>${esc(x.listing?.title || t('Item no longer available', '商品已下架'))}</b>
          <small>${x.listing ? `${money(x.listing.price)} · ${esc(x.listing.seller_name)}` : ''}${x.ok && x.wanted > x.qty ? ` · <span class="warn">${t(`only ${x.max} left`, `僅剩 ${x.max} 件`)}</span>` : ''}${x.listing && !x.ok ? ` · <span class="warn">${t('sold out', '已售完')}</span>` : ''}</small>
          ${x.ok ? `<div class="stepq sm" style="margin-top:6px;align-self:flex-start"><button data-m="-1" aria-label="−">−</button><span>${x.qty}</span><button data-m="1" aria-label="+" ${x.qty >= x.max ? 'disabled' : ''}>+</button></div>` : ''}</div>
        ${x.ok ? `<b class="lt">${money(x.qty * x.listing.price)}</b>` : ''}
        <button class="rm" data-rm="${x.id}" aria-label="${t('Remove', '移除')}">✕</button></li>`).join('')}</ul>
      <div class="sumline"><span>${t('Subtotal', '小計')}</span><b>${money(tot.subtotal)}</b></div>
      <p class="freebar">${t('Shipping and the platform fee are calculated at checkout. In-person pickup is free.', '運費與平台手續費於結帳時計算。面交自取免運費。')}</p>
      <p class="acts" style="margin-top:14px"><a class="btn" style="flex:1;text-align:center;${good.length ? '' : 'pointer-events:none;opacity:.5'}" href="/checkout.html">${t('Proceed to checkout', '前往結帳')}</a></p>`
    body.querySelector('#keep')?.addEventListener('click', () => d.close())
    body.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { cart = cart.filter((x) => x.id !== b.dataset.rm); cartSave(session.user.id, cart); draw(); render() }))
    body.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => {
      const id = b.closest('li').dataset.id, l = rows.find((r) => r.id === id)
      cart = cart.map((x) => (x.id === id ? { ...x, qty: Math.max(1, Math.min(Math.min(available(l), 99), x.qty + Number(b.dataset.m))) } : x))
      cartSave(session.user.id, cart); draw(); render()
    }))
  }
  dialog(`<h3 style="margin-top:0">🛒 ${t('Your cart', '購物車')}</h3><div class="cartbody"></div>`, 'drawer')
  draw()
}

/* ----------------------------------------------- data ----------------------------------------------- */
async function refreshRows() {
  const { data, error } = await supabase.from('listings').select('*').eq('status', 'approved').eq('active', true).order('created_at', { ascending: false })
  if (error) { app.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return false }
  rows = data; return true
}
async function whoAmI() {
  role = null
  if (session) { const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle(); role = data?.role || null }
  cart = cartLoad(session?.user.id)
}

async function load() {
  if (!configured) return
  app.innerHTML = skeletonCards(6)
  const { data } = await supabase.auth.getSession(); session = data.session
  await Promise.all([whoAmI(), loadSettings(supabase).then((x) => (settings = x)), refreshRows().then((ok) => { loaded = ok })])
  if (loaded) render()
  supabase.auth.onAuthStateChange(async (ev, s) => {
    if (ev === 'TOKEN_REFRESHED' || (ev === 'SIGNED_IN' && s?.user?.id === session?.user?.id)) return
    const me = ++ver; session = s; await whoAmI(); if (me === ver && loaded) render()
  })
}
window.addEventListener('langchange', () => { if (loaded) { render(); document.getElementById('dlg')?.close() } })
load()
