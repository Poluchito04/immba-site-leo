## 0. About this document
This is the product documentation for the **imMBA program website**, built for the course *AI-Assisted Digital Product Development* (Fu Jen Catholic University). It follows the course sequence: opportunity assessment, vision, OKRs, customer profile, value map, PRD, MVP and user stories.

**Honesty note.** Everything marked *hypothesis* comes from analysis (AI-assisted brainstorming plus the public official website) and has **not** been validated with real people yet. Section 7 is a template for the classmate interviews that still have to be done and recorded with real answers.

## 1. Opportunity assessment
- **Business objective:** help the imMBA program attract and convert qualified applicants (local and international) and cut the effort needed to keep its website accurate.
- **Key results (how success is measured):** see section 3 (OKRs).
- **Customer problem:** prospective and current students need current, trustworthy, bilingual information (admissions dates, curriculum, faculty, documents) in one place. Today information is spread across many pages, some pages are empty in one language, and staff can only update content by editing pages manually.
- **Target market:** (1) prospective international students, (2) prospective local students, (3) current students, (4) program staff and faculty who maintain the content.

## 2. Product vision and strategy
- **Vision (2-5 years):** the imMBA website is the single front door to the program: always up to date, fully bilingual, and so easy to maintain that program staff update it in minutes without a developer.
- **Strategy:** (1) put all content in a cloud database instead of hard-coded pages, (2) give staff a safe back office with roles and approvals, (3) measure what visitors use and what is out of date, (4) later add AI assistance (admissions FAQ, translation drafts) with human review.

## 3. Product objectives (OKRs)
- **O1 - Prospective students find answers fast.**
  - KR1: every main section (About, Admissions, Curriculum, Faculty, Downloads) reachable in at most 2 clicks from the home page.
  - KR2: 100% of public pages available in English and Chinese.
  - KR3: admissions information and documents visible without leaving the site.
- **O2 - Staff keep content fresh with little effort.**
  - KR1: publishing a news item in both languages takes under 3 minutes.
  - KR2: 0 announcements published with only one language without a warning.
  - KR3: new administrators need approval from a super administrator before they can edit.
- **O3 - The team can see how the site is doing.**
  - KR1: dashboard shows visits, content counts, drafts and items needing attention.
  - KR2: every content change is recorded (who, what, when).

## 4. Stakeholders
- Prospective international student
- Prospective local student
- Current imMBA student (also buyer/seller in the marketplace)
- Faculty member (appears on the Faculty page)
- Program staff / administrator (edits content)
- Program director / super administrator (approves administrators, owns quality)
- Partner universities and visitors (read-only)

## 5. Customer profile (jobs, pains, gains)
*All items are hypotheses to verify in section 7.*

### Prospective international student
- **Jobs:** decide if imMBA fits; check requirements and deadlines; apply; understand life in Taipei.
- **Pains:** information only in Chinese; unclear deadlines per intake; documents hard to find; unsure about dual degree options.
- **Gains:** clear English admissions page; downloadable brochure; visible faculty and partners; confidence the site is current.

### Prospective local student
- **Jobs:** compare MBA programs; understand the two admission channels; prepare the application.
- **Pains:** dates scattered across posts; unclear difference between channels.
- **Gains:** one page explaining both channels with dates and documents.

### Current student
- **Jobs:** follow announcements and events; find forms (graduation, dual degree); buy or sell course books.
- **Pains:** notices buried in a long list; forms hard to find; no trusted place for book exchange.
- **Gains:** card-style announcements, searchable downloads, a moderated marketplace.

### Program staff / administrator
- **Jobs:** publish news in two languages; update faculty; keep documents current.
- **Pains:** editing hard-coded pages; keeping two languages in sync; no history of changes.
- **Gains:** one back office, bilingual forms with translation help and sync check, audit log.

### Program director / super administrator
- **Jobs:** control who can edit; keep quality.
- **Pains:** no visibility of what changed or what is outdated.
- **Gains:** approvals, dashboard, activity log.

## 6. Value map
- **Products and services:** public site (home, pages, faculty, news, events, downloads, marketplace), bilingual switch, back office, dashboard, moderated marketplace.
- **Pain relievers:** Chinese/English everywhere; database instead of hard-coded pages; approval workflow; sync warnings; audit log.
- **Gain creators:** card UI with clear link types; document library with file types; moderated listings; reports.
- **Check:** do the products support all jobs? Admissions and documents (yes), faculty (yes), news and events (yes), marketplace (yes). Open gap: application submission itself stays on the official site.

