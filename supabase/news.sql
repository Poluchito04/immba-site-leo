-- News / announcements (bilingual: one record holds both languages). Run in Supabase SQL Editor.
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  news_date date not null default current_date,
  title_zh text, title_en text,
  content_zh text, content_en text,
  link_url text, link_url_zh text,
  pinned boolean not null default false,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint news_has_title check (coalesce(title_zh,'') <> '' or coalesce(title_en,'') <> '')
);
alter table public.news enable row level security;
drop policy if exists "news public read"  on public.news;
drop policy if exists "news admin read"   on public.news;
drop policy if exists "news admin insert" on public.news;
drop policy if exists "news admin update" on public.news;
drop policy if exists "news admin delete" on public.news;
create policy "news public read"  on public.news for select using (published or public.is_admin());
create policy "news admin insert" on public.news for insert with check (public.is_admin());
create policy "news admin update" on public.news for update using (public.is_admin()) with check (public.is_admin());
create policy "news admin delete" on public.news for delete using (public.is_admin());
