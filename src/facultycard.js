import { esc, safeUrl } from './util.js'
import { isZh, t, fpick } from './i18n.js'

export const tags = (v) => (v ? `<div class="ftags">${v.split(/[,，、;；]\s*/).filter(Boolean).slice(0, 8).map((x) => `<button type="button" class="tag" data-tag="${esc(x.trim())}">${esc(x.trim())}</button>`).join('')}</div>` : '')

const CAT = { 'full-time': ['Full-time', '專任'], visiting: ['Visiting', '客座'], adjunct: ['Adjunct', '兼任'] }

/** One faculty member as a full-width card. */
export function facultyCard(f) {
  const name = isZh() && f.name_zh ? f.name_zh : f.name
  const alt = isZh() && f.name_zh ? f.name : f.name_zh
  const photo = safeUrl(f.image_url)
    ? `<img src="${esc(safeUrl(f.image_url))}" alt="${esc(name)}" loading="lazy" onload="this.classList.add('ld')">`
    : `<div class="ph">${esc(name.trim().charAt(0).toUpperCase())}</div>`
  const row = (label, v) => (v ? `<div class="frow"><span>${label}</span><p>${esc(v)}</p></div>` : '')
  const site = safeUrl(f.website)
  return `<article class="fcard">${photo}<div class="fbody">
    <h4>${esc(name)}${alt ? ` <small>${esc(alt)}</small>` : ''}</h4><div class="ftitle">${esc(fpick(f, 'title'))}${CAT[f.category] ? ` <span class="fcat">${t(...CAT[f.category])}</span>` : ''}</div>
    ${row(t('Department', '系所'), fpick(f, 'department'))}${row(t('Education', '學歷'), fpick(f, 'education'))}
    ${fpick(f, 'research_fields') ? `<div class="frow"><span>${t('Research', '研究領域')}</span>${tags(fpick(f, 'research_fields'))}</div>` : ''}
    <div class="fcontact">${f.phone ? `<span>☎ ${esc(f.phone)}</span>` : ''}${f.email ? `<a href="mailto:${esc(f.email)}">✉ ${esc(f.email)}</a>` : ''}${site ? `<a href="${esc(site)}" target="_blank" rel="noopener">${t('Personal website', '個人網站')} ↗</a>` : ''}</div>
  </div></article>`
}
