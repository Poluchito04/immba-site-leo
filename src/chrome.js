import { setLang, initLang, isZh, t } from './i18n.js'
import { track } from './track.js'
import { themeButton } from './theme.js'
import { autoReveal, mountScrollUi, skeletonCards, skeletonList } from './ui.js'
import { mountPalette, searchButtonHtml } from './palette.js'
import { mountAssistant } from './assistant.js'

const OFFICIAL = 'https://www.management.fju.edu.tw/esubweb/immbaengindex/'
const CTA = OFFICIAL + 'enroll.php?IID=3'
const COLLEGE = 'https://www.management.fju.edu.tw/index_en.php'

/** The one main menu used on every page. hrefs starting with # are sections of the home page. */
const MENU = [
  ['About', '關於', '/page.html?p=overview', [['Overview and Ranking', '特色與排名', '/page.html?p=overview'], ['Our Learning Environment', '學習環境', '/page.html?p=environment']]],
  ['Admissions', '招生資訊', '/page.html?p=admissions', [['Apply for Fu Jen imMBA', '申請輔仁 imMBA', '/page.html?p=admissions']]],
  ['Faculty', '師資介紹', '#faculty'],
  ['Curriculum', '課程資訊', '/page.html?p=curriculum', [['Curriculum and Requirements', '課程與修業規定', '/page.html?p=curriculum']]],
  ['imMBA Guide', 'imMBA 全攻略', '/page.html?p=guide'],
  ['Graduation', '畢業與離校', '/page.html?p=graduation'],
  ['Dual Degree', '雙聯學位', '/page.html?p=dual-degree'],
  ['Overseas Exchange', '海外交換', '/page.html?p=exchange'],
  ['Marketplace', '書籍教材市集', '/marketplace.html'],
  ['Events', '活動集錦', '#events'],
  ['Announcements', '公告', '#announcements'],
  ['Downloads', '表格下載', '/downloads.html'],
  ['College of Management', '輔大管理學院', COLLEGE, null, true],
]

const onHome = () => (location.pathname.replace(/\/$/, '') || '/') === '/'
const href = (h) => (h.startsWith('#') && !onHome() ? '/' + h : h)
const here = () => location.pathname + location.search
const isHere = (h) => !h.startsWith('#') && !h.startsWith('http') && (h.includes('?') ? here() === h : location.pathname === h)
const menuHidden = () => { try { return localStorage.getItem('menuHidden') === '1' } catch { return false } }

let spy = false
function scrollSpy() {
  if (!onHome()) return
  const links = [...document.querySelectorAll('#menu>li>a[href^="#"]')]
  const y = scrollY + 220
  let cur = null
  links.forEach((a) => { const e = document.querySelector(a.getAttribute('href')); if (e && e.offsetTop <= y) cur = a })
  links.forEach((a) => a.classList.toggle('on', a === cur))
}

