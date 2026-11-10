import { mountChrome } from './chrome.js'
import { t } from './i18n.js'
import { renderMd } from './md.js'
import { esc } from './supabase.js'

mountChrome()
const app = document.getElementById('app')
let md = ''
let doc = new URLSearchParams(location.search).get('doc') === 'spec' ? 'spec' : 'prd'
const docs = { prd: '', spec: '' }

function render() {
  document.title = t('About this project · imMBA', '專案說明 · imMBA')
  md = docs[doc]
  document.getElementById('h-title').textContent = doc === 'spec' ? t('Product SPEC', '產品規格 (SPEC)') : t('About this project', '專案說明')
  document.getElementById('h-sub').textContent = doc === 'spec'
    ? t('AI-executable specification: requirements, flows, data and permissions, acceptance criteria, edge cases and what not to do.', '可由 AI 執行的規格：需求、流程、資料與權限、驗收標準、邊界情況與禁止事項。')
    : t('Product requirements, user stories, design decisions and verification for the imMBA website (course project).', 'imMBA 網站（課程專案）的產品需求、使用者故事、設計決策與驗證紀錄。')
  const tabs = `<nav class="doc-tabs" style="display:flex;gap:8px;margin:0 0 18px"><a class="btn${doc === 'prd' ? '' : ' o'}" href="/project.html">PRD</a><a class="btn${doc === 'spec' ? '' : ' o'}" href="/project.html?doc=spec">SPEC</a></nav>`
  const toc = [...md.matchAll(/^## (.+)$/gm)].map((m, i) => `<a href="#s${i}">${esc(m[1])}</a>`).join('')
  let i = -1
  const body = renderMd(md).replace(/<h3>/g, () => `<h3 id="s${++i}">`)
  app.innerHTML = `<div class="layout"><aside class="side">${toc}</aside><article class="prose">${tabs}${body || ''}
    <p style="font-size:13px;color:var(--mut)">${t('Source file:', '原始檔：')} <a href="/docs/${doc === 'spec' ? 'SPEC' : 'PRD'}.md">${doc === 'spec' ? 'SPEC' : 'PRD'}.md</a> · <a href="https://github.com/Poluchito04/immba-site-leo" target="_blank" rel="noopener">GitHub ↗</a></p></article></div>`
}
Promise.all(['PRD', 'SPEC'].map((n) => fetch(`/docs/${n}.md`).then((r) => r.text()))).then(([a, b]) => { docs.prd = a; docs.spec = b; render() })
window.addEventListener('langchange', render)
