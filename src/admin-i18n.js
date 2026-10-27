import { isZh, setLang, initLang } from './i18n.js'

const D = {
  'Log out': '登出', 'Email': '電子郵件', 'Password': '密碼', 'Log in': '登入', 'Create account': '建立帳號', 'Reset password': '重設密碼',
  'Forgot password?': '忘記密碼？', '← Back to log in': '← 返回登入', 'Back to log in': '返回登入', 'Resend email': '重新寄送郵件',
  'Check your email': '請查收電子郵件', 'Email not confirmed yet': '電子郵件尚未驗證', 'Waiting for approval': '等待核准', 'Access denied': '拒絕存取',
  'Your administrator request was not approved.': '您的管理員申請未獲核准。', 'Choose a new password': '設定新密碼', 'New password': '新密碼', 'Save password': '儲存密碼',
  'Your email is verified, but a super administrator still has to approve your account before you can use the back office.': '您的電子郵件已驗證，但仍需超級管理員核准後才能使用後台。',
  'imMBA Back Office': 'imMBA 後台管理', 'View Faculty page': '查看師資頁面',
  'Dashboard': '儀表板', 'News & events': '公告與活動', 'Faculty': '師資', 'Pages': '頁面', 'Documents': '文件', 'Marketplace': '市集', 'Administrators': '管理員',
  '+ Add item': '+ 新增項目', 'Restore default announcements': '還原預設公告', 'Put back the original list of announcements': '還原為原始公告清單', '+ Add faculty': '+ 新增教師', '+ Add page': '+ 新增頁面', '+ Add document': '+ 新增文件',
  'Date': '日期', 'Date *': '日期 *', 'Type': '類型', 'English title': '英文標題', '中文標題': '中文標題', 'Sync': '同步', 'Status': '狀態', 'Order': '排序', 'Name': '姓名', 'Title': '職稱',
  'Edit': '編輯', 'Delete': '刪除', 'Cancel': '取消', 'Approve': '核准', 'Reject': '拒絕', 'View': '檢視', 'Remove access': '移除權限',
  'PINNED': '置頂', 'published': '已發布', 'draft': '草稿', 'hidden': '已隱藏', 'pending': '待核准', 'approved': '已核准', 'rejected': '已拒絕', 'admin': '管理員', 'super_admin': '超級管理員',
  'Both languages complete': '雙語皆完整', 'Out of sync': '未同步', 'EN ⇄ 中文 ✓': '英 ⇄ 中 ✓',
  '— one record, both languages': '— 一筆紀錄，兩種語言', 'New announcement': '新增公告', 'Edit announcement': '編輯公告',
  'Display order (lower first, same date)': '顯示順序（同日期，數字小者優先）', 'News / announcement': '公告 / 消息', 'Event': '活動',
  'Link URL (English)': '連結（英文）', 'Link URL (中文, optional)': '連結（中文，選填）', 'Published': '已發布', 'Pinned to top': '置頂',
  'English content': '英文內容', '中文內容': '中文內容', 'Auto-translate English → 中文': '自動翻譯 英文 → 中文', 'Auto-translate 中文 → English': '自動翻譯 中文 → 英文',
  'Preview': '預覽', '(no title)': '（無標題）', '(empty)': '（空白）', 'Save changes': '儲存變更', 'Publish': '發布', 'Create': '建立', 'Create page': '建立頁面', 'Add': '新增',
  'Name *': '姓名 *', 'Department / position': '系所 / 職務', 'Full-time': '專任', 'Adjunct': '兼任', 'Phone': '電話', '中文 (Chinese version)': '中文版本',
  'Education': '學歷', 'Research fields': '研究領域', 'Personal website (https://…)': '個人網站 (https://…)', 'Photo (JPG/PNG/WebP, max 2 MB)': '照片（JPG/PNG/WebP，最大 2 MB）',
  'Current photo kept unless you choose a new one.': '除非選擇新照片，否則保留目前照片。', 'New faculty member': '新增教師',
  'Page': '頁面', 'Languages': '語言', 'Slug (URL name) *': '網址代稱 *', 'Section': '區塊', 'Source link (English)': '來源連結（英文）', 'Source link (中文)': '來源連結（中文）',
  'Published ': '已發布', 'Content pages': '內容頁面', 'Edit page': '編輯頁面', 'New page': '新增頁面',
  'Formatting:': '格式：', '. Blank line = new paragraph.': '。空一行 = 新段落。',
  'Category': '類別', 'File URL (https://…) *': '檔案網址 (https://…) *', 'File type': '檔案類型', 'Edit document': '編輯文件', 'New document': '新增文件',
  'Listing': '商品', 'Price': '價格', 'Seller / contact': '賣家 / 聯絡方式', '— visitors submit, administrators approve': '— 訪客投稿，管理員核准',
  'Loading dashboard…': '儀表板載入中…', 'Visits, last 14 days': '近 14 天瀏覽量', 'Announcements per month': '每月公告數', 'Bilingual completeness': '雙語完整度', 'Needs attention': '待處理事項',
  'Open →': '前往 →', '✓ Everything is up to date.': '✓ 一切都是最新的。', 'Most visited pages': '最多人瀏覽的頁面', 'Waiting for visits.': '等待訪客。', 'Recent activity': '近期動態', 'No activity yet.': '尚無動態。',
  'Download report (CSV)': '下載報表 (CSV)', 'No visits recorded yet.': '尚無瀏覽紀錄。', 'Published news': '已發布公告', 'Events': '活動', 'Live listings': '上架商品', 'Admins to approve': '待核准管理員',
  'Listings to review': '待審商品', 'Visits (14 days)': '瀏覽量 (14 天)', 'Documents ': '文件', 'Pending': '待處理',
  'News & events (title + content in both languages)': '公告與活動（標題與內容皆有雙語）', 'Faculty with Chinese name and title': '具中文姓名與職稱的教師', 'Pages with both languages': '雙語完整的頁面',
  'Translating…': '翻譯中…', 'Done — review before publishing.': '完成 — 發布前請檢查。', 'Done — review and edit the translation before publishing.': '完成 — 發布前請檢查並修改譯文。',
  'Updated.': '已更新。', 'Page saved.': '頁面已儲存。', 'Page deleted.': '頁面已刪除。', 'Document saved.': '文件已儲存。', 'Document deleted.': '文件已刪除。', 'Listing deleted.': '商品已刪除。',
  'Announcement saved (both languages).': '公告已儲存（雙語）。', 'Announcement deleted (both languages).': '公告已刪除（雙語）。',
  'Photo must be JPG, PNG or WebP.': '照片必須是 JPG、PNG 或 WebP。', 'Photo is larger than 2 MB.': '照片超過 2 MB。', 'Add a title.': '請輸入標題。', 'Add a title in at least one language.': '請至少以一種語言輸入標題。',
  'Links must start with http:// or https://': '連結必須以 http:// 或 https:// 開頭', 'The website must start with http:// or https://': '網站必須以 http:// 或 https:// 開頭', 'The file URL must start with http:// or https://': '檔案網址必須以 http:// 或 https:// 開頭',
  'Alumni': '校友', 'Import CSV': '匯入 CSV', 'Export CSV': '匯出 CSV', '+ Add alumnus': '+ 新增校友', 'Records': '紀錄', 'Activity log': '活動紀錄',
  'Search': '搜尋', 'Degree Program': '學位別', 'Graduation Year': '畢業年', 'Admission Year': '入學年', 'Department': '系所', 'Company': '公司', 'Student ID': '學號', 'Student ID *': '學號 *', 'Current Company': '目前公司', 'Job Title': '職稱', 'Notes': '備註', 'Registered': '註冊日期',
  'Name, Student ID, email, company…': '姓名、學號、電子郵件、公司…', 'Contains…': '包含…', 'Clear filters': '清除篩選', 'Columns ▾': '欄位 ▾', 'Reset columns': '重設欄位', 'Sort': '排序', 'Showing': '顯示', 'of': '／',
  'No alumni match these filters.': '沒有符合篩選條件的校友。', 'No alumni yet. Add one, or import a CSV file.': '尚無校友。請新增或匯入 CSV 檔。', 'History': '歷程', 'Close': '關閉', '← Previous': '← 上一頁', 'Next →': '下一頁 →',
  'Edit alumnus': '編輯校友', 'New alumnus': '新增校友', 'Degree Program *': '學位別 *', 'Bachelor': '學士', 'Master': '碩士', 'Doctoral': '博士', 'Other': '其他', 'Admin': '管理員', 'Action': '動作', 'Record': '紀錄', 'Change': '變更', 'Time': '時間',
  'Administrator': '管理員', 'No activity recorded.': '尚無活動紀錄。', 'Deleted values': '已刪除的內容',
  'Every create, update, delete and import by an administrator is recorded by the database itself and cannot be edited from the back office.': '管理員的每一次新增、修改、刪除與匯入都由資料庫自動記錄，且無法從後台修改。',
  'Import alumni from CSV': '從 CSV 匯入校友', 'Download CSV template': '下載 CSV 範本', 'Choose a CSV file': '選擇 CSV 檔案', 'or drop it here': '或拖曳至此', 'Show problems only': '只顯示有問題的列', 'Line': '行', 'Ready': '就緒', 'Warning': '警告', 'Duplicate': '重複', 'Error': '錯誤',
  'Update existing records when the Student ID or email already exists (blank cells keep current values)': '學號或電子郵件已存在時更新既有紀錄（空白欄位保留原值）', 'Nothing to import': '沒有可匯入的資料', 'Import': '匯入',
  'The file is larger than 2 MB. Split it into smaller files.': '檔案超過 2 MB，請拆分成較小的檔案。', 'That is not a CSV file. In Excel use Save as → CSV UTF-8.': '這不是 CSV 檔。在 Excel 請使用「另存新檔 → CSV UTF-8」。',
  'Nothing to export with the current filters.': '目前篩選條件下沒有可匯出的資料。', 'That Student ID or email already exists.': '此學號或電子郵件已存在。', 'Graduation year is before admission year.': '畢業年早於入學年。',
  'Years in the ROC calendar were converted (110 = 2021).': '民國年份已自動轉換（110 = 2021）。',
  'CSV file → validate → preview → import. Nothing is saved until you press Import.': 'CSV 檔 → 驗證 → 預覽 → 匯入。按下「匯入」之前不會儲存任何資料。', 'Required columns: Name, Student ID.': '必要欄位：姓名、學號。', 'Years in the ROC calendar (110 = 2021) are converted automatically.': '民國年份（110 = 2021）會自動轉換。', 'Excel: use Save as → CSV UTF-8.': 'Excel 請使用「另存新檔 → CSV UTF-8」。',
  'CREATE': '新增', 'UPDATE': '修改', 'DELETE': '刪除', 'IMPORT': '匯入',
  'Inquiries': '諮詢', 'Inquiries by topic': '各主題諮詢數', 'New inquiries': '新諮詢', 'Registered members': '註冊會員', 'Content items': '內容項目', 'Visiting': '客座', 'To handle': '待處理', 'Answered': '已回覆', 'Closed': '已結案', 'All': '全部', 'New': '新', 'In progress': '處理中', 'Save': '儲存', 'Internal / reply note (visible to the member)': '內部 / 回覆備註（會員可見）', 'No inquiries yet.': '尚無諮詢。', 'Member account': '會員帳號', 'member': '會員', 'new': '新', 'in_progress': '處理中', 'answered': '已回覆', 'closed': '已結案', 'Inquiry updated.': '諮詢已更新。', 'Inquiry deleted.': '諮詢已刪除。', 'Image (optional, JPG/PNG/WebP, max 2 MB)': '圖片（選填，JPG/PNG/WebP，最大 2 MB）', 'Current image kept unless you choose a new one.': '除非選擇新圖片，否則保留目前圖片。', 'Download': '下載', 'Light': '淺色', 'Dark': '深色',
}
const R = [
  [/^(Created|Updated) by CSV import: (.+)$/, (m) => `${m[1] === 'Created' ? '透過 CSV 匯入建立' : '透過 CSV 匯入更新'}：${m[2]}`],
  [/^Alumni \((\d+)\)$/, (m) => `校友 (${m[1]})`], [/^History — (.+)$/, (m) => `歷程 — ${m[1]}`], [/^Alumni record (created|updated|deleted): (.+)$/, (m) => `校友紀錄已${{ created: '建立', updated: '更新', deleted: '刪除' }[m[1]]}：${m[2]}`],
  [/^Exported (\d+) record\(s\) to CSV\.$/, (m) => `已匯出 ${m[1]} 筆紀錄至 CSV。`], [/^Import (\d+) rows?$/, (m) => `匯入 ${m[1]} 列`], [/^Importing… (\d+) \/ (\d+)$/, (m) => `匯入中… ${m[1]} / ${m[2]}`],
  [/^(\d+) ready$/, (m) => `${m[1]} 筆就緒`], [/^(\d+) with warnings$/, (m) => `${m[1]} 筆有警告`], [/^(\d+) duplicates$/, (m) => `${m[1]} 筆重複`], [/^(\d+) with errors$/, (m) => `${m[1]} 筆有錯誤`], [/^(\d+) empty rows skipped$/, (m) => `已略過 ${m[1]} 列空白`],
  [/^(\d+) rows? will be skipped \(errors or duplicates\)\.$/, (m) => `${m[1]} 列將被略過（錯誤或重複）。`],
  [/^Import finished: (\d+) added, (\d+) updated, (\d+) skipped(?:, (\d+) failed)?\.$/, (m) => `匯入完成：新增 ${m[1]}、更新 ${m[2]}、略過 ${m[3]}${m[4] ? `、失敗 ${m[4]}` : ''}。`],
  [/^Delete the alumni record "(.+)" \((.+)\)\? The deletion is logged in the activity log\.$/, (m) => `刪除校友紀錄「${m[1]}」(${m[2]})？此刪除會記錄在活動紀錄中。`],
  [/^Inquiries \((\d+)\)$/, (m) => `諮詢 (${m[1]})`], [/^To handle \((\d+)\)$/, (m) => `待處理 (${m[1]})`], [/^(\d+)% answered or closed\.$/, (m) => `${m[1]}% 已回覆或結案。`], [/^(\d+) new inquir(?:y|ies) to answer$/, (m) => `${m[1]} 則新諮詢待回覆`],
  [/^Faculty members \((\d+)\)$/, (m) => `教師 (${m[1]})`], [/^News & events \((\d+)\)$/, (m) => `公告與活動 (${m[1]})`], [/^Content pages \((\d+)\)$/, (m) => `內容頁面 (${m[1]})`],
  [/^Documents \((\d+)\)$/, (m) => `文件 (${m[1]})`], [/^Marketplace listings \((\d+)\)$/, (m) => `市集商品 (${m[1]})`],
  [/^Default announcements restored \((\d+)\)\.$/, (m) => `已還原預設公告（${m[1]} 則）。`],
  [/^Edit (.+)$/, (m) => `編輯 ${m[1]}`], [/^(.+) saved\.$/, (m) => `${m[1]} 已儲存。`], [/^(.+) deleted\.$/, (m) => `${m[1]} 已刪除。`], [/^Listing (approved|rejected)\.$/, (m) => `商品已${m[1] === 'approved' ? '核准' : '拒絕'}。`],
  [/^(\d+) administrators? waiting for approval$/, (m) => `${m[1]} 位管理員等待核准`], [/^(\d+) marketplace listings? to review$/, (m) => `${m[1]} 則市集商品待審核`],
  [/^(\d+) announcement\(s\) missing a language$/, (m) => `${m[1]} 則公告缺少一種語言`], [/^(\d+) draft announcement\(s\) not published$/, (m) => `${m[1]} 則草稿公告尚未發布`],
  [/^(\d+) faculty member\(s\) without Chinese data$/, (m) => `${m[1]} 位教師缺少中文資料`], [/^(\d+) page\(s\) missing a language$/, (m) => `${m[1]} 個頁面缺少一種語言`],
  [/^(\d+)% of visits in Chinese\.$/, (m) => `${m[1]}% 的瀏覽為中文。`],
  [/^We sent a verification link to (.+)\./, (m) => `我們已寄出驗證連結至 ${m[1]}。`],
  [/^Delete the page "(.+)"\? Both languages will be removed\.$/, (m) => `刪除頁面「${m[1]}」？兩種語言都會被移除。`],
]
const ATTRS = ['placeholder', 'title', 'aria-label']
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'INPUT'])
const orig = new WeakMap(), origAttr = new WeakMap()

