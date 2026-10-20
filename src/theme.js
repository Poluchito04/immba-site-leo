const ICON_SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
const ICON_MOON = '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'

export const getTheme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
export function setTheme(t) {
  document.documentElement.dataset.theme = t
  try { localStorage.setItem('theme', t) } catch { /* ignore */ }
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#0d1b20' : '#0f4c5c')
  window.dispatchEvent(new Event('themechange'))
}
export const themeButton = () => {
  const b = document.createElement('button')
  b.className = 'iconbtn'; b.type = 'button'
  const paint = () => { b.innerHTML = getTheme() === 'dark' ? ICON_SUN : ICON_MOON; b.setAttribute('aria-label', getTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); b.title = b.getAttribute('aria-label') }
  b.onclick = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark')
  window.addEventListener('themechange', paint); paint()
  return b
}
