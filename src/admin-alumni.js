import { esc } from './util.js'
import { skeletonList, toast } from './ui.js'
import { COLUMNS, LABELS, DEGREES, TEMPLATE_CSV, decodeBytes, validateCsv, toCsv } from './alumni-csv.js'

const DEFAULT_COLS = ['full_name', 'student_id', 'department', 'degree_program', 'graduation_year', 'company']
const LS_COLS = 'alumni-cols'
const PAGE = 50
const ACTION_CLASS = { CREATE: '', UPDATE: 'pending', DELETE: 'rejected', IMPORT: 'super_admin' }

// filters and view survive the full re-render that every notify() triggers
const S = { q: '', degree: '', dept: '', year: '', company: '', sort: { key: 'full_name', dir: 1 }, view: 'records', page: 0, act: '', who: '' }

const loadCols = () => { try { const c = JSON.parse(localStorage.getItem(LS_COLS)); if (Array.isArray(c) && c.length) return c.filter((x) => COLUMNS.includes(x)) } catch { /* private mode */ } return [...DEFAULT_COLS] }
const saveCols = (c) => { try { localStorage.setItem(LS_COLS, JSON.stringify(c)) } catch { /* ignore */ } }
const nice = (e) => (e?.code === '23505' || /duplicate key/i.test(e?.message || '') ? 'That Student ID or email already exists.' : e?.message || 'Something went wrong.')
const cell = (r, k) => (r[k] ?? '') === '' ? '<span style="color:var(--mut)">—</span>' : k === 'degree_program' ? esc(r[k]) : esc(r[k])
const when = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
const download = (name, text, type = 'text/csv;charset=utf-8') => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name })
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** one human line per audit row: "Company: ABC → XYZ" */
export function describeChange(a) {
  const c = a.changes || {}
  if (a.action === 'IMPORT' && a.via) return `${a.via === 'created' ? 'Created' : 'Updated'} by CSV import: ${c.file || 'CSV'}`
  if (a.action === 'UPDATE') return Object.entries(c).map(([k, v]) => `${LABELS[k] || (k === 'role' ? 'Role' : k)}: ${v?.from ?? '∅'} → ${v?.to ?? '∅'}`).join(' · ') || '—'
  if (a.action === 'IMPORT') return `${c.file || 'CSV'} — ${c.inserted ?? 0} added, ${c.updated ?? 0} updated, ${c.skipped ?? 0} skipped, ${c.failed ?? 0} failed`
  if (a.action === 'CREATE' || a.action === 'INSERT') return 'New record'
  if (a.action === 'DELETE') return 'Record deleted'
  return ''
}
const actionName = (a) => (a === 'INSERT' ? 'CREATE' : a)

