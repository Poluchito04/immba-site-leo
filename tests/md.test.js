import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMd } from '../src/md.js'
import { esc, safeUrl } from '../src/util.js'

test('escapes HTML so content cannot inject markup', () => {
  assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;')
  assert.ok(!renderMd('<img src=x onerror=alert(1)>').includes('<img'))
})

test('safeUrl allows only http(s)', () => {
  assert.equal(safeUrl('https://example.com'), 'https://example.com')
  assert.equal(safeUrl('javascript:alert(1)'), '')
  assert.equal(safeUrl(null), '')
})

test('renders headings, paragraphs and links', () => {
  const html = renderMd('## Title\n\nHello [site](https://a.com/x%20y.pdf) **bold**')
  assert.match(html, /<h3>Title<\/h3>/)
  assert.match(html, /<a href="https:\/\/a.com\/x%20y.pdf" target="_blank" rel="noopener">site ↗<\/a>/)
  assert.match(html, /<strong>bold<\/strong>/)
})

test('does not turn javascript: links into anchors', () => {
  assert.ok(!renderMd('[x](javascript:alert(1))').includes('<a '))
})

test('renders nested lists with balanced tags', () => {
  const html = renderMd('- one\n  - child\n- two')
  assert.equal((html.match(/<ul>/g) || []).length, (html.match(/<\/ul>/g) || []).length)
  assert.equal((html.match(/<li>/g) || []).length, (html.match(/<\/li>/g) || []).length)
  assert.match(html, /<li>one<ul><li>child<\/li><\/ul><\/li><li>two<\/li>/)
})
