import { mountScrollUi, autoReveal } from './ui.js'
import { mountPalette } from './palette.js'
import { themeButton } from './theme.js'
import { supabase, configured, esc } from './supabase.js'
import { facultyCard } from './facultycard.js'
import { mountAssistant } from './assistant.js'

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const isZh = () => document.documentElement.lang.startsWith('zh')

mountScrollUi(); mountPalette(); mountAssistant()
document.getElementById('themeslot')?.replaceWith(themeButton())

/* compact sticky header */
const hdr = document.getElementById('hdr')
let tick = false
const onScroll = () => { if (tick) return; tick = true; requestAnimationFrame(() => { hdr.classList.toggle('compact', scrollY > 70); tick = false }) }
addEventListener('scroll', onScroll, { passive: true }); onScroll()

/* mobile menu */
const burger = document.getElementById('burger')
burger?.addEventListener('click', () => { const o = hdr.classList.toggle('open'); burger.setAttribute('aria-expanded', o) })
document.getElementById('menu')?.addEventListener('click', (e) => {
  const a = e.target.closest('a')
  if (a && !a.parentElement.classList.contains('has') && hdr.classList.contains('open')) { hdr.classList.remove('open'); burger.setAttribute('aria-expanded', 'false') }
})

/* count-up statistics */
function countUp(el) {
  const end = +el.dataset.count, pre = el.dataset.prefix || '', suf = el.dataset.suffix || ''
  if (reduce) { el.textContent = pre + end + suf; return }
  const t0 = performance.now(), dur = 1100
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3)
    el.textContent = pre + Math.round(end * e) + suf
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
const finish = (el) => { el.textContent = (el.dataset.prefix || '') + el.dataset.count + (el.dataset.suffix || '') }
const cio = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target) }
  else if (e.boundingClientRect.top < 0) { finish(e.target); cio.unobserve(e.target) } // already scrolled past
}), { threshold: 0.3 })
document.querySelectorAll('[data-count]').forEach((el) => { el.textContent = (el.dataset.prefix || '') + '0' + (el.dataset.suffix || ''); cio.observe(el) })

/* admissions countdown (first Fall 2027 round closes 4 Dec 2026 23:59 Taiwan time, per the official announcement) */
const DEADLINE = new Date('2026-12-04T23:59:00+08:00').getTime()
function paintDeadline() {
  const box = document.getElementById('deadline'), txt = document.getElementById('dl-text')
  const ms = DEADLINE - Date.now()
  if (ms <= 0) { box.hidden = true; return }
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000)
  txt.textContent = isZh() ? `2027 秋季班第一輪報名 · 剩 ${d} 天 ${h} 小時截止` : `Fall 2027, first round closes in ${d} days ${h} h`
  box.hidden = false
}
paintDeadline(); setInterval(paintDeadline, 60000)
new MutationObserver(paintDeadline).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })

/* reveal on scroll, including cards that load later */
autoReveal()
let raf
new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => autoReveal()) }).observe(document.getElementById('secs'), { childList: true, subtree: true })

/* faculty: every professor shown directly, one per row */
const flist = document.getElementById('faculty-list')
let fac = []
const paintFaculty = () => {
  if (!flist) return
  flist.innerHTML = fac.length ? fac.map(facultyCard).join('') : `<p class="d">${isZh() ? '目前沒有教師資料。' : 'No faculty yet.'}</p>`
  flist.querySelectorAll('[data-tag]').forEach((b) => (b.onclick = () => { location.href = '/faculty.html?q=' + encodeURIComponent(b.dataset.tag) }))
}
if (flist && configured) {
  supabase.from('faculty').select('*').order('sort_order').order('created_at').then(({ data, error }) => {
    if (error) { flist.innerHTML = `<p class="d">${esc(error.message)}</p>`; return }
    fac = data; paintFaculty()
  })
  new MutationObserver(paintFaculty).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
}
