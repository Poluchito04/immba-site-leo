// Grounded retrieval for the admissions assistant: answers only from published content and always cites it.
const STOP = new Set('the a an and or of to in on for with is are was were be been how what when where who whom which why do does did can could should would will i you we they it its my your our their this that these those at by from as about into than then so if not no yes please tell me any there here have has had teach teaches teaching taught offer offers offered want need know get give find show list'.split(' '))
const CJK = /[㐀-鿿]+/g

export function tokens(text) {
  const t = (text || '').toLowerCase()
  const out = []
  for (const w of t.replace(CJK, ' ').match(/[a-z0-9]+/g) || []) {
    if (w.length < 3 && !/\d/.test(w)) continue
    if (STOP.has(w)) continue
    out.push(w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w)
  }
  for (const run of t.match(CJK) || []) {
    if (run.length === 1) out.push(run)
    for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2))
  }
  return out
}

const clean = (s) => s.replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]*\)/g, '$1').replace(/\*\*/g, '').replace(/^#+ /gm, '').replace(/^- /gm, '• ').replace(/[ \t]+/g, ' ').trim()

/** Split a markdown-ish body into passages of reasonable size. */
export function passages(body) {
  const out = []
  for (const block of clean(body || '').split(/\n{2,}/)) {
    const b = block.trim()
    if (b.length < 35) continue
    if (b.length <= 520) { out.push(b); continue }
    let cur = ''
    for (const s of b.split(/(?<=[.!?。！？])\s*/)) {
      if ((cur + s).length > 480 && cur) { out.push(cur.trim()); cur = '' }
      cur += s + ' '
    }
    if (cur.trim().length >= 35) out.push(cur.trim())
  }
  return out
}

/** docs: [{title, url, lang, text, kind}] -> searchable index */
export function buildIndex(docs) {
  const items = []
  for (const d of docs) {
    const list = d.kind === 'fact' ? [d.text] : passages(d.text)
    for (const p of list) items.push({ ...d, text: p, toks: new Set(tokens(p)), ttoks: new Set(tokens(d.title)) })
  }
  const df = new Map()
  for (const it of items) for (const t of new Set([...it.toks, ...it.ttoks])) df.set(t, (df.get(t) || 0) + 1)
  const idf = (t) => Math.log(1 + items.length / (df.get(t) || 0.5))
  return { items, idf }
}

export function search(index, query, { lang = 'en', limit = 2 } = {}) {
  const q = [...new Set(tokens(query))]
  if (!q.length) return { hits: [], confident: false }
  const total = q.reduce((a, t) => a + index.idf(t), 0)
  const scored = index.items.map((it) => {
    let s = 0, matched = 0
    for (const t of q) {
      const w = index.idf(t)
      if (it.toks.has(t)) { s += w; matched += w }
      else if (it.ttoks.has(t)) { s += w * 0.8; matched += w * 0.8 }
      if (it.ttoks.has(t)) s += w * 0.5
    }
    if (it.lang === lang) s *= 1.25
    s /= 1 + it.text.length / 1400
    return { it, s, cover: matched / total }
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)
  const hits = [], seen = new Set()
  for (const x of scored) {
    const key = x.it.url + x.it.text.slice(0, 30)
    if (seen.has(key)) continue
    if (hits.filter((h) => h.it.url === x.it.url).length >= 1) continue // one passage per source
    seen.add(key); hits.push(x)
    if (hits.length >= limit) break
  }
  const confident = hits.length > 0 && hits[0].cover >= 0.5
  return { hits: confident ? hits.filter((h) => h.cover >= 0.34 || h === hits[0]) : [], confident }
}