### Fit assessment (does the site address each customer need?)
- **Find the right program quickly** - Yes: overview, key facts, search and assistant. Priority: high.
- **Understand admission requirements and dates** - Yes: admissions page in both languages, countdown, documents. Priority: high.
- **Know the faculty and their research** - Yes: full list with research tags, searchable. Priority: medium.
- **Ask a question and follow the answer** - Yes: inquiry form with member accounts and status tracking. Priority: high.
- **Stay informed about news and events** - Yes: announcement cards, events. Priority: medium.
- **Apply online** - Partly: the application itself stays on the official site (linked everywhere). Priority: high, accepted gap.
- **Staff keep content current without a developer** - Yes: back office with roles. Priority: high.

## 7. Verification plan: interviews (TO BE COMPLETED WITH REAL DATA)
Interview at least 3 classmates. Record the real answers here. Do not invent answers.
- **Interviewee 1** (name/role, date): ______
- **Interviewee 2** (name/role, date): ______
- **Interviewee 3** (name/role, date): ______
- **Questions:**
  - What do you look for first on a program website?
  - What was hard to find or understand?
  - Did you miss anything in your language?
  - Would you use a student book marketplace? What would stop you?
- **What we learned / what changes in the product:** ______

## 8. Product Requirements Document (PRD-lite)
### Why should we build the product?
To turn a static, partly Chinese-only, hand-edited website into a bilingual, database-driven product that serves applicants and is cheap for staff to keep current.

### What should the product do?
- **Public site:** home with 5 sections (notice bar, branding, navigation, action area, hero); content pages (About, Admissions, Curriculum, Guide, Graduation, Dual Degree, Exchange); faculty; announcements and events as cards; downloads; marketplace; language switch.
- **Back office:** login, roles, approvals; manage news/events, faculty (with photos), pages, downloads, marketplace listings; dashboard.
- **Constraints:** free tiers only (Vercel, Supabase, GitHub); no payment handling; content sourced from the official site must cite it; personal data limited to what the official site already publishes.
- **Scope (in):** everything above. **Scope (out):** online application form, payments, real-time chat.

### How do we measure success?
- Visits per page and language (page_views table).
- Share of news with both languages complete (dashboard).
- Number of content changes per week and time to publish (audit log).
- Open items: pending administrators, pending listings, drafts.
- Qualitative: interview feedback (section 7).

## 9. MVP (midterm demo) and next steps
- **MVP:** public home with navigation and bilingual switch; news cards; faculty page; content pages; login with roles; news and faculty management; deployed on Vercel with Supabase.
- **Delivered beyond MVP:** downloads, marketplace with moderation, dashboard, audit log, page-view analytics.
- **Next:** user feedback round (three classmate interviews), responsible-AI review (week 15), more tests for the browser interface.

## 9b. Course "Final Project Requirements" coverage
- **1. Users (browse, submit inquiry/form, register):** public pages; contact form; member registration and login.
- **2. Front-end (responsive, key sections, forms and interactions):** responsive site in two languages; forms for inquiries and marketplace.
- **3. Database (user data, inquiries, content, media files):** profiles, inquiries, faculty, news, pages, downloads, listings, audit log, page views; storage bucket for photos.
- **4. Admin dashboard (view and manage inquiries, manage content, basic analytics):** Inquiries tab; content tabs; dashboard with counts and charts.
- **5. Reports / insights (summary of inquiries and users, simple charts, decision support):** dashboard panels for inquiries by topic, answered rate, members, visits, bilingual completeness; CSV report.

## 10. User story map
- **Activity: Explore the program**
  - Task: read about the program, then story: *As a prospective student I want to read the program overview in my language so that I can decide if it fits me.*
  - Task: see faculty, then story: *As a prospective student I want to see who teaches so that I trust the program.*
- **Activity: Apply**
  - Task: find admissions information, then story: *As an international student I want one admissions page in English so that I know dates and documents.*
  - Task: get documents, then story: *As an applicant I want to download the brochure so that I can prepare my application.*
