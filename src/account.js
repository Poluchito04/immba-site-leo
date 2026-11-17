import { supabase, configured, esc } from './supabase.js'
import { mountChrome } from './chrome.js'
import { t } from './i18n.js'
import { toast } from './ui.js'
import { pwField, bindPasswords, matchHint } from './password.js'
import { loadPurchases, loadSelling, loadSales, sellerTodo } from './account-trade.js'

mountChrome({ skeleton: 'form' })
const app = document.getElementById('app')
let session = null, role = null, mode = 'login', inquiries = [], pendingEmail = null, tab = (location.hash || '').slice(1)

const STATUS = { new: ['New', '新'], in_progress: ['In progress', '處理中'], answered: ['Answered', '已回覆'], closed: ['Closed', '已結案'] }

function authForm() {
  const titles = { login: t('Sign in', '登入'), register: t('Create your account', '建立帳號') }
  app.innerHTML = `<form class="box auth" id="f"><h3 style="margin-top:0">${titles[mode]}</h3>
    <label>Email</label><input type="email" name="email" required autocomplete="email">
    ${pwField({ name: 'password', label: t('Password', '密碼'), autocomplete: mode === 'login' ? 'current-password' : 'new-password' })}
    ${mode === 'register' ? `${pwField({ name: 'password2', label: t('Confirm password', '確認密碼'), autocomplete: 'new-password' })}${matchHint}<p style="font-size:12px;color:var(--mut);margin:8px 0 0">${t('At least 6 characters.', '至少 6 個字元。')}</p>` : ''}
    <p><button class="btn" type="submit" style="width:100%">${titles[mode]}</button></p>
    <p style="font-size:14px;text-align:center">${mode === 'login' ? `<a href="#" data-m="register">${t('Create an account', '建立帳號')}</a>` : `<a href="#" data-m="login">${t('Already registered? Sign in', '已有帳號？登入')}</a>`}</p>
    <p style="font-size:12px;color:var(--mut);text-align:center">${t('Member accounts let you follow your inquiries. Administrators use the', '會員帳號可追蹤您的諮詢。管理員請使用')} <a href="/admin.html">${t('back office', '後台')}</a>.</p></form>`
  app.querySelectorAll('[data-m]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); mode = a.dataset.m; authForm() }))
  const pw = bindPasswords(app, (k) => ({ show: t('Show password', '顯示密碼'), hide: t('Hide password', '隱藏密碼'), match: t('Passwords match', '密碼相符'), mismatch: t('Passwords do not match', '兩次輸入的密碼不一致') }[k]))
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault()
    if (mode === 'register' && !pw.matches()) return document.querySelector('[name=password2]').reportValidity()
    const fd = new FormData(e.target), email = fd.get('email'), password = fd.get('password')
    const btn = e.target.querySelector('button'); btn.disabled = true
    let error
    if (mode === 'login') ({ error } = await supabase.auth.signInWithPassword({ email, password }))
    else {
      const r = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + '/account.html', data: { kind: 'member' } } })
      error = r.error
      if (!error && !r.data.session) { pendingEmail = email; return checkEmail() }
    }
    btn.disabled = false
    if (error) {
      if (/not confirmed/i.test(error.message)) { pendingEmail = email; return checkEmail() }
      toast(error.message, 'err', 6000)
    }
  }
}

function checkEmail() {
  app.innerHTML = `<div class="box auth"><h3 style="margin-top:0">${t('Check your email', '請查收電子郵件')}</h3><p>${t('Confirm your address with the link we sent to', '請點擊我們寄到以下信箱的連結完成驗證：')} <b>${esc(pendingEmail)}</b>. ${t('Then come back and sign in.', '然後回來登入。')}</p>
    <p class="acts"><button class="btn o" id="rs">${t('Resend email', '重新寄送')}</button><button class="btn" id="bk">${t('Back to sign in', '返回登入')}</button></p></div>`
  document.getElementById('bk').onclick = () => { mode = 'login'; authForm() }
  document.getElementById('rs').onclick = async () => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: pendingEmail, options: { emailRedirectTo: location.origin + '/account.html' } })
    toast(error ? error.message : t('Email sent again.', '已重新寄出。'), error ? 'err' : 'ok')
  }
}

const TABS = [['purchases', 'My orders', '我的訂單'], ['selling', 'My listings', '我的商品'], ['sales', 'Sales', '銷售'], ['inquiries', 'My inquiries', '我的諮詢']]

