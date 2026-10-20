import { supabase, configured, esc } from './supabase.js'
import { mountChrome } from './chrome.js'
import { t } from './i18n.js'
import { toast } from './ui.js'

mountChrome()
const app = document.getElementById('app')
const CATS = [['books', 'Books', '書籍'], ['notes', 'Notes', '筆記'], ['electronics', 'Electronics', '電子產品'], ['other', 'Other', '其他']]
let rows = [], cat = 'all', flash = '', open = false

function render() {
  document.title = t('Marketplace · imMBA', '書籍教材市集 · imMBA')
  document.getElementById('h-title').textContent = t('Student marketplace', '書籍教材市集')
  document.getElementById('h-sub').textContent = t('Buy, sell or swap books and course materials with other imMBA students. Every listing is reviewed by an administrator before it appears.', '與 imMBA 同學買賣、交換書籍與教材。每則刊登皆經管理員審核後才會公開。')
  const list = rows.filter((r) => cat === 'all' || r.category === cat)
  const chips = [['all', 'All', '全部'], ...CATS].map(([k, en, zh]) => `<button data-c="${k}" class="${cat === k ? 'on' : ''}">${t(en, zh)}</button>`).join('')
  app.innerHTML = `${flash ? `<div class="msg ok">${esc(flash)}</div>` : ''}<div class="spread" style="margin-top:20px"><div class="chips" style="margin:0">${chips}</div><button class="btn" id="post">${t('+ Post a listing', '+ 刊登商品')}</button></div>
    <div id="form"></div>
    <div class="grid" style="margin-top:20px">${list.map((r) => `<article class="lcard"><small>${esc(t(...(CATS.find((c) => c[0] === r.category)?.slice(1) || ['Other', '其他'])))}</small><h4>${esc(r.title)}</h4>
      <div class="price">NT$ ${Number(r.price).toLocaleString()}</div><p>${esc(r.description || '')}</p><small>${t('Seller', '賣家')}: ${esc(r.seller_name)} · ${t('Contact', '聯絡')}: ${esc(r.contact)}</small></article>`).join('') || `<div class="msg" style="grid-column:1/-1">${t('No listings yet.', '目前沒有商品。')}</div>`}</div>`
  app.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { cat = b.dataset.c; flash = ''; render() }))
  document.getElementById('post').onclick = () => { open = !open; showForm() }
  if (open) showForm()
}

function showForm() {
  const host = document.getElementById('form')
  if (!open) { host.innerHTML = ''; return }
  host.innerHTML = `<form class="box" id="lf"><h3 style="margin-top:0">${t('New listing', '新增商品')}</h3>
    <div class="row2"><div><label>${t('Title', '商品名稱')} *</label><input name="title" required minlength="3" maxlength="120"></div>
    <div><label>${t('Category', '類別')}</label><select name="category">${CATS.map(([k, en, zh]) => `<option value="${k}">${t(en, zh)}</option>`).join('')}</select></div>
    <div><label>${t('Price (NT$)', '價格 (NT$)')} *</label><input type="number" name="price" min="0" max="100000" step="1" required value="0"></div>
    <div><label>${t('Your name', '您的姓名')} *</label><input name="seller_name" required minlength="2" maxlength="80"></div></div>
    <label>${t('Contact (email, LINE or phone)', '聯絡方式（Email、LINE 或電話）')} *</label><input name="contact" required minlength="3" maxlength="120">
    <label>${t('Description', '說明')}</label><textarea name="description" rows="3" maxlength="1000"></textarea>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <p class="acts"><button class="btn" type="submit">${t('Submit for review', '送出審核')}</button><button class="btn o" type="button" id="lc">${t('Cancel', '取消')}</button></p></form>`
  document.getElementById('lc').onclick = () => { open = false; showForm() }
  document.getElementById('lf').onsubmit = async (e) => {
    e.preventDefault()
    const f = e.target
    if (f.website.value) return // honeypot
    const btn = f.querySelector('[type=submit]'); btn.disabled = true
    const { error } = await supabase.from('listings').insert({
      title: f.title.value.trim(), category: f.category.value, price: Number(f.price.value), seller_name: f.seller_name.value.trim(),
      contact: f.contact.value.trim(), description: f.description.value.trim() || null, status: 'pending',
    })
    btn.disabled = false
    if (error) { host.insertAdjacentHTML('afterbegin', `<div class="msg err">${esc(error.message)}</div>`); return }
    toast(t('Thanks! Your listing was submitted and will appear once an administrator approves it.', '感謝！您的商品已送出，管理員審核通過後即會顯示。'), 'ok', 5000)
    open = false; render()
  }
}

async function load() {
  if (!configured) return
  const { data, error } = await supabase.from('listings').select('*').eq('status', 'approved').order('created_at', { ascending: false })
  if (error) { app.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return }
  rows = data; render()
}
window.addEventListener('langchange', render)
load()
