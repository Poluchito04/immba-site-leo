import test from 'node:test'
import assert from 'node:assert/strict'
import { tokens, passages, buildIndex, search } from '../src/retrieval.js'

const docs = [
  { title: 'Dual Degree', url: '/page.html?p=dual-degree', lang: 'en', text: 'Students complete the first year at Fu Jen and the second year at a partner school such as the University of Michigan-Flint, Kedge Business School or IQS School of Management.\n\nTuition fees depend on the agreement with each partner.' },
  { title: 'Admissions', url: '/page.html?p=admissions', lang: 'en', text: 'The Fall application has two rounds: mid-October to early December and early March to mid-May. International students apply through the English admissions page.' },
  { title: '跨國雙碩士', url: '/page.html?p=dual-degree', lang: 'zh', text: '碩二可選擇到美國、法國、西班牙等名校留學一年，取得跨國雙碩士學位，享有優惠學費。' },
  { title: 'Faculty', url: '/faculty.html', lang: 'en', kind: 'fact', text: 'Yaonan Lin, Professor. Research: Marketing Management.' },
]
const idx = buildIndex(docs)

test('tokenizer drops stop words and handles Chinese bigrams', () => {
  assert.ok(!tokens('what is the deadline').includes('the'))
  assert.ok(tokens('雙碩士').includes('雙碩') && tokens('雙碩士').includes('碩士'))
})

test('passages split long text and keep short blocks out', () => {
  assert.equal(passages('hi').length, 0)
  assert.ok(passages('x'.repeat(40) + '. ' + 'y'.repeat(600) + '. ' + 'z'.repeat(60)).length >= 2)
})

test('answers come from the right source and cite it', () => {
  const r = search(idx, 'Which partner schools offer the dual degree?', { lang: 'en' })
  assert.ok(r.confident)
  assert.equal(r.hits[0].it.url, '/page.html?p=dual-degree')
})

test('finds faculty facts', () => {
  const r = search(idx, 'who teaches marketing', { lang: 'en' })
  assert.equal(r.hits[0].it.url, '/faculty.html')
})

test('answers Chinese questions from Chinese content', () => {
  const r = search(idx, '雙碩士學費', { lang: 'zh' })
  assert.ok(r.confident)
  assert.equal(r.hits[0].it.lang, 'zh')
})

test('admits when it does not know', () => {
  const r = search(idx, 'What is the cafeteria menu on Friday?', { lang: 'en' })
  assert.equal(r.confident, false)
  assert.equal(r.hits.length, 0)
})
