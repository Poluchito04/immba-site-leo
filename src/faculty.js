import { supabase, configured, esc, safeUrl } from './supabase.js'
import { mountChrome } from './chrome.js'
import { isZh, t, pick } from './i18n.js'

mountChrome()
const app = document.getElementById('app')
let rows = [], q = new URLSearchParams(location.search).get('q') || '', cat = 'all'

const tags = (v) => (v ? `<p>${v.split(/[,，、;；]\s*/).filter(Boolean).slice(0, 6).map((x) => `<button class="tag" data-tag="${esc(x.trim())}">${esc(x.trim())}</button>`).join('')}</p>` : '')
const hay = (f) => [f.name, f.name_zh, f.title, f.title_zh, f.research_fields, f.research_fields_zh, f.department, f.education].join(' ').toLowerCase()

function card(f) {
  const name = isZh() && f.name_zh ? f.name_zh : f.name
  const alt = isZh() && f.name_zh ? f.name : f.name_zh
  const photo = safeUrl(f.image_url)
    ? `<img src="${esc(safeUrl(f.image_url))}" alt="${esc(name)}" loading="lazy" onload="this.classList.add('ld')">`
    : `<div class="ph">${esc(name.trim().charAt(0).toUpperCase())}</div>`
  const line = (label, v) => (v ? `<p><b>${label}:</b> ${esc(v)}</p>` : '')
  const site = safeUrl(f.website)
  return `<article class="card">${photo}<div>
    <h4>${esc(name)}${alt ? ` <small style="color:var(--mut);font-weight:400">${esc(alt)}</small>` : ''}</h4><div class="t">${esc(pick(f, 'title'))}</div>
    ${line(t('Department', '系所'), pick(f, 'department'))}${line(t('Education', '學歷'), pick(f, 'education'))}${tags(pick(f, 'research_fields'))}
    ${line(t('Phone', '電話'), f.phone)}
    ${f.email ? `<p><b>Email:</b> <a href="mailto:${esc(f.email)}">${esc(f.email)}</a></p>` : ''}
    ${site ? `<p><a href="${esc(site)}" target="_blank" rel="noopener">${t('Personal website', '個人網站')} ↗</a></p>` : ''}
  </div></article>`
}

function render() {
  document.title = t('Faculty · imMBA', '師資 · imMBA')
  document.getElementById('h-title').textContent = t('Faculty', '師資介紹')
  document.getElementById('h-sub').textContent = t('Meet the teaching team behind the imMBA program.', '認識國際經營管理碩士班（imMBA）的教師團隊。')
  if (!rows.length) { app.innerHTML = `<div class="msg">${t('No faculty members have been added yet.', '尚未新增教師資料。')}</div>`; return }
  const hasInput = document.getElementById('fq')
  const list = rows.filter((f) => (cat === 'all' || f.category === cat) && hay(f).includes(q.trim().toLowerCase()))
  const group = (c, title) => {
    const l = list.filter((f) => f.category === c)
    return l.length ? `<h3 class="sec">${title}</h3><div class="grid">${l.map(card).join('')}</div>` : ''
  }
  const chips = [['all', 'All', '全部'], ['full-time', 'Full-time', '專任'], ['adjunct', 'Adjunct', '兼任']].map(([k, en, zh]) => `<button data-c="${k}" class="${cat === k ? 'on' : ''}">${t(en, zh)}</button>`).join('')
  const results = (group('full-time', t('Full-time faculty', '專任師資')) + group('adjunct', t('Adjunct faculty', '兼任師資'))) || `<div class="msg">${t('No faculty match your search.', '沒有符合的教師。')} <a href="#" id="clr">${t('Clear search', '清除搜尋')}</a></div>`
  const src = `<p class="src" style="margin-top:28px;font-size:13px;color:var(--mut)">${t('Source:', '資料來源：')} <a href="https://www.management.fju.edu.tw/esubweb/immbaengindex/teacher.php" target="_blank" rel="noopener">${t('official imMBA faculty page', '輔大 imMBA 官方師資頁')} ↗</a></p>`
  if (!hasInput) {
    app.innerHTML = `<div class="toolbar"><input id="fq" type="search" placeholder="${t('Search by name, field, title…', '依姓名、領域、職稱搜尋…')}" value="${esc(q)}" aria-label="${t('Search faculty', '搜尋師資')}"><div class="chips" id="fchips" style="margin:0">${chips}</div><span class="count" id="fcount"></span></div><div id="fres"></div>${src}`
    const inp = document.getElementById('fq')
    inp.oninput = () => { q = inp.value; render() }
  } else {
    document.getElementById('fchips').innerHTML = chips
    hasInput.placeholder = t('Search by name, field, title…', '依姓名、領域、職稱搜尋…')
  }
  document.getElementById('fres').innerHTML = results
  document.getElementById('fcount').textContent = t(`${list.length} of ${rows.length}`, `${list.length} / ${rows.length} 位`)
  bind()
}
function bind() {
  document.querySelectorAll('#fchips [data-c]').forEach((b) => (b.onclick = () => { cat = b.dataset.c; render() }))
  document.querySelectorAll('[data-tag]').forEach((b) => (b.onclick = () => { q = b.dataset.tag; const i = document.getElementById('fq'); i.value = q; render(); scrollTo({ top: 0, behavior: 'smooth' }) }))
  document.getElementById('clr')?.addEventListener('click', (e) => { e.preventDefault(); q = ''; document.getElementById('fq').value = ''; render() })
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
