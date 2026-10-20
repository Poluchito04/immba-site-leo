// Grounded retrieval for the admissions assistant: answers only from published content and always cites it.
const STOP = new Set('the a an and or of to in on for with is are was were be been how what when where who whom which why do does did can could should would will i you we they it its my your our their this that these those at by from as about into than then so if not no yes please tell me any there here have has had teach teaches teaching taught offer offers offered want need know get give find show list'.split(' '))
const CJK = /[㐀-鿿]+/g
const CJK_STOP = new Set(['怎麼', '麼算', '什麼', '麼是', '如何', '可以', '是否', '有沒', '沒有', '請問', '想要', '需要', '哪些', '哪個', '多少'])
const SYN = { deadline: ['round', 'period', 'apply'], clos: ['round', 'period'], due: ['round', 'period'], tuition: ['fee'], cost: ['fee', 'tuition'], price: ['fee'], fee: ['tuition'], requirement: ['document', 'submit'], eligibility: ['requirement', 'qualif'] }
const stem = (w) => {
  if (w.length <= 4) return w
  let x = w.replace(/(ing|ed|es|s)$/, '')
  if (x.length > 4) x = x.replace(/e$/, '').replace(/y$/, 'i')
  return x
}

export function tokens(text) {
  const t = (text || '').toLowerCase()
  const out = []
  for (const w of t.replace(CJK, ' ').match(/[a-z0-9]+/g) || []) {
    if (w.length < 3 && !/\d/.test(w)) continue
    if (STOP.has(w)) continue
    out.push(stem(w))
  }
  for (const run of t.match(CJK) || []) {
    // split on common particles so "的學費怎麼算" does not create junk bigrams
    for (const piece of run.split(/[的了是嗎呢吧在和與或及怎麼什有]+/).filter(Boolean)) {
      for (let i = 0; i < piece.length - 1; i++) { const bg = piece.slice(i, i + 2); if (!CJK_STOP.has(bg)) out.push(bg) }
      if (piece.length === 1 && run.length <= 2) out.push(piece)
    }
  }
  return out
}

const clean = (s) => s.replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]*\)/g, '$1').replace(/\*\*/g, '').replace(/^#+ /gm, '').replace(/^- /gm, '• ').replace(/[ \t]+/g, ' ').trim()

/** Split a markdown-ish body into passages of reasonable size. */
export function passages(body) {
  const out = []
  let carry = ''
  const emit = (b) => {
    if (b.length <= 520) { out.push(b); return }
    let cur = ''
    for (const s of b.split(/(?<=[.!?。！？])\s*/)) {
      if ((cur + s).length > 480 && cur) { out.push(cur.trim()); cur = '' }
      cur += s + ' '
    }
    if (cur.trim().length >= 35) out.push(cur.trim())
  }
  for (const block of clean(body || '').split(/\n{2,}/)) {
    const b = block.trim()
    if (!b) continue
    if (b.length < 80) { carry += (carry ? '\n' : '') + b; continue } // keep short headings with the paragraph they introduce
    emit((carry ? carry + '\n' : '') + b); carry = ''
  }
  if (carry.length >= 35) emit(carry)
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
  const base = [...new Set(tokens(query))]
  if (!base.length) return { hits: [], confident: false }
  const q = [...new Set([...base, ...base.flatMap((t) => SYN[t] || [])])]
  const wantsFaculty = /\b(who|professor|prof|faculty|instructor|lecturer|research)\b|誰|教授|老師|師資|研究/i.test(query)
  const wantsDocs = /\b(form|forms|download|pdf|brochure|document|documents|file|template)\b|表格|簡章|文件|下載|檔案/i.test(query)
  const total = base.reduce((a, t) => a + index.idf(t), 0)
  const scored = index.items.map((it) => {
    let s = 0, matched = 0
    for (const t of q) {
      const w = index.idf(t)
      const isBase = base.includes(t), f = isBase ? 1 : 0.6
      if (it.toks.has(t)) { s += w * f; if (isBase) matched += w }
      else if (it.ttoks.has(t)) { s += w * 0.8 * f; if (isBase) matched += w * 0.8 }
      if (it.ttoks.has(t)) s += w * 0.4 * f
    }
    if (it.lang === lang) s *= 1.25
    const kind = it.group || 'page'
    s *= { page: 1, faculty: wantsFaculty ? 1.7 : 0.8, news: 0.75, doc: wantsDocs ? 1.6 : 0.35 }[kind] ?? 1
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
