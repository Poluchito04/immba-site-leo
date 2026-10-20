-- "Restore the default announcement list" (class #5, AdminNews main functions).
-- Snapshot of the current announcements + an admin-only function that puts them back.
create table if not exists public.news_defaults (like public.news including all);
alter table public.news_defaults enable row level security;
drop policy if exists "news_defaults admin read" on public.news_defaults;
create policy "news_defaults admin read" on public.news_defaults for select using (public.is_admin());
insert into public.news_defaults select * from public.news where not exists (select 1 from public.news_defaults);

create or replace function public.restore_default_news() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'Only administrators can restore the defaults'; end if;
  delete from public.news where true;
  insert into public.news select * from public.news_defaults;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.restore_default_news() from public, anon;
grant execute on function public.restore_default_news() to authenticated;
