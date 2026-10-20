-- v3: visitor inquiries, member accounts, visiting faculty (from the course's "Final Project Requirements" slide).
-- Safe to re-run. Run after v2.sql.

-- 1. Member accounts: visitors can register; they never get edit rights ---------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('pending','admin','super_admin','rejected','member'));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, case when new.raw_user_meta_data->>'kind' = 'member' then 'member' else 'pending' end);
  return new;
end $$;

-- 2. Faculty: visiting category -------------------------------------------------------------------
alter table public.faculty drop constraint if exists faculty_category_check;
alter table public.faculty add constraint faculty_category_check check (category in ('full-time','visiting','adjunct'));

-- 3. Inquiries: anyone can ask, administrators manage ---------------------------------------------
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) between 5 and 120 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  topic text not null default 'admissions' check (topic in ('admissions','curriculum','dual-degree','exchange','faculty','other')),
  message text not null check (char_length(message) between 10 and 2000),
  lang text not null default 'en' check (lang in ('en','zh')),
  status text not null default 'new' check (status in ('new','in_progress','answered','closed')),
  admin_note text check (char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inquiries_created_idx on public.inquiries (created_at desc);
drop trigger if exists inquiries_touch on public.inquiries;
create trigger inquiries_touch before update on public.inquiries for each row execute function public.touch_updated_at();

alter table public.inquiries enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='inquiries' loop
    execute format('drop policy %I on public.inquiries', p.policyname);
  end loop;
end $$;
create policy "inquiries submit" on public.inquiries for insert
  with check (status = 'new' and admin_note is null and (user_id is null or user_id = auth.uid()));
create policy "inquiries read own or admin" on public.inquiries for select
  using (public.is_admin() or (user_id is not null and user_id = auth.uid()));
create policy "inquiries admin update" on public.inquiries for update using (public.is_admin()) with check (public.is_admin());
create policy "inquiries admin delete" on public.inquiries for delete using (public.is_admin());

drop trigger if exists audit_inquiries on public.inquiries;
create trigger audit_inquiries after insert or update or delete on public.inquiries for each row execute function public.log_change();
