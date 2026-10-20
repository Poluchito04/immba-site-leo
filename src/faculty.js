import { supabase, configured, esc, safeUrl } from './supabase.js'

const app = document.getElementById('app')

function card(f) {
  const photo = safeUrl(f.image_url)
    ? `<img src="${esc(safeUrl(f.image_url))}" alt="${esc(f.name)}" loading="lazy">`
    : `<div class="ph">${esc(f.name.trim().charAt(0).toUpperCase())}</div>`
  const line = (label, v) => (v ? `<p><b>${label}:</b> ${esc(v)}</p>` : '')
  const site = safeUrl(f.website)
  return `<article class="card">${photo}<div>
    <h4>${esc(f.name)}</h4><div class="t">${esc(f.title)}</div>
    ${line('Department', f.department)}${line('Education', f.education)}${line('Research', f.research_fields)}
    ${line('Phone', f.phone)}
    ${f.email ? `<p><b>Email:</b> <a href="mailto:${esc(f.email)}">${esc(f.email)}</a></p>` : ''}
    ${site ? `<p><a href="${esc(site)}" target="_blank" rel="noopener">Personal website ↗</a></p>` : ''}
  </div></article>`
}

async function load() {
  if (!configured) {
    app.innerHTML = '<div class="msg err">The cloud backend is not connected yet (missing Supabase environment variables).</div>'
    return
  }
  const { data, error } = await supabase.from('faculty').select('*').order('sort_order').order('created_at')
  if (error) { app.innerHTML = `<div class="msg err">Could not load faculty: ${esc(error.message)}</div>`; return }
  if (!data.length) { app.innerHTML = '<div class="msg">No faculty members have been added yet.</div>'; return }
  const group = (cat, title) => {
    const rows = data.filter((f) => f.category === cat)
    return rows.length ? `<h3 class="sec">${title}</h3><div class="grid">${rows.map(card).join('')}</div>` : ''
  }
  app.innerHTML = group('full-time', 'Full-time faculty') + group('adjunct', 'Adjunct faculty')
}
load()
