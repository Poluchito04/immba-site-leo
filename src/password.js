// Password field with a show/hide eye and, for sign-up, a second field that must match.
const EYE = '<svg class="on" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
const EYE_OFF = '<svg class="off" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.600 5.100A10 10 0 0 1 12 5c6.400 0 10 7 10 7a17 17 0 0 1-3.200 4.200M6.600 6.600C3.800 8.400 2 12 2 12s3.600 7 10 7a10 10 0 0 0 4.400-1M9.900 9.900a3 3 0 0 0 4.200 4.200"/></svg>'

/** label + input + eye button. `label` is already translated by the caller. */
export function pwField({ name, label, autocomplete, hint = '' }) {
  return `<label for="pw-${name}">${label}</label><div class="pw"><input type="password" id="pw-${name}" name="${name}" required minlength="6" autocomplete="${autocomplete}" autocapitalize="none" spellcheck="false">
    <button type="button" class="pweye" data-pw="pw-${name}" aria-pressed="false">${EYE}${EYE_OFF}</button></div>${hint}`
}

/**
 * Wire the eyes inside `root`. `text(key)` returns the translated string for
 * 'show' | 'hide' | 'match' | 'mismatch' so it works with both i18n styles.
 * Returns { matches() } to validate a password/confirm pair at submit time.
 */
export function bindPasswords(root, text, first = 'password', second = 'password2') {
  root.querySelectorAll('.pweye').forEach((b) => {
    const input = root.querySelector('#' + b.dataset.pw)
    const paint = () => { const shown = input.type === 'text'; b.classList.toggle('shown', shown); b.setAttribute('aria-pressed', shown); const l = text(shown ? 'hide' : 'show'); b.setAttribute('aria-label', l); b.title = l }
    b.onclick = () => { input.type = input.type === 'password' ? 'text' : 'password'; paint(); input.focus() }
    paint()
  })
  const a = root.querySelector(`[name=${first}]`), c = root.querySelector(`[name=${second}]`)
  const msg = root.querySelector('#pwmatch')
  const check = () => {
    if (!a || !c) return true
    const ok = a.value === c.value
    c.setCustomValidity(ok ? '' : text('mismatch'))
    if (msg) { msg.hidden = !c.value; msg.className = 'pwhint ' + (ok ? 'ok' : 'bad'); msg.textContent = ok ? '✓ ' + text('match') : text('mismatch') }
    return ok
  }
  if (a && c) { a.addEventListener('input', check); c.addEventListener('input', check) }
  return { matches: check }
}

export const matchHint = '<p id="pwmatch" class="pwhint" role="status" hidden></p>'
