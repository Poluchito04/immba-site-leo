-- imMBA backend: faculty table, admin roles, storage. Run once in Supabase → SQL Editor.

-- 1. Faculty ---------------------------------------------------------------
create table if not exists public.faculty (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  education text,
  research_fields text,
  department text,
  phone text,
  email text,
  website text,
  image_url text,
  category text not null default 'full-time' check (category in ('full-time','adjunct')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Admin profiles (one row per auth user) ---------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'pending' check (role in ('pending','admin','super_admin','rejected')),
  created_at timestamptz not null default now()
);

-- every new sign-up starts as 'pending' (the client can never choose its own role)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role) values (new.id, new.email, 'pending');
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- role helpers (security definer avoids RLS recursion)
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.current_role_name() in ('admin','super_admin'), false) $$;
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.current_role_name() = 'super_admin', false) $$;

-- 3. Row Level Security -----------------------------------------------------
alter table public.faculty  enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "faculty public read"   on public.faculty;
drop policy if exists "faculty admin insert"  on public.faculty;
drop policy if exists "faculty admin update"  on public.faculty;
drop policy if exists "faculty admin delete"  on public.faculty;
create policy "faculty public read"  on public.faculty for select using (true);
create policy "faculty admin insert" on public.faculty for insert with check (public.is_admin());
create policy "faculty admin update" on public.faculty for update using (public.is_admin()) with check (public.is_admin());
create policy "faculty admin delete" on public.faculty for delete using (public.is_admin());

drop policy if exists "profiles read own or super" on public.profiles;
drop policy if exists "profiles super update"      on public.profiles;
create policy "profiles read own or super" on public.profiles for select
  using (id = auth.uid() or public.is_super_admin());
create policy "profiles super update" on public.profiles for update
  using (public.is_super_admin()) with check (public.is_super_admin());

-- 4. Storage bucket for faculty photos --------------------------------------
insert into storage.buckets (id, name, public) values ('faculty-photos','faculty-photos', true)
  on conflict (id) do nothing;
drop policy if exists "photos public read"   on storage.objects;
drop policy if exists "photos admin insert"  on storage.objects;
drop policy if exists "photos admin update"  on storage.objects;
drop policy if exists "photos admin delete"  on storage.objects;
create policy "photos public read"  on storage.objects for select using (bucket_id = 'faculty-photos');
create policy "photos admin insert" on storage.objects for insert with check (bucket_id = 'faculty-photos' and public.is_admin());
create policy "photos admin update" on storage.objects for update using (bucket_id = 'faculty-photos' and public.is_admin());
create policy "photos admin delete" on storage.objects for delete using (bucket_id = 'faculty-photos' and public.is_admin());

-- 5. Sample row (from the course slides) ------------------------------------
insert into public.faculty (name, title, email, department, category, sort_order)
select 'Yi-Ning Tu', 'Associate Professor', '082435@mail.fju.edu.tw',
       'Department of Statistics and Information Science', 'full-time', 1
where not exists (select 1 from public.faculty);

-- 6. Make YOURSELF the first super_admin (after you have registered once) ---
-- update public.profiles set role = 'super_admin' where email = 'YOUR_EMAIL_HERE';
