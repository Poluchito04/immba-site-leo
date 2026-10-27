import { esc } from './util.js'

const DAY = 86400000
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)
const filled = (v) => Boolean((v || '').trim())

function bars(values, labels, title) {
  const max = Math.max(1, ...values)
  return `<div class="bars">${values.map((v, i) => `<div style="height:${Math.max(2, (v / max) * 100)}%" title="${esc(labels[i])}: ${v}"><span>${v || ''}</span></div>`).join('')}</div>
    <div class="bl">${labels.map((l) => `<span>${esc(l)}</span>`).join('')}</div>`
}
const meter = (label, n, d) => `<div><div class="spread" style="font-size:14px"><span>${esc(label)}</span><b>${pct(n, d)}%</b> </div><div class="meter"><i style="width:${pct(n, d)}%"></i></div></div>`

export async function loadDashboard(pane, { supabase, goto }) {
  pane.innerHTML = '<div class="box">Loading dashboard…</div>'
  const since = new Date(Date.now() - 14 * DAY).toISOString()
  const q = (t, cols = '*') => supabase.from(t).select(cols)
  const [fac, news, pages, dls, lst, prof, log, views, inq] = await Promise.all([
    q('faculty', 'id,name,name_zh,title_zh,education_zh,research_fields_zh'),
    q('news', 'id,news_date,published,kind,title_en,title_zh,content_en,content_zh'),
    q('pages', 'id,slug,body_en,body_zh,published'),
    q('downloads', 'id,published'),
    q('listings', 'id,status'),
    q('profiles', 'id,role'),
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(12),
    supabase.from('page_views').select('path,lang,created_at').gte('created_at', since).limit(5000),
    q('inquiries', 'id,status,topic,created_at'),
  ])
  if (!pane.isConnected) return // a newer render replaced this tab while it was loading
  const err = [fac, news, pages, dls, lst, prof, log, views, inq].find((r) => r.error)
  if (err) { pane.innerHTML = `<div class="msg err">${esc(err.error.message)} — did you run supabase/v2.sql?</div>`; return }
  const F = fac.data, N = news.data, P = pages.data, D = dls.data, L = lst.data, U = prof.data, V = views.data, I = inq.data
  const members = U.filter((u) => u.role === 'member').length
  const newInq = I.filter((x) => x.status === 'new').length
  const topics = ['admissions', 'curriculum', 'dual-degree', 'exchange', 'faculty', 'other']
  const perTopic = topics.map((tp) => I.filter((x) => x.topic === tp).length)
  const answeredPct = I.length ? Math.round((I.filter((x) => x.status === 'answered' || x.status === 'closed').length / I.length) * 100) : 0

  // KPIs
  const newsOnly = N.filter((n) => n.kind !== 'event'), events = N.filter((n) => n.kind === 'event')
  const pendingAdmins = U.filter((u) => u.role === 'pending').length
  const pendingListings = L.filter((l) => l.status === 'pending').length
  const drafts = N.filter((n) => !n.published).length
  const kpi = (v, label, warn) => `<div class="kpi ${warn && v ? 'warn' : ''}"><b>${v}</b><span>${esc(label)}</span></div>`

  // bilingual completeness
  const newsBoth = N.filter((n) => filled(n.title_en) && filled(n.title_zh) && filled(n.content_en) && filled(n.content_zh))
  const facZh = F.filter((f) => filled(f.name_zh) && filled(f.title_zh))
  const pagesBoth = P.filter((p) => filled(p.body_en) && filled(p.body_zh))

  // news per month (last 6 months)
  const now = new Date(), months = []
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en', { month: 'short' }) }) }
  const perMonth = months.map((m) => N.filter((n) => (n.news_date || '').startsWith(m.key)).length)

  // visits per day (last 14 days)
  const days = [], dayKey = (d) => d.toISOString().slice(0, 10)
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * DAY))
  const perDay = days.map((d) => V.filter((v) => dayKey(new Date(v.created_at)) === dayKey(d)).length)
  const dayLabels = days.map((d) => String(d.getUTCDate()))
  const top = Object.entries(V.reduce((a, v) => ((a[v.path] = (a[v.path] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const zhShare = pct(V.filter((v) => v.lang === 'zh').length, V.length)

  // needs attention
  const att = []
  if (newInq) att.push([`${newInq} new inquir${newInq > 1 ? 'ies' : 'y'} to answer`, 'inquiries'])
  if (pendingAdmins) att.push([`${pendingAdmins} administrator${pendingAdmins > 1 ? 's' : ''} waiting for approval`, 'approvals'])
  if (pendingListings) att.push([`${pendingListings} marketplace listing${pendingListings > 1 ? 's' : ''} to review`, 'marketplace'])
  if (N.length - newsBoth.length) att.push([`${N.length - newsBoth.length} announcement(s) missing a language`, 'news'])
  if (drafts) att.push([`${drafts} draft announcement(s) not published`, 'news'])
  if (F.length - facZh.length) att.push([`${F.length - facZh.length} faculty member(s) without Chinese data`, 'faculty'])
  if (P.length - pagesBoth.length) att.push([`${P.length - pagesBoth.length} page(s) missing a language`, 'pages'])

  pane.innerHTML = `<div class="kpis">
    ${kpi(F.length, 'Faculty')}${kpi(newsOnly.filter((n) => n.published).length, 'Published news')}${kpi(events.length, 'Events')}${kpi(P.length, 'Pages')}${kpi(D.length, 'Documents')}
    ${kpi(L.filter((l) => l.status === 'approved').length, 'Live listings')}${kpi(pendingAdmins, 'Admins to approve', true)}${kpi(pendingListings, 'Listings to review', true)}${kpi(V.length, 'Visits (14 days)')}${kpi(I.length, 'Inquiries')}${kpi(newInq, 'New inquiries', true)}${kpi(members, 'Registered members')}${kpi(D.length + P.length + N.length + F.length, 'Content items')}</div>
    <div class="cols">
      <div class="panel"><h4>Visits, last 14 days</h4>${bars(perDay, dayLabels)}<p style="font-size:13px;color:var(--mut);margin:12px 0 0">${V.length ? `${zhShare}% of visits in Chinese.` : 'No visits recorded yet.'}</p></div>
      <div class="panel"><h4>Announcements per month</h4>${bars(perMonth, months.map((m) => m.label))}</div>
      <div class="panel"><h4>Inquiries by topic</h4>${bars(perTopic, topics.map((x) => x.replace('dual-degree', 'dual').slice(0, 6)))}<p style="font-size:13px;color:var(--mut);margin:12px 0 0">${I.length ? `${answeredPct}% answered or closed.` : 'No inquiries yet.'}</p></div>
      <div class="panel"><h4>Bilingual completeness</h4>${meter('News & events (title + content in both languages)', newsBoth.length, N.length)}${meter('Faculty with Chinese name and title', facZh.length, F.length)}${meter('Pages with both languages', pagesBoth.length, P.length)}</div>
      <div class="panel"><h4>Needs attention</h4>${att.length ? `<ul class="todo">${att.map(([t, tab]) => `<li><span>${esc(t)}</span><a href="#" data-goto="${tab}">Open →</a></li>`).join('')}</ul>` : '<p style="color:var(--ok);margin:0">✓ Everything is up to date.</p>'}</div>
      <div class="panel"><h4>Most visited pages</h4>${top.length ? `<ul class="todo">${top.map(([p, n]) => `<li><span>${esc(p)}</span><b>${n}</b></li>`).join('')}</ul>` : '<p style="color:var(--mut);margin:0">Waiting for visits.</p>'}</div>
      <div class="panel"><h4>Recent activity</h4>${log.data.length ? `<ul class="todo">${log.data.map((a) => `<li><span><b>${esc(a.action)}</b> ${esc(a.table_name)} · ${esc(a.row_label || '')}<br><small style="color:var(--mut)">${esc(a.actor_email || '')}</small></span><small style="color:var(--mut);white-space:nowrap">${new Date(a.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></li>`).join('')}</ul>` : '<p style="color:var(--mut);margin:0">No activity yet.</p>'}</div>
    </div>
    <p style="margin-top:18px"><button class="btn o sm" id="csv">Download report (CSV)</button></p>`
  pane.querySelectorAll('[data-goto]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); goto(a.dataset.goto) }))
  pane.querySelector('#csv').onclick = () => {
    const rows = [['metric', 'value'], ['faculty', F.length], ['news_published', newsOnly.filter((n) => n.published).length], ['news_drafts', drafts], ['events', events.length], ['pages', P.length],
      ['documents', D.length], ['listings_approved', L.filter((l) => l.status === 'approved').length], ['listings_pending', pendingListings], ['admins_pending', pendingAdmins],
      ['visits_14d', V.length], ['inquiries', I.length], ['inquiries_new', newInq], ['inquiries_answered_pct', answeredPct], ['members', members], ['visits_zh_pct', zhShare], ['news_bilingual_pct', pct(newsBoth.length, N.length)], ['faculty_zh_pct', pct(facZh.length, F.length)], ['pages_bilingual_pct', pct(pagesBoth.length, P.length)],
      ...perDay.map((v, i) => ['visits_' + dayKey(days[i]), v]), ...top.map(([p, n]) => ['top_' + p, n])]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `immba-report-${dayKey(new Date())}.csv`; a.click()
  }
}
