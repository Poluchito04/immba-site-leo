import { supabase, configured, esc, safeUrl } from './supabase.js'
import { translate } from './translate.js'
import { loadDashboard } from './admin-dashboard.js'
import { loadPages, loadDownloads, loadListings } from './admin-content.js'

const app = document.getElementById('app')
const who = document.getElementById('who')
const BUCKET = 'faculty-photos'
const FIELDS = ['name', 'title', 'education', 'research_fields', 'department', 'phone', 'email', 'website', 'category', 'name_zh', 'title_zh', 'education_zh', 'research_fields_zh', 'department_zh']
let session = null, profile = null, faculty = [], news = [], editingNews = null, tab = 'dashboard', editing = null, flash = null

const notify = (text, type = 'ok') => { flash = { text, type }; render() }
const flashHtml = () => { if (!flash) return ''; const h = `<div class="msg ${flash.type}">${esc(flash.text)}</div>`; flash = null; return h }

/* ---------- boot ---------- */
async function boot() {
  if (!configured) {
    app.innerHTML = '<div class="msg err">Supabase is not connected: set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.</div>'
    return
  }
  let lastUser
  supabase.auth.onAuthStateChange((event, s) => {
    const prev = lastUser
    session = s
    lastUser = s?.user?.id
    if (event === 'PASSWORD_RECOVERY') return renderNewPassword()
    // token refreshes / tab refocus re-emit SIGNED_IN for the same user: ignore, or open forms get wiped
    if (event === 'TOKEN_REFRESHED' || (event === 'SIGNED_IN' && prev === lastUser && profile)) return
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') refresh()
  })
}

async function refresh() {
  profile = null
  if (session) {
    who.innerHTML = `${esc(session.user.email)} <button class="btn o sm" id="out">Log out</button>`
    document.getElementById('out').onclick = () => supabase.auth.signOut()
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    profile = data
  } else who.innerHTML = ''
  render()
}

function render() {
  if (!session) return renderAuth()
  if (!profile) return (app.innerHTML = flashHtml() + '<div class="msg err">Your profile could not be loaded. Run supabase/schema.sql and log in again.</div>')
  if (profile.role === 'pending') return (app.innerHTML = '<div class="box auth"><h3>Waiting for approval</h3><p>Your email is verified, but a super administrator still has to approve your account before you can use the back office.</p></div>')
  if (profile.role === 'rejected') return (app.innerHTML = '<div class="box auth"><h3>Access denied</h3><p>Your administrator request was not approved.</p></div>')
  renderDashboard()
}

/* ---------- authentication ---------- */
function renderAuth(mode = 'login') {
  const titles = { login: 'Log in', register: 'Create account', reset: 'Reset password' }
  app.innerHTML = `${flashHtml()}<form class="box auth" id="f"><h3 style="margin-top:0">${titles[mode]}</h3>
    <label>Email</label><input type="email" name="email" required autocomplete="email">
    ${mode !== 'reset' ? '<label>Password</label><input type="password" name="password" required minlength="6" autocomplete="' + (mode === 'login' ? 'current-password' : 'new-password') + '">' : ''}
    <p><button class="btn" type="submit" style="width:100%">${titles[mode]}</button></p>
    <p style="font-size:14px;text-align:center">
      ${mode === 'login' ? '<a href="#" data-m="register">Create account</a> · <a href="#" data-m="reset">Forgot password?</a>' : '<a href="#" data-m="login">← Back to log in</a>'}</p></form>`
  app.querySelectorAll('[data-m]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); renderAuth(a.dataset.m) }))
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target), email = fd.get('email'), password = fd.get('password')
    const btn = e.target.querySelector('button'); btn.disabled = true
    const redirect = location.origin + '/admin.html'
    let error, ok
    if (mode === 'login') ({ error } = await supabase.auth.signInWithPassword({ email, password }))
    else if (mode === 'register') {
      const res = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
      error = res.error
      if (!error && !res.data.session) return renderCheckEmail(email)
    } else { ({ error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect })); ok = 'If that email exists, a reset link is on its way.' }
    btn.disabled = false
    if (error && /not confirmed/i.test(error.message)) return renderCheckEmail(email, true)
    if (error) notify(error.message, 'err'), renderAuth(mode)
    else if (ok) { flash = { text: ok, type: 'ok' }; renderAuth('login') }
  }
}

