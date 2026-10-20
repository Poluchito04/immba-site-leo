import { supabase, configured, esc, safeUrl } from './supabase.js'

const app = document.getElementById('app')
const who = document.getElementById('who')
const BUCKET = 'faculty-photos'
const FIELDS = ['name', 'title', 'education', 'research_fields', 'department', 'phone', 'email', 'website', 'category']
let session = null, profile = null, faculty = [], tab = 'faculty', editing = null, flash = null

const notify = (text, type = 'ok') => { flash = { text, type }; render() }
const flashHtml = () => { if (!flash) return ''; const h = `<div class="msg ${flash.type}">${esc(flash.text)}</div>`; flash = null; return h }

/* ---------- boot ---------- */
async function boot() {
  if (!configured) {
    app.innerHTML = '<div class="msg err">Supabase is not connected: set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.</div>'
    return
  }
  supabase.auth.onAuthStateChange((event, s) => {
    session = s
    if (event === 'PASSWORD_RECOVERY') return renderNewPassword()
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
  app.innerHTML = `${flashHtml()}<div class="tabs"><button data-t="faculty" class="${tab === 'faculty' ? 'on' : ''}">Faculty</button>
    ${isSuper ? `<button data-t="approvals" class="${tab === 'approvals' ? 'on' : ''}">Administrators</button>` : ''}</div><div id="pane"></div>`
  app.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { tab = b.dataset.t; editing = null; renderDashboard() }))
  tab === 'faculty' ? loadFaculty() : loadApprovals()
}

/* ---------- faculty CRUD ---------- */
async function loadFaculty() {
  const pane = document.getElementById('pane')
  const { data, error } = await supabase.from('faculty').select('*').order('sort_order').order('created_at')
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return }
  faculty = data
  pane.innerHTML = `<div class="box"><div class="spread"><h3 style="margin:0">Faculty members (${faculty.length})</h3>
    <button class="btn" id="add">+ Add faculty</button></div>
    <div id="form"></div><div class="scroll"><table><thead><tr><th></th><th>Name</th><th>Title</th><th>Type</th><th>Order</th><th></th></tr></thead><tbody>
    ${faculty.map((f, i) => `<tr><td>${safeUrl(f.image_url) ? `<img class="thumb" src="${esc(f.image_url)}" alt="">` : '<div class="thumb"></div>'}</td>
      <td><b>${esc(f.name)}</b></td><td>${esc(f.title)}</td><td><span class="pill">${esc(f.category)}</span></td>
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
