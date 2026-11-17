## 0. How to use this SPEC
This is the AI-executable specification of the imMBA website (Fu Jen University, bilingual EN / 繁體中文). The PRD (`/docs/PRD.md`) explains *why*; this SPEC says *exactly what the system must do* so that an AI agent (Claude Code) can build or change it without guessing. Where the code and this document disagree, the code in `supabase/` and `src/` is the truth and this SPEC must be fixed.

Rules for any agent working on this repository:
- Develop **one feature at a time**. Before coding: say whether it is a *new* feature or a *revision*, and list the shared logic it touches (see section 5).
- Start with a **plan**, let the human revise it, then execute. Do not make product decisions silently: anything in section 15 needs the student's confirmation.
- Every rule that protects data lives in the **database** (RLS, constraints, triggers), never only in the browser.
- Every new user-facing text needs both languages. `npm test` must pass before a commit.

## 1. Product concept
- **What:** a public, database-driven website for the imMBA program that replaces a hand-edited, mostly Chinese-only site, plus a back office so staff update content without a developer.
- **Why it is different:** one record holds both languages; content is cited from the official site; staff changes are accountable (audit trail); an FAQ assistant answers only from published content.
- **Out of scope:** online application form, payments, real-time chat, any editing right for visitors or members.

## 2. Target users and needs
| User | Need | Must be possible |
|---|---|---|
| International applicant | Understand the program in English | Read every public page in English; admissions page; download the brochure |
| Local applicant | Same in Chinese, quickly | Language switch remembered; search (Ctrl/Cmd+K) |
| Current student (member) | Follow my questions, trade books | Register; see own inquiries and their status; post a listing |
| Program staff (admin) | Update content alone | CRUD of news, faculty, pages, downloads; moderate listings; alumni records |
| Director (super admin) | Control who edits; see what happened | Approve or reject administrators; dashboard; Activity log |

## 3. Requirements (IDs are used by tests and acceptance criteria)
**Functional**
- **F1** Public pages: home (notice bar, branding, navigation, action area, hero, announcements, events), content pages by slug, faculty, downloads, marketplace, contact, account, about-this-project.
- **F2** Language switch EN / 中文 on every page, saved in the browser, with fallback to the other language when a translation is missing.
- **F3** Accounts with roles `member`, `pending`, `admin`, `super_admin`, `rejected`. Self-registration creates `member` (visitor kind) or `pending` (administrator kind).
- **F4** Back office (`/admin.html`): dashboard, news (with images), faculty (with photos and drag order), pages, downloads, marketplace, inquiries, administrators, alumni, Activity log.
- **F5** Marketplace (class 10): a member lists a product with quantity and image; it stays hidden until an admin approves it; sellers manage stock, hide and remove; buyers use a cart and checkout; each order follows `waiting_payment → payment_confirmed → ready_to_ship → shipped → completed` (or `cancelled`); buyers, sellers and admins each get their own view; sellers get an accounting dashboard and CSV export; admins monitor all transactions read-only.
- **F5b** Transactions are business records: an order or order line can never be deleted or edited, and a listing that has orders is hidden, not deleted.
- **F6** Inquiries: anyone sends one; a member sees the status and the staff note of their own.
- **F7** Alumni: CRUD, search, filters, column chooser, CSV template, validated batch import with preview (skip or update duplicates), export with a review screen.
- **F8** Audit: every create, update and delete on audited tables records who, what, which record, when and old/new values; role changes too; one summary row per CSV import.
- **F9** Assistant: answers admissions questions only from published pages, faculty, news and documents; cites the source link; says it does not know otherwise.
- **F10** Analytics: path and language per page view, no personal data.

**Non-functional**
- **N1** Free tiers only (Vercel, Supabase, GitHub). **N2** Mobile first, keyboard accessible, light theme default with a dark option. **N3** No secret in the repository. **N4** Public pages show a skeleton, never a blank screen, while loading.

## 4. MVP and scope boundary
MVP (midterm): public home, bilingual switch, news cards, faculty, content pages, login with roles, news and faculty management, deployed on Vercel with Supabase. Everything else in F1 to F10 was delivered later (classes 6 and 7). Nothing outside F1 to F10 is in scope without a new plan.

