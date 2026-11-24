import { supabase, configured, esc } from './supabase.js'
import { mountChrome } from './chrome.js'
import { t } from './i18n.js'
import { toast } from './ui.js'
import { pwField, bindPasswords, matchHint } from './password.js'
import { loadPurchases, loadSelling, loadSales, sellerTodo, buyerTodo, sellerIds } from './account-trade.js'
import { loadSettings } from './trade-ui.js'

mountChrome({ skeleton: 'form' })
const app = document.getElementById('app')
let session = null, role = null, mode = 'login', recovering = false, inquiries = [], pendingEmail = null, tab = (location.hash || '').slice(1).split('?')[0]

const STATUS = { new: ['New', '新'], in_progress: ['In progress', '處理中'], answered: ['Answered', '已回覆'], closed: ['Closed', '已結案'] }

function authForm() {
  const titles = { login: t('Sign in', '登入'), register: t('Create your account', '建立帳號'), reset: t('Reset your password', '重設密碼') }
  app.innerHTML = `<form class="box auth" id="f"><h3 style="margin-top:0">${titles[mode]}</h3>
    <label>Email</label><input type="email" name="email" required autocomplete="email">
    ${mode === 'reset' ? `<p style="font-size:14px;color:var(--mut)">${t('Enter your email and we will send you a link to choose a new password.', '輸入電子郵件，我們會寄給您設定新密碼的連結。')}</p>` : pwField({ name: 'password', label: t('Password', '密碼'), autocomplete: mode === 'login' ? 'current-password' : 'new-password' })}
    ${mode === 'register' ? `${pwField({ name: 'password2', label: t('Confirm password', '確認密碼'), autocomplete: 'new-password' })}${matchHint}<p style="font-size:12px;color:var(--mut);margin:8px 0 0">${t('At least 6 characters.', '至少 6 個字元。')}</p>` : ''}
    <p><button class="btn" type="submit" style="width:100%">${titles[mode]}</button></p>
    <p style="font-size:14px;text-align:center">${mode === 'login' ? `<a href="#" data-m="register">${t('Create an account', '建立帳號')}</a> · <a href="#" data-m="reset">${t('Forgot password?', '忘記密碼？')}</a>` : `<a href="#" data-m="login">${mode === 'reset' ? t('← Back to sign in', '← 返回登入') : t('Already registered? Sign in', '已有帳號？登入')}</a>`}</p>
    <p style="font-size:12px;color:var(--mut);text-align:center">${t('Member accounts let you follow your inquiries. Administrators use the', '會員帳號可追蹤您的諮詢。管理員請使用')} <a href="/admin.html">${t('back office', '後台')}</a>.</p></form>`
  app.querySelectorAll('[data-m]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); mode = a.dataset.m; authForm() }))
  const pw = bindPasswords(app, (k) => ({ show: t('Show password', '顯示密碼'), hide: t('Hide password', '隱藏密碼'), match: t('Passwords match', '密碼相符'), mismatch: t('Passwords do not match', '兩次輸入的密碼不一致') }[k]))
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault()
    if (mode === 'register' && !pw.matches()) return document.querySelector('[name=password2]').reportValidity()
    const fd = new FormData(e.target), email = fd.get('email'), password = fd.get('password')
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true
    let error
    if (mode === 'reset') {
      ;({ error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/account.html' }))
      btn.disabled = false
      if (error) return toast(error.message, 'err', 6000)
      toast(t('If that email has an account, a reset link is on its way. Check your spam folder too.', '若該電子郵件已註冊，重設連結即將寄出（請也檢查垃圾郵件匣）。'), 'ok', 7000)
      mode = 'login'; return authForm()
    }
    if (mode === 'login') ({ error } = await supabase.auth.signInWithPassword({ email, password }))
    else {
      const r = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + '/account.html', data: { kind: 'member' } } })
      error = r.error
      if (!error && !r.data.session) { pendingEmail = email; return checkEmail() }
    }
    btn.disabled = false
    if (error) {
      if (/not confirmed/i.test(error.message)) { pendingEmail = email; return checkEmail() }
      toast(/rate limit/i.test(error.message) ? t('Too many e-mails were requested in the last hour. Please wait a little and try again, or ask the administrator.', '近一小時寄出的郵件過多，請稍候再試，或聯絡管理員。') : error.message, 'err', 6000)
    }
  }
}

