# imMBA website (student project)

Bilingual (English / 中文) program website for the Fu Jen imMBA, built for the course *AI-Assisted Digital Product Development*.
Stack: static multi-page site with Vite + vanilla JS, **Supabase** (Postgres, Auth, Storage) and **Vercel**. Built with Claude Code.

Live: https://immba-copia.vercel.app · Product docs: `/project.html` (source: `public/docs/PRD.md`)

## Features
- Public site: home (5 sections), content pages (About, Admissions, Curriculum, Guide, Graduation, Dual Degree, Exchange), faculty page (not on the home page), announcements and events as cards (the home page shows Announcements, then Events), downloads library, moderated student marketplace, language switch.
- Back office (`/admin.html`): login, roles (`pending` → `admin` → `super_admin`), dashboard and CSV report, management of news/events (bilingual with auto-translate and sync check), faculty (with photos and reorder), pages, documents, marketplace moderation, administrator approvals, **activity log** (its own tab, all areas, filterable), **alumni database** (CRUD, search and filters, selectable columns, CSV batch import with validation and preview, CSV export of the filtered set, field-level audit trail with per-record history).
- Security: Row Level Security on every table, safe markdown renderer, link sanitising, no secrets in the repo.

## Setup
1. Create a Supabase project. In the SQL Editor run, in order: `supabase/schema.sql`, `supabase/seed-faculty.sql`, `supabase/news.sql`, `supabase/seed-news.sql`, `supabase/v2.sql`, `supabase/fix-file-links.sql` (corrects old university file paths), then the later migrations `supabase/v3.sql`, `supabase/v4.sql` and `supabase/v5.sql` (alumni database, audit trail, CSV import).
2. Register once in `/admin.html`, then make yourself the first super admin:
   `update public.profiles set role = 'super_admin' where email = 'YOUR_EMAIL';`
3. In Supabase → Auth → URL configuration set the Site URL and add `https://YOUR-DOMAIN/admin.html` as a redirect URL.
4. Copy `.env.example` to `.env.local` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key). Set the same variables in Vercel.
5. `npm install && npm run dev`

## Scripts
- `npm run dev` / `npm run build`
- `npm test`: unit tests for the markdown renderer, sanitisers, retrieval and the alumni CSV parser/validator (`tests/`)

## Data sources
Faculty, news, pages and document links come from the official imMBA website (cited on every page). Photos and files are linked, not copied.