## 5. Product structure (where the code lives)
- Pages (Vite multi-page, `vite.config.js`): `index`, `faculty`, `page`, `downloads`, `marketplace`, `contact`, `account`, `admin`, `project`.
- Shared logic (touch with care, it affects many pages): `src/trade.js` (order rules, stock formula, cart, accounting, CSV: pure and tested), `src/supabase.js` (client, `esc`, `safeUrl`), `src/i18n.js` (`t(en, zh)`), `src/chrome.js` (header, footer, search, language and theme switch), `src/md.js` (Markdown to safe HTML), `src/retrieval.js` (search for the assistant), `src/track.js` (page views).
- Back office: `src/admin.js` (shell, tabs, roles), `admin-content.js`, `admin-alumni.js`, `alumni-csv.js`, `admin-activity.js`, `admin-dashboard.js`, `admin-i18n.js`, `admin-orders.js` (Transactions tab).
- Marketplace: `src/marketplace.js` (browse, detail, cart, checkout), `src/account.js` + `src/account-trade.js` (My orders, My listings, Sales), `src/trade-ui.js` (order card and stepper shared by buyer, seller and admin).
- Database: `supabase/schema.sql`, then `v2.sql` to `v6.sql` in order (idempotent, safe to re-run). New work goes in a **new** numbered SQL file.
- Tests: `tests/*.test.js`, run with `npm test` (Node test runner, no browser tests yet).

## 6. User flows
1. **Visitor reads:** open page, choose language, read or search, optionally download a file (documents show their type).
2. **Visitor asks:** contact form, row in `inquiries` with status `new`; if logged in as member the row is linked to them.
3. **Member lists an item:** Account → My listings → new listing (name, category, price, quantity, image), `status = 'pending'`, invisible to the public until an admin approves it in the Marketplace tab.
3b. **Buy:** Marketplace → product → quantity → cart drawer → Checkout page (contact, pickup or delivery, payment instructions, Subtotal + Shipping + Platform fee = Total Due) → Place order; one order per seller, stock reserved; the seller sees it under Account → Sales (badge on the tab); buyer presses "I have paid", **the administrator confirms the payment received** (Transactions tab), then the seller marks ready to ship and shipped; buyer confirms receipt; both keep it in their history; admin sees it in back office → Transactions.
4. **Administrator onboarding:** register, verify email, role `pending`, waiting screen; super admin approves in the Administrators tab, role becomes `admin` (or `rejected`); the change is written to the audit log.
5. **Publish bilingual news:** fill English, press auto-translate for a Chinese draft, edit, save; the system warns if one language is missing and asks for confirmation.
6. **Import alumni:** download template, choose CSV, validate and preview with row-level errors, pick skip or update duplicates, import, verify counts, see one `IMPORT` row in the Activity log.

## 7. UI / UX rules
- One palette (deep teal, coral accent), serif headings, light and dark theme; the language and theme choice persist.
- Internal links look like normal menu items; external links carry the arrow and open a new tab; action links are buttons that start with a verb.
- Feedback by toast, destructive actions ask for confirmation, Ctrl/Cmd+S saves the open back-office form, Esc closes it.
- Motion respects `prefers-reduced-motion`.

## 8. Data and system design
**Stack:** Vite 6 (vanilla JS) + Supabase (Postgres, Auth, Storage, RLS) + Vercel + GitHub (`Poluchito04/immba-site-leo`). Commits use the GitHub identity `poluchito04@gmail.com` (another identity makes Vercel block the deploy).

**Tables:** `faculty`, `profiles`, `news`, `pages`, `downloads`, `listings`, `orders`, `order_items`, `inquiries`, `alumni`, `audit_log`, `page_views`; storage buckets `faculty-photos` and `news-images` (public read, admin write) and `listing-images` (public read, a member writes only in their own folder). Column details are in `supabase/*.sql` and PRD section 13.

