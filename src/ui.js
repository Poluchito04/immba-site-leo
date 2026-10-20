// Shared motion + feedback helpers: scroll reveal, progress bar, back-to-top, toasts.
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches
let io

export function reveal(root = document) {
  if (reduce()) return
  io ||= new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
  root.querySelectorAll('.rv:not(.in):not([data-seen])').forEach((el) => {
    el.dataset.seen = '1'
    const sib = [...(el.parentElement?.children || [])].filter((c) => c.classList.contains('rv'))
    el.style.setProperty('--d', Math.min(sib.indexOf(el), 8) * 70 + 'ms')
    io.observe(el)
  })
}

/** mark likely-animated elements; call again after dynamic renders */
export function autoReveal(root = document) {
  root.querySelectorAll('section h3, section .d, .sub, .ncard, .lcard, .card, .docs li, .kpi, .panel, .why, .stat, .prose > *, .page-h > div').forEach((el) => el.classList.add('rv'))
  reveal(root)
}

export function mountScrollUi() {
  if (document.getElementById('progress')) return
  const bar = document.createElement('div'); bar.id = 'progress'; document.body.appendChild(bar)
  const top = document.createElement('button'); top.id = 'totop'; top.type = 'button'; top.setAttribute('aria-label', 'Back to top'); top.textContent = '↑'
  top.onclick = () => scrollTo({ top: 0, behavior: reduce() ? 'auto' : 'smooth' }); document.body.appendChild(top)
  let tick = false
  const on = () => {
    if (tick) return; tick = true
    requestAnimationFrame(() => {
      const h = document.documentElement.scrollHeight - innerHeight
      bar.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + '%'
      top.classList.toggle('show', scrollY > 600); tick = false
    })
  }
  addEventListener('scroll', on, { passive: true }); on()
}

export function toast(text, type = 'ok', ms = 3600) {
  let host = document.getElementById('toasts')
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host) }
  const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = text
  host.appendChild(el)
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260) }, ms)
}

export const skeletonCards = (n = 6) => `<div class="skgrid">${Array.from({ length: n }, () => '<div class="skcard"><div class="sk" style="height:12px;width:40%"></div><div class="sk" style="height:18px"></div><div class="sk" style="height:14px;width:85%"></div><div class="sk" style="height:14px;width:60%"></div></div>').join('')}</div>`
export const skeletonList = (n = 8) => Array.from({ length: n }, () => '<div class="sk" style="height:48px;margin-bottom:8px"></div>').join('')
