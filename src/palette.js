import { supabase, configured, esc, safeUrl } from './supabase.js'
import { isZh, pick, fpick } from './i18n.js'

let data = null, items = [], sel = 0, loading = null
const ICON = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'
const tr = (en, zh) => (isZh() ? zh : en)

const QUICK = () => [
  { g: 'go', ic: '🏠', t: tr('Home', '首頁'), s: '/', href: '/' },
  { g: 'go', ic: '👩‍🏫', t: tr('Faculty', '師資介紹'), s: '/faculty.html', href: '/faculty.html' },
  { g: 'go', ic: '📄', t: tr('Downloads', '表格下載'), s: '/downloads.html', href: '/downloads.html' },
  { g: 'go', ic: '📚', t: tr('Student marketplace', '書籍教材市集'), s: '/marketplace.html', href: '/marketplace.html' },
  { g: 'go', ic: '✉️', t: tr('Contact us', '聯絡我們'), s: '/contact.html', href: '/contact.html' },
  { g: 'go', ic: '👤', t: tr('My account', '我的帳號'), s: '/account.html', href: '/account.html' },
  { g: 'go', ic: '🧭', t: tr('About this project', '專案說明'), s: '/project.html', href: '/project.html' },
  { g: 'go', ic: '🔐', t: tr('Back office', '後台'), s: '/admin.html', href: '/admin.html' },
]

async function load() {
  if (data) return data
  if (loading) return loading
  loading = (async () => {
    if (!configured) return (data = { pages: [], news: [], faculty: [], downloads: [], listings: [] })
    const q = (t, c) => supabase.from(t).select(c)
    const [pages, news, faculty, downloads, listings] = await Promise.all([
      q('pages', 'slug,title_en,title_zh,body_en,body_zh').eq('published', true),
      q('news', 'id,title_en,title_zh,news_date,kind,link_url,link_url_zh').eq('published', true),
      q('faculty', 'name,name_zh,title,title_zh,research_fields,research_fields_zh'),
      q('downloads', 'title_en,title_zh,file_url,file_type').eq('published', true),
      q('listings', 'title').eq('status', 'approved'),
    ])
    return (data = { pages: pages.data || [], news: news.data || [], faculty: faculty.data || [], downloads: downloads.data || [], listings: listings.data || [] })
  })()
  return loading
}

const norm = (s) => (s || '').toLowerCase()
function score(q, title, body = '') {
  const t = norm(title), b = norm(body)
  let s = 0
  for (const w of q.split(/\s+/).filter(Boolean)) {
    if (t.startsWith(w)) s += 6
    else if (t.includes(w)) s += 4
    else if (b.includes(w)) s += 1
    else return 0
  }
  return s
}
const snippet = (body, q) => {
  const i = norm(body).indexOf(q.split(/\s+/)[0])
  if (i < 0) return ''
  return (i > 30 ? '…' : '') + body.slice(Math.max(0, i - 30), i + 90).replace(/\s+/g, ' ')
}

function search(q) {
  q = norm(q).trim()
  if (!q) return QUICK()
  const out = []
  const push = (g, ic, list) => list.sort((a, b) => b.sc - a.sc).slice(0, 6).forEach((r) => out.push({ g, ic, ...r }))
  push('pages', '📖', data.pages.map((p) => ({ sc: score(q, pick(p, 'title'), pick(p, 'body')), t: pick(p, 'title'), s: snippet(pick(p, 'body'), q), href: '/page.html?p=' + p.slug })).filter((r) => r.sc))
  push('faculty', '👩‍🏫', data.faculty.map((f) => ({ sc: score(q, f.name + ' ' + (f.name_zh || ''), [f.title, f.title_zh, f.research_fields, f.research_fields_zh].join(' ')), t: isZh() && f.name_zh ? f.name_zh : f.name, s: fpick(f, 'title'), href: '/faculty.html?q=' + encodeURIComponent(f.name) })).filter((r) => r.sc))
  push('news', '📰', data.news.map((n) => ({ sc: score(q, pick(n, 'title')), t: pick(n, 'title'), s: n.news_date + (n.kind === 'event' ? ' · event' : ''), href: safeUrl(isZh() ? n.link_url_zh || n.link_url : n.link_url || n.link_url_zh) || '/#announcements', ext: true })).filter((r) => r.sc))
  push('downloads', '📎', data.downloads.map((d) => ({ sc: score(q, pick(d, 'title')), t: pick(d, 'title'), s: d.file_type, href: safeUrl(d.file_url), ext: true })).filter((r) => r.sc))
  push('marketplace', '🛒', data.listings.map((l) => ({ sc: score(q, l.title), t: l.title, s: 'Marketplace', href: '/marketplace.html' })).filter((r) => r.sc))
  push('go', '↪', QUICK().map((x) => ({ sc: score(q, x.t + ' ' + x.s), t: x.t, s: x.s, href: x.href })).filter((r) => r.sc))
  return out
}

