import { esc } from './util.js'
import { skeletonList, toast } from './ui.js'
import { COLUMNS, LABELS, DEGREES, TEMPLATE_CSV, decodeBytes, validateCsv, toCsv } from './alumni-csv.js'
import { logTable } from './admin-activity.js'

const DEFAULT_COLS = ['full_name', 'student_id', 'department', 'degree_program', 'graduation_year', 'company']
const LS_COLS = 'alumni-cols'
const PAGE = 50

// filters survive the full re-render that every notify() triggers
const S = { q: '', degree: '', dept: '', year: '', company: '', sort: { key: 'full_name', dir: 1 }, page: 0 }

const loadCols = () => { try { const c = JSON.parse(localStorage.getItem(LS_COLS)); if (Array.isArray(c) && c.length) return c.filter((x) => COLUMNS.includes(x)) } catch { /* private mode */ } return [...DEFAULT_COLS] }
const saveCols = (c) => { try { localStorage.setItem(LS_COLS, JSON.stringify(c)) } catch { /* ignore */ } }
const nice = (e) => (e?.code === '23505' || /duplicate key/i.test(e?.message || '') ? 'That Student ID or email already exists.' : e?.message || 'Something went wrong.')
const cell = (r, k) => (r[k] ?? '') === '' ? '<span style="color:var(--mut)">—</span>' : k === 'degree_program' ? esc(r[k]) : esc(r[k])
const download = (name, text, type = 'text/csv;charset=utf-8') => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name })
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export async function loadAlumni(pane, ctx) {
  const { supabase, notify } = ctx
  const fail = (m) => toast(m, 'err', 6000) // unlike notify(), keeps the open form and its typed values
  const { data, error } = await supabase.from('alumni').select('*').order('full_name').range(0, 4999)
  if (!pane.isConnected) return // a newer render replaced this tab while it was loading
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)} — did you run supabase/v5.sql?</div>`; return }
  let rows = data, cols = loadCols()

  const distinct = (k) => [...new Set(rows.map((r) => r[k]).filter((v) => v !== null && v !== ''))].sort((a, b) => (typeof a === 'number' ? b - a : String(a).localeCompare(b)))
  const opts = (list, cur, all) => `<option value="">${all}</option>` + list.map((v) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(v)}</option>`).join('')

  const sortRows = (list) => {
    const { key, dir } = S.sort
    return [...list].sort((a, b) => {
      const x = a[key], y = b[key]
      if (x == null && y == null) return 0
      if (x == null) return 1 // blanks always last
      if (y == null) return -1
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * dir
    })
  }
  const filtered = () => {
    const q = S.q.trim().toLowerCase(), co = S.company.trim().toLowerCase()
    return sortRows(rows.filter((r) =>
      (!q || [r.full_name, r.student_id, r.email, r.company, r.job_title].some((v) => (v || '').toLowerCase().includes(q))) &&
      (!S.degree || r.degree_program === S.degree) && (!S.dept || r.department === S.dept) &&
      (!S.year || String(r.graduation_year) === S.year) && (!co || (r.company || '').toLowerCase().includes(co))))
  }

  pane.innerHTML = `<div class="box"><div class="spread"><h3 style="margin:0" id="atitle">Alumni (${rows.length})</h3>
    <div class="acts"><button class="btn o" id="aimp">Import CSV</button><button class="btn o" id="aexp">Export CSV</button><button class="btn" id="aadd">+ Add alumnus</button></div></div>
    <div id="aimphost"></div><div id="aexphost"></div><div id="aform"></div><div id="ahist"></div>
    <div id="aview"></div></div>`

  const host = (id) => document.getElementById(id)
  host('aadd').onclick = () => form(null)
  host('aimp').onclick = () => importPanel()
  host('aexp').onclick = () => exportPanel()
  drawRecords()

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
    if (host('aexphost').firstElementChild) drawExport() // filters, sorting or columns changed under an open export review
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
    host('aimphost').innerHTML = ''; host('ahist').innerHTML = ''; host('aexphost').innerHTML = ''
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
    host('aform').innerHTML = ''; host('aimphost').innerHTML = ''; host('aexphost').innerHTML = ''
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

  /* ------------------------------ CSV export: review before download ------------------------------ */
  const X = { scope: 'filtered', cols: 'all' } // the choices made in the open panel
  const activeFilters = () => [
    S.q.trim() && ['Search', `"${S.q.trim()}"`], S.degree && ['Degree Program', S.degree], S.year && ['Graduation Year', S.year],
    S.dept && ['Department', S.dept], S.company.trim() && ['Company', `"${S.company.trim()}"`],
  ].filter(Boolean)

  function exportPanel() {
    host('aform').innerHTML = ''; host('ahist').innerHTML = ''; host('aimphost').innerHTML = ''
    X.scope = activeFilters().length ? 'filtered' : 'all'; X.cols = 'all'
    drawExport()
    host('aexphost').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function drawExport() {
    const box = host('aexphost'), filters = activeFilters()
    if (!filters.length) X.scope = 'all'
    if (cols.length === COLUMNS.length) X.cols = 'all' // nothing to choose between
    const matching = filtered()
    const list = X.scope === 'filtered' ? matching : sortRows(rows)
    const out = X.cols === 'shown' ? cols : COLUMNS
    const n = list.length, word = (k, one, many) => (k === 1 ? one : many)
    const name = `alumni-${new Date().toISOString().slice(0, 10)}.csv`
    const opt = (group, val, on, label, count) => `<label class="xopt"><input type="radio" name="${group}" value="${val}" ${on ? 'checked' : ''}><span>${label}</span><b>${count}</b></label>`
    const arrow = S.sort.dir > 0 ? '▲' : '▼'
    box.innerHTML = `<div class="imp"><div class="spread"><h4 style="margin:0">Export alumni to CSV</h4><button class="btn o sm" id="xclose">Close</button></div>
      <p class="impnote"><span>Check what you are about to download. The file is built in your browser and saved to your Downloads folder when you press the button.</span></p>
      ${!rows.length ? '<p style="color:var(--mut)">There are no alumni to export yet.</p>' : `
      <h5 class="xh">Records</h5>
      ${filters.length ? `<div class="chips2"><span class="xlab">Active filters:</span>${filters.map(([k, v]) => `<span class="pill"><span>${k}</span>: <b>${esc(v)}</b></span>`).join('')}</div>
        ${opt('xs', 'filtered', X.scope === 'filtered', 'Only the records matching the current filters', matching.length)}${opt('xs', 'all', X.scope === 'all', 'All alumni', rows.length)}`
        : '<p class="xline"><span>No filters are active, so all alumni will be exported.</span></p>'}
      <h5 class="xh">Columns</h5>
      ${cols.length < COLUMNS.length ? `${opt('xc', 'all', X.cols === 'all', 'All columns', COLUMNS.length)}${opt('xc', 'shown', X.cols === 'shown', 'Only the columns shown in the table', cols.length)}` : ''}
      <div class="chips2">${out.map((k) => `<span class="pill">${LABELS[k]}</span>`).join('')}</div>
      <h5 class="xh">Preview</h5>
      ${n ? `<div class="scroll"><table class="ipv xpv"><thead><tr>${out.map((k) => `<th>${LABELS[k]}</th>`).join('')}</tr></thead><tbody>${list.slice(0, 5).map((r) => `<tr>${out.map((k) => `<td>${cell(r, k)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        ${n > 5 ? `<p class="impnote" style="margin:6px 0 0">…and ${n - 5} more</p>` : ''}` : '<p style="color:var(--err);margin:6px 0">Nothing to export with the current filters.</p>'}
      <div class="xsum"><span>File name</span><b>${esc(name)}</b><span>Contents</span><b>${n} ${word(n, 'record', 'records')} × ${out.length} ${word(out.length, 'column', 'columns')}</b>
        <span>Order</span><b><span>${LABELS[S.sort.key]}</span> ${arrow}</b><span>Format</span><b>UTF-8 with BOM, opens correctly in Excel</b></div>
      <p class="xwarn">This file contains personal data (emails, phone numbers). Store it securely and share it only with people who need it.</p>
      <p class="acts" style="margin-top:12px"><button class="btn" id="xgo" ${n ? '' : 'disabled'}>Download ${n} ${word(n, 'record', 'records')}</button><button class="btn o" id="xcancel">Cancel</button></p>`}</div>`
    const close = () => (box.innerHTML = '')
    box.querySelector('#xclose').onclick = close
    box.querySelector('#xcancel')?.addEventListener('click', close)
    ;[['xs', 'scope'], ['xc', 'cols']].forEach(([group, key]) => box.querySelectorAll(`[name=${group}]`).forEach((r) => (r.onchange = () => {
      X[key] = r.value; drawExport(); box.querySelector(`[name=${group}]:checked`)?.focus({ preventScroll: true })
    })))
    const go = box.querySelector('#xgo')
    if (go) go.onclick = () => { download(name, toCsv(list, out)); close(); toast(`Exported ${n} record(s) to CSV.`) }
  }

  /* ------------------------------ CSV batch import ------------------------------ */
  function importPanel() {
    host('aform').innerHTML = ''; host('ahist').innerHTML = ''; host('aexphost').innerHTML = ''
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