- **Activity: Stay informed**
  - Task: read announcements, then story: *As a student I want announcements as cards with dates so that I can scan what is new.*
- **Activity: Trade materials**
  - Task: post a listing, then story: *As a student I want to post a book for sale so that classmates can find it.*
- **Activity: Ask the program**
  - Task: send an inquiry, then story: *As a prospective student I want to send a question from the site so that the team can answer me by email.*
  - Task: follow it, then story: *As a member I want to see the status of my inquiries so that I know if I was answered.*
- **Activity: Manage content**
  - Task: publish bilingual news, then story: *As an administrator I want to enter Chinese and English in one record so that both stay in sync.*
  - Task: control access, then story: *As a super administrator I want to approve new administrators so that only trusted people edit.*
  - Task: monitor, then story: *As a super administrator I want a dashboard so that I see what needs attention.*

### Acceptance criteria (examples)
- **Story: bilingual news.**
  - Scenario 1 - Given an administrator on the News form, When they fill English and press auto-translate, Then the Chinese fields are filled and remain editable.
  - Scenario 2 - Given a news record missing the Chinese title, When they save, Then the system warns that the versions are out of sync and asks for confirmation.
- **Story: approve administrators.**
  - Scenario 1 - Given a newly registered user with role pending, When they log in, Then they see a waiting screen and cannot edit anything.
  - Scenario 2 - Given a super administrator, When they approve the user, Then the user gets role admin and can edit content.
- **Story: marketplace.**
  - Scenario 1 - Given a visitor submits a listing, When it is saved, Then it is hidden until an administrator approves it.
  - Scenario 2 - Given a rejected listing, When anyone browses the marketplace, Then it never appears.

## 11. Information architecture
- Home: notice bar, branding, navigation, action area, hero, then Announcements and Events. Faculty has its own page (`/faculty.html`), linked from the menu.
- Navigation: About (Overview and Ranking; Our Learning Environment), Admissions (Apply), Curriculum (Curriculum and Requirements), Faculty, Guide, Graduation, Dual Degree, Overseas Exchange, Marketplace, Events, Announcements, Downloads, College of Management.
- Link types: internal links look like normal menu items; external links carry the arrow icon and open a new tab; documents show the file type (PDF, XLS, DOC); action links are buttons that start with a verb.

### Class 7 requirements ("Multi-Admin Back-Office Management", 20 Oct 2026)
- **Admin approval workflow:** register, verify email, `pending`, super admin review, `admin` (or `rejected`). The Administrators tab shows each applicant's email, registration date and current status, and every role change is written to the audit log.
- **Alumni database:** schema with `full_name`, `student_id`, `department`, `degree_program`, `admission_year`, `graduation_year`, `email`, `phone`, `company`, `job_title`, `notes`; degree program is a controlled dropdown (Bachelor, Master, Doctoral, Other).
- **Alumni management (Alumni tab):** add, view, edit, delete, search (name, ID, email, company), filter (degree program, graduation year, department, company), view activity history per record.
- **Audit trail:** every create, update and delete writes who, what action, which record, when and the changed fields (old and new values).
- **CSV batch import:** downloadable template; validation before importing (required fields, empty rows, invalid degree values, wrong column names, duplicates by Student ID or email, encoding problems); preview with row-level errors; empty cells handled.
- **Export CSV:** exports the filtered dataset. **Dynamic columns:** a Columns checklist updates the table immediately.

