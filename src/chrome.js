import { getLang, setLang, initLang, isZh, t } from './i18n.js'
import { track } from './track.js'

const NAV = [
  ['/', 'Home', '首頁'],
  ['/faculty.html', 'Faculty', '師資'],
  ['/downloads.html', 'Downloads', '表格下載'],
  ['/marketplace.html', 'Marketplace', '書籍教材市集'],
  ['/project.html', 'About this project', '專案說明'],
]

export function mountChrome({ trackPath } = {}) {
  initLang()
  const host = document.getElementById('chrome')
  const foot = document.getElementById('site-footer')
  const draw = () => {
    const here = location.pathname.replace(/\/$/, '') || '/'
    host.innerHTML = `<div class="bar"><b>Leopoldo Martinez · F15381071</b><span>${t('Student project · Unofficial site', '學生專案 · 非官方網站')}</span>
      <a href="https://www.management.fju.edu.tw/esubweb/immbaengindex/" target="_blank" rel="noopener">${t('Official imMBA website', 'imMBA 官方網站')} ↗</a></div>
      <div class="top"><a class="brandlink" href="/" aria-label="imMBA home"><img src="/favicon.svg" alt="" width="44" height="44"><h1>${t('Fu Jen Catholic University International MBA (imMBA)', '輔仁大學國際經營管理碩士班（imMBA）')}</h1></a>
      <div class="topnav">${NAV.map(([h, en, zh]) => `<a href="${h}" class="${here === h.replace(/\/$/, '') || (h === '/' && here === '') ? 'on' : ''}">${t(en, zh)}</a>`).join('')}
      <button class="lang" id="langbtn" title="Switch language">${isZh() ? 'EN' : '中文'}</button></div></div>`
    document.getElementById('langbtn').onclick = () => setLang(isZh() ? 'en' : 'zh')
    if (foot) foot.innerHTML = `<footer>${t('Unofficial student project · Content © College of Management, Fu Jen Catholic University', '非官方學生專案 · 內容 © 輔仁大學管理學院')} · <a href="/admin.html">${t('Back office', '後台')}</a></footer>`
  }
  window.addEventListener('langchange', draw)
  draw()
  if (trackPath !== false) track(trackPath)
}
export { getLang }
