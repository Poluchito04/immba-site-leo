import { setLang, initLang, isZh, t } from './i18n.js'
import { track } from './track.js'
import { themeButton } from './theme.js'
import { autoReveal, mountScrollUi, skeletonCards, skeletonList } from './ui.js'
import { mountPalette, searchButtonHtml } from './palette.js'

const NAV = [
  ['/', 'Home', '首頁'],
  ['/faculty.html', 'Faculty', '師資'],
  ['/downloads.html', 'Downloads', '表格下載'],
  ['/marketplace.html', 'Marketplace', '書籍教材市集'],
  ['/project.html', 'About this project', '專案說明'],
]

export function mountChrome({ trackPath, skeleton = 'cards' } = {}) {
  initLang()
  const host = document.getElementById('chrome')
  const foot = document.getElementById('site-footer')
  const app = document.getElementById('app')
  if (app && app.querySelector('.msg') && /Loading/.test(app.textContent)) app.innerHTML = skeleton === 'list' ? skeletonList() : skeletonCards()
  app?.setAttribute('tabindex', '-1')

  const draw = () => {
    const here = location.pathname.replace(/\/$/, '') || '/'
    host.innerHTML = `<a class="skip" href="#app">${t('Skip to content', '跳到主要內容')}</a>
      <div class="bar"><b>Leopoldo Martinez · F15381071</b><span>${t('Student project · Unofficial site', '學生專案 · 非官方網站')}</span>
      <a href="https://www.management.fju.edu.tw/esubweb/immbaengindex/" target="_blank" rel="noopener">${t('Official imMBA website', 'imMBA 官方網站')} ↗</a></div>
      <header class="top"><a class="brandlink" href="/" aria-label="imMBA home"><img src="/favicon.svg" alt="" width="44" height="44"><h1>${t('Fu Jen Catholic University International MBA (imMBA)', '輔仁大學國際經營管理碩士班（imMBA）')}</h1></a>
      <nav class="topnav" aria-label="Main">${NAV.map(([h, en, zh]) => `<a href="${h}" ${here === h.replace(/\/$/, '') || (h === '/' && here === '') ? 'aria-current="page" class="on"' : ''}>${t(en, zh)}</a>`).join('')}
      <span class="tools">${searchButtonHtml(t('Search', '搜尋'))}<span id="themeslot"></span><button class="lang" id="langbtn" title="Switch language">${isZh() ? 'EN' : '中文'}</button></span></nav></header>`
    document.getElementById('themeslot').replaceWith(themeButton())
    document.getElementById('langbtn').onclick = () => setLang(isZh() ? 'en' : 'zh')
    if (foot) foot.innerHTML = `<footer>${t('Unofficial student project · Content © College of Management, Fu Jen Catholic University', '非官方學生專案 · 內容 © 輔仁大學管理學院')} · <a href="/admin.html">${t('Back office', '後台')}</a> · <a href="/project.html">${t('Project docs', '專案文件')}</a></footer>`
  }
  window.addEventListener('langchange', draw)
  draw()
  mountScrollUi(); mountPalette()
  if (app) {
    new MutationObserver(() => autoReveal(app)).observe(app, { childList: true })
    autoReveal(document)
  }
  if (trackPath !== false) track(trackPath)
}
