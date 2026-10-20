// Free MyMemory translation (draft quality: humans must review before publishing).
export async function translate(text, from, to) {
  const chunks = []
  for (const para of text.split(/\n/)) {
    if (!para.trim()) { chunks.push(''); continue }
    for (let i = 0; i < para.length; i += 450) chunks.push(para.slice(i, i + 450))
  }
  const out = []
  for (const c of chunks) {
    if (!c) { out.push(''); continue }
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=${from}|${to}`)
    const j = await r.json()
    if (!j.responseData || (Number(j.responseStatus) >= 400)) throw new Error(j.responseDetails || 'Translation service unavailable')
    out.push(j.responseData.translatedText)
  }
  return out.join('\n')
}
