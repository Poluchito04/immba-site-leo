import { mountChrome } from './chrome.js'
import { t } from './i18n.js'
import { renderMd } from './md.js'
import { esc } from './supabase.js'

mountChrome()
const app = document.getElementById('app')
let md = ''

function render() {
  document.title = t('About this project · imMBA', '專案說明 · imMBA')
  document.getElementById('h-title').textContent = t('About this project', '專案說明')
  document.getElementById('h-sub').textContent = t('Product requirements, user stories, design decisions and verification for the imMBA website (course project).', 'imMBA 網站（課程專案）的產品需求、使用者故事、設計決策與驗證紀錄。')
  const toc = [...md.matchAll(/^## (.+)$/gm)].map((m, i) => `<a href="#s${i}">${esc(m[1])}</a>`).join('')
  let i = -1
  const body = renderMd(md).replace(/<h3>/g, () => `<h3 id="s${++i}">`)
  app.innerHTML = `<div class="layout"><aside class="side">${toc}</aside><article class="prose">${body || ''}
    <p style="font-size:13px;color:var(--mut)">${t('Source file:', '原始檔：')} <a href="/docs/PRD.md">PRD.md</a> · <a href="https://github.com/Poluchito04/immba-site-leo" target="_blank" rel="noopener">GitHub ↗</a></p></article></div>`
}
fetch('/docs/PRD.md').then((r) => r.text()).then((x) => { md = x; render() })
window.addEventListener('langchange', render)
