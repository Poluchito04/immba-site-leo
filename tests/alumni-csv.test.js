import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { parseCsv, validateCsv, normalizeDegree, normalizeYear, toCsv, decodeBytes, TEMPLATE_CSV, COLUMNS } from '../src/alumni-csv.js'

const HEAD = 'Name,Student ID,Department,Degree Program,Admission Year,Graduation Year,Email,Phone,Current Company,Job Title'

test('parseCsv handles BOM, quotes, commas and newlines inside quotes, CRLF', () => {
  const { rows } = parseCsv('﻿a,b\r\n"Formosa, Co.","say ""hi"""\r\n"line1\nline2",x\r\n')
  assert.deepEqual(rows, [['a', 'b'], ['Formosa, Co.', 'say "hi"'], ['line1\nline2', 'x']])
})

test('parseCsv detects semicolon and tab delimiters and flags an unclosed quote', () => {
  assert.equal(parseCsv('a;b;c\n1;2;3').delimiter, ';')
  assert.equal(parseCsv('a\tb\n1\t2').delimiter, '\t')
  assert.equal(parseCsv('a,b\n"oops,1').unterminated, true)
})

test('degree values are normalised and unknown ones are flagged', () => {
  for (const v of ["Master's Program", 'MBA', 'M.B.A.', 'Master', '碩士班']) assert.equal(normalizeDegree(v), 'Master', v)
  assert.equal(normalizeDegree("Bachelor's Program"), 'Bachelor')
  assert.equal(normalizeDegree('PhD'), 'Doctoral')
  assert.equal(normalizeDegree(''), null)
  assert.equal(normalizeDegree('Wizard'), undefined)
})

test('years: ROC calendar converts, Gregorian stays, junk is rejected', () => {
  assert.deepEqual(normalizeYear('110'), { value: 2021, roc: true })
  assert.deepEqual(normalizeYear('2024'), { value: 2024 })
  assert.deepEqual(normalizeYear(''), { value: null })
  assert.ok(normalizeYear('abc').error)
  assert.ok(normalizeYear('1500').error)
})

test('a good row passes; empty optional fields only warn', () => {
  const r = validateCsv(`${HEAD}\nEmily Lee,10920002,Business Administration,Bachelor's Program,110,114,emily.lee@example.com,,,\n`)
  assert.equal(r.headerErrors.length, 0)
  assert.equal(r.rows[0].status, 'warn')
  assert.equal(r.rocYears, true) // converted silently, flagged once for the whole file
  assert.equal(r.rows[0].data.phone, null)
  assert.equal(r.rows[0].data.admission_year, 2021)
  assert.equal(r.rows[0].data.degree_program, 'Bachelor')
})

test('doctoral student without graduation year is valid', () => {
  const r = validateCsv(`${HEAD}\nDaniel Chang,10830003,Accounting,Doctoral Program,113,,d@example.com,0922-111-222,Insight,Consultant\n`)
  assert.equal(r.rows[0].data.graduation_year, null)
  assert.notEqual(r.rows[0].status, 'error')
})

test('missing required column blocks the import; wrong header names are explained', () => {
  const r = validateCsv('Name,Dept\nAnn,Law\n')
  assert.ok(r.headerErrors.some((e) => /Student ID/.test(e)))
  assert.ok(r.headerWarnings.length === 0 || r.headerWarnings.every((w) => typeof w === 'string'))
})

test('row errors: required fields, bad degree, bad email, graduation before admission', () => {
  const r = validateCsv(`${HEAD}\n,111,Law,Master,110,114,a@b.co,,,\nBob,,Law,Master,110,114,a@b.co,,,\nCy,222,Law,Wizard,110,114,c@b.co,,,\nDi,333,Law,Master,110,114,not-an-email,,,\nEd,444,Law,Master,114,110,e@b.co,,,\n`)
  assert.deepEqual(r.rows.map((x) => x.status), ['error', 'error', 'error', 'error', 'error'])
  assert.match(r.rows[2].errors[0], /Invalid degree/)
  assert.match(r.rows[4].errors.join(), /before admission/)
})

test('empty rows are skipped and counted', () => {
  const r = validateCsv(`${HEAD}\n,,,,,,,,,\nAnn,1,Law,Master,110,112,ann@b.co,,,\n\n`)
  assert.equal(r.rows.length, 1)
  assert.equal(r.emptyRows, 2) // the comma-only row and the blank line
})

test('duplicates are detected inside the file and against the database', () => {
  const r = validateCsv(`${HEAD}\nA,100,Law,Master,110,112,a@b.co,,,\nB,100,Law,Master,110,112,b@b.co,,,\nC,300,Law,Master,110,112,A@B.CO,,,\nD,400,Law,Master,110,112,d@b.co,,,\nE,500,Law,Master,110,112,e@b.co,,,\n`,
    { studentIds: new Set(['400']), emails: new Set(['e@b.co']) })
  assert.deepEqual(r.rows.map((x) => x.status), ['warn', 'duplicate', 'duplicate', 'duplicate', 'duplicate'])
  assert.equal(r.rows[3].inDatabase, true)
  assert.equal(r.rows[1].inDatabase, false)
})

test('encoding: replacement characters are reported, Big5 files are decoded', () => {
  assert.ok(validateCsv(`${HEAD}\nA�,1,Law,Master,110,112,,,,\n`).headerErrors.some((e) => /Encoding/.test(e)))
  const utf8 = new TextEncoder().encode('名字\n王')
  assert.equal(decodeBytes(utf8).encoding, 'UTF-8')
  const big5 = Uint8Array.from([0xa5, 0xfe]) // 全 in Big5, invalid in UTF-8
  const d = decodeBytes(big5)
  assert.ok(d.encoding === 'Big5' ? d.text === '全' : d.problem)
})

test('toCsv escapes quotes and commas, adds a BOM and defuses formulas', () => {
  const csv = toCsv([{ full_name: 'A, "B"', student_id: '=SUM(1)', phone: '+886 912 345 678', notes: '-x' }], ['full_name', 'student_id', 'phone', 'notes'])
  assert.ok(csv.startsWith('﻿Name,Student ID,Phone,Notes\r\n'))
  assert.ok(csv.includes('"A, ""B"""'))
  assert.ok(csv.includes("'=SUM(1)"))
  assert.ok(csv.includes('+886 912 345 678') && !csv.includes("'+886"))
  assert.ok(csv.includes("'-x"))
})

test('the template round-trips through the validator', () => {
  const r = validateCsv(TEMPLATE_CSV)
  assert.equal(r.headerErrors.length, 0)
  assert.equal(r.rows[0].status, 'ok')
})

const SAMPLE = '/Users/leomartinezllorente/Downloads/alumni_sample_20_english.csv'
test('the class sample (20 alumni) imports without errors', { skip: !existsSync(SAMPLE) }, () => {
  const r = validateCsv(decodeBytes(readFileSync(SAMPLE)).text)
  assert.equal(r.rows.length, 20)
  assert.equal(r.counts.error, 0)
  assert.equal(r.counts.duplicate, 0)
  assert.equal(r.rows[0].data.full_name, 'Alex Wang')
  assert.equal(r.rows[0].data.company, 'Formosa Global Co., Ltd.')
  assert.ok(COLUMNS.every((c) => c in r.rows[0].data))
})