### Class 10 requirements ("Building a Role-Based C2C Marketplace", 17 Nov 2026)
Source: the slides of the session; the learning goals are role-based access, different interfaces for buyer, seller and administrator, an end-to-end transaction workflow, inventory and order status, linking buyer actions to seller operations, and basic sales and transaction management. "It is not about building an e-commerce website. It is about designing a multi-user transactional system."
- **Roles:** Visitor (browse), Buyer (browse, cart, place orders, order history), Seller (list products, manage inventory, process orders, sales records), Platform Admin (manage users, monitor transactions). One account can be buyer, seller and administrator at once; the interface shows the functions of each role.
- **Seller:** create a listing (name, category, description, price, quantity, image, status), view and edit own listings, update quantity, hide or remove a listing, see stock status. *Available Stock = Current Inventory − Purchased Quantity.*
- **Buyer:** browse, product detail with price and availability, select quantity, shopping cart, review items, confirm quantity, submit the order. *Order created, seller notified.*
- **Order lifecycle:** Order placed, Waiting for payment confirmation, Payment confirmed, Ready to ship, Shipped, Completed. The seller sees order ID, buyer, products, total, payment status and date and confirms payment, prepares and confirms shipment. Completed transactions stay in the buyer's order history, the seller's sales history and the platform records: **they are never deleted**.
- **One transaction, three views:** buyer (my orders, status, purchase history), seller (orders to process, payments to confirm, products to ship, sales history), admin (all transactions, buyer and seller, status, amount).
- **Seller dashboard:** monthly sales revenue, completed orders, pending payments, orders waiting for shipment, sales history, **CSV export** of transaction records.
- **Platform admin:** view all transactions, search by order ID, filter by status, see buyer and seller, monitor abnormal or incomplete transactions, review transaction history. *Monitoring does not always mean editing.*
- **Today's checklist, answered:** different functions per role (account tabs, admin tab) / sellers list products (My listings) / buyers place orders (cart and checkout) / order status updates (Sales and My orders) / orders visible to buyer and seller / inventory updates after a transaction (stock reserved at checkout, released on cancel) / completed records kept (database trigger blocks deletes).
- **What changed from the previous version (the slides win):** (1) listing no longer open to anonymous visitors: a seller needs a member account, because orders need an identity; (2) listings gained quantity, image and hide switch; (3) a seller editing the text, price, category or image of a live listing sends it back to review, stock changes do not; (4) the public card no longer needs a phone or email, buyers order through the platform; (5) demo listings (no seller) can be browsed but not ordered.

## 12. Roles and permissions
- **Visitor:** read published content; browse approved, visible marketplace listings; send an inquiry. Cannot buy or sell (class 10: needs an account).
- **Member = buyer and seller:** a registered, verified user. Follows their inquiries; lists products (they stay `pending` until an administrator approves them); orders other members' products; processes orders as seller. Cannot buy their own listing. Never gets any editing right on site content.
- **Marketplace, per role:** orders can only be created by `place_order()` and changed by `advance_order()`; the seller moves payment, ready to ship and shipped, the buyer confirms receipt (the seller may also close a shipped sale), either can cancel while waiting for payment and only the seller after payment (stock returns). **Admins have read access to all orders and no write path at all**; nobody can delete an order or its lines.
- **Pending:** registered and verified but cannot enter the back office.
- **Admin:** create, edit and delete news, events, faculty, pages, downloads; moderate listings; see the dashboard.
- **Super admin:** everything an admin can do, plus approve or reject administrators.
- Alumni data is personal data: only admins and super admins can read or write it (no public read policy). Nobody can edit or delete audit rows from the browser.
- Rules are enforced in the database with Row Level Security, not only in the interface.

## 13. Database design
- **faculty:** names, titles, education, research, contact, photo, category, order (English and Chinese fields).
- **news:** one record per announcement or event with title and content in both languages, dates, links, pinned, published, kind (news or event), order.
- **pages:** slug, section, bilingual title and body, source links, published, updated_at.
- **downloads:** bilingual title, file URL, file type, category, order, published.
- **listings:** marketplace item with price, category, seller (`seller_id`, `seller_name`), status (pending, approved, rejected), `quantity` (inventory), `purchased`, generated `available = quantity − purchased`, `active` (hide switch), image, timestamps. A check keeps `purchased <= quantity`; a trigger lets sellers change only their own rows, never the status or the purchased counter.
- **orders:** `order_no` (starts at 1001), buyer and seller ids plus name and email snapshots, buyer contact, note, total, status (waiting_payment, payment_confirmed, ready_to_ship, shipped, completed, cancelled) and a timestamp per step. No insert, update or delete policy: only the two functions write.
- **order_items:** order, listing, title and unit price snapshot, quantity, generated line total; cannot be edited or deleted.
- **inquiries:** visitor questions with topic, language, status (new, in progress, answered, closed) and an optional note shown to the member.
- **alumni:** one row per graduate: the 11 fields above, `created_by`, timestamps. Unique Student ID and unique email (case-insensitive); checks on degree values, year ranges and email format. Years are stored as calendar years (ROC years in a CSV are converted: 110 = 2021).
- **profiles:** one row per login user with role (member, pending, admin, super_admin, rejected).
- **audit_log:** who changed what and when (filled by database triggers). Since v5 it also stores `record_id` and `changes` (JSON: new values on create, `{field: {from, to}}` on update, a full snapshot on delete) and one `IMPORT` summary row per batch.
- **page_views:** path, language, timestamp (no personal data).
- **Storage:** public buckets for faculty photos and news images (only admins write) and `listing-images` (a member writes only inside their own `user-id/` folder).

