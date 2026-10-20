export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// only allow http(s) links coming from the database
export const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '')
