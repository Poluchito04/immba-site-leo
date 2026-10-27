// Alumni CSV: parse, normalise, validate, export. Pure functions (no DOM) so they can be unit-tested.

export const COLUMNS = ['full_name', 'student_id', 'department', 'degree_program', 'admission_year', 'graduation_year', 'email', 'phone', 'company', 'job_title', 'notes']
export const REQUIRED = ['full_name', 'student_id']
export const DEGREES = ['Bachelor', 'Master', 'Doctoral', 'Other']
export const LABELS = { full_name: 'Name', student_id: 'Student ID', department: 'Department', degree_program: 'Degree Program', admission_year: 'Admission Year', graduation_year: 'Graduation Year', email: 'Email', phone: 'Phone', company: 'Current Company', job_title: 'Job Title', notes: 'Notes' }

// header aliases -> field (compared after lower-casing and stripping spaces/_/-/.)
const squash = (s) => String(s ?? '').toLowerCase().replace(/[\s_\-.]+/g, '')
const ALIASES = {}
const alias = (field, ...names) => names.forEach((n) => (ALIASES[squash(n)] = field))
alias('full_name', 'name', 'full name', 'fullname', 'alumni name', 'alumni', '姓名')
alias('student_id', 'student id', 'studentid', 'id', 'student number', 'student no', '學號')
alias('department', 'department', 'dept', 'department / program', 'program', '系所')
alias('degree_program', 'degree program', 'degree', 'degree level', 'level', '學位')
alias('admission_year', 'admission year', 'admission', 'entry year', 'enrollment year', '入學年')
alias('graduation_year', 'graduation year', 'graduation', 'grad year', '畢業年')
alias('email', 'email', 'e-mail', 'email address', '電子郵件')
alias('phone', 'phone', 'phone number', 'mobile', 'tel', 'telephone', '電話')
alias('company', 'company', 'current company', 'employer', 'organization', '公司')
alias('job_title', 'job title', 'current position', 'position', 'title', 'role', '職稱')
alias('notes', 'notes', 'note', 'additional information', 'remarks', 'comments', '備註')

const DEGREE_MAP = [
  [/^(b\.?\s?a\.?|b\.?\s?s\.?c?\.?|bachelor.*|undergrad.*|大學.*|學士.*)$/i, 'Bachelor'],
  [/^(m\.?\s?b\.?\s?a\.?|m\.?\s?a\.?|m\.?\s?s\.?c?\.?|master.*|碩士.*|研究所.*)$/i, 'Master'],
  [/^(ph\.?\s?d\.?|d\.?b\.?a\.?|doctor.*|博士.*)$/i, 'Doctoral'],
  [/^(other|others|—|n\/a)$/i, 'Other'],
]
export function normalizeDegree(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  for (const [re, out] of DEGREE_MAP) if (re.test(s)) return out
  return undefined // present but not recognised
}

/** Taiwan files use ROC years (110 = 2021). 1-200 are read as ROC, 1900+ as calendar years. */
export function normalizeYear(v) {
  const s = String(v ?? '').trim()
  if (!s) return { value: null }
  if (!/^\d{1,4}$/.test(s)) return { error: 'not a year' }
  const n = parseInt(s, 10)
  if (n >= 1 && n <= 200) return { value: n + 1911, roc: true }
  if (n >= 1950 && n <= 2100) return { value: n }
  return { error: 'year out of range' }
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE_RE = /^[+\d][\d\s\-().#x]{5,}$/i

/** RFC 4180 CSV reader: quoted fields, escaped quotes, newlines inside quotes, BOM, CRLF. */
export function parseCsv(text, delimiter) {
  const src = String(text ?? '').replace(/^﻿/, '')
  const d = delimiter || detectDelimiter(src)
  const rows = []
  let row = [], field = '', q = false, quoted = false, i = 0, unterminated = false
  for (; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++ } else q = false } else field += c
    } else if (c === '"' && field === '' && !quoted) { q = true; quoted = true }
    else if (c === d) { row.push(field); field = ''; quoted = false }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''; quoted = false
    } else field += c
  }
  if (q) unterminated = true
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return { rows, delimiter: d, unterminated }
}

function detectDelimiter(src) {
  const first = src.split(/\r?\n/, 1)[0] || ''
  const count = (ch) => first.split(ch).length - 1
  const best = [',', ';', '\t'].map((ch) => [ch, count(ch)]).sort((a, b) => b[1] - a[1])[0]
  return best[1] > 0 ? best[0] : ','
}

/** Decode bytes read from a file: UTF-8 first, Big5 (Excel in Taiwan) as fallback. */
export function decodeBytes(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  if (!utf8.includes('�')) return { text: utf8, encoding: 'UTF-8', problem: false }
  try {
    const big5 = new TextDecoder('big5').decode(bytes)
    if (!big5.includes('�')) return { text: big5, encoding: 'Big5', problem: false }
  } catch { /* decoder not available */ }
  return { text: utf8, encoding: 'UTF-8', problem: true }
}

/** Defuse spreadsheet formulas (=, @, +, - followed by a non-number) in cells we export. */
const safeCell = (v) => {
  const s = String(v ?? '')
  return /^[=@\t\r]/.test(s) || /^[+-](?!\d[\d\s\-().]*$)/.test(s) ? "'" + s : s
}
const csvCell = (v) => { const s = safeCell(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }

export function toCsv(rows, cols = COLUMNS) {
  const head = cols.map((c) => csvCell(LABELS[c] || c)).join(',')
  const body = rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))
  return '﻿' + [head, ...body].join('\r\n') + '\r\n' // BOM so Excel opens it as UTF-8
}

