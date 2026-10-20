import { supabase, configured, esc } from './supabase.js'
import { mountChrome } from './chrome.js'
import { t, isZh } from './i18n.js'
import { toast } from './ui.js'

mountChrome()
const app = document.getElementById('app')
const TOPICS = [['admissions', 'Admissions', '招生'], ['curriculum', 'Curriculum', '課程'], ['dual-degree', 'Dual degree', '雙碩士'], ['exchange', 'Exchange', '海外交換'], ['faculty', 'Faculty', '師資'], ['other', 'Other', '其他']]
let session = null, sent = false

function render() {
  document.title = t('Contact · imMBA', '聯絡我們 · imMBA')
  document.getElementById('h-title').textContent = t('Contact us', '聯絡我們')
  document.getElementById('h-sub').textContent = t('Ask the program team about admissions, courses or exchange. We answer by email.', '對招生、課程或交換有疑問？請留言給課程團隊，我們會以電子郵件回覆。')
  if (sent) {
    app.innerHTML = `<div class="box auth" style="max-width:560px;text-align:center"><h3 style="margin-top:0">✓ ${t('Inquiry sent', '已送出')}</h3><p>${t('Thank you! The program team will reply to the email you provided.', '謝謝！課程團隊會回覆您提供的電子郵件。')}</p>
      <p class="acts" style="justify-content:center"><button class="btn" id="again">${t('Send another', '再送一則')}</button>${session ? `<a class="btn o" href="/account.html">${t('See my inquiries', '查看我的諮詢')}</a>` : `<a class="btn o" href="/account.html">${t('Create an account to follow it', '建立帳號追蹤進度')}</a>`}</p></div>`
    document.getElementById('again').onclick = () => { sent = false; render() }
    return
  }
  app.innerHTML = `<div class="layout" style="grid-template-columns:1fr 320px"><form class="box" id="cf" style="margin-top:34px"><h3 style="margin-top:0">${t('Your inquiry', '您的諮詢')}</h3>
    <div class="row2"><div><label>${t('Your name', '姓名')} *</label><input name="name" required minlength="2" maxlength="80" autocomplete="name"></div>
    <div><label>Email *</label><input type="email" name="email" required maxlength="120" autocomplete="email" value="${esc(session?.user?.email || '')}"></div></div>
    <label>${t('Topic', '主題')}</label><select name="topic">${TOPICS.map(([k, en, zh]) => `<option value="${k}">${t(en, zh)}</option>`).join('')}</select>
    <label>${t('Message', '訊息')} * <small style="font-weight:400">(${t('10–2000 characters', '10–2000 字')})</small></label><textarea name="message" rows="6" required minlength="10" maxlength="2000"></textarea>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <p style="font-size:12px;color:var(--mut)">${t('We only use your details to answer this inquiry.', '我們僅使用您的資料回覆此諮詢。')}</p>
    <p><button class="btn" type="submit">${t('Send inquiry', '送出諮詢')}</button></p></form>
    <aside style="margin-top:34px"><div class="panel"><h4>${t('Before you write', '寫信之前')}</h4><ul class="todo">
      <li><a href="/page.html?p=admissions">${t('Admissions requirements and dates', '招生資格與日期')}</a></li><li><a href="/page.html?p=curriculum">${t('Curriculum and requirements', '課程與修業規定')}</a></li><li><a href="/downloads.html">${t('Forms and brochures', '表格與簡章')}</a></li></ul>
      <p style="font-size:13px;color:var(--mut);margin:12px 0 0">${t('Tip: the “Ask” assistant answers common questions instantly.', '提示：右下角的「提問」小幫手可立即回答常見問題。')}</p></div>
      <div class="panel" style="margin-top:14px"><h4>${t('Have an account?', '已有帳號？')}</h4><p style="font-size:14px;margin:0 0 10px">${session ? t('You are signed in; your inquiry will appear in your account.', '您已登入，諮詢紀錄會顯示在您的帳號中。') : t('Sign in to follow the status of your inquiries.', '登入即可追蹤諮詢進度。')}</p><a class="btn o sm" href="/account.html">${session ? t('My account', '我的帳號') : t('Sign in / Register', '登入 / 註冊')}</a></div></aside></div>`
  document.getElementById('cf').onsubmit = async (e) => {
    e.preventDefault()
    const f = e.target
    if (f.website.value) return // honeypot
    const btn = f.querySelector('[type=submit]'); btn.disabled = true
    const { error } = await supabase.from('inquiries').insert({ name: f.name.value.trim(), email: f.email.value.trim(), topic: f.topic.value, message: f.message.value.trim(), lang: isZh() ? 'zh' : 'en', status: 'new', user_id: session?.user?.id ?? null })
    btn.disabled = false
    if (error) return toast(error.message, 'err', 6000)
    sent = true; render()
  }
}

async function boot() {
  if (!configured) { app.innerHTML = '<div class="msg err">Backend not connected.</div>'; return }
  session = (await supabase.auth.getSession()).data.session
  render()
}
window.addEventListener('langchange', render)
boot()
