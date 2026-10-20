import { supabase, configured, esc, safeUrl } from './supabase.js'
import { isZh, t } from './i18n.js'
import { buildIndex, search } from './retrieval.js'

let index = null, loading = null, built = false

async function load() {
  if (index) return index
  if (loading) return loading
  loading = (async () => {
    const docs = []
    if (configured) {
      const q = (tb, c) => supabase.from(tb).select(c)
      const [pages, faculty, news, dls] = await Promise.all([
        q('pages', 'slug,title_en,title_zh,body_en,body_zh').eq('published', true),
        q('faculty', 'name,name_zh,title,title_zh,education,education_zh,research_fields,research_fields_zh,email'),
        q('news', 'title_en,title_zh,content_en,content_zh,link_url,link_url_zh,news_date').eq('published', true),
        q('downloads', 'title_en,title_zh,file_url,file_type').eq('published', true),
      ])
      for (const p of pages.data || []) {
        const url = '/page.html?p=' + p.slug
        if (p.body_en) docs.push({ title: p.title_en || p.title_zh, url, lang: 'en', text: p.body_en })
        if (p.body_zh) docs.push({ title: p.title_zh || p.title_en, url, lang: 'zh', text: p.body_zh })
      }
      for (const f of faculty.data || []) {
        const en = `${f.name}${f.title ? ', ' + f.title : ''}.${f.research_fields ? ' Research: ' + f.research_fields + '.' : ''}${f.education ? ' Education: ' + f.education + '.' : ''}${f.email ? ' Email: ' + f.email : ''}`
        docs.push({ title: 'Faculty ' + f.name, url: '/faculty.html?q=' + encodeURIComponent(f.name), lang: 'en', kind: 'fact', text: en })
        if (f.name_zh) docs.push({ title: '師資 ' + f.name_zh, url: '/faculty.html?q=' + encodeURIComponent(f.name), lang: 'zh', kind: 'fact', text: `${f.name_zh}${f.title_zh ? '，' + f.title_zh : ''}。${f.research_fields_zh ? '研究領域：' + f.research_fields_zh + '。' : ''}${f.education_zh ? '學歷：' + f.education_zh + '。' : ''}` })
      }
      for (const n of news.data || []) {
        if (n.title_en) docs.push({ title: n.title_en, url: safeUrl(n.link_url) || '/#announcements', lang: 'en', text: `${n.news_date}. ${n.title_en}\n\n${n.content_en || ''}`, ext: true })
        if (n.title_zh) docs.push({ title: n.title_zh, url: safeUrl(n.link_url_zh) || '/#announcements', lang: 'zh', text: `${n.news_date}。${n.title_zh}\n\n${n.content_zh || ''}`, ext: true })
      }
      for (const d of dls.data || []) {
        if (d.title_en) docs.push({ title: d.title_en, url: d.file_url, lang: 'en', kind: 'fact', text: `Document (${d.file_type}): ${d.title_en}`, ext: true })
        if (d.title_zh) docs.push({ title: d.title_zh, url: d.file_url, lang: 'zh', kind: 'fact', text: `文件（${d.file_type}）：${d.title_zh}`, ext: true })
      }
    }
    return (index = buildIndex(docs))
  })()
  return loading
}

const SUGGEST = () => [
  t('How do I apply?', '如何申請？'),
  t('What is the dual degree?', '什麼是跨國雙碩士？'),
  t('When is the application deadline?', '報名截止日期是什麼時候？'),
  t('Who teaches marketing?', '誰教行銷？'),
]

function msg(role, html) {
  const box = document.getElementById('asmsgs')
  const el = document.createElement('div'); el.className = 'asm ' + role; el.innerHTML = html
  box.appendChild(el); box.scrollTop = box.scrollHeight
  return el
}

