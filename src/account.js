import { supabase, configured, esc } from './supabase.js'
import { mountChrome } from './chrome.js'
import { t } from './i18n.js'
import { toast } from './ui.js'
import { pwField, bindPasswords, matchHint } from './password.js'

mountChrome({ skeleton: 'form' })
const app = document.getElementById('app')
let session = null, role = null, mode = 'login', inquiries = [], pendingEmail = null

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

async function dashboard() {
  const { data, error } = await supabase.from('inquiries').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
  if (error) return (app.innerHTML = `<div class="msg err">${esc(error.message)}</div>`)
  inquiries = data
  const staff = role === 'admin' || role === 'super_admin'
  app.innerHTML = `<div class="spread" style="margin-top:26px"><div><h3 style="margin:0">${t('Welcome', '歡迎')}, ${esc(session.user.email)}</h3><span class="pill ${staff ? 'super_admin' : ''}">${esc(staff ? role : 'member')}</span></div>
    <div class="acts"><a class="btn" href="/contact.html">${t('New inquiry', '新增諮詢')}</a>${staff ? `<a class="btn o" href="/admin.html">${t('Back office', '後台')}</a>` : ''}<button class="btn o" id="out">${t('Sign out', '登出')}</button></div></div>
    <h3 class="sec">${t('My inquiries', '我的諮詢')} (${inquiries.length})</h3>
    ${inquiries.length ? `<div class="grid">${inquiries.map((q) => `<article class="lcard"><small>${esc(new Date(q.created_at).toLocaleDateString())} · ${esc(q.topic)}</small><h4>${esc(q.message.slice(0, 90))}${q.message.length > 90 ? '…' : ''}</h4>
      <p><span class="pill ${q.status === 'closed' ? 'rejected' : q.status === 'new' ? 'pending' : ''}">${esc(t(...STATUS[q.status]))}</span></p>${q.admin_note ? `<p><b>${t('Reply note', '回覆備註')}:</b> ${esc(q.admin_note)}</p>` : ''}</article>`).join('')}</div>`
      : `<div class="msg">${t('You have not sent any inquiry from this account yet.', '此帳號尚未送出任何諮詢。')}</div>`}`
  document.getElementById('out').onclick = () => supabase.auth.signOut()
}

async function refresh() {
  document.getElementById('h-title').textContent = t('My account', '我的帳號')
  document.getElementById('h-sub').textContent = t('Follow the status of your inquiries.', '追蹤您的諮詢進度。')
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
