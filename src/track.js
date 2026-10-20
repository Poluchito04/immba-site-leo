import { supabase, configured } from './supabase.js'
import { getLang } from './i18n.js'

// Anonymous page-view counter (path + language only, no personal data) used for the admin dashboard.
export function track(path = location.pathname) {
  if (!configured) return
  try {
    const key = 'pv:' + path
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch { /* ignore */ }
  supabase.from('page_views').insert({ path: path.slice(0, 200), lang: getLang() }).then(() => {})
}
