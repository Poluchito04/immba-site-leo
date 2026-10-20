import { supabase, configured, esc, safeUrl } from './supabase.js'

const grid = document.getElementById('news-grid')
const LIMIT = 9
let items = [], showAll = false

const isZh = () => document.documentElement.lang.startsWith('zh')
const excerpt = (t) => {
  const s = (t || '').replace(/\s+/g, ' ').trim()
  return s.length > 150 ? s.slice(0, 150).trim() + '…' : s
}

function render() {
  if (!grid) return
  const zh = isZh()
  if (!items.length) { grid.innerHTML = `<p class="d">${zh ? '目前沒有公告。' : 'No announcements yet.'}</p>`; return }
  const list = showAll ? items : items.slice(0, LIMIT)
  grid.innerHTML = list.map((n) => {
    const title = (zh ? n.title_zh || n.title_en : n.title_en || n.title_zh) || ''
    const body = zh ? n.content_zh || n.content_en : n.content_en || n.content_zh
    const link = safeUrl(zh ? n.link_url_zh || n.link_url : n.link_url || n.link_url_zh)
    return `<article class="ncard"><div><time datetime="${esc(n.news_date)}">${esc(n.news_date.replace(/-/g, '/'))}</time>${n.pinned ? `<span class="top">${zh ? '置頂' : 'PINNED'}</span>` : ''}</div>
      <h4>${esc(title)}</h4><p>${esc(excerpt(body))}</p>
      ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${zh ? '查看詳情' : 'View Details'}</a>` : ''}</article>`
  }).join('')
  if (items.length > LIMIT) {
    grid.insertAdjacentHTML('beforeend', `<div style="grid-column:1/-1"><button class="btn o more" id="more">${showAll ? (zh ? '收合' : 'Show fewer') : zh ? `顯示全部 (${items.length})` : `Show all (${items.length})`}</button></div>`)
    document.getElementById('more').onclick = () => { showAll = !showAll; render() }
  }
  // the whole card is clickable
  grid.querySelectorAll('.ncard').forEach((c) => {
    const a = c.querySelector('a')
    if (a) c.addEventListener('click', (e) => { if (!e.target.closest('a')) window.open(a.href, '_blank', 'noopener') })
  })
}

async function load() {
  if (!grid) return
  if (!configured) { grid.innerHTML = '<p class="d">Announcements will appear once the backend is connected.</p>'; return }
  const { data, error } = await supabase
    .from('news').select('*').eq('published', true)
    .order('pinned', { ascending: false }).order('news_date', { ascending: false }).order('sort_order')
  if (error) { grid.innerHTML = `<p class="d">Could not load announcements: ${esc(error.message)}</p>`; return }
  items = data
  render()
}

new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
load()
