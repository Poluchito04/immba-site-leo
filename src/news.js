import { supabase, configured, esc, safeUrl } from './supabase.js'
import { track } from './track.js'

track('/')
const GRIDS = { news: document.getElementById('news-grid'), event: document.getElementById('events-grid') }
const LIMIT = 9
const state = { news: { items: [], all: false }, event: { items: [], all: false } }

const isZh = () => document.documentElement.lang.startsWith('zh')
const excerpt = (t, max = 150) => {
  const s = (t || '').replace(/\s+/g, ' ').trim()
  if (/^https?:\/\/\S+$/.test(s)) return '' // a bare link is not a summary; the card's own link button covers it
  return s.length > max ? s.slice(0, max).trim() + '…' : s
}

const paragraphs = (t) => (t || '').split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join('')

function render(kind) {
  const grid = GRIDS[kind]
  if (!grid) return
  const { items, all } = state[kind]
  const zh = isZh()
  if (!items.length) { grid.innerHTML = `<p class="d">${zh ? '目前沒有項目。' : 'Nothing here yet.'}</p>`; return }
  const list = all ? items : items.slice(0, LIMIT)
  grid.innerHTML = list.map((n) => {
    const title = (zh ? n.title_zh || n.title_en : n.title_en || n.title_zh) || ''
    const body = zh ? n.content_zh || n.content_en : n.content_en || n.content_zh
    const link = safeUrl(zh ? n.link_url_zh || n.link_url : n.link_url || n.link_url_zh)
    const img = safeUrl(n.image_url) ? `<img class="nimg" src="${esc(safeUrl(n.image_url))}" alt="${esc(title)}" loading="lazy">` : ''
    return `<article class="ncard${img ? ' withimg' : ''}">${img}<div><time datetime="${esc(n.news_date)}">${esc(n.news_date.replace(/-/g, '/'))}</time>${n.pinned ? `<span class="top">${zh ? '置頂' : 'PINNED'}</span>` : ''}</div>
      <h4>${esc(title)}</h4>${link ? (excerpt(body) ? `<p>${esc(excerpt(body, n.image_url ? 320 : 150))}</p>` : '') : paragraphs(body)}
      ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${zh ? '查看詳情' : 'View Details'}</a>` : ''}</article>`
  }).join('')
  if (items.length > LIMIT) {
    grid.insertAdjacentHTML('beforeend', `<div style="grid-column:1/-1"><button class="btn o more" data-k="${kind}">${all ? (zh ? '收合' : 'Show fewer') : zh ? `顯示全部 (${items.length})` : `Show all (${items.length})`}</button></div>`)
    grid.querySelector('.more').onclick = () => { state[kind].all = !state[kind].all; render(kind) }
  }
  grid.querySelectorAll('.ncard').forEach((c) => {
    const a = c.querySelector('a')
    if (a) c.addEventListener('click', (e) => { if (!e.target.closest('a')) window.open(a.href, '_blank', 'noopener') })
  })
}

async function load() {
  if (!configured) { Object.values(GRIDS).forEach((g) => g && (g.innerHTML = '<p class="d">Content appears once the backend is connected.</p>')); return }
  const { data, error } = await supabase
    .from('news').select('*').eq('published', true)
    .order('pinned', { ascending: false }).order('news_date', { ascending: false }).order('sort_order')
  if (error) { Object.values(GRIDS).forEach((g) => g && (g.innerHTML = `<p class="d">Could not load: ${esc(error.message)}</p>`)); return }
  state.news.items = data.filter((n) => (n.kind || 'news') === 'news')
  state.event.items = data.filter((n) => n.kind === 'event')
  render('news'); render('event')
}

new MutationObserver(() => { render('news'); render('event') }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
load()
