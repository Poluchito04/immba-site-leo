import test from 'node:test'
import assert from 'node:assert/strict'

const faculty = { title: 'Associate Professor', title_zh: '副教授' }
const news = { title_en: 'Hello', title_zh: '你好' }
const onlyZh = { title_zh: '只有中文' }

test('English mode: faculty uses plain columns, bilingual rows use *_en', async () => {
  globalThis.localStorage = { getItem: () => 'en', setItem() {} }
  const { fpick, pick, t } = await import('../src/i18n.js?en')
  assert.equal(fpick(faculty, 'title'), 'Associate Professor')
  assert.equal(pick(news, 'title'), 'Hello')
  assert.equal(pick(onlyZh, 'title'), '只有中文') // falls back to the other language
  assert.equal(t('a', 'b'), 'a')
})

test('Chinese mode picks the Chinese columns and falls back to English', async () => {
  globalThis.localStorage = { getItem: () => 'zh', setItem() {} }
  const { fpick, pick, t } = await import('../src/i18n.js?zh')
  assert.equal(fpick(faculty, 'title'), '副教授')
  assert.equal(fpick({ title: 'X' }, 'title'), 'X')
  assert.equal(pick(news, 'title'), '你好')
  assert.equal(t('a', 'b'), 'b')
})
