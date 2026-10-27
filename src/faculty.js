import { supabase, configured, esc } from './supabase.js'
import { mountChrome } from './chrome.js'
import { t } from './i18n.js'
import { facultyCard } from './facultycard.js'

mountChrome()
const app = document.getElementById('app')
let rows = [], q = new URLSearchParams(location.search).get('q') || '', cat = 'all'

const hay = (f) => [f.name, f.name_zh, f.title, f.title_zh, f.research_fields, f.research_fields_zh, f.department, f.education].join(' ').toLowerCase()

function render() {
  document.title = t('Faculty · imMBA', '師資 · imMBA')
  document.getElementById('h-title').textContent = t('Faculty', '師資介紹')
  document.getElementById('h-sub').textContent = t('Meet the teaching team behind the imMBA program.', '認識國際經營管理碩士班（imMBA）的教師團隊。')
  if (!rows.length) { app.innerHTML = `<div class="msg">${t('No faculty members have been added yet.', '尚未新增教師資料。')}</div>`; return }
  const hasInput = document.getElementById('fq')
  const list = rows.filter((f) => (cat === 'all' || f.category === cat) && hay(f).includes(q.trim().toLowerCase()))
  const chips = [['all', 'All', '全部'], ['full-time', 'Full-time', '專任'], ['visiting', 'Visiting', '客座'], ['adjunct', 'Adjunct', '兼任']].map(([k, en, zh]) => `<button data-c="${k}" class="${cat === k ? 'on' : ''}">${t(en, zh)}</button>`).join('')
  const results = list.length ? `<div class="fgrid">${list.map(facultyCard).join('')}</div>` : `<div class="msg">${t('No faculty match your search.', '沒有符合的教師。')} <a href="#" id="clr">${t('Clear search', '清除搜尋')}</a></div>`
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