**Access matrix (enforced by RLS):**
| Table | Anonymous | Member | Admin | Super admin |
|---|---|---|---|---|
| faculty | read | read | CRUD | CRUD |
| news, pages, downloads | read only if `published` | same | CRUD, sees drafts | same |
| listings | read `approved` and `active` | same, plus own listings; insert own with `status='pending'`; update or delete own (cannot change status or `purchased`) | read all, update (moderate), delete | same |
| orders, order_items | none | read the ones where they are buyer or seller; **no write**; checkout and status changes only through `place_order()` / `advance_order()` | read all, **no write, no delete** | same |
| inquiries | insert | read own | read all, update, delete | same |
| alumni | none | none | CRUD | CRUD |
| audit_log | none | none | read | read |
| page_views | insert | insert | read | read |
| profiles | none | read own | read own | read all, update role |

`is_admin()` is true for `admin` and `super_admin`; `is_super_admin()` only for the latter. Nobody can edit or delete `audit_log` rows from the browser. Audit rows are written by database triggers (`log_change`, `log_alumni_change`, `log_role_change`), not by the client. Duplicate alumni are blocked by unique indexes on `student_id` and `lower(email)`; the CSV import is validated in the browser (preview) and again in the `import_alumni` function.

## 9. Acceptance criteria (verifiable)
Each item is checked by hand in production unless a test is named.
- **A1 (F2)** Given the English interface, when I switch to 中文 and reload, then all public text is Chinese and the choice persists. Test: `tests/i18n.test.js` checks that Chinese mode picks the Chinese columns and falls back to English.
- **A2 (F3, F4)** Given a `pending` user, when they open `/admin.html`, then they see a waiting screen and no edit control; an update attempted through the API is rejected by RLS.
- **A3 (F3, F8)** Given a super admin approves a `pending` user, then the user becomes `admin`, can edit news, and one audit row with old and new role exists.
- **A4 (F5)** Given a member's listing, then it is saved as `pending`, does not appear on `/marketplace.html`, and appears after approval; a rejected or hidden listing never appears. An anonymous insert, or an insert with `status='approved'`, is refused.
- **A12 (F5)** Given a member orders 2 of a listing with 3 in stock, then an order `waiting_payment` exists, available stock is 1 and the seller sees it; ordering 2 more fails with "Only 1 left". Cancelling returns the stock. Test: `tests/trade.test.js` (rules), SQL role simulation (database).
- **A13 (F5)** Only the buyer can report payment ("I have paid"); only an administrator can confirm it or say it was not received; the seller can mark ready to ship and ship only after confirmation; the seller cannot confirm payment; the buyer can confirm receipt and cancel while waiting for payment; an admin, a stranger or a visitor calling `advance_order` is rejected; a seller cannot buy their own listing.
- **A14 (F5b)** Given a completed order, then `delete` on `orders` or `order_items` fails for everyone, including an admin, and the order remains in buyer history, seller history and the admin Transactions tab.
- **A15 (F5)** Seller dashboard: monthly revenue counts completed orders only; the CSV opens in Excel with Chinese text and neutralises cells starting with `=`. Admin can search an order by `#1001`, filter by status and see stalled orders.
- **A5 (F7)** Given the 20-row class CSV, when imported, then 20 rows are added and ROC year 110 is stored as 2021. Given a repeated Student ID, then the row is reported as duplicate and the form is not lost. Test: `tests/alumni-csv.test.js`.
- **A6 (F7)** Given blank cells in update mode, then existing values are kept.
- **A7 (F8)** Given an alumnus edited by an admin, then the Activity log shows admin email, action, record and `{field: {from, to}}`; given a delete, then a full snapshot is kept.
- **A8 (F9)** Given a question with no answer in published content, then the assistant says it does not know and invents nothing. Test: `tests/retrieval.test.js`.
- **A9 (privacy)** Given an anonymous client, then `select` on `alumni`, `audit_log`, `profiles` returns nothing or an error.
- **A10 (N4)** Given a slow connection, then skeletons show instead of a blank page.
- **A11 (Markdown)** Given news content with HTML or a `javascript:` link, then it is escaped or dropped. Test: `tests/md.test.js`.

- **A16 (F5)** Checkout totals: Subtotal + Shipping (per seller, delivery only) + Platform fee (per order) = Total Due; delivery without an address is refused; the fees come from `app_settings` and only the super admin can change them. Test: `tests/trade.test.js` (checkoutTotals).