function renderCheckEmail(email, unconfirmed = false) {
  app.innerHTML = `<div class="box auth"><h3 style="margin-top:0">${unconfirmed ? 'Email not confirmed yet' : 'Check your email'}</h3>
    <p>${unconfirmed ? 'You still need to confirm' : 'We sent a verification link to'} <b>${esc(email)}</b>. Click it, then come back and log in. Check your spam folder too.</p>
    <p class="acts"><button class="btn o" id="resend">Resend email</button><button class="btn" id="back">Back to log in</button></p><div id="rs"></div></div>`
  document.getElementById('back').onclick = () => renderAuth('login')
  document.getElementById('resend').onclick = async () => {
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin + '/admin.html' } })
    document.getElementById('rs').innerHTML = `<div class="msg ${error ? 'err' : 'ok'}">${esc(error ? error.message : 'Email sent again.')}</div>`
  }
}

function renderNewPassword() {
  app.innerHTML = `<form class="box auth" id="f"><h3 style="margin-top:0">Choose a new password</h3>
    <label>New password</label><input type="password" name="password" required minlength="6" autocomplete="new-password">
    <p><button class="btn" style="width:100%">Save password</button></p></form>`
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: new FormData(e.target).get('password') })
    if (error) { app.insertAdjacentHTML('afterbegin', `<div class="msg err">${esc(error.message)}</div>`); return }
    flash = { text: 'Password updated.', type: 'ok' }; refresh()
  }
}

/* ---------- dashboard ---------- */
function renderDashboard() {
  const isSuper = profile.role === 'super_admin'
  if (tab === 'approvals' && !isSuper) tab = 'faculty'
  app.innerHTML = `${flashHtml()}<div class="tabs">${[['dashboard', 'Dashboard'], ['news', 'News & events'], ['faculty', 'Faculty'], ['pages', 'Pages'], ['downloads', 'Documents'], ['marketplace', 'Marketplace']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}
    ${isSuper ? `<button data-t="approvals" class="${tab === 'approvals' ? 'on' : ''}">Administrators</button>` : ''}</div><div id="pane"></div>`
  app.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { tab = b.dataset.t; editing = null; renderDashboard() }))
  const pane = document.getElementById('pane')
  const ctx = { supabase, notify, goto: (t) => { tab = t; renderDashboard() } }
  const views = { dashboard: () => loadDashboard(pane, ctx), news: loadNews, faculty: loadFaculty, pages: () => loadPages(pane, ctx), downloads: () => loadDownloads(pane, ctx), marketplace: () => loadListings(pane, ctx), approvals: loadApprovals }
  ;(views[tab] || loadFaculty)()
}


/* ---------- AdminNews: one record, two languages ---------- */
const NEWS_TXT = ['title_zh', 'title_en', 'content_zh', 'content_en']
const filled = (v) => Boolean((v || '').trim())
const syncState = (n) => {
  const miss = NEWS_TXT.filter((k) => !filled(n[k]))
  return miss.length ? { ok: false, text: 'Missing: ' + miss.map((k) => ({ title_zh: '中文 title', title_en: 'English title', content_zh: '中文 content', content_en: 'English content' }[k])).join(', ') } : { ok: true, text: 'Both languages complete' }
}

