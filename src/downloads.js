import { supabase, configured, esc, safeUrl } from './supabase.js'
import { mountChrome } from './chrome.js'
import { t, pick } from './i18n.js'

mountChrome()
const app = document.getElementById('app')
const CATS = [['admissions', 'Admissions', '招生'], ['curriculum', 'Curriculum', '課程'], ['graduation', 'Graduation', '畢業'], ['dual', 'Dual degree', '雙碩士'], ['other', 'Other', '其他']]
let rows = [], cat = 'all', q = ''

function render() {
  document.title = t('Downloads · imMBA', '表格下載 · imMBA')
  document.getElementById('h-title').textContent = t('Downloads', '表格下載')
  document.getElementById('h-sub').textContent = t('Forms, brochures and program documents. File type shown before each link.', '表單、簡章與課程文件。每個連結前標示檔案類型。')
  const match = rows.filter((d) => (cat === 'all' || d.category === cat) && pick(d, 'title').toLowerCase().includes(q.toLowerCase()))
  const chips = [['all', 'All', '全部'], ...CATS].map(([k, en, zh]) => `<button data-c="${k}" class="${cat === k ? 'on' : ''}">${t(en, zh)}</button>`).join('')
  app.innerHTML = `<div class="chips">${chips}</div><input id="q" type="search" placeholder="${t('Search documents…', '搜尋文件…')}" value="${esc(q)}" style="max-width:360px;margin-bottom:18px">
    ${match.length ? `<ul class="docs">${match.map((d) => `<li><span class="ft ${esc(d.file_type)}">${esc(d.file_type)}</span><a href="${esc(safeUrl(d.file_url))}" target="_blank" rel="noopener">${esc(pick(d, 'title'))}</a></li>`).join('')}</ul>` : `<div class="msg">${t('No documents match.', '沒有符合的文件。')}</div>`}
    <p style="font-size:13px;color:var(--mut)">${t('Source:', '資料來源：')} <a href="https://www.management.fju.edu.tw/esubweb/immbaengindex/download.php" target="_blank" rel="noopener">${t('official imMBA website', '輔大 imMBA 官方網站')} ↗</a></p>`
  app.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { cat = b.dataset.c; render() }))
  const qi = document.getElementById('q')
  qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; render(); const n = document.getElementById('q'); n.focus(); n.setSelectionRange(pos, pos) }
}

async function load() {
  if (!configured) return
  const { data, error } = await supabase.from('downloads').select('*').eq('published', true).order('category').order('sort_order')
  if (error) { app.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return }
  rows = data; render()
}
window.addEventListener('langchange', render)
load()