export function mountChrome({ trackPath, skeleton = 'cards', assistant = true } = {}) {
  initLang()
  const host = document.getElementById('chrome')
  const foot = document.getElementById('site-footer')
  const app = document.getElementById('app')
  if (app && app.querySelector('.msg') && /Loading/.test(app.textContent)) app.innerHTML = skeleton === 'list' ? skeletonList() : skeletonCards()
  app?.setAttribute('tabindex', '-1')

  const draw = () => {
    const compact = document.getElementById('hdr')?.classList.contains('compact')
    const open = document.getElementById('hdr')?.classList.contains('open')
    const hidden = menuHidden()
    const items = MENU.map(([en, zh, h, subs, ext]) => {
      const active = isHere(h) || (subs && subs.some((s) => isHere(s[2])))
      return `<li${subs ? ' class="has"' : ''}><a href="${href(h)}"${ext ? ' target="_blank" rel="noopener"' : ''}${active ? ' class="on" aria-current="page"' : ''}>${t(en, zh)}${ext ? ' ↗' : ''}</a>${subs ? `<div class="dd">${subs.map(([e, z, u]) => `<a href="${u}"${isHere(u) ? ' class="on"' : ''}>${t(e, z)}</a>`).join('')}</div>` : ''}</li>`
    }).join('')
    host.innerHTML = `<a class="skip" href="#${app ? 'app' : 'main'}">${t('Skip to content', '跳到主要內容')}</a>
    <header id="hdr" class="hdr${compact ? ' compact' : ''}${open ? ' open' : ''}">
      <div class="notice"><span class="who">Leopoldo Martinez · F15381071</span><span class="sep">|</span><span>${t('Student project · Unofficial site', '課堂作業 · 非官方網站')}</span><span class="sep">|</span>
        <a href="${OFFICIAL}" target="_blank" rel="noopener">${t('Official imMBA website', 'imMBA 官方網站')} ↗</a>
        <button class="cm" id="cm" type="button" aria-expanded="${!hidden}">${hidden ? t('Expand main menu', '展開主選單') : t('Collapse main menu', '收合主選單')}</button></div>
      <div class="brand"><a class="lg" href="/admin.html" title="${t('Back office (administrators)', '後台（管理員）')}"><img src="/favicon.svg" alt="${t('imMBA logo – open back office', 'imMBA 標誌 – 開啟後台')}" width="58" height="58"></a>
        <a class="ttl" href="/"><h1>${t('Fu Jen Catholic University International MBA (imMBA)', '輔仁大學國際經營管理碩士班（imMBA）')}</h1></a>
        <div class="act">${searchButtonHtml(t('Search', '搜尋'))}<span id="themeslot"></span>
          <a class="lang not-m" href="/project.html">${t('About this project', '專案說明')}</a>
          <button class="lang" id="langbtn" type="button" title="Switch language">${isZh() ? 'EN' : '中文'}</button>
          <a class="btn not-m" href="${CTA}" target="_blank" rel="noopener">${t('Start your application', '立即報名')}</a>
          <button class="iconbtn burger" id="burger" type="button" aria-expanded="${!!open}" aria-controls="navrow" aria-label="Menu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div></div>
      <div class="navrow" id="navrow"${hidden ? ' hidden' : ''}><nav aria-label="Main"><ul id="menu">${items}
        <li class="only-m"><a href="/project.html">${t('About this project', '專案說明')}</a></li>
        <li class="only-m"><a class="btn" href="${CTA}" target="_blank" rel="noopener">${t('Start your application', '立即報名')}</a></li></ul></nav></div>
    </header>`
    document.getElementById('themeslot').replaceWith(themeButton())
    document.getElementById('langbtn').onclick = () => setLang(isZh() ? 'en' : 'zh')
    const hdr = document.getElementById('hdr')
    document.getElementById('cm').onclick = () => {
      const h = !menuHidden()
      try { localStorage.setItem('menuHidden', h ? '1' : '0') } catch { /* ignore */ }
      draw()
    }
    document.getElementById('burger').onclick = () => { const o = hdr.classList.toggle('open'); document.getElementById('burger').setAttribute('aria-expanded', o) }
    document.querySelectorAll('#menu li.has>a').forEach((a) => a.addEventListener('click', (e) => {
      if (!matchMedia('(hover:none)').matches && innerWidth > 860) return
      const li = a.parentNode, o = li.classList.contains('open')
      document.querySelectorAll('#menu li.open').forEach((x) => x.classList.remove('open'))
      if (!o) { e.preventDefault(); li.classList.add('open') }
    }))
    document.getElementById('menu').addEventListener('click', (e) => { const a = e.target.closest('a'); if (a && hdr.classList.contains('open') && !a.parentNode.classList.contains('has')) hdr.classList.remove('open') })
    scrollSpy()
    if (foot) foot.innerHTML = `<footer>${t('Unofficial student project · Content © College of Management, Fu Jen Catholic University', '非官方學生專案 · 內容 © 輔仁大學管理學院')} · <a href="/admin.html">${t('Back office', '後台')}</a> · <a href="/project.html">${t('Project docs', '專案文件')}</a></footer>`
  }
  window.addEventListener('langchange', draw)
  draw()

  if (!spy) {
    spy = true
    let tick = false
    addEventListener('scroll', () => {
      if (tick) return; tick = true
      requestAnimationFrame(() => { document.getElementById('hdr')?.classList.toggle('compact', scrollY > 70); scrollSpy(); tick = false })
    }, { passive: true })
    document.addEventListener('click', (e) => { if (!e.target.closest('#menu')) document.querySelectorAll('#menu li.open').forEach((x) => x.classList.remove('open')) })
  }
  document.getElementById('hdr')?.classList.toggle('compact', scrollY > 70)

  mountScrollUi(); mountPalette()
  if (assistant) mountAssistant()
  if (app) {
    new MutationObserver(() => autoReveal(app)).observe(app, { childList: true })
    autoReveal(document)
  }
  if (trackPath !== false) track(trackPath)
}