async function loadNews() {
  const pane = document.getElementById('pane')
  const { data, error } = await supabase.from('news').select('*').order('pinned', { ascending: false }).order('news_date', { ascending: false }).order('sort_order')
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)} — did you run supabase/news.sql?</div>`; return }
  news = data
  pane.innerHTML = `<div class="box"><div class="spread"><h3 style="margin:0">News & events (${news.length})</h3><button class="btn" id="addn">+ Add item</button></div>
    <div id="nform"></div><div class="scroll"><table><thead><tr><th>Date</th><th>Type</th><th>English title</th><th>中文標題</th><th>Sync</th><th>Status</th><th></th></tr></thead><tbody>
    ${news.map((n) => { const st = syncState(n); return `<tr><td style="white-space:nowrap">${esc(n.news_date)}</td><td><span class="pill ${n.kind === 'event' ? 'super_admin' : ''}">${esc(n.kind || 'news')}</span></td><td>${n.pinned ? '<span class="pill">PINNED</span> ' : ''}${esc(n.title_en || '—')}</td><td>${esc(n.title_zh || '—')}</td>
      <td><span class="pill ${st.ok ? '' : 'pending'}" title="${esc(st.text)}">${st.ok ? 'EN ⇄ 中文 ✓' : 'Out of sync'}</span></td>
      <td><span class="pill ${n.published ? '' : 'rejected'}">${n.published ? 'published' : 'draft'}</span></td>
      <td><div class="acts"><button class="btn o sm" data-nedit="${n.id}">Edit</button><button class="btn danger sm" data-ndel="${n.id}">Delete</button></div></td></tr>` }).join('')}
    </tbody></table></div></div>`
  document.getElementById('addn').onclick = () => showNewsForm(null)
  pane.querySelectorAll('[data-nedit]').forEach((b) => (b.onclick = () => showNewsForm(news.find((n) => n.id === b.dataset.nedit))))
  pane.querySelectorAll('[data-ndel]').forEach((b) => (b.onclick = () => removeNews(news.find((n) => n.id === b.dataset.ndel))))
}

function showNewsForm(n) {
  editingNews = n
  const v = (k) => esc(n?.[k] ?? '')
  const host = document.getElementById('nform')
  host.innerHTML = `<form id="nf" style="border-top:1px solid var(--bd);margin-top:18px;padding-top:6px"><h4 style="margin:12px 0 0">${n ? 'Edit announcement' : 'New announcement'} <small style="color:var(--mut);font-weight:400">— one record, both languages</small></h4>
    <div class="row2"><div><label>Date *</label><input type="date" name="news_date" required value="${v('news_date') || new Date().toISOString().slice(0, 10)}"></div>
    <div><label>Display order (lower first, same date)</label><input type="number" name="sort_order" value="${n?.sort_order ?? 0}"></div>
    <div><label>Type</label><select name="kind"><option value="news" ${n?.kind === 'event' ? '' : 'selected'}>News / announcement</option><option value="event" ${n?.kind === 'event' ? 'selected' : ''}>Event</option></select></div>
    <div><label>Link URL (English)</label><input type="url" name="link_url" value="${v('link_url')}" placeholder="https://…"></div>
    <div><label>Link URL (中文, optional)</label><input type="url" name="link_url_zh" value="${v('link_url_zh')}" placeholder="https://…"></div></div>
    <p style="margin:12px 0 0"><label style="display:inline;margin-right:18px"><input type="checkbox" name="published" style="width:auto" ${n?.published === false ? '' : 'checked'}> Published</label>
    <label style="display:inline"><input type="checkbox" name="pinned" style="width:auto" ${n?.pinned ? 'checked' : ''}> Pinned to top</label></p>
    <div class="row2"><div><label>English title</label><input name="title_en" value="${v('title_en')}"></div><div><label>中文標題</label><input name="title_zh" value="${v('title_zh')}"></div>
    <div><label>English content</label><textarea name="content_en" rows="7">${v('content_en')}</textarea></div><div><label>中文內容</label><textarea name="content_zh" rows="7">${v('content_zh')}</textarea></div></div>
    <p class="acts"><button class="btn o" type="button" id="t-en2zh">Auto-translate English → 中文</button><button class="btn o" type="button" id="t-zh2en">Auto-translate 中文 → English</button><span id="tstat" style="font-size:13px;color:var(--mut);align-self:center"></span></p>
    <div id="npreview"></div>
    <p class="acts"><button class="btn" type="submit">${n ? 'Save changes' : 'Publish'}</button><button class="btn o" type="button" id="ncancel">Cancel</button></p></form>`
  const f = document.getElementById('nf')
  const preview = () => {
    const g = (k) => f[k].value
    const st = syncState({ title_zh: g('title_zh'), title_en: g('title_en'), content_zh: g('content_zh'), content_en: g('content_en') })
    const card = (lang, t, c) => `<div class="card" style="display:block"><div style="font-size:12px;color:var(--mut);font-weight:700">${lang} · ${esc(g('news_date').replace(/-/g, '/'))}${f.pinned.checked ? ' · PINNED' : ''}</div><h4 style="margin:6px 0">${esc(t) || '<i>(no title)</i>'}</h4><p style="margin:0;white-space:pre-line">${esc((c || '').slice(0, 220))}${(c || '').length > 220 ? '…' : ''}</p></div>`
    document.getElementById('npreview').innerHTML = `<h4 style="margin:18px 0 8px">Preview <span class="pill ${st.ok ? '' : 'pending'}">${esc(st.text)}</span></h4><div class="row2">${card('EN', g('title_en'), g('content_en'))}${card('中文', g('title_zh'), g('content_zh'))}</div>`
  }
  f.addEventListener('input', preview); preview()
  const tr = (from, to, srcP, dstP) => async () => {
    const stat = document.getElementById('tstat'); stat.textContent = 'Translating…'
    try {
      for (const k of ['title', 'content']) {
        const src = f[`${k}_${srcP}`].value
        if (src.trim()) f[`${k}_${dstP}`].value = await translate(src, from, to)
      }
      stat.textContent = 'Done — review and edit the translation before publishing.'; preview()
    } catch (e) { stat.textContent = 'Translation failed: ' + e.message }
  }
  document.getElementById('t-en2zh').onclick = tr('en', 'zh-TW', 'en', 'zh')
  document.getElementById('t-zh2en').onclick = tr('zh-TW', 'en', 'zh', 'en')
  document.getElementById('ncancel').onclick = () => { host.innerHTML = ''; editingNews = null }
  f.onsubmit = saveNews
  host.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

async function saveNews(e) {
  e.preventDefault()
  const f = e.target, btn = f.querySelector('[type=submit]')
  const val = (k) => f[k].value.trim() || null
  const row = { news_date: f.news_date.value, sort_order: parseInt(f.sort_order.value, 10) || 0, link_url: val('link_url'), link_url_zh: val('link_url_zh'),
    kind: f.kind.value, published: f.published.checked, pinned: f.pinned.checked, title_en: val('title_en'), title_zh: val('title_zh'), content_en: val('content_en'), content_zh: val('content_zh') }
  for (const k of ['link_url', 'link_url_zh']) if (row[k] && !safeUrl(row[k])) return notify('Links must start with http:// or https://', 'err')
  if (!row.title_en && !row.title_zh) return notify('Add a title in at least one language.', 'err')
  const st = syncState(row)
  if (!st.ok && !confirm(`The two language versions are not in sync (${st.text}). Save anyway?`)) return
  btn.disabled = true
  const res = editingNews ? await supabase.from('news').update(row).eq('id', editingNews.id) : await supabase.from('news').insert(row)
  if (res.error) { btn.disabled = false; return notify(res.error.message, 'err') }
  editingNews = null; notify('Announcement saved (both languages).')
}

async function removeNews(n) {
  if (!confirm('Delete this announcement? Both the Chinese and English versions will be removed.')) return
  const { error } = await supabase.from('news').delete().eq('id', n.id)
  error ? notify(error.message, 'err') : notify('Announcement deleted (both languages).')
}

/* ---------- faculty CRUD ---------- */
async function loadFaculty() {
  const pane = document.getElementById('pane')
  const { data, error } = await supabase.from('faculty').select('*').order('sort_order').order('created_at')
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return }
  faculty = data
  pane.innerHTML = `<div class="box"><div class="spread"><h3 style="margin:0">Faculty members (${faculty.length})</h3>
    <button class="btn" id="add">+ Add faculty</button></div>
    <div id="form"></div><div class="scroll"><table><thead><tr><th></th><th>Name</th><th>中文</th><th>Title</th><th>Type</th><th>Order</th><th></th></tr></thead><tbody>
    ${faculty.map((f, i) => `<tr><td>${safeUrl(f.image_url) ? `<img class="thumb" src="${esc(f.image_url)}" alt="">` : '<div class="thumb"></div>'}</td>
      <td><b>${esc(f.name)}</b></td><td>${esc(f.name_zh || '—')}</td><td>${esc(f.title)}</td><td><span class="pill">${esc(f.category)}</span></td>
      <td><div class="acts"><button class="btn o sm" data-up="${f.id}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button class="btn o sm" data-down="${f.id}" ${i === faculty.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button></div></td>
      <td><div class="acts"><button class="btn o sm" data-edit="${f.id}">Edit</button><button class="btn danger sm" data-del="${f.id}">Delete</button></div></td></tr>`).join('')}
    </tbody></table></div></div>`
  document.getElementById('add').onclick = () => showForm(null)
  pane.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => showForm(faculty.find((f) => f.id === b.dataset.edit))))
  pane.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => remove(faculty.find((f) => f.id === b.dataset.del))))
  pane.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => move(b.dataset.up, -1)))
  pane.querySelectorAll('[data-down]').forEach((b) => (b.onclick = () => move(b.dataset.down, 1)))
}

function showForm(f) {
  editing = f
  const v = (k) => esc(f?.[k] ?? '')
  const host = document.getElementById('form')
  host.innerHTML = `<form id="ff" style="border-top:1px solid var(--bd);margin-top:18px;padding-top:6px"><h4 style="margin:12px 0 0">${f ? 'Edit ' + esc(f.name) : 'New faculty member'}</h4>
    <div class="row2"><div><label>Name *</label><input name="name" required value="${v('name')}"></div>
    <div><label>Title</label><input name="title" value="${v('title')}" placeholder="Associate Professor"></div>
    <div><label>Department / position</label><input name="department" value="${v('department')}"></div>
    <div><label>Type</label><select name="category"><option value="full-time">Full-time</option><option value="adjunct">Adjunct</option></select></div>
    <div><label>Email</label><input type="email" name="email" value="${v('email')}"></div>
    <div><label>Phone</label><input name="phone" value="${v('phone')}"></div></div>
    <h4 style="margin:18px 0 0">中文 (Chinese version)</h4><div class="row2"><div><label>中文姓名</label><input name="name_zh" value="${v('name_zh')}"></div><div><label>中文職稱</label><input name="title_zh" value="${v('title_zh')}"></div>
    <div><label>中文系所</label><input name="department_zh" value="${v('department_zh')}"></div><div><label>中文學歷</label><input name="education_zh" value="${v('education_zh')}"></div></div>
    <label>中文研究領域</label><input name="research_fields_zh" value="${v('research_fields_zh')}">
    <label>Education</label><input name="education" value="${v('education')}">
    <label>Research fields</label><input name="research_fields" value="${v('research_fields')}">
    <label>Personal website (https://…)</label><input type="url" name="website" value="${v('website')}">
    <label>Photo (JPG/PNG/WebP, max 2 MB)</label><input type="file" name="photo" accept="image/jpeg,image/png,image/webp">
    ${safeUrl(f?.image_url) ? `<p style="font-size:13px;color:var(--mut)">Current photo kept unless you choose a new one.</p>` : ''}
    <p class="acts"><button class="btn" type="submit">${f ? 'Save changes' : 'Create'}</button><button class="btn o" type="button" id="cancel">Cancel</button></p></form>`
  host.querySelector('[name=category]').value = f?.category || 'full-time'
  document.getElementById('cancel').onclick = () => { host.innerHTML = ''; editing = null }
  document.getElementById('ff').onsubmit = save
  host.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

const photoPath = (url) => { const i = (url || '').indexOf(`/${BUCKET}/`); return i < 0 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split('?')[0]) }

async function save(e) {
  e.preventDefault()
  const form = e.target, fd = new FormData(form), btn = form.querySelector('[type=submit]')
  const row = {}
  FIELDS.forEach((k) => (row[k] = (fd.get(k) || '').toString().trim() || null))
  row.name = row.name || ''; row.category = row.category || 'full-time'
  if (row.website && !safeUrl(row.website)) return notify('The website must start with http:// or https://', 'err')
  const file = fd.get('photo')
  if (file && file.size) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return notify('Photo must be JPG, PNG or WebP.', 'err')
    if (file.size > 2 * 1024 * 1024) return notify('Photo is larger than 2 MB.', 'err')
  }
  btn.disabled = true
  try {
    if (file && file.size) {
      const path = `${crypto.randomUUID()}.${file.type.split('/')[1].replace('jpeg', 'jpg')}`
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
      if (up.error) throw up.error
      row.image_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      const old = photoPath(editing?.image_url)
      if (old) await supabase.storage.from(BUCKET).remove([old])
    }
    let res
    if (editing) res = await supabase.from('faculty').update(row).eq('id', editing.id)
    else { row.sort_order = faculty.reduce((m, f) => Math.max(m, f.sort_order), 0) + 1; res = await supabase.from('faculty').insert(row) }
    if (res.error) throw res.error
    editing = null; notify(row.name + ' saved.')
  } catch (err) { btn.disabled = false; return notify(err.message, 'err') }
}

async function remove(f) {
  if (!confirm(`Delete ${f.name}? This cannot be undone.`)) return
  const { error } = await supabase.from('faculty').delete().eq('id', f.id)
  if (error) return notify(error.message, 'err')
  const p = photoPath(f.image_url); if (p) await supabase.storage.from(BUCKET).remove([p])
  notify(f.name + ' deleted.')
}

async function move(id, dir) {
  const list = [...faculty], i = list.findIndex((f) => f.id === id), j = i + dir
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  const changed = list.map((f, k) => ({ f, order: k + 1 })).filter(({ f, order }) => f.sort_order !== order)
  const results = await Promise.all(changed.map(({ f, order }) => supabase.from('faculty').update({ sort_order: order }).eq('id', f.id)))
  const err = results.find((r) => r.error)
  err ? notify(err.error.message, 'err') : renderDashboard()
}

/* ---------- super admin: approvals ---------- */
async function loadApprovals() {
  const pane = document.getElementById('pane')
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return }
  const order = { pending: 0, admin: 1, super_admin: 2, rejected: 3 }
  data.sort((a, b) => order[a.role] - order[b.role])
  pane.innerHTML = `<div class="box"><h3 style="margin-top:0">Administrators</h3><div class="scroll"><table><thead><tr><th>Email</th><th>Status</th><th></th></tr></thead><tbody>
    ${data.map((p) => `<tr><td>${esc(p.email)}</td><td><span class="pill ${p.role}">${esc(p.role)}</span></td><td>
      ${p.id === session.user.id || p.role === 'super_admin' ? '' : `<div class="acts">
        ${p.role !== 'admin' ? `<button class="btn sm" data-set="admin" data-id="${p.id}">Approve</button>` : ''}
        ${p.role !== 'rejected' ? `<button class="btn danger sm" data-set="rejected" data-id="${p.id}">${p.role === 'admin' ? 'Remove access' : 'Reject'}</button>` : ''}</div>`}</td></tr>`).join('')}
    </tbody></table></div></div>`
  pane.querySelectorAll('[data-set]').forEach((b) => (b.onclick = async () => {
    const { error } = await supabase.from('profiles').update({ role: b.dataset.set }).eq('id', b.dataset.id)
    error ? notify(error.message, 'err') : notify('Updated.')
  }))
}

boot()
