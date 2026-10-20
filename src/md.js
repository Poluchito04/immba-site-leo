import { esc } from './util.js'

// Tiny, safe markdown subset: ## / ### headings, nested - lists, [text](url), **bold**, *italic*, paragraphs.
// Everything is HTML-escaped first, so database content can never inject markup.
const inline = (s) =>
  s
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g, (_, text, url) => {
      const ext = /^https?:/.test(url)
      return `<a href="${url}"${ext ? ' target="_blank" rel="noopener"' : ''}>${text}${ext ? ' ↗' : ''}</a>`
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')

export function renderMd(src) {
  const lines = esc(src || '').split('\n')
  const out = []
  let para = [], items = []
  const flushP = () => { if (para.length) out.push(`<p>${inline(para.join('<br>'))}</p>`); para = [] }
  const flushL = () => {
    if (!items.length) return
    // build nested lists
    let html = '', depth = 0
    html += '<ul>'
    let prev = 0
    items.forEach((it, i) => {
      if (i > 0) {
        if (it.d > prev) html += '<ul>'.repeat(it.d - prev)
        else { html += '</li>'; for (let k = prev; k > it.d; k--) html += '</ul></li>' }
      }
      html += `<li>${inline(it.text)}`
      prev = it.d
    })
    html += '</li>' + '</ul></li>'.repeat(prev) + '</ul>'
    out.push(html); items = []
  }
  for (const raw of lines) {
    if (!raw.trim()) { flushP(); flushL(); continue }
    let m
    if ((m = raw.match(/^(#{2,3}) (.*)$/))) { flushP(); flushL(); out.push(m[1].length === 2 ? `<h3>${inline(m[2])}</h3>` : `<h4>${inline(m[2])}</h4>`); continue }
    if ((m = raw.match(/^(\s*)- (.*)$/))) { flushP(); items.push({ d: Math.min(3, Math.floor(m[1].length / 2)), text: m[2] }); continue }
    flushL(); para.push(raw.trim())
  }
  flushP(); flushL()
  return out.join('')
}
