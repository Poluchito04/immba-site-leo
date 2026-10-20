-- v4: images on announcements (storage bucket + column)
alter table public.news add column if not exists image_url text;
alter table public.news_defaults add column if not exists image_url text;

insert into storage.buckets (id, name, public) values ('news-images','news-images', true) on conflict (id) do nothing;
drop policy if exists "news images public read"  on storage.objects;
drop policy if exists "news images admin insert" on storage.objects;
drop policy if exists "news images admin update" on storage.objects;
drop policy if exists "news images admin delete" on storage.objects;
create policy "news images public read"  on storage.objects for select using (bucket_id = 'news-images');
create policy "news images admin insert" on storage.objects for insert with check (bucket_id = 'news-images' and public.is_admin());
create policy "news images admin update" on storage.objects for update using (bucket_id = 'news-images' and public.is_admin());
create policy "news images admin delete" on storage.objects for delete using (bucket_id = 'news-images' and public.is_admin());