export const TEMPLATE_CSV = toCsv([
  { full_name: 'Jane Chen', student_id: '11210001', department: 'International Business and Trade', degree_program: 'Master', admission_year: 2023, graduation_year: 2025, email: 'jane.chen@example.com', phone: '0912-345-678', company: 'Example Co., Ltd.', job_title: 'Project Manager', notes: '' },
])

/**
 * Validate a whole file.
 * @param text decoded CSV text
 * @param existing { studentIds:Set<string>, emails:Set<string> } already in the database
 * @returns { headerErrors, headerWarnings, rows:[{line,data,status,errors,warnings,duplicateOf}], counts, emptyRows }
 *   status: ok | warn | error | duplicate (duplicate = already in DB or earlier in the file)
 */
export function validateCsv(text, existing = {}) {
  const ids = existing.studentIds || new Set(), mails = existing.emails || new Set()
  const out = { headerErrors: [], headerWarnings: [], rows: [], counts: { ok: 0, warn: 0, error: 0, duplicate: 0 }, emptyRows: 0, delimiter: ',' }
  const { rows: raw, delimiter, unterminated } = parseCsv(text)
  out.delimiter = delimiter
  if (unterminated) out.headerErrors.push('A quoted field is never closed (the file looks truncated or damaged).')
  if (!raw.length || !raw[0].some((h) => h.trim())) { out.headerErrors.push('The file is empty.'); return out }
  if (String(text).includes('�')) out.headerErrors.push('Encoding problem: some characters could not be read. Save the file as "CSV UTF-8" and try again.')

  const map = [] // column index -> field
  const seen = new Set()
  raw[0].forEach((h, idx) => {
    const f = ALIASES[squash(h)]
    if (!f) { if (h.trim()) out.headerWarnings.push(`Unknown column "${h.trim()}" will be ignored.`); map[idx] = null }
    else if (seen.has(f)) { out.headerWarnings.push(`Column "${h.trim()}" repeats ${LABELS[f]} and will be ignored.`); map[idx] = null }
    else { seen.add(f); map[idx] = f }
  })
  for (const r of REQUIRED) if (!seen.has(r)) out.headerErrors.push(`Missing required column "${LABELS[r]}".`)
  if (out.headerErrors.length) return out

  const fileIds = new Map(), fileMails = new Map()
  for (let n = 1; n < raw.length; n++) {
    const cells = raw[n]
    if (!cells.some((c) => c.trim())) { out.emptyRows++; continue }
    const data = Object.fromEntries(COLUMNS.map((c) => [c, null]))
    cells.forEach((c, idx) => { if (map[idx]) data[map[idx]] = c.trim() || null })
    const errors = [], warnings = []
    let dupOf = null

    if (!data.full_name) errors.push('Name is required.')
    if (!data.student_id) errors.push('Student ID is required.')
    else if (!/^[A-Za-z0-9\-_.]{1,30}$/.test(data.student_id)) errors.push('Student ID may only contain letters, digits, - _ .')

    const deg = normalizeDegree(data.degree_program)
    if (deg === undefined) errors.push(`Invalid degree program "${data.degree_program}" (use Bachelor, Master, Doctoral or Other).`)
    else if (deg === null) { data.degree_program = 'Other'; warnings.push('Degree program is empty: set to Other.') }
    else data.degree_program = deg

    for (const f of ['admission_year', 'graduation_year']) {
      const y = normalizeYear(data[f])
      if (y.error) errors.push(`${LABELS[f]}: ${y.error} ("${data[f]}").`)
      else { if (y.roc) out.rocYears = true; data[f] = y.value }
    }
    if (data.admission_year && data.graduation_year && data.graduation_year < data.admission_year) errors.push('Graduation year is before admission year.')

    if (data.email) { data.email = data.email.toLowerCase(); if (!EMAIL_RE.test(data.email)) errors.push(`Invalid email "${data.email}".`) }
    if (data.phone && !PHONE_RE.test(data.phone)) warnings.push(`Phone "${data.phone}" looks unusual.`)
    if (!errors.length) {
      const empties = ['department', 'email', 'phone', 'company', 'job_title'].filter((f) => !data[f])
      if (empties.length) warnings.push('Empty: ' + empties.map((f) => LABELS[f]).join(', ') + '.')
    }

    if (data.student_id) {
      if (ids.has(data.student_id)) dupOf = `Student ID already in the database`
      else if (fileIds.has(data.student_id)) dupOf = `Student ID repeated from line ${fileIds.get(data.student_id)}`
      else fileIds.set(data.student_id, n + 1)
    }
    if (!dupOf && data.email) {
      if (mails.has(data.email)) dupOf = 'Email already in the database'
      else if (fileMails.has(data.email)) dupOf = `Email repeated from line ${fileMails.get(data.email)}`
      else fileMails.set(data.email, n + 1)
    }
    const status = errors.length ? 'error' : dupOf ? 'duplicate' : warnings.length ? 'warn' : 'ok'
    out.counts[status]++
    out.rows.push({ line: n + 1, data, status, errors, warnings, duplicateOf: dupOf, inDatabase: Boolean(dupOf && /database/.test(dupOf)) })
  }
  if (!out.rows.length) out.headerErrors.push('The file has a header but no data rows.')
  return out
}