function look(s) {
  const k = s.trim()
  if (!k) return null
  let v = D[k]
  if (!v) for (const [re, fn] of R) { const m = k.match(re); if (m) { v = fn(m); break } }
  return v ? s.replace(k, v) : null
}
function walk(root, zh) {
  if (root.nodeType === 3) { text(root, zh); return }
  if (root.nodeType !== 1 || SKIP.has(root.tagName)) return
  attrs(root, zh)
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => (n.nodeType === 1 && SKIP.has(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) })
  let n
  while ((n = w.nextNode())) n.nodeType === 3 ? text(n, zh) : attrs(n, zh)
}
function text(n, zh) {
  if (zh) { const v = look(n.data); if (v !== null) { if (!orig.has(n)) orig.set(n, n.data); n.data = v } }
  else if (orig.has(n)) { n.data = orig.get(n); orig.delete(n) }
}
function attrs(el, zh) {
  for (const a of ATTRS) {
    const cur = el.getAttribute?.(a)
    if (!cur) continue
    if (zh) { const v = look(cur); if (v !== null) { const m = origAttr.get(el) || {}; m[a] ??= cur; origAttr.set(el, m); el.setAttribute(a, v) } }
    else { const m = origAttr.get(el); if (m?.[a] !== undefined) { el.setAttribute(a, m[a]); delete m[a] } }
  }
}

export function mountAdminI18n() {
  initLang()
  const btn = document.getElementById('langbtn')
  const paintBtn = () => { if (btn) btn.textContent = isZh() ? 'EN' : '中文' }
  btn?.addEventListener('click', () => setLang(isZh() ? 'en' : 'zh'))
  const all = () => { paintBtn(); walk(document.body, isZh()) }
  window.addEventListener('langchange', all)
  new MutationObserver((muts) => {
    if (!isZh()) return
    for (const m of muts) m.addedNodes.forEach((n) => walk(n, true))
  }).observe(document.body, { childList: true, subtree: true })
  all()
}