export async function loadAlumni(pane, ctx) {
  const { supabase, notify } = ctx
  const fail = (m) => toast(m, 'err', 6000) // unlike notify(), keeps the open form and its typed values
  const { data, error } = await supabase.from('alumni').select('*').order('full_name').range(0, 4999)
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)} — did you run supabase/v5.sql?</div>`; return }
  let rows = data, cols = loadCols()

  const distinct = (k) => [...new Set(rows.map((r) => r[k]).filter((v) => v !== null && v !== ''))].sort((a, b) => (typeof a === 'number' ? b - a : String(a).localeCompare(b)))
  const opts = (list, cur, all) => `<option value="">${all}</option>` + list.map((v) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(v)}</option>`).join('')

  const filtered = () => {
    const q = S.q.trim().toLowerCase(), co = S.company.trim().toLowerCase()
    const list = rows.filter((r) =>
      (!q || [r.full_name, r.student_id, r.email, r.company, r.job_title].some((v) => (v || '').toLowerCase().includes(q))) &&
      (!S.degree || r.degree_program === S.degree) && (!S.dept || r.department === S.dept) &&
      (!S.year || String(r.graduation_year) === S.year) && (!co || (r.company || '').toLowerCase().includes(co)))
    const { key, dir } = S.sort
    return list.sort((a, b) => {
      const x = a[key], y = b[key]
      if (x == null && y == null) return 0
      if (x == null) return 1 // blanks always last
      if (y == null) return -1
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * dir
    })
  }

  pane.innerHTML = `<div class="box"><div class="spread"><h3 style="margin:0" id="atitle">Alumni (${rows.length})</h3>
    <div class="acts"><button class="btn o" id="aimp">Import CSV</button><button class="btn o" id="aexp">Export CSV</button><button class="btn" id="aadd">+ Add alumnus</button></div></div>
    <div class="tabs" style="margin-top:14px"><button data-v="records" class="${S.view === 'records' ? 'on' : ''}">Records</button><button data-v="activity" class="${S.view === 'activity' ? 'on' : ''}">Activity log</button></div>
    <div id="aimphost"></div><div id="aform"></div><div id="ahist"></div>
    <div id="aview"></div></div>`

  const host = (id) => document.getElementById(id)
  pane.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { S.view = b.dataset.v; pane.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b)); drawView() }))
  host('aadd').onclick = () => form(null)
  host('aimp').onclick = () => importPanel()
  host('aexp').onclick = () => {
    const list = filtered()
    if (!list.length) return fail('Nothing to export with the current filters.')
    download(`alumni-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(list))
    notify(`Exported ${list.length} record(s) to CSV.`)
  }
  drawView()

  function drawView() { S.view === 'records' ? drawRecords() : drawActivity() }

  /* ------------------------------ records ------------------------------ */
  function drawRecords() {
    host('aview').innerHTML = `<div class="afilters"><div><label>Search</label><input type="search" id="fq" placeholder="Name, Student ID, email, company…" value="${esc(S.q)}"></div>
      <div><label>Degree Program</label><select id="fdeg">${opts(DEGREES, S.degree, 'All')}</select></div>
      <div><label>Graduation Year</label><select id="fyear">${opts(distinct('graduation_year'), S.year, 'All')}</select></div>
      <div><label>Department</label><select id="fdept">${opts(distinct('department'), S.dept, 'All')}</select></div>
      <div><label>Company</label><input type="search" id="fco" placeholder="Contains…" value="${esc(S.company)}"></div></div>
    <div class="spread" style="margin:12px 0 4px"><span id="acount" style="font-size:13px;color:var(--mut)"></span>
      <div class="acts"><button class="btn o sm" id="aclear">Clear filters</button>
      <details class="colmenu" id="colmenu"><summary class="btn o sm">Columns ▾</summary><div class="colpop">${COLUMNS.map((c) => `<label><input type="checkbox" data-col="${c}" ${cols.includes(c) ? 'checked' : ''}> ${LABELS[c]}</label>`).join('')}<button type="button" class="btn o sm" id="colreset" style="margin-top:6px;width:100%">Reset columns</button></div></details></div></div>
    <div class="scroll" id="atable"></div><div id="apager" class="acts" style="margin-top:12px;justify-content:center"></div>`
    const bind = (id, key, ev = 'input') => (host(id).addEventListener(ev, (e) => { S[key] = e.target.value; S.page = 0; paintTable() }))
    bind('fq', 'q'); bind('fco', 'company'); bind('fdeg', 'degree', 'change'); bind('fyear', 'year', 'change'); bind('fdept', 'dept', 'change')
    host('aclear').onclick = () => { Object.assign(S, { q: '', degree: '', dept: '', year: '', company: '', page: 0 }); drawRecords() }
    host('colmenu').querySelectorAll('[data-col]').forEach((c) => (c.onchange = () => {
      cols = COLUMNS.filter((k) => host('colmenu').querySelector(`[data-col="${k}"]`).checked)
      if (!cols.length) { c.checked = true; cols = [c.dataset.col] }
      saveCols(cols); paintTable() // the table updates the moment a box is ticked
    }))
    host('colreset').onclick = () => { cols = [...DEFAULT_COLS]; saveCols(cols); host('colmenu').querySelectorAll('[data-col]').forEach((c) => (c.checked = cols.includes(c.dataset.col))); paintTable() }
    paintTable()
  }

  function paintTable() {
    const list = filtered(), pages = Math.max(1, Math.ceil(list.length / PAGE))
    S.page = Math.min(S.page, pages - 1)
    const slice = list.slice(S.page * PAGE, S.page * PAGE + PAGE)
    const arrow = (k) => (S.sort.key === k ? (S.sort.dir > 0 ? ' ▲' : ' ▼') : '')
    host('acount').innerHTML = `<span>Showing</span> <b>${list.length}</b> <span>of</span> <b>${rows.length}</b>`
    host('atable').innerHTML = rows.length ? `<table><thead><tr>${cols.map((k) => `<th><button class="thsort" data-sort="${k}" title="Sort">${LABELS[k]}${arrow(k)}</button></th>`).join('')}<th></th></tr></thead><tbody>
      ${slice.map((r) => `<tr>${cols.map((k) => `<td ${k === 'full_name' ? 'style="font-weight:600"' : ''}>${k === 'degree_program' ? `<span class="pill">${esc(r[k])}</span>` : cell(r, k)}</td>`).join('')}
        <td><div class="acts"><button class="btn o sm" data-aedit="${r.id}">Edit</button><button class="btn o sm" data-ahist="${r.id}">History</button><button class="btn danger sm" data-adel="${r.id}">Delete</button></div></td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}" style="text-align:center;color:var(--mut);padding:26px">No alumni match these filters.</td></tr>`}
      </tbody></table>` : '<p style="color:var(--mut);margin:24px 0">No alumni yet. Add one, or import a CSV file.</p>'
    host('apager').innerHTML = pages > 1 ? `<button class="btn o sm" id="pprev" ${S.page === 0 ? 'disabled' : ''}>← Previous</button><span style="align-self:center;font-size:13px;color:var(--mut)">${S.page + 1} / ${pages}</span><button class="btn o sm" id="pnext" ${S.page >= pages - 1 ? 'disabled' : ''}>Next →</button>` : ''
    if (pages > 1) { host('pprev').onclick = () => { S.page--; paintTable() }; host('pnext').onclick = () => { S.page++; paintTable() } }
    const t = host('atable')
    t.querySelectorAll('[data-sort]').forEach((b) => (b.onclick = () => { const k = b.dataset.sort; S.sort = { key: k, dir: S.sort.key === k ? -S.sort.dir : 1 }; paintTable() }))
    t.querySelectorAll('[data-aedit]').forEach((b) => (b.onclick = () => form(rows.find((r) => r.id === b.dataset.aedit))))
    t.querySelectorAll('[data-ahist]').forEach((b) => (b.onclick = () => history(rows.find((r) => r.id === b.dataset.ahist))))
    t.querySelectorAll('[data-adel]').forEach((b) => (b.onclick = async () => {
      const r = rows.find((x) => x.id === b.dataset.adel)
      if (!confirm(`Delete the alumni record "${r.full_name}" (${r.student_id})? The deletion is logged in the activity log.`)) return
      const res = await supabase.from('alumni').delete().eq('id', r.id)
      res.error ? fail(nice(res.error)) : notify(`Alumni record deleted: ${r.full_name}`)
    }))
  }

  /* ------------------------------ add / edit ------------------------------ */
  function form(a) {
    host('aimphost').innerHTML = ''; host('ahist').innerHTML = ''
    const v = (k) => esc(a?.[k] ?? '')
    const depts = distinct('department')
    host('aform').innerHTML = `<form id="af" style="border-top:1px solid var(--bd);margin-top:18px;padding-top:6px"><h4 style="margin:12px 0 0">${a ? 'Edit alumnus' : 'New alumnus'}</h4>
      <div class="row2"><div><label>Name *</label><input name="full_name" required maxlength="120" value="${v('full_name')}"></div>
      <div><label>Student ID *</label><input name="student_id" required maxlength="30" pattern="[A-Za-z0-9._\\-]+" value="${v('student_id')}"></div>
      <div><label>Department</label><input name="department" list="adepts" maxlength="120" value="${v('department')}"><datalist id="adepts">${depts.map((d) => `<option value="${esc(d)}">`).join('')}</datalist></div>
      <div><label>Degree Program *</label><select name="degree_program" required>${DEGREES.map((d) => `<option ${(a?.degree_program || 'Master') === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      <div><label>Admission Year</label><input type="number" name="admission_year" min="1950" max="2100" placeholder="2023" value="${v('admission_year')}"></div>
      <div><label>Graduation Year</label><input type="number" name="graduation_year" min="1950" max="2100" placeholder="2025" value="${v('graduation_year')}"></div>
      <div><label>Email</label><input type="email" name="email" maxlength="160" value="${v('email')}"></div>
      <div><label>Phone</label><input name="phone" maxlength="40" value="${v('phone')}"></div>
      <div><label>Current Company</label><input name="company" maxlength="160" value="${v('company')}"></div>
      <div><label>Job Title</label><input name="job_title" maxlength="160" value="${v('job_title')}"></div></div>
      <label>Notes</label><textarea name="notes" rows="3" maxlength="2000">${v('notes')}</textarea>
      <p class="acts"><button class="btn" type="submit">${a ? 'Save changes' : 'Create'}</button><button class="btn o" type="button" id="acancel">Cancel</button></p></form>`
    const f = host('af')
    host('acancel').onclick = () => (host('aform').innerHTML = '')
    f.onsubmit = async (e) => {
      e.preventDefault()
      const g = (k) => f[k].value.trim() || null, yr = (k) => (f[k].value ? parseInt(f[k].value, 10) : null)
      const row = { full_name: g('full_name'), student_id: g('student_id'), department: g('department'), degree_program: f.degree_program.value, admission_year: yr('admission_year'), graduation_year: yr('graduation_year'),
        email: g('email')?.toLowerCase() ?? null, phone: g('phone'), company: g('company'), job_title: g('job_title'), notes: g('notes') }
      if (row.admission_year && row.graduation_year && row.graduation_year < row.admission_year) return fail('Graduation year is before admission year.', 'err')
      const btn = f.querySelector('[type=submit]'); btn.disabled = true
      const res = a ? await supabase.from('alumni').update(row).eq('id', a.id) : await supabase.from('alumni').insert(row)
      if (res.error) { btn.disabled = false; return fail(nice(res.error)) }
      notify(a ? `Alumni record updated: ${row.full_name}` : `Alumni record created: ${row.full_name}`)
    }
    host('aform').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    f.full_name.focus({ preventScroll: true })
  }

  /* ------------------------------ history of one record ------------------------------ */
  async function history(a) {
    host('aform').innerHTML = ''; host('aimphost').innerHTML = ''
    host('ahist').innerHTML = `<div style="border-top:1px solid var(--bd);margin-top:18px;padding-top:12px"><h4 style="margin:0 0 8px">History — ${esc(a.full_name)}</h4>${skeletonList(3)}</div>`
    host('ahist').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    // direct changes, plus the batch imports that created or updated this record (import rows list the Student IDs they touched)
    const base = () => supabase.from('audit_log').select('*').eq('table_name', 'alumni')
    const [direct, ins, upd] = await Promise.all([
      base().eq('record_id', a.id),
      base().eq('action', 'IMPORT').contains('changes', { student_ids: { inserted: [a.student_id] } }),
      base().eq('action', 'IMPORT').contains('changes', { student_ids: { updated: [a.student_id] } }),
    ])
    const err = direct.error || ins.error || upd.error
    const log = [...(direct.data || []), ...(ins.data || []).map((l) => ({ ...l, via: 'created' })), ...(upd.data || []).map((l) => ({ ...l, via: 'updated' }))]
      .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
    host('ahist').innerHTML = `<div style="border-top:1px solid var(--bd);margin-top:18px;padding-top:12px"><div class="spread"><h4 style="margin:0">History — ${esc(a.full_name)}</h4><button class="btn o sm" id="hclose">Close</button></div>
      ${err ? `<div class="msg err">${esc(err.message)}</div>` : logTable(log || [], false)}</div>`
    host('hclose').onclick = () => (host('ahist').innerHTML = '')
  }

  /* ------------------------------ global activity ------------------------------ */
  async function drawActivity() {
    host('aview').innerHTML = skeletonList(5)
    const { data: log, error: err } = await supabase.from('audit_log').select('*').in('table_name', ['alumni', 'profiles']).order('created_at', { ascending: false }).limit(300)
    if (S.view !== 'activity') return
    if (err) { host('aview').innerHTML = `<div class="msg err">${esc(err.message)} — did you run supabase/v5.sql?</div>`; return }
    const actors = [...new Set(log.map((l) => l.actor_email).filter(Boolean))].sort()
    host('aview').innerHTML = `<div class="afilters" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))"><div><label>Action</label><select id="lact">${opts(['CREATE', 'UPDATE', 'DELETE', 'IMPORT'], S.act, 'All')}</select></div>
      <div><label>Administrator</label><select id="lwho">${opts(actors, S.who, 'All')}</select></div></div>
      <p style="font-size:13px;color:var(--mut)">Every create, update, delete and import by an administrator is recorded by the database itself and cannot be edited from the back office.</p><div class="scroll" id="alog"></div>`
    const paint = () => {
      const list = log.filter((l) => (!S.act || actionName(l.action) === S.act) && (!S.who || l.actor_email === S.who))
      host('alog').innerHTML = logTable(list, true)
    }
    host('lact').onchange = (e) => { S.act = e.target.value; paint() }
    host('lwho').onchange = (e) => { S.who = e.target.value; paint() }
    paint()
  }

  function logTable(list, withRecord) {
    if (!list.length) return '<p style="color:var(--mut)">No activity recorded.</p>'
    return `<table><thead><tr><th>Time</th><th>Admin</th><th>Action</th>${withRecord ? '<th>Record</th>' : ''}<th>Change</th></tr></thead><tbody>${list.map((l) => {
      const act = actionName(l.action)
      const snap = act === 'DELETE' && l.changes ? `<details><summary style="cursor:pointer;color:var(--g)">Deleted values</summary><div style="font-size:12.5px;color:var(--mut)">${Object.entries(l.changes).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${esc(LABELS[k] || k)}: ${esc(v)}`).join(' · ')}</div></details>` : ''
      return `<tr><td style="white-space:nowrap">${esc(when(l.created_at))}</td><td>${esc(l.actor_email || '—')}</td><td><span class="pill ${ACTION_CLASS[act] ?? ''}">${esc(act)}</span></td>${withRecord ? `<td>${esc(l.table_name === 'profiles' ? 'Account: ' : '')}${esc(l.row_label || '—')}</td>` : ''}<td>${esc(describeChange({ ...l, action: act }))}${snap}</td></tr>`
    }).join('')}</tbody></table>`
  }

  /* ------------------------------ CSV batch import ------------------------------ */
  function importPanel() {
    host('aform').innerHTML = ''; host('ahist').innerHTML = ''
    host('aimphost').innerHTML = `<div class="imp"><div class="spread"><h4 style="margin:0">Import alumni from CSV</h4><button class="btn o sm" id="icancel">Close</button></div>
      <p class="impnote"><span>CSV file → validate → preview → import. Nothing is saved until you press Import.</span> <span>Required columns: Name, Student ID.</span> <span>Years in the ROC calendar (110 = 2021) are converted automatically.</span> <span>Excel: use Save as → CSV UTF-8.</span></p>
      <div class="acts" style="margin-bottom:10px"><button class="btn o sm" id="itpl">Download CSV template</button></div>
      <label class="drop" id="idrop" tabindex="0"><input type="file" id="ifile" accept=".csv,text/csv,.txt" hidden><b>Choose a CSV file</b> <span>or drop it here</span></label><div id="iout"></div></div>`
    const drop = host('idrop'), file = host('ifile')
    host('icancel').onclick = () => (host('aimphost').innerHTML = '')
    host('itpl').onclick = () => download('alumni-template.csv', TEMPLATE_CSV)
    file.onchange = () => file.files[0] && readFile(file.files[0])
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click() } })
    ;['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over') }))
    ;['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over') }))
    drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]))
    host('aimphost').scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    async function readFile(f) {
      const out = host('iout')
      if (f.size > 2 * 1024 * 1024) { out.innerHTML = '<div class="msg err">The file is larger than 2 MB. Split it into smaller files.</div>'; return }
      if (!/\.(csv|txt)$/i.test(f.name) && !/csv|text/.test(f.type)) { out.innerHTML = '<div class="msg err">That is not a CSV file. In Excel use Save as → CSV UTF-8.</div>'; return }
      out.innerHTML = skeletonList(3)
      const { text, encoding } = decodeBytes(await f.arrayBuffer())
      const res = validateCsv(text, { studentIds: new Set(rows.map((r) => r.student_id)), emails: new Set(rows.map((r) => (r.email || '').toLowerCase()).filter(Boolean)) })
      preview(f.name, res, encoding)
    }

    function preview(name, res, encoding) {
      const out = host('iout')
      const head = `<p style="margin:14px 0 6px;font-size:14px"><b>${esc(name)}</b> <span style="color:var(--mut)">· ${esc(encoding)}</span></p>`
      const msgs = res.headerErrors.map((m) => `<div class="msg err" style="margin:6px 0">${esc(m)}</div>`).join('') + (res.headerWarnings.length ? `<div class="msg" style="margin:6px 0;font-size:13.5px">${res.headerWarnings.map(esc).join('<br>')}</div>` : '')
      if (res.headerErrors.length) { out.innerHTML = head + msgs; return }
      const c = res.counts
      let update = false, only = false
      const importable = () => res.rows.filter((r) => r.status === 'ok' || r.status === 'warn' || (update && r.status === 'duplicate' && r.inDatabase))
      out.innerHTML = `${head}${msgs}${res.rocYears ? '<p style="font-size:13px;color:var(--mut);margin:6px 0">Years in the ROC calendar were converted (110 = 2021).</p>' : ''}<div class="chips2"><span class="pill">${c.ok} ready</span><span class="pill pending">${c.warn} with warnings</span><span class="pill super_admin">${c.duplicate} duplicates</span><span class="pill rejected">${c.error} with errors</span>${res.emptyRows ? `<span class="pill" style="background:var(--b)">${res.emptyRows} empty rows skipped</span>` : ''}</div>
        <div class="spread" style="margin:10px 0"><label style="display:inline;margin:0;font-weight:500"><input type="checkbox" id="iupd" style="width:auto"> Update existing records when the Student ID or email already exists (blank cells keep current values)</label>
        <label style="display:inline;margin:0;font-weight:500"><input type="checkbox" id="ionly" style="width:auto"> Show problems only</label></div>
        <div class="scroll" id="ipv"></div>
        <p class="acts" style="margin-top:12px"><button class="btn" id="igo"></button><span id="inote" style="font-size:13px;color:var(--mut);align-self:center"></span></p>`
      const paint = () => {
        const list = res.rows.filter((r) => !only || r.status !== 'ok')
        const pill = { ok: ['', 'Ready'], warn: ['pending', 'Warning'], duplicate: ['super_admin', 'Duplicate'], error: ['rejected', 'Error'] }
        host('ipv').innerHTML = `<table class="ipv"><thead><tr><th>Line</th><th>Status</th>${['full_name', 'student_id', 'department', 'degree_program', 'graduation_year', 'email', 'company'].map((k) => `<th>${LABELS[k]}</th>`).join('')}<th>Notes</th></tr></thead><tbody>
          ${list.slice(0, 300).map((r) => `<tr class="st-${r.status}"><td>${r.line}</td><td><span class="pill ${pill[r.status][0]}">${pill[r.status][1]}</span></td>${['full_name', 'student_id', 'department', 'degree_program', 'graduation_year', 'email', 'company'].map((k) => `<td>${cell(r.data, k)}</td>`).join('')}
          <td style="font-size:12.5px;max-width:320px">${[...r.errors.map((m) => `<span style="color:var(--err)">${esc(m)}</span>`), ...(r.duplicateOf ? [`<span style="color:var(--g)">${esc(r.duplicateOf)}</span>`] : []), ...r.warnings.map((m) => `<span style="color:var(--mut)">${esc(m)}</span>`)].join('<br>')}</td></tr>`).join('') || '<tr><td colspan="10" style="text-align:center;color:var(--mut);padding:20px">No problems found.</td></tr>'}
          </tbody></table>${list.length > 300 ? `<p style="font-size:13px;color:var(--mut)">Showing the first 300 of ${list.length} rows. All rows are validated.</p>` : ''}`
        const n = importable().length, skip = res.rows.length - n
        host('igo').textContent = n ? `Import ${n} ${n === 1 ? 'row' : 'rows'}` : 'Nothing to import'
        host('igo').disabled = !n
        host('inote').textContent = skip ? `${skip} ${skip === 1 ? 'row' : 'rows'} will be skipped (errors or duplicates).` : ''
      }
      host('iupd').onchange = (e) => { update = e.target.checked; paint() }
      host('ionly').onchange = (e) => { only = e.target.checked; paint() }
      paint()
      host('igo').onclick = async () => {
        const send = importable().map((r) => r.data), btn = host('igo'); btn.disabled = true
        let tot = { inserted: 0, updated: 0, skipped: 0, failed: [] }
        for (let i = 0; i < send.length; i += 500) {
          btn.textContent = `Importing… ${Math.min(i + 500, send.length)} / ${send.length}`
          const { data: r, error: e } = await supabase.rpc('import_alumni', { p_rows: send.slice(i, i + 500), p_update: update, p_filename: name })
          if (e) { btn.disabled = false; btn.textContent = 'Import'; return fail(e.message + ' (did you run supabase/v5.sql?)') }
          tot.inserted += r.inserted; tot.updated += r.updated; tot.skipped += r.skipped; tot.failed.push(...r.failed)
        }
        if (tot.failed.length) alert('Some rows could not be imported:\n' + tot.failed.slice(0, 20).map((f) => `${f.student_id}: ${f.error}`).join('\n'))
        notify(`Import finished: ${tot.inserted} added, ${tot.updated} updated, ${tot.skipped + (res.rows.length - send.length)} skipped${tot.failed.length ? `, ${tot.failed.length} failed` : ''}.`, tot.failed.length ? 'err' : 'ok')
      }
    }
  }
}