function inquiriesPane(pane) {
  pane.innerHTML = `<div class="spread" style="margin-top:22px"><h3 style="margin:0">${t('My inquiries', '我的諮詢')} (${inquiries.length})</h3><a class="btn sm" href="/contact.html">${t('New inquiry', '新增諮詢')}</a></div>
    ${inquiries.length ? `<div class="grid" style="margin-top:14px">${inquiries.map((q) => `<article class="lcard"><small>${esc(new Date(q.created_at).toLocaleDateString())} · ${esc(q.topic)}</small><h4>${esc(q.message.slice(0, 90))}${q.message.length > 90 ? '…' : ''}</h4>
      <p><span class="pill ${q.status === 'closed' ? 'rejected' : q.status === 'new' ? 'pending' : ''}">${esc(t(...STATUS[q.status]))}</span></p>${q.admin_note ? `<p><b>${t('Reply note', '回覆備註')}:</b> ${esc(q.admin_note)}</p>` : ''}</article>`).join('')}</div>`
      : `<div class="msg">${t('You have not sent any inquiry from this account yet.', '此帳號尚未送出任何諮詢。')}</div>`}`
}

async function dashboard() {
  const { data, error } = await supabase.from('inquiries').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
  if (error) return (app.innerHTML = `<div class="msg err">${esc(error.message)}</div>`)
  inquiries = data
  const staff = role === 'admin' || role === 'super_admin'
  const trader = staff || role === 'member'              // pending / rejected administrator applicants cannot trade
  const tabs = trader ? TABS : TABS.filter((x) => x[0] === 'inquiries')
  if (!tabs.some((x) => x[0] === tab)) tab = tabs[0][0]
  app.innerHTML = `<div class="spread" style="margin-top:26px"><div><h3 style="margin:0">${t('Welcome', '歡迎')}, ${esc(session.user.email)}</h3><span class="pill ${staff ? 'super_admin' : ''}">${esc(staff ? role : role === 'member' ? 'member' : role || 'member')}</span>
      ${trader ? `<span class="rolehint">${t('You can buy and sell on the marketplace.', '您可以在市集購買與刊登商品。')}${staff ? ' ' + t('As an administrator you also monitor every transaction in the back office (read-only).', '身為管理員，您也可在後台監看所有交易（唯讀）。') : ''}</span>` : ''}</div>
    <div class="acts"><a class="btn" href="/marketplace.html">${t('Marketplace', '市集')}</a>${staff ? `<a class="btn o" href="/admin.html">${t('Back office', '後台')}</a>` : ''}<button class="btn o" id="out">${t('Sign out', '登出')}</button></div></div>
    <div class="tabs" role="tablist">${tabs.map(([k, en, zh]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${t(en, zh)}${k === 'sales' ? '<b class="tbadge" id="todo" hidden></b>' : ''}</button>`).join('')}</div><div id="tpane"></div>`
  document.getElementById('out').onclick = () => supabase.auth.signOut()
  const pane = document.getElementById('tpane')
  const ctx = { supabase, uid: session.user.id, email: session.user.email, role, badges }
  async function badges() {
    if (!trader) return
    const n = await sellerTodo(supabase, ctx.uid), b = document.getElementById('todo')
    if (b) { b.hidden = !n; b.textContent = n }
  }
  const show = () => ({ purchases: loadPurchases, selling: loadSelling, sales: loadSales, inquiries: inquiriesPane }[tab])(pane, ctx)
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, '', '#' + tab); app.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b)); show() }))
  show(); badges()
  // a seller who left the tab open sees new orders as soon as they come back to it
  document.onvisibilitychange = () => { if (!document.hidden && pane.isConnected && (tab === 'sales' || tab === 'purchases')) { show(); badges() } }
}

async function refresh() {
  document.getElementById('h-title').textContent = t('My account', '我的帳號')
  document.getElementById('h-sub').textContent = t('Buy, sell and follow your orders and inquiries.', '購買、刊登，並追蹤您的訂單與諮詢。')
  document.title = t('My account · imMBA', '我的帳號 · imMBA')
  if (!session) return pendingEmail ? checkEmail() : authForm()
  const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
  role = data?.role
  dashboard()
}

if (!configured) app.innerHTML = '<div class="msg err">Backend not connected.</div>'
else {
  supabase.auth.onAuthStateChange((ev, s) => { const prev = session?.user?.id; session = s; if (ev === 'TOKEN_REFRESHED' || (ev === 'SIGNED_IN' && prev === s?.user?.id && role)) return; refresh() })
  window.addEventListener('langchange', refresh)
}