async function ask(q) {
  q = q.trim(); if (!q) return
  msg('me', esc(q))
  const typing = msg('bot', '<span class="dots"><i></i><i></i><i></i></span>')
  const idx = await load()
  await new Promise((r) => setTimeout(r, 350))
  const { hits, confident } = search(idx, q, { lang: isZh() ? 'zh' : 'en', limit: 2 })
  if (!confident) {
    typing.innerHTML = `${t("I couldn't find that in the published pages, so I won't guess.", '我在已發布的頁面中找不到答案，所以不亂猜。')}<div class="ass">${t('Try rephrasing, use the search (Ctrl/Cmd+K), or check the', '請換個問法、使用搜尋（Ctrl/Cmd+K），或查看')} <a href="https://www.management.fju.edu.tw/esubweb/immbaengindex/" target="_blank" rel="noopener">${t('official imMBA website', '輔大 imMBA 官方網站')} ↗</a>.</div>`
    return
  }
  typing.innerHTML = hits.map(({ it }) => {
    const text = it.text.length > 460 ? it.text.slice(0, 460).replace(/\s+\S*$/, '') + '…' : it.text
    const ext = /^https?:/.test(it.url)
    return `<div class="ans">${esc(text).replace(/\n/g, '<br>')}<a class="src" href="${esc(it.url)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t('Source', '來源')}: ${esc(it.title)} ${ext ? '↗' : '→'}</a></div>`
  }).join('')
}

function build() {
  if (built) return
  built = true
  const fab = document.createElement('button')
  fab.id = 'asfab'; fab.type = 'button'; fab.setAttribute('aria-haspopup', 'dialog')
  fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.600A8 8 0 1 1 21 12z"/><path d="M8.500 11h7M8.500 14h4"/></svg><span></span>'
  document.body.appendChild(fab)
  const panel = document.createElement('section')
  panel.id = 'aspanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Admissions assistant')
  panel.innerHTML = `<header><div><b id="astitle"></b><small id="assub"></small></div><button type="button" class="iconbtn" id="asclose" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
    <div id="asmsgs" aria-live="polite"></div><div id="aschips"></div>
    <form id="asform"><input id="asq" type="text" autocomplete="off" maxlength="200"><button class="btn sm" type="submit" id="assend"></button></form>
    <p class="asnote" id="asnote"></p>`
  document.body.appendChild(panel)
  const paint = () => {
    fab.querySelector('span').textContent = t('Ask', '提問')
    fab.setAttribute('aria-label', t('Open admissions assistant', '開啟招生小幫手'))
    document.getElementById('astitle').textContent = t('Admissions assistant', '招生小幫手')
    document.getElementById('assub').textContent = t('Answers come from the published pages', '答案取自已發布的頁面')
    document.getElementById('asq').placeholder = t('Ask about admissions, courses, faculty…', '詢問招生、課程、師資…')
    document.getElementById('assend').textContent = t('Send', '送出')
    document.getElementById('asnote').textContent = t('Automatic search over the site content, not generative AI. It may be incomplete; always confirm on the official site. Your questions are not stored.', '這是網站內容的自動檢索，並非生成式 AI，內容可能不完整，請以官方網站為準。您的提問不會被儲存。')
    document.getElementById('aschips').innerHTML = SUGGEST().map((s) => `<button type="button" class="tag">${esc(s)}</button>`).join('')
    document.querySelectorAll('#aschips .tag').forEach((b) => (b.onclick = () => ask(b.textContent)))
  }
  paint(); window.addEventListener('langchange', paint)
  const open = () => {
    panel.classList.add('open'); fab.classList.add('hide'); load()
    if (!document.querySelector('#asmsgs .asm')) msg('bot', t('Hi! I can answer questions about the program using the pages published on this site, and I will always show my source.', '你好！我會根據本站已發布的頁面回答問題，並附上來源。'))
    setTimeout(() => document.getElementById('asq').focus(), 50)
  }
  const close = () => { panel.classList.remove('open'); fab.classList.remove('hide'); fab.focus() }
  fab.onclick = open
  document.getElementById('asclose').onclick = close
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close() })
  document.getElementById('asform').onsubmit = (e) => { e.preventDefault(); const i = document.getElementById('asq'); const v = i.value; i.value = ''; ask(v) }
}
export const mountAssistant = build