## 14. Dashboard and reports
- KPI cards: faculty, published news, events, pages, downloads, approved listings, plus open items.
- Reports: bilingual completeness (news, faculty, pages), visits in the last 14 days and top pages, announcements per month, listing status.
- Needs attention: pending administrators, pending listings, news out of sync, drafts, faculty without Chinese data.
- Recent activity from the audit log.
- Class 10: transactions count and **stalled transactions** (an order stuck too long in one state: 3 days waiting for or after payment, 4 ready to ship, 7 shipped) in KPIs and the needs-attention panel.

## 15. Dual-language approach
- One record holds both languages (shared fields: date, link, order, status).
- The language switch is saved in the browser and applies to every page.
- Missing translations fall back to the other language and are flagged for administrators.
- Auto-translate gives a first draft that a human must review.

## 15b. Design and UX decisions
- **Visual system:** one palette (deep teal, coral accent) with serif headings and a light and a dark theme. The site opens in the light theme by default (the device's dark setting is not applied automatically); visitors can switch with the button and the choice is remembered.
- **Motion with purpose:** content reveals as it scrolls into view, statistics count up once, cards lift on hover, the hero gradient drifts slowly and pages cross-fade when navigating. Everything switches off for people who prefer reduced motion.
- **Fast to use:** global search (press Ctrl/Cmd+K or /) across pages, faculty, news, documents and listings, in the current language; sticky compact header; back-to-top button and reading progress bar; skeleton placeholders instead of blank screens; toast messages instead of banners.
- **Orientation:** admissions deadline countdown in the hero (source: the official announcement), key facts strip, four "why imMBA" cards, previous/next links between content pages, breadcrumbs, faculty search with clickable research tags.
- **Mobile first:** hamburger menu with full-width drawer, tools always visible, horizontally scrollable navigation on content pages.
- **Accessibility:** skip link, visible keyboard focus, labelled controls, semantic landmarks, sufficient contrast in both themes.
- **Back office ergonomics:** Ctrl/Cmd+S saves the open form, Esc closes it, dashboard first, needs-attention shortcuts that jump to the right tab.

## 15c. What we learned, class by class
### Class 6 - From a local prototype to a cloud backend (20 Oct 2026)
A website published on Vercel is not yet a product. While everything lived in the browser (localStorage), content could not be shared, could be lost and had no real login. Moving the data to Supabase gave the site a database, file storage and authentication, so administrators can log in and edit what visitors see.

The architecture is simple: Claude Code writes the code, GitHub stores it, Vercel publishes it and Supabase keeps the data. Two ideas matter most: secrets such as keys live in `.env` and never in GitHub, and authentication (who you are) is different from authorization (what you may do), hence the pending, admin and super admin roles.

AI wrote the SQL and the code, but it had to be reviewed and tested in production before being trusted. Evidence: the back-office dashboard screenshot in the Announcements section.

### Class 7 - Multi-admin back office, audit trail and batch import (20 Oct 2026)
- More access requires more accountability: when several administrators edit the same data we must be able to answer who changed what, when, and what exactly changed.
- An audit trail records who, what action, which record, when and what changed. Business data tells us the current state; audit data tells us how we got there.
- Good data management starts with a clear data structure; controlled inputs (a dropdown for degree program) improve data quality because "MBA", "M.B.A.", "Master" and "Master's" would otherwise be four different values.
- One-by-one CRUD does not scale to 500 records: CSV batch import follows the flow CSV file, validate, import, Supabase, verify. Validation comes before importing.
- Storing data is not enough: search, filter, choosing which columns to display and exporting the filtered set turn data into usable information.
- Implemented with Claude Code and reviewed by the student: the audit is written by database triggers (not by the browser), duplicate protection is a unique index (not only a preview warning), and the import is validated twice (in the browser for the preview, in the database function for safety).

### Class 8 - From requirements to an AI-executable product SPEC (10 Nov 2026)
- Vibe coding hands the important decisions to the AI unless the human states them: concept, users and needs, requirements, MVP, structure, user flow, UI/UX, data and system design. A plan the student does not understand is not a decision.
- AI tends to meet the minimum (10 users, 100 records, basic security). A SPEC has to say what must also hold at 10,000 users and 100,000 records, and what must never happen.
- Workflow taught: understand the codebase first (new feature or revision? shared logic?), then plan, revise the plan, execute, one feature at a time; debug with evidence; let agents write tests; customize the agent with rules (static context), skills (dynamic context) and MCP (external tools).
- Applied: the project now has `public/docs/SPEC.md` (also at `/project.html?doc=spec`), written from the real schema, RLS and code, with verifiable acceptance criteria, edge cases, a scale table, an operations section and a "what NOT to do" list. Writing it also exposed gaps that were not in the PRD (no browser tests, alumni filtering in the browser, minimal marketplace spam protection).
- Workshop set-up: the Supabase MCP server is declared for this project in `.mcp.json` (read-only, project ref only; the student authenticates it in the browser), so the agent can read the real schema instead of guessing.

### Class 10 - Role-based C2C marketplace (17 Nov 2026)
- A product is "a connected workflow, not a collection of pages": seller lists, buyer browses, order, payment, shipment, completion, seller inventory and sales, admin monitoring. The hard part is not the screens, it is **who is allowed to do which step**.
- Role → permission → available actions: the same order is rendered three ways (buyer, seller, admin) from one record, and the buttons come from one rule table (`actionsFor` in `src/trade.js`) that the database repeats in `advance_order()`. The interface is a convenience; the function is the lock.
- Two buyers can want the last copy at the same moment. The checkout locks the listing rows inside one transaction and checks stock again, so the second buyer gets "Only 0 left" instead of an oversold item. This is the kind of decision AI skips at "10 users".
- Business records: sold items and orders cannot be deleted (a trigger refuses it, and removing a listing that has orders hides it instead).
- Interpretation I made (to confirm with the instructor): the slides list "Seller: approved seller"; I treat the administrator's approval of each listing as that approval, instead of a separate seller application.

## 16. Test and verification log
- **20 Oct 2026, production:** created, edited, reordered, deleted faculty and news from the admin; verified photo upload and deletion in Storage; verified drafts are invisible to the public; verified an anonymous visitor cannot insert, delete, upload or read profiles; verified pending, admin and super admin permissions with a role simulation that rolls back.
- **20 Oct 2026, production (class 7):** ran `v5.sql`; imported the 20-row class CSV (20 added, ROC years converted); verified search, degree filter, column chooser, edit (audit shows company and job title old to new), duplicate Student ID rejected without losing the form, re-import in skip and update modes (blank cells keep existing values), export CSV, delete (audit keeps a snapshot), Chinese interface. Test data was deleted afterwards.
- **Automated tests:** `npm test` includes unit tests for the alumni CSV parser and validator (quotes, delimiters, ROC years, degree synonyms, empty rows, duplicates, encoding, formula-safe export) and a check against the 20-row class sample.
- **Automated tests (class 10):** `tests/trade.test.js` covers who can do what at each order status (administrators and visitors get no action), stock formula, stalled-order flags, seller accounting by month, order search, CSV with formula protection, cart limits.
- **Known limits:** tests cover the Markdown renderer, translations, retrieval and the alumni CSV parser, but not the browser interface (checked by hand in production); marketplace has no spam protection beyond a honeypot and database limits.

## 17. AI usage and responsible use
- Claude Code was used as the AI coding agent (agreed with the instructor), with GitHub and Vercel for versioning and deployment.
- AI generated drafts of code, SQL and documentation; the student reviewed behaviour, tested in production and decides what ships.
- Auto-translation is a draft only; humans approve text before publishing.
- Privacy: only information already public on the official website (names, emails, phone extensions) is shown; analytics store no personal data; secrets are never committed.
- AI feature (built): an admissions FAQ assistant that answers only from published pages and database content, cites the source link, and says when it does not know (it never guesses).

## 18. Change and decision log
- **6 Oct 2026:** first version of the site (home with 5 sections, navigation with dropdowns, hero, language switch). Published with GitHub and Vercel.
- **20 Oct 2026:** restyled the site and changed copy and branding.
- **20 Oct 2026:** connected Supabase (database, storage, auth); faculty CRUD with reorder and photos; login with pending, admin, super admin.
- **20 Oct 2026:** announcements as cards with hover effects; bilingual news management with auto-translate, preview and sync check.
- **20 Oct 2026:** content pages, downloads, moderated marketplace, dashboard, audit log, analytics, full bilingual public site, new logo, this document.
- **Decision:** keep content in the database, not in code, so staff never need a developer.
- **Decision:** moderate marketplace listings before publishing to avoid spam and abuse.
- **Decision:** link photos and documents to the official site and cite the source.
- **20 Oct 2026 (evening):** design and UX pass: dark mode, global search, scroll animations, countdown, mobile menu, skeleton loaders, toasts, faculty search.

- **20 Oct 2026 (class 7):** alumni database (`supabase/v5.sql`), Alumni tab with CRUD, search, filters, sortable and selectable columns, per-record history; CSV template, validated batch import with preview and duplicate handling; export of the filtered set; audit of role changes.
- **Decision:** one summary `IMPORT` audit row per batch instead of one row per imported record, so a 500-row import does not bury the log; deletions keep a full snapshot of the record.
- **Decision:** the sample CSV has ROC years, so years are stored as calendar years and converted on import.
- **Decision:** CSV only (Excel users save as CSV UTF-8); no spreadsheet library is added to keep the site light.
- **27 Oct 2026:** fixed 404s on university files: links under `/esubweb/immbaengindex/` and `/subweb/immba/` were rewritten to the live `/smarteditupfiles/` path in downloads and pages (`supabase/fix-file-links.sql`); 93 of 96 university links now answer 200.
- **27 Oct 2026:** fixed the header flicker (it shrank and grew again on scroll because the browser's scroll anchoring pushed the page back above the threshold; now two thresholds); password fields have a show/hide eye and sign-up asks for the password twice; the home page no longer shows Faculty (Announcements first, then Events; the menu links to the Faculty page); added an example faculty profile; login pages show a form-shaped placeholder instead of card skeletons.
- **27 Oct 2026:** the public Faculty page now lists people in exactly the order set in the back office (it used to group by category, so a person moved to 2nd could appear near the end); each card keeps a category pill and the chips act as filters. Reordering in the back office shows a confirmation toast, highlights the moved row and numbers the rows. The site opens in the light theme by default. The **Activity log** is its own back-office tab (not inside Alumni) and covers every area (news, faculty, alumni, pages, documents, marketplace, administrator roles) with Area, Action and Administrator filters; each alumnus keeps its own History button. Faculty was removed from the home page, which now shows Announcements then Events. **Export CSV** now opens a review screen before anything is downloaded: records (filtered or all, with the active filters listed), columns (all or only those shown), a preview of the first rows, the file name, size and format, and a reminder that the file holds personal data; the figures update live if filters change while it is open.
- **10 Nov 2026 (class 8):** added the AI-executable SPEC (`public/docs/SPEC.md`, shown at `/project.html?doc=spec` with a PRD/SPEC switch) and the read-only Supabase MCP configuration (`.mcp.json`). **Decision:** the SPEC is a separate document from the PRD (PRD = why and for whom, SPEC = exact behaviour); the code stays the source of truth.

- **17 Nov 2026 (class 10):** role-based C2C marketplace (`supabase/v6.sql`): seller listings with stock and images, cart and checkout (one order per seller), order workflow with five statuses, buyer, seller and admin views, seller accounting with CSV export, admin Transactions tab (search, status filter, abnormal monitor, history), audit of every order change. **Decision:** orders are written only by two database functions that check the caller's role, so even a modified browser cannot skip a step. **Decision:** payment is arranged offline between buyer and seller and the seller confirms it (no payment processor; the slides model "confirm payment" as a seller action). **Decision:** administrators are read-only on orders.

## 19. Final reflection (to be written by the student)
Write this yourself at the end of the course. Suggested prompts:
- What did you build, and what would you change first with more time?
- Where did the AI help most, and where did you have to correct it?
- What did the interviews change in the product?
- What risks (privacy, quality, dependence on AI) did you find and how did you handle them?
- What did you learn about turning a business problem into requirements?
