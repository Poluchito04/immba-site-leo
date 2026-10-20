import { supabase, configured, esc, safeUrl } from './supabase.js'
import { mountChrome } from './chrome.js'
import { isZh, t, pick } from './i18n.js'
import { renderMd } from './md.js'

const slug = new URLSearchParams(location.search).get('p') || 'overview'
mountChrome({ trackPath: '/page/' + slug.slice(0, 40) })
const app = document.getElementById('app')
document.getElementById('hero').style.display = 'none'
const DOC_CAT = { admissions: 'admissions', curriculum: 'curriculum', graduation: 'graduation', 'dual-degree': 'dual' }
const GROUPS = { about: ['About', '關於'], admissions: ['Admissions', '招生'], curriculum: ['Curriculum', '課程'], more: ['More', '更多'] }
let pages = [], docs = []

function render() {
  const cur = pages.find((p) => p.slug === slug)
  if (!cur) { document.title = 'imMBA'; app.innerHTML = `<div class="msg err">${t('Page not found.', '找不到此頁面。')} <a href="/">${t('Back home', '回首頁')}</a></div>`; return }
  const title = pick(cur, 'title')
  document.title = title + ' · imMBA'
  const src = isZh() ? cur.source_url_zh : cur.source_url_en
  const related = docs.filter((d) => d.category === DOC_CAT[cur.slug])
  const missingNote = isZh() ? (!cur.body_zh && cur.body_en ? t('', '（此頁尚無中文版，顯示英文內容）') : '') : (!cur.body_en && cur.body_zh ? '(No English version yet — showing the Chinese content.)' : '')
  const side = Object.keys(GROUPS).map((g) => {
    const list = pages.filter((p) => p.section === g)
    return list.length ? `<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:700;color:var(--mut);text-transform:uppercase;padding:0 12px 4px">${isZh() ? GROUPS[g][1] : GROUPS[g][0]}</div>${list.map((p) => `<a href="/page.html?p=${esc(p.slug)}" class="${p.slug === slug ? 'on' : ''}">${esc(pick(p, 'title'))}</a>`).join('')}</div>` : ''
  }).join('')
  app.innerHTML = `<div class="layout"><aside class="side">${side}</aside><article>
    <div class="crumb"><a href="/">${t('Home', '首頁')}</a> › ${esc(isZh() ? GROUPS[cur.section][1] : GROUPS[cur.section][0])}</div>
    <h2 style="font:700 clamp(1.8rem,5vw,2.6rem)/1.15 'Palatino Linotype',Palatino,serif;color:var(--g);margin:0 0 18px">${esc(title)}</h2>
    ${missingNote ? `<div class="msg">${esc(missingNote)}</div>` : ''}
    <div class="prose">${renderMd(pick(cur, 'body')) || `<p>${t('Content coming soon.', '內容即將推出。')}</p>`}</div>
    ${related.length ? `<h3 class="sec">${t('Related documents', '相關文件')}</h3><ul class="docs">${related.map((d) => `<li><span class="ft ${esc(d.file_type)}">${esc(d.file_type)}</span><a href="${esc(safeUrl(d.file_url))}" target="_blank" rel="noopener">${esc(pick(d, 'title'))}</a></li>`).join('')}</ul>` : ''}
    ${safeUrl(src) ? `<p style="margin-top:28px;font-size:13px;color:var(--mut)">${t('Source:', '資料來源：')} <a href="${esc(safeUrl(src))}" target="_blank" rel="noopener">${t('official imMBA website', '輔大 imMBA 官方網站')} ↗</a></p>` : ''}
  </article></div>`
}

async function load() {
  if (!configured) { app.innerHTML = '<div class="msg err">Backend not connected.</div>'; return }
  const [p, d] = await Promise.all([
    supabase.from('pages').select('*').eq('published', true).order('sort_order'),
    supabase.from('downloads').select('*').eq('published', true).order('sort_order'),
  ])
  if (p.error) { app.innerHTML = `<div class="msg err">${esc(p.error.message)}</div>`; return }
  pages = p.data; docs = d.data || []
  render()
}
window.addEventListener('langchange', render)
load()
