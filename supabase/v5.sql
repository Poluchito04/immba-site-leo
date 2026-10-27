-- v5 (class 7): alumni database, field-level audit trail, CSV batch import, role-change auditing.
-- Safe to re-run. Requires schema.sql + v2.sql (is_admin(), audit_log, touch_updated_at()).

-- 1. Alumni table ---------------------------------------------------------------
create table if not exists public.alumni (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  student_id text not null check (char_length(btrim(student_id)) between 1 and 30),
  department text check (char_length(department) <= 120),
  degree_program text not null default 'Other' check (degree_program in ('Bachelor','Master','Doctoral','Other')),
  admission_year int check (admission_year between 1950 and 2100),
  graduation_year int check (graduation_year between 1950 and 2100),
  email text check (email is null or (char_length(email) <= 160 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (char_length(phone) <= 40),
  company text check (char_length(company) <= 160),
  job_title text check (char_length(job_title) <= 160),
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (graduation_year is null or admission_year is null or graduation_year >= admission_year)
);
-- duplicate protection lives in the database, not only in the CSV preview
create unique index if not exists alumni_student_id_key on public.alumni (student_id);
create unique index if not exists alumni_email_key on public.alumni (lower(email)) where email is not null;
create index if not exists alumni_name_idx on public.alumni (lower(full_name));

drop trigger if exists alumni_touch on public.alumni;
create trigger alumni_touch before update on public.alumni for each row execute function public.touch_updated_at();

-- 2. Audit trail: who -> did what -> to which record -> when -> what changed ----------
alter table public.audit_log add column if not exists record_id text;
alter table public.audit_log add column if not exists changes jsonb;
create index if not exists audit_log_record_idx on public.audit_log (table_name, record_id, created_at desc);

create or replace function public.log_alumni_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; o jsonb; n jsonb; diff jsonb := '{}'::jsonb; k text; v jsonb; rec public.alumni;
begin
  -- a batch import writes ONE summary row (see import_alumni) instead of one CREATE per row
  if tg_op = 'INSERT' and current_setting('app.bulk_import', true) = 'on' then return null; end if;
  select email into who from public.profiles where id = auth.uid();
  who := coalesce(who, 'system');
  rec := case when tg_op = 'DELETE' then old else new end;
  n := to_jsonb(rec) - array['id','created_at','updated_at','created_by'];
  if tg_op = 'INSERT' then diff := n;                      -- the new values
  elsif tg_op = 'DELETE' then diff := n;                   -- full snapshot, so a deleted record can be restored by hand
  else
    o := to_jsonb(old) - array['id','created_at','updated_at','created_by'];
    for k, v in select * from jsonb_each(n) loop
      if v is distinct from o->k then diff := diff || jsonb_build_object(k, jsonb_build_object('from', o->k, 'to', v)); end if;
    end loop;
    if diff = '{}'::jsonb then return null; end if;        -- nothing really changed
  end if;
  insert into public.audit_log (table_name, action, row_label, actor_email, record_id, changes)
  values ('alumni', tg_op, left(rec.full_name || ' (' || rec.student_id || ')', 160), who, rec.id::text, diff);
  return null;
end $$;
drop trigger if exists audit_alumni on public.alumni;
create trigger audit_alumni after insert or update or delete on public.alumni for each row execute function public.log_alumni_change();

-- permission changes are audited too (administrative transparency)
create or replace function public.log_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if new.role is not distinct from old.role then return null; end if;
  select email into who from public.profiles where id = auth.uid();
  insert into public.audit_log (table_name, action, row_label, actor_email, record_id, changes)
  values ('profiles', 'UPDATE', left(new.email, 160), coalesce(who, 'system'), new.id::text,
          jsonb_build_object('role', jsonb_build_object('from', old.role, 'to', new.role)));
  return null;
end $$;
drop trigger if exists audit_profile_role on public.profiles;
create trigger audit_profile_role after update of role on public.profiles for each row execute function public.log_role_change();

-- 3. Row Level Security ------------------------------------------------------------
alter table public.alumni enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'alumni' loop
    execute format('drop policy %I on public.alumni', p.policyname);
  end loop;
end $$;
-- alumni data is personal: no public read at all, administrators only
create policy "alumni admin read"   on public.alumni for select using (public.is_admin());
create policy "alumni admin insert" on public.alumni for insert with check (public.is_admin());
create policy "alumni admin update" on public.alumni for update using (public.is_admin()) with check (public.is_admin());
create policy "alumni admin delete" on public.alumni for delete using (public.is_admin());
-- audit_log keeps its read-only policy from v2: nobody can edit or delete history from the browser.

-- 4. Batch import (validated again on the server; one summary audit row) ---------------
create or replace function public.import_alumni(p_rows jsonb, p_update boolean default false, p_filename text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; ex uuid; who text; ins int := 0; upd int := 0; skp int := 0;
  new_ids jsonb := '[]'::jsonb; upd_ids jsonb := '[]'::jsonb; skip_ids jsonb := '[]'::jsonb; failed jsonb := '[]'::jsonb;
  sid text;
begin
  if not public.is_admin() then raise exception 'Only administrators can import alumni'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Expected a list of rows'; end if;
  if jsonb_array_length(p_rows) > 2000 then raise exception 'At most 2000 rows per import'; end if;
  perform set_config('app.bulk_import', 'on', true);
  for r in select * from jsonb_array_elements(p_rows) loop
    sid := nullif(btrim(r->>'student_id'), '');
    begin
      select id into ex from public.alumni
       where student_id = sid or (nullif(r->>'email','') is not null and lower(email) = lower(r->>'email'))
       order by (student_id = sid) desc limit 1;
      if ex is not null and not p_update then
        skp := skp + 1; skip_ids := skip_ids || to_jsonb(sid);
      elsif ex is not null then
        update public.alumni set
          full_name = coalesce(nullif(btrim(r->>'full_name'), ''), full_name),
          department = coalesce(nullif(btrim(r->>'department'), ''), department),
          degree_program = coalesce(nullif(r->>'degree_program', ''), degree_program),
          admission_year = coalesce((r->>'admission_year')::int, admission_year),
          graduation_year = coalesce((r->>'graduation_year')::int, graduation_year),
          email = coalesce(nullif(btrim(r->>'email'), ''), email),
          phone = coalesce(nullif(btrim(r->>'phone'), ''), phone),
          company = coalesce(nullif(btrim(r->>'company'), ''), company),
          job_title = coalesce(nullif(btrim(r->>'job_title'), ''), job_title)
        where id = ex;                                     -- blanks in the file never erase existing data
        upd := upd + 1; upd_ids := upd_ids || to_jsonb(sid);
      else
        insert into public.alumni (full_name, student_id, department, degree_program, admission_year, graduation_year, email, phone, company, job_title, notes)
        values (nullif(btrim(r->>'full_name'), ''), sid, nullif(btrim(r->>'department'), ''), coalesce(nullif(r->>'degree_program',''), 'Other'),
                (r->>'admission_year')::int, (r->>'graduation_year')::int, nullif(btrim(r->>'email'), ''), nullif(btrim(r->>'phone'), ''),
                nullif(btrim(r->>'company'), ''), nullif(btrim(r->>'job_title'), ''), nullif(btrim(r->>'notes'), ''));
        ins := ins + 1; new_ids := new_ids || to_jsonb(sid);
      end if;
    exception when others then
      failed := failed || jsonb_build_object('student_id', sid, 'error', sqlerrm);
    end;
  end loop;
  select email into who from public.profiles where id = auth.uid();
  insert into public.audit_log (table_name, action, row_label, actor_email, record_id, changes)
  values ('alumni', 'IMPORT', left(coalesce(p_filename, 'CSV import'), 160), coalesce(who, 'system'), null,
          jsonb_build_object('file', p_filename, 'inserted', ins, 'updated', upd, 'skipped', skp, 'failed', jsonb_array_length(failed),
                             'student_ids', jsonb_build_object('inserted', new_ids, 'updated', upd_ids, 'skipped', skip_ids)));
  return jsonb_build_object('inserted', ins, 'updated', upd, 'skipped', skp, 'failed', failed);
end $$;
revoke all on function public.import_alumni(jsonb, boolean, text) from public, anon;
grant execute on function public.import_alumni(jsonb, boolean, text) to authenticated;