/** the user came back from the reset e-mail: Supabase has signed them in with a recovery session, so ask for the new password */
function newPassword() {
  app.innerHTML = `<form class="box auth" id="f"><h3 style="margin-top:0">${t('Choose a new password', '設定新密碼')}</h3>
    ${pwField({ name: 'password', label: t('New password', '新密碼'), autocomplete: 'new-password' })}${pwField({ name: 'password2', label: t('Confirm password', '確認密碼'), autocomplete: 'new-password' })}${matchHint}
    <p style="font-size:12px;color:var(--mut);margin:8px 0 0">${t('At least 6 characters.', '至少 6 個字元。')}</p>
    <p><button class="btn" type="submit" style="width:100%">${t('Save password', '儲存密碼')}</button></p></form>`
  const pw = bindPasswords(app, (k) => ({ show: t('Show password', '顯示密碼'), hide: t('Hide password', '隱藏密碼'), match: t('Passwords match', '密碼相符'), mismatch: t('Passwords do not match', '兩次輸入的密碼不一致') }[k]))
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault()
    if (!pw.matches()) return app.querySelector('[name=password2]').reportValidity()
    const { error } = await supabase.auth.updateUser({ password: new FormData(e.target).get('password') })
    if (error) return toast(error.message, 'err', 6000)
    recovering = false; toast(t('Password updated.', '密碼已更新。'), 'ok'); refresh()
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

const TABS = { buyer: [['purchases', 'My orders', '我的訂單'], ['inquiries', 'My inquiries', '我的諮詢']], seller: [['selling', 'My listings', '我的商品'], ['sales', 'Orders & sales', '訂單與銷售'], ['inquiries', 'My inquiries', '我的諮詢']] }
const getMode = () => { try { return localStorage.getItem('immba-mode') === 'seller' ? 'seller' : 'buyer' } catch { return 'buyer' } }
const setMode = (m) => { try { localStorage.setItem('immba-mode', m) } catch { /* private mode */ } }

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
  const settings = trader ? await loadSettings(supabase) : {}
  const storeId = settings.demo_store_id || null
  let mode = getMode()
  if (tab === 'purchases') mode = 'buyer'; else if (tab === 'selling' || tab === 'sales') mode = 'seller'
  const tabsOf = () => (trader ? TABS[mode] : TABS.buyer.filter((x) => x[0] === 'inquiries'))
  if (!tabsOf().some((x) => x[0] === tab)) tab = tabsOf()[0][0]
  const ctx = { supabase, uid: session.user.id, email: session.user.email, role, settings, storeId, badges: null, who: { uid: session.user.id, admin: staff, superAdmin: role === 'super_admin', storeId } }
  // slide "Seller Mode / Buyer Mode": the same account switches between the two interfaces
  const [listedQ, boughtQ] = trader ? await Promise.all([
    supabase.from('listings').select('id', { count: 'exact', head: true }).in('seller_id', sellerIds(ctx)),
    supabase.from('order_items').select('quantity, orders!inner(buyer_id,status)').eq('orders.buyer_id', ctx.uid).neq('orders.status', 'cancelled'),
  ]) : [{}, {}]
  const listed = listedQ.count || 0, bought = (boughtQ.data || []).reduce((a, r) => a + r.quantity, 0)

  const draw = () => {
    const tabs = tabsOf()
    app.innerHTML = `<div class="spread" style="margin-top:26px"><div><h3 style="margin:0">${t('Welcome', '歡迎')}, ${esc(session.user.email)}</h3><span class="pill ${staff ? 'super_admin' : ''}">${esc(staff ? role : role === 'member' ? 'member' : role || 'member')}</span>
        ${trader ? `<span class="rolehint">${t('One account, three possible roles: buyer, seller and (if you are an administrator) platform admin.', '一個帳號，三種可能身分：買家、賣家，以及（若為管理員）平台管理員。')}</span>` : ''}</div>
      <div class="acts"><a class="btn" href="/marketplace.html">${t('Marketplace', '市集')}</a>${staff ? `<a class="btn o" href="/admin.html#orders">${t('Platform transactions', '平台交易')}</a>` : ''}<button class="btn o" id="out">${t('Sign out', '登出')}</button></div></div>
      ${trader ? `<div class="modebox"><div class="modesw" role="radiogroup" aria-label="${t('Current role', '目前身分')}"><b>${t('Current role', '目前身分')}</b>
          <label class="${mode === 'buyer' ? 'on' : ''}"><input type="radio" name="mode" value="buyer" ${mode === 'buyer' ? 'checked' : ''}> 🛒 ${t('Buyer mode', '買家模式')}</label>
          <label class="${mode === 'seller' ? 'on' : ''}"><input type="radio" name="mode" value="seller" ${mode === 'seller' ? 'checked' : ''}> 🏪 ${t('Seller mode', '賣家模式')}</label></div>
        <div class="kpis" style="margin:0"><div class="kpi"><b>${listed}</b><span>${t('Number of listed products', '上架商品數')}</span></div><div class="kpi"><b>${bought}</b><span>${t('Number of purchased items', '已購買件數')}</span></div><div class="kpi"><b style="font-size:1.3rem">${mode === 'buyer' ? t('Buyer mode', '買家模式') : t('Seller mode', '賣家模式')}</b><span>${t('Current mode', '目前模式')}</span></div></div></div>
        <p class="hint" style="margin-top:6px">${mode === 'buyer' ? t('Buyer mode: browse products, pay for your orders and follow them until they arrive.', '買家模式：瀏覽商品、支付訂單並追蹤到貨。') : t('Seller mode: create listings, edit them, manage inventory, mark items as sold and process orders.', '賣家模式：新增與編輯商品、管理庫存、標記售完並處理訂單。')}</p>` : ''}
      <div class="tabs" role="tablist">${tabs.map(([k, en, zh]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${t(en, zh)}${k === 'sales' ? '<b class="tbadge" id="todo" hidden></b>' : k === 'purchases' ? '<b class="tbadge" id="mine" hidden></b>' : ''}</button>`).join('')}</div><div id="tpane"></div>`
    document.getElementById('out').onclick = () => supabase.auth.signOut()
    const pane = document.getElementById('tpane')
    ctx.badges = async () => {
      if (!trader) return
      const [n, m] = await Promise.all([sellerTodo(supabase, ctx), buyerTodo(supabase, ctx.uid)])
      const b = document.getElementById('todo'), c = document.getElementById('mine')
      if (b) { b.hidden = !n; b.textContent = n }
      if (c) { c.hidden = !m; c.textContent = m }
    }
    const show = () => ({ purchases: loadPurchases, selling: loadSelling, sales: loadSales, inquiries: inquiriesPane }[tab])(pane, ctx)
    app.querySelectorAll('input[name=mode]').forEach((r) => (r.onchange = () => { mode = r.value; setMode(mode); tab = TABS[mode][0][0]; history.replaceState(null, '', '#' + tab); draw() }))
    app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, '', '#' + tab); app.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b)); show() }))
    show(); ctx.badges()
    // a user who left the tab open sees new orders as soon as they come back to it
    document.onvisibilitychange = () => { if (!document.hidden && pane.isConnected && ['sales', 'purchases'].includes(tab)) { show(); ctx.badges() } }
  }
  draw()
}

async function refresh() {
  document.getElementById('h-title').textContent = t('My account', '我的帳號')
  document.getElementById('h-sub').textContent = t('Buy, sell and follow your orders and inquiries.', '購買、刊登，並追蹤您的訂單與諮詢。')
  document.title = t('My account · imMBA', '我的帳號 · imMBA')
  if (!session) return pendingEmail ? checkEmail() : authForm()
  if (recovering) return newPassword()
  const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
  role = data?.role
  if (recovering) return newPassword()   // the recovery event can arrive while the profile is loading
  dashboard()
}

if (!configured) app.innerHTML = '<div class="msg err">Backend not connected.</div>'
else {
  supabase.auth.onAuthStateChange((ev, s) => { const prev = session?.user?.id; session = s; if (ev === 'PASSWORD_RECOVERY') { recovering = true; return newPassword() } if (ev === 'TOKEN_REFRESHED' || (ev === 'SIGNED_IN' && prev === s?.user?.id && role)) return; refresh() })
  window.addEventListener('langchange', refresh)
}
