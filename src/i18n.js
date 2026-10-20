export const getLang = () => { try { return localStorage.getItem('lang') === 'zh' ? 'zh' : 'en' } catch { return 'en' } }
export const isZh = () => getLang() === 'zh'
export function setLang(l) {
  try { localStorage.setItem('lang', l) } catch { /* private mode */ }
  document.documentElement.lang = l === 'zh' ? 'zh-Hant' : 'en'
  window.dispatchEvent(new Event('langchange'))
}
export function initLang() { document.documentElement.lang = isZh() ? 'zh-Hant' : 'en' }
/** pick(row,'title') -> row.title_zh / row.title_en, falling back to the other language */
export const pick = (o, k) => (isZh() ? o[k + '_zh'] || o[k + '_en'] : o[k + '_en'] || o[k + '_zh']) || ''
export const t = (en, zh) => (isZh() ? zh : en)
