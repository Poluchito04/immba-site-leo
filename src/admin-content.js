import { esc, safeUrl } from './util.js'
import { renderMd } from './md.js'
import { translate } from './translate.js'

const val = (f, k) => f[k].value.trim() || null
const TYPES = ['PDF', 'DOC', 'XLS', 'PPT', 'OTHER']
const DCATS = ['admissions', 'curriculum', 'graduation', 'dual', 'other']

/* ------------------------------ Pages (CMS) ------------------------------ */
export async function loadPages(pane, ctx) {
  const { supabase, notify } = ctx
  const { data, error } = await supabase.from('pages').select('*').order('sort_order')
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)} — did you run supabase/v2.sql?</div>`; return }
  pane.innerHTML = `<div class="box"><div class="spread"><h3 style="margin:0">Content pages (${data.length})</h3><button class="btn" id="addp">+ Add page</button></div><div id="pform"></div>
    <div class="scroll"><table><thead><tr><th>Page</th><th>English title</th><th>中文標題</th><th>Languages</th><th>Status</th><th></th></tr></thead><tbody>
    ${data.map((p) => { const both = (p.body_en || '').trim() && (p.body_zh || '').trim(); return `<tr><td><code>${esc(p.slug)}</code></td><td>${esc(p.title_en || '—')}</td><td>${esc(p.title_zh || '—')}</td>
      <td><span class="pill ${both ? '' : 'pending'}">${both ? 'EN ⇄ 中文 ✓' : 'Out of sync'}</span></td><td><span class="pill ${p.published ? '' : 'rejected'}">${p.published ? 'published' : 'draft'}</span></td>
      <td><div class="acts"><a class="btn o sm" href="/page.html?p=${esc(p.slug)}" target="_blank" rel="noopener">View</a><button class="btn o sm" data-e="${p.id}">Edit</button><button class="btn danger sm" data-d="${p.id}">Delete</button></div></td></tr>` }).join('')}
    </tbody></table></div></div>`
  document.getElementById('addp').onclick = () => form(null)
  pane.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => form(data.find((p) => p.id === b.dataset.e))))
  pane.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => {
    const p = data.find((x) => x.id === b.dataset.d)
    if (!confirm(`Delete the page "${p.slug}"? Both languages will be removed.`)) return
    const r = await supabase.from('pages').delete().eq('id', p.id); r.error ? notify(r.error.message, 'err') : notify('Page deleted.')
  }))

  function form(p) {
    const v = (k) => esc(p?.[k] ?? '')
    const host = document.getElementById('pform')
    host.innerHTML = `<form id="pf" style="border-top:1px solid var(--bd);margin-top:18px;padding-top:6px"><h4 style="margin:12px 0 0">${p ? 'Edit page' : 'New page'}</h4>
      <div class="row2"><div><label>Slug (URL name) *</label><input name="slug" required pattern="[a-z0-9-]+" value="${v('slug')}" ${p ? 'readonly' : ''}></div>
      <div><label>Section</label><select name="section">${['about', 'admissions', 'curriculum', 'more'].map((s) => `<option ${p?.section === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div><label>English title</label><input name="title_en" value="${v('title_en')}"></div><div><label>中文標題</label><input name="title_zh" value="${v('title_zh')}"></div>
      <div><label>Source link (English)</label><input type="url" name="source_url_en" value="${v('source_url_en')}"></div><div><label>Source link (中文)</label><input type="url" name="source_url_zh" value="${v('source_url_zh')}"></div>
      <div><label>Order</label><input type="number" name="sort_order" value="${p?.sort_order ?? 0}"></div>
      <div><label>&nbsp;</label><label style="display:inline"><input type="checkbox" name="published" style="width:auto" ${p?.published === false ? '' : 'checked'}> Published</label></div></div>
      <p style="font-size:13px;color:var(--mut);margin:12px 0 0">Formatting: <code>## Heading</code>, <code>- list item</code>, <code>[text](https://…)</code>, <code>**bold**</code>. Blank line = new paragraph.</p>
      <div class="row2"><div><label>English content</label><textarea name="body_en" rows="12">${v('body_en')}</textarea></div><div><label>中文內容</label><textarea name="body_zh" rows="12">${v('body_zh')}</textarea></div></div>
      <p class="acts"><button class="btn o" type="button" id="p-en2zh">Auto-translate English → 中文</button><button class="btn o" type="button" id="p-zh2en">Auto-translate 中文 → English</button><span id="pstat" style="font-size:13px;color:var(--mut);align-self:center"></span></p>
      <h4 style="margin:18px 0 8px">Preview</h4><div class="row2"><div class="panel prose" id="pv-en"></div><div class="panel prose" id="pv-zh"></div></div>
      <p class="acts"><button class="btn" type="submit">${p ? 'Save changes' : 'Create page'}</button><button class="btn o" type="button" id="pc">Cancel</button></p></form>`
    const f = document.getElementById('pf')
    const prev = () => { document.getElementById('pv-en').innerHTML = renderMd(f.body_en.value) || '<i>(empty)</i>'; document.getElementById('pv-zh').innerHTML = renderMd(f.body_zh.value) || '<i>(empty)</i>' }
    f.addEventListener('input', prev); prev()
    const tr = (from, to, a, b) => async () => {
      const st = document.getElementById('pstat'); st.textContent = 'Translating…'
      try { for (const k of ['title', 'body']) if (f[`${k}_${a}`].value.trim()) f[`${k}_${b}`].value = await translate(f[`${k}_${a}`].value, from, to); st.textContent = 'Done — review before publishing.'; prev() }
      catch (e) { st.textContent = 'Translation failed: ' + e.message }
    }
    document.getElementById('p-en2zh').onclick = tr('en', 'zh-TW', 'en', 'zh')
    document.getElementById('p-zh2en').onclick = tr('zh-TW', 'en', 'zh', 'en')
    document.getElementById('pc').onclick = () => (host.innerHTML = '')
    f.onsubmit = async (e) => {
      e.preventDefault()
      const row = { section: f.section.value, title_en: val(f, 'title_en'), title_zh: val(f, 'title_zh'), body_en: val(f, 'body_en'), body_zh: val(f, 'body_zh'),
        source_url_en: val(f, 'source_url_en'), source_url_zh: val(f, 'source_url_zh'), sort_order: parseInt(f.sort_order.value, 10) || 0, published: f.published.checked }
      for (const k of ['source_url_en', 'source_url_zh']) if (row[k] && !safeUrl(row[k])) return notify('Links must start with http:// or https://', 'err')
      if (!row.title_en && !row.title_zh) return notify('Add a title.', 'err')
      if (!(row.body_en && row.body_zh) && !confirm('One language has no content. Save anyway?')) return
      const r = p ? await supabase.from('pages').update(row).eq('id', p.id) : await supabase.from('pages').insert({ ...row, slug: f.slug.value.trim() })
      r.error ? notify(r.error.message, 'err') : notify('Page saved.')
    }
    host.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

/* ------------------------------- Downloads ------------------------------- */
export async function loadDownloads(pane, ctx) {
  const { supabase, notify } = ctx
  const { data, error } = await supabase.from('downloads').select('*').order('category').order('sort_order')
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return }
  pane.innerHTML = `<div class="box"><div class="spread"><h3 style="margin:0">Documents (${data.length})</h3><button class="btn" id="addd">+ Add document</button></div><div id="dform"></div>
    <div class="scroll"><table><thead><tr><th>Type</th><th>Title</th><th>Category</th><th>Status</th><th></th></tr></thead><tbody>
    ${data.map((d) => `<tr><td><span class="ft ${esc(d.file_type)}">${esc(d.file_type)}</span></td><td>${esc(d.title_en || d.title_zh)}<br><small style="color:var(--mut)">${esc(d.title_zh && d.title_en ? d.title_zh : '')}</small></td><td>${esc(d.category)}</td>
    <td><span class="pill ${d.published ? '' : 'rejected'}">${d.published ? 'published' : 'hidden'}</span></td><td><div class="acts"><button class="btn o sm" data-e="${d.id}">Edit</button><button class="btn danger sm" data-d="${d.id}">Delete</button></div></td></tr>`).join('')}
    </tbody></table></div></div>`
  document.getElementById('addd').onclick = () => form(null)
  pane.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => form(data.find((d) => d.id === b.dataset.e))))
  pane.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Delete this document link?')) return
    const r = await supabase.from('downloads').delete().eq('id', b.dataset.d); r.error ? notify(r.error.message, 'err') : notify('Document deleted.')
  }))
  function form(d) {
    const v = (k) => esc(d?.[k] ?? '')
    const host = document.getElementById('dform')
    host.innerHTML = `<form id="df" style="border-top:1px solid var(--bd);margin-top:18px;padding-top:6px"><h4 style="margin:12px 0 0">${d ? 'Edit document' : 'New document'}</h4>
      <div class="row2"><div><label>English title</label><input name="title_en" value="${v('title_en')}"></div><div><label>中文標題</label><input name="title_zh" value="${v('title_zh')}"></div></div>
      <label>File URL (https://…) *</label><input type="url" name="file_url" required value="${v('file_url')}">
      <div class="row2"><div><label>File type</label><select name="file_type">${TYPES.map((t) => `<option ${d?.file_type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>Category</label><select name="category">${DCATS.map((t) => `<option ${d?.category === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>Order</label><input type="number" name="sort_order" value="${d?.sort_order ?? 0}"></div><div><label>&nbsp;</label><label style="display:inline"><input type="checkbox" name="published" style="width:auto" ${d?.published === false ? '' : 'checked'}> Published</label></div></div>
      <p class="acts"><button class="btn" type="submit">${d ? 'Save changes' : 'Add'}</button><button class="btn o" type="button" id="dc">Cancel</button></p></form>`
    document.getElementById('dc').onclick = () => (host.innerHTML = '')
    document.getElementById('df').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target
      const row = { title_en: val(f, 'title_en'), title_zh: val(f, 'title_zh'), file_url: f.file_url.value.trim(), file_type: f.file_type.value, category: f.category.value, sort_order: parseInt(f.sort_order.value, 10) || 0, published: f.published.checked }
      if (!safeUrl(row.file_url)) return notify('The file URL must start with http:// or https://', 'err')
      if (!row.title_en && !row.title_zh) return notify('Add a title in at least one language.', 'err')
      const r = d ? await supabase.from('downloads').update(row).eq('id', d.id) : await supabase.from('downloads').insert(row)
      r.error ? notify(r.error.message, 'err') : notify('Document saved.')
    }
    host.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

/* ------------------------------- Marketplace ------------------------------ */
export async function loadListings(pane, ctx) {
  const { supabase, notify } = ctx
  const { data, error } = await supabase.from('listings').select('*').order('created_at', { ascending: false })
  if (error) { pane.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return }
  const order = { pending: 0, approved: 1, rejected: 2 }
  data.sort((a, b) => order[a.status] - order[b.status])
  pane.innerHTML = `<div class="box"><h3 style="margin-top:0">Marketplace listings (${data.length}) <small style="font-weight:400;color:var(--mut)">— visitors submit, administrators approve</small></h3><div class="scroll"><table><thead><tr><th>Listing</th><th>Price</th><th>Seller / contact</th><th>Status</th><th></th></tr></thead><tbody>
    ${data.map((l) => `<tr><td><b>${esc(l.title)}</b><br><small style="color:var(--mut)">${esc(l.category)} · ${esc((l.description || '').slice(0, 80))}</small></td><td>NT$ ${Number(l.price).toLocaleString()}</td>
    <td>${esc(l.seller_name)}<br><small style="color:var(--mut)">${esc(l.contact)}</small></td><td><span class="pill ${l.status === 'approved' ? '' : l.status}">${esc(l.status)}</span></td>
    <td><div class="acts">${l.status !== 'approved' ? `<button class="btn sm" data-s="approved" data-id="${l.id}">Approve</button>` : ''}${l.status !== 'rejected' ? `<button class="btn o sm" data-s="rejected" data-id="${l.id}">Reject</button>` : ''}<button class="btn danger sm" data-del="${l.id}">Delete</button></div></td></tr>`).join('')}
    </tbody></table></div></div>`
  pane.querySelectorAll('[data-s]').forEach((b) => (b.onclick = async () => { const r = await supabase.from('listings').update({ status: b.dataset.s }).eq('id', b.dataset.id); r.error ? notify(r.error.message, 'err') : notify('Listing ' + b.dataset.s + '.') }))
  pane.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => { if (!confirm('Delete this listing?')) return; const r = await supabase.from('listings').delete().eq('id', b.dataset.del); r.error ? notify(r.error.message, 'err') : notify('Listing deleted.') }))
}
