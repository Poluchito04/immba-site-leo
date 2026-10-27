import { esc } from './util.js'
import { skeletonList } from './ui.js'
import { LABELS } from './alumni-csv.js'

const ACTION_CLASS = { CREATE: '', UPDATE: 'pending', DELETE: 'rejected', IMPORT: 'super_admin' }
const SHOWN = 200
// audit_log.table_name -> the tab an administrator knows it by
const AREAS = { news: 'News & events', faculty: 'Faculty', alumni: 'Alumni', pages: 'Pages', downloads: 'Documents', listings: 'Marketplace', profiles: 'Administrators' }

// filters survive the full re-render that every notify() triggers
const S = { area: '', act: '', who: '' }

const when = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
export const actionName = (a) => (a === 'INSERT' ? 'CREATE' : a)

/** one human line per audit row: "Company: ABC → XYZ" */
export function describeChange(a) {
  const c = a.changes || {}
  if (a.action === 'IMPORT' && a.via) return `${a.via === 'created' ? 'Created' : 'Updated'} by CSV import: ${c.file || 'CSV'}`
  if (a.action === 'UPDATE') return Object.entries(c).map(([k, v]) => `${LABELS[k] || (k === 'role' ? 'Role' : k)}: ${v?.from ?? '∅'} → ${v?.to ?? '∅'}`).join(' · ') || 'Edited'
  if (a.action === 'IMPORT') return `${c.file || 'CSV'} — ${c.inserted ?? 0} added, ${c.updated ?? 0} updated, ${c.skipped ?? 0} skipped, ${c.failed ?? 0} failed`
  if (a.action === 'CREATE' || a.action === 'INSERT') return 'New record'
  if (a.action === 'DELETE') return 'Record deleted'
  return ''
}

/** the audit table; `withRecord` adds the Area and Record columns (global view), off for one record's own history */
export function logTable(list, withRecord) {
  if (!list.length) return '<p style="color:var(--mut)">No activity recorded.</p>'
  return `<table><thead><tr><th>Time</th><th>Admin</th>${withRecord ? '<th>Area</th>' : ''}<th>Action</th>${withRecord ? '<th>Record</th>' : ''}<th>Change</th></tr></thead><tbody>${list.map((l) => {
    const act = actionName(l.action)
    const snap = act === 'DELETE' && l.changes ? `<details><summary style="cursor:pointer;color:var(--g)">Deleted values</summary><div style="font-size:12.5px;color:var(--mut)">${Object.entries(l.changes).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${esc(LABELS[k] || k)}: ${esc(v)}`).join(' · ')}</div></details>` : ''
    return `<tr><td style="white-space:nowrap">${esc(when(l.created_at))}</td><td>${esc(l.actor_email || '—')}</td>${withRecord ? `<td>${esc(AREAS[l.table_name] || l.table_name)}</td>` : ''}<td><span class="pill ${ACTION_CLASS[act] ?? ''}">${esc(act)}</span></td>${withRecord ? `<td>${esc(l.row_label || '—')}</td>` : ''}<td>${esc(describeChange({ ...l, action: act }))}${snap}</td></tr>`
  }).join('')}</tbody></table>`
}

export async function loadActivity(pane, { supabase }) {
  const { data: log, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(500)
  if (!pane.isConnected) return // a newer render replaced this tab while it was loading
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)} — did you run supabase/v5.sql?</div>`; return }

  const opts = (list, cur, label = (v) => v) => '<option value="">All</option>' + list.map((v) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label(v))}</option>`).join('')
  const areas = Object.keys(AREAS).filter((t) => log.some((l) => l.table_name === t))
  const actors = [...new Set(log.map((l) => l.actor_email).filter(Boolean))].sort()

  pane.innerHTML = `<div class="box"><div class="spread"><h3 style="margin:0">Activity log</h3><span id="lcount" style="font-size:13px;color:var(--mut)"></span></div>
    <p style="font-size:13px;color:var(--mut);margin:6px 0 14px">Every create, update, delete and import by an administrator is recorded by the database itself and cannot be edited from the back office.</p>
    <div class="afilters" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))"><div><label>Area</label><select id="larea">${opts(areas, S.area, (t) => AREAS[t])}</select></div>
      <div><label>Action</label><select id="lact">${opts(['CREATE', 'UPDATE', 'DELETE', 'IMPORT'], S.act)}</select></div>
      <div><label>Administrator</label><select id="lwho">${opts(actors, S.who)}</select></div></div>
    <div class="scroll" id="alog" style="margin-top:12px"></div></div>`

  const paint = () => {
    const list = log.filter((l) => (!S.area || l.table_name === S.area) && (!S.act || actionName(l.action) === S.act) && (!S.who || l.actor_email === S.who))
    pane.querySelector('#alog').innerHTML = logTable(list.slice(0, SHOWN), true)
    pane.querySelector('#lcount').textContent = list.length > SHOWN ? `Latest ${SHOWN} of ${list.length}` : `${list.length} ${list.length === 1 ? 'entry' : 'entries'}`
  }
  ;[['larea', 'area'], ['lact', 'act'], ['lwho', 'who']].forEach(([id, key]) => (pane.querySelector('#' + id).onchange = (e) => { S[key] = e.target.value; paint() }))
  paint()
}
