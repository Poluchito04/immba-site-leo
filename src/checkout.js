import { supabase, configured, esc } from './supabase.js'
import { mountChrome } from './chrome.js'
import { t } from './i18n.js'
import { toast } from './ui.js'
import { money, cartLoad, cartSave, cartLines, checkoutTotals, SHIPPING } from './trade.js'
import { loadSettings } from './trade-ui.js'

mountChrome({ skeleton: 'form' })
const app = document.getElementById('app')
let session = null, role = null, settings = {}, rows = [], cart = [], busy = false
const F = { shipping: 'pickup', contact: '', name: '', address: '', note: '' }

const photo = (l) => (l?.image_url ? `<img class="cph" src="${esc(l.image_url)}" alt="">` : '<div class="cph none">📦</div>')

function render() {
  document.title = t('Checkout · imMBA', '結帳 · imMBA')
  document.getElementById('h-title').textContent = t('Checkout', '結帳')
  document.getElementById('h-sub').textContent = t('Review your items, choose how to receive them and place the order.', '確認商品、選擇取貨方式並送出訂單。')
  if (!session) return (app.innerHTML = `<div class="box auth"><h3 style="margin-top:0">${t('Sign in to check out', '請先登入再結帳')}</h3><p><a class="btn" href="/account.html">${t('Sign in', '登入')}</a></p></div>`)
  if (!['member', 'admin', 'super_admin'].includes(role)) return (app.innerHTML = `<div class="msg">${t('Your account cannot place orders yet.', '您的帳號目前無法下單。')}</div>`)
  const lines = cartLines(cart, rows), good = lines.filter((l) => l.ok), tot = checkoutTotals(lines, F.shipping, settings)
  if (!lines.length) return (app.innerHTML = `<div class="msg" style="text-align:center">${t('Your cart is empty.', '購物車是空的。')}<br><br><a class="btn" href="/marketplace.html">${t('Back to the marketplace', '回到市集')}</a></div>`)
  const opt = (k, note) => `<label class="ship-opt ${F.shipping === k ? 'on' : ''}"><input type="radio" name="ship" value="${k}" ${F.shipping === k ? 'checked' : ''}><span><b>${t(...SHIPPING[k])}</b>${k === 'delivery' ? ` · ${money(settings.delivery_fee ?? 80)}` : ''}<small>${note}</small></span></label>`
  app.innerHTML = `<a href="/marketplace.html" class="hint" style="display:inline-block;margin-top:18px">← ${t('Continue shopping', '繼續購物')}</a>
    <form class="co" id="co"><div>
      <h3 class="cot">${t('Contact', '聯絡資料')}</h3>
      <div class="row2"><div><label>${t('Your name', '您的姓名')}</label><input name="name" maxlength="120" value="${esc(F.name)}"></div>
        <div><label>${t('Contact for the seller', '給賣家的聯絡方式')} *</label><input name="contact" required minlength="3" maxlength="120" placeholder="${t('LINE ID, phone or email', 'LINE ID、電話或 Email')}" value="${esc(F.contact)}"></div></div>
      <h3 class="cot">${t('Shipping method', '取貨方式')}</h3>
      ${opt('pickup', t('Meet the seller on campus. No shipping fee.', '與賣家面交，免運費。'))}${opt('delivery', t('The seller sends it to your address (fee per seller order).', '由賣家寄送到您的地址（每位賣家訂單各收一次運費）。'))}
      ${F.shipping === 'delivery' ? `<label>${t('Delivery address', '收件地址')} *</label><textarea name="address" rows="2" required minlength="5" maxlength="300">${esc(F.address)}</textarea>` : ''}
      <label>${t('Note to the seller (optional)', '給賣家的備註（選填）')}</label><textarea name="note" rows="2" maxlength="500" placeholder="${t('Where and when can you meet?', '面交時間與地點？')}">${esc(F.note)}</textarea>
      <h3 class="cot">${t('Payment', '付款')}</h3>
      <div class="paybox"><p style="margin:0">${esc(settings.payment_instructions || '')}</p></div>
      <p class="hint">${t('You pay after placing the order. The order then appears in “My orders” with a button “I have paid”; an administrator confirms the money arrived, then the seller prepares your order.', '下單後再付款。訂單會出現在「我的訂單」並附「我已付款」按鈕；管理員確認款項入帳後，賣家才會備貨。')}</p>
      <p class="acts" style="margin-top:18px"><button class="btn" type="submit" id="go" ${good.length ? '' : 'disabled'}>${t('Place order', '送出訂單')} · ${money(tot.total)}</button></p></div>
    <aside class="sum"><h3 class="cot" style="margin-top:0">${t('Order summary', '訂單摘要')}</h3>
      ${lines.map((x) => `<div class="sitem ${x.ok ? '' : 'bad'}">${photo(x.listing)}<div class="cinfo"><b>${esc(x.listing?.title || t('Item no longer available', '商品已下架'))}</b><small>${x.listing ? `${esc(x.listing.seller_name)} · ${money(x.listing.price)} × ${x.qty}` : ''}${x.ok && x.wanted > x.qty ? ` · <span class="warn">${t(`only ${x.max} left`, `僅剩 ${x.max} 件`)}</span>` : ''}${x.listing && !x.ok ? ` · <span class="warn">${t('sold out', '已售完')}</span>` : ''}</small></div>${x.ok ? `<b>${money(x.qty * x.listing.price)}</b>` : `<button type="button" class="rm" data-rm="${x.id}">✕</button>`}</div>`).join('')}
      <div style="margin-top:12px"><div class="sumline"><span>${t('Subtotal', '小計')}</span><span>${money(tot.subtotal)}</span></div>
      <div class="sumline"><span>${t('Shipping', '運費')}${tot.orders > 1 && F.shipping === 'delivery' ? ` (${tot.orders} ${t('sellers', '位賣家')})` : ''}</span><span>${tot.shipping ? money(tot.shipping) : t('Free', '免費')}</span></div>
      <div class="sumline"><span>${t('Platform fee', '平台手續費')}${tot.orders > 1 ? ` (${tot.orders} ${t('orders', '筆訂單')})` : ''}</span><span>${money(tot.fee)}</span></div>
      <div class="sumline tot"><span>${t('Total due', '應付總額')}</span><span>${money(tot.total)}</span></div></div>
      ${tot.orders > 1 ? `<p class="hint">${t('Items from different sellers become separate orders, each handled by its own seller.', '不同賣家的商品會拆成各自的訂單，由各賣家分別處理。')}</p>` : ''}</aside></form>`
  const f = document.getElementById('co')
  const keep = () => { F.name = f.name.value; F.contact = f.contact.value; F.note = f.note.value; if (f.address) F.address = f.address.value }
  f.querySelectorAll('[name=ship]').forEach((r) => (r.onchange = () => { keep(); F.shipping = r.value; render() }))
  f.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { keep(); cart = cart.filter((x) => x.id !== b.dataset.rm); cartSave(session.user.id, cart); render() }))
  f.onsubmit = async (e) => {
    e.preventDefault(); if (busy) return; keep(); busy = true
    const btn = document.getElementById('go'); btn.disabled = true; btn.textContent = t('Placing order…', '送出中…')
    const items = good.map((x) => ({ listing_id: x.id, quantity: x.qty }))
    const { data, error } = await supabase.rpc('place_order', { p_items: items, p_contact: F.contact, p_note: F.note, p_name: F.name, p_shipping: F.shipping, p_address: F.address })
    busy = false
    if (error) { toast(error.message, 'err', 7000); await load(false); return }
    const ids = new Set(items.map((i) => i.listing_id))
    cartSave(session.user.id, cart.filter((x) => !ids.has(x.id)))
    location.href = `/account.html?placed=${encodeURIComponent(data.map((o) => '#' + o.order_no).join(', '))}#purchases`
  }
}

async function load(first = true) {
  if (!configured) return
  const { data } = await supabase.auth.getSession(); session = data.session
  if (session) {
    const [prof, st] = await Promise.all([supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle(), loadSettings(supabase)])
    role = prof.data?.role; settings = st; cart = cartLoad(session.user.id)
    if (first) { F.contact = session.user.email; F.name = session.user.email.split('@')[0] }
    const ids = cart.map((x) => x.id)
    const r = ids.length ? await supabase.from('listings').select('*').in('id', ids).eq('status', 'approved').eq('active', true) : { data: [] }
    rows = r.data || []
  }
  render()
}
window.addEventListener('langchange', render)
load()
