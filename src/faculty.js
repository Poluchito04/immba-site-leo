import { supabase, configured, esc, safeUrl } from './supabase.js'
import { mountChrome } from './chrome.js'
import { isZh, t, pick } from './i18n.js'

mountChrome()
const app = document.getElementById('app')
let rows = []

function card(f) {
  const name = isZh() && f.name_zh ? f.name_zh : f.name
  const alt = isZh() && f.name_zh ? f.name : f.name_zh
  const photo = safeUrl(f.image_url)
    ? `<img src="${esc(safeUrl(f.image_url))}" alt="${esc(name)}" loading="lazy">`
    : `<div class="ph">${esc(name.trim().charAt(0).toUpperCase())}</div>`
  const line = (label, v) => (v ? `<p><b>${label}:</b> ${esc(v)}</p>` : '')
  const site = safeUrl(f.website)
  return `<article class="card">${photo}<div>
    <h4>${esc(name)}${alt ? ` <small style="color:var(--mut);font-weight:400">${esc(alt)}</small>` : ''}</h4><div class="t">${esc(pick(f, 'title'))}</div>
    ${line(t('Department', '系所'), pick(f, 'department'))}${line(t('Education', '學歷'), pick(f, 'education'))}${line(t('Research', '研究領域'), pick(f, 'research_fields'))}
    ${line(t('Phone', '電話'), f.phone)}
    ${f.email ? `<p><b>Email:</b> <a href="mailto:${esc(f.email)}">${esc(f.email)}</a></p>` : ''}
    ${site ? `<p><a href="${esc(site)}" target="_blank" rel="noopener">${t('Personal website', '個人網站')} ↗</a></p>` : ''}
  </div></article>`
}

function render() {
  document.title = t('Faculty · imMBA', '師資 · imMBA')
  document.getElementById('h-title').textContent = t('Faculty', '師資介紹')
  document.getElementById('h-sub').textContent = t('Meet the teaching team behind the imMBA program.', '認識國際經營管理碩士班（imMBA）的教師團隊。')
  const group = (cat, title) => {
    const list = rows.filter((f) => f.category === cat)
    return list.length ? `<h3 class="sec">${title}</h3><div class="grid">${list.map(card).join('')}</div>` : ''
  }
  app.innerHTML = rows.length
    ? group('full-time', t('Full-time faculty', '專任師資')) + group('adjunct', t('Adjunct faculty', '兼任師資')) +
      `<p class="src" style="margin-top:28px;font-size:13px;color:var(--mut)">${t('Source:', '資料來源：')} <a href="https://www.management.fju.edu.tw/esubweb/immbaengindex/teacher.php" target="_blank" rel="noopener">${t('official imMBA faculty page', '輔大 imMBA 官方師資頁')} ↗</a></p>`
    : `<div class="msg">${t('No faculty members have been added yet.', '尚未新增教師資料。')}</div>`
}

async function load() {
  if (!configured) { app.innerHTML = '<div class="msg err">Backend not connected.</div>'; return }
  const { data, error } = await supabase.from('faculty').select('*').order('sort_order').order('created_at')
  if (error) { app.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return }
  rows = data
  render()
}
window.addEventListener('langchange', render)
load()