const GROUP = () => ({ go: tr('Go to', '前往'), pages: tr('Pages', '頁面'), faculty: tr('Faculty', '師資'), news: tr('News & events', '公告與活動'), downloads: tr('Documents', '文件'), marketplace: tr('Marketplace', '市集') })

function paint(q) {
  const host = document.getElementById('palres')
  items = search(q)
  sel = Math.min(sel, Math.max(0, items.length - 1))
  if (!items.length) { host.innerHTML = `<div class="palempty">${tr('No results for', '找不到')} “${esc(q)}”</div>`; return }
  let last = '', html = ''
  items.forEach((r, i) => {
    if (r.g !== last) { html += `<div class="palgrp">${esc(GROUP()[r.g] || r.g)}</div>`; last = r.g }
    html += `<a class="palitem" role="option" id="po${i}" data-i="${i}" aria-selected="${i === sel}" href="${esc(r.href || '#')}"${r.ext && /^https?:/.test(r.href) ? ' target="_blank" rel="noopener"' : ''}><span class="ic">${r.ic}</span><span style="min-width:0"><b style="font-weight:600">${esc(r.t)}</b>${r.s ? `<small>${esc(r.s)}</small>` : ''}</span></a>`
  })
  host.innerHTML = html
  host.querySelectorAll('.palitem').forEach((a) => a.addEventListener('mousemove', () => select(+a.dataset.i)))
  host.querySelectorAll('.palitem').forEach((a) => a.addEventListener('click', close))
}
function select(i) {
  sel = i
  document.querySelectorAll('.palitem').forEach((a, k) => a.setAttribute('aria-selected', k === i))
  document.getElementById('po' + i)?.scrollIntoView({ block: 'nearest' })
}

function build() {
  if (document.getElementById('pal')) return
  const el = document.createElement('div'); el.id = 'pal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Search')
  el.innerHTML = `<div class="palbox"><div class="palin">${ICON}<input id="palq" type="text" autocomplete="off" spellcheck="false" aria-controls="palres" aria-label="Search"></div>
    <div class="palres" id="palres" role="listbox"></div><div class="palfoot" id="palfoot"></div></div>`
  document.body.appendChild(el)
  el.addEventListener('mousedown', (e) => { if (e.target === el) close() })
  const input = document.getElementById('palq')
  input.addEventListener('input', () => { sel = 0; paint(input.value) })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); select(Math.min(items.length - 1, sel + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(Math.max(0, sel - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); document.getElementById('po' + sel)?.click() }
    else if (e.key === 'Escape') close()
  })
}
let lastFocus
export async function open() {
  build()
  lastFocus = document.activeElement
  const el = document.getElementById('pal'), input = document.getElementById('palq')
  input.placeholder = tr('Search pages, faculty, news, documents…', '搜尋頁面、師資、公告、文件…')
  document.getElementById('palfoot').innerHTML = `<span><kbd>↑</kbd> <kbd>↓</kbd> ${tr('navigate', '選擇')}</span><span><kbd>↵</kbd> ${tr('open', '開啟')}</span><span><kbd>esc</kbd> ${tr('close', '關閉')}</span>`
  el.classList.add('open'); document.body.style.overflow = 'hidden'
  input.value = ''; sel = 0; paint('')
  input.focus()
  await load(); paint(input.value)
}
export function close() {
  document.getElementById('pal')?.classList.remove('open'); document.body.style.overflow = ''
  lastFocus?.focus?.()
}

export function mountPalette() {
  addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open() }
    else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); open() }
  })
  document.addEventListener('click', (e) => { if (e.target.closest('[data-open-search]')) { e.preventDefault(); open() } })
  window.addEventListener('langchange', () => { data = data })
}
export const searchButtonHtml = (label) => `<button class="srch" type="button" data-open-search aria-label="${label}"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span>${label}</span><kbd>⌘K</kbd></button>`