## 10. Edge cases the agent must handle
- Missing translation (fallback and flag); news with only one language.
- Empty database (empty-state text, not an error); a failed Supabase call (message, page still usable).
- CSV: wrong column names, empty rows, invalid degree, duplicate in the file and in the database, ROC years, Excel-produced encodings, cells starting with `=`, `+`, `-`, `@` (exported with formula protection).
- Same email in two cases (`A@x.com` vs `a@x.com`): treated as the same.
- Two admins editing the same record: last write wins today; both changes are in the audit log (known limit).
- Role changed while a user has the back office open: RLS rejects the write even if the screen still shows the form.
- User text containing HTML or very long strings: escaped with `esc()` and limited by database `check` constraints.

## 11. Scale
| Dimension | 10 users / 100 records (today) | 10,000 users / 100,000 records (target behaviour) |
|---|---|---|
| Public reads | Direct queries from the browser | Indexed and limited; add pagination before any list exceeds a few hundred rows; consider caching static pages |
| Alumni table | All rows loaded, filtered in the browser | Move search and filters to server-side queries with `limit/offset` and an index on the filter columns; import in batches |
| `audit_log` and `page_views` | Whole table scanned for the dashboard | Aggregate in SQL or a view; keep indexes on `created_at` and `(table_name, record_id, created_at)`; archive old rows |
| Assistant index | Built in the browser from all published content | Pre-compute server-side, or use search in Postgres |
| Marketplace spam | Members only (account needed), moderation, length limits | Rate limiting and captcha |
| Orders | All of a user's orders loaded and filtered in the browser (admin: latest 2,000) | Server-side pagination and search, indexes already on buyer, seller, status; aggregate revenue in SQL |
| Checkout concurrency | Listing rows locked per checkout | Same; keep transactions short |
Today's code only guarantees the left column; the right column is the next work, not a promise.

## 12. Security checklist
RLS enabled on every table; no `service_role` key in the browser; `.env.local` is not committed; all user text escaped before rendering; URLs go through `safeUrl`; storage writes only for admins; email verification for administrator accounts (a Supabase Auth setting, to be re-checked in the dashboard); analytics store no personal data; alumni data treated as personal data.

## 13. Operations (running the product)
- **Deploy:** push to `main` and `vercel --prod`. **Roll back:** promote the previous Vercel deployment.
- **Database changes:** a new `supabase/vN.sql`, reviewed, then run in the Supabase SQL Editor; verify in production; delete test rows afterwards.
- **Content owner:** admins, not developers. **Access control:** the super admin approves every administrator.
- **Monitoring today:** the dashboard (needs-attention panel, visits) and the Activity log. **Not yet:** backups policy beyond the Supabase default, error alerts, uptime check.
- **Support:** inquiries arrive in the Inquiries tab; target answer time to be agreed with the program.

## 14. What NOT to do
- Do not add a feature without a plan the student has confirmed. Do not rewrite shared files to fit one page.
- Do not trust the browser for permissions; do not add a policy that lets anonymous users read `alumni`, `audit_log` or `profiles`.
- Do not put keys, passwords or personal data in the repository, in URLs or in logs.
- Do not invent content: official facts need a source link; auto-translation is a draft until a human reviews it.
- Do not edit an old SQL file that has already run in production; add a new one.
- Do not commit with an Apple private-relay email.
- Do not delete data without an audit snapshot. Never add a delete or update policy on `orders` or `order_items`; never let an administrator move an order.

## 15. Open decisions and known gaps (need the student)
- Interviews in PRD section 7 are not done; no claim about user feedback may be written until they are.
- Browser-interface tests do not exist yet (only unit tests: 42 passing).
- Spam protection for the marketplace is minimal; server-side pagination for alumni is missing.
- Marketplace: no real payment processor (payment is arranged offline and confirmed by the seller); no in-app notification beyond the Sales tab badge (no email); no ratings or disputes; buyers see each other's contact only through orders. Needs the student's decision: whether the seller may also mark a shipped order completed (today yes).
- Whether the program wants a custom domain and who owns the Supabase project after the course.
