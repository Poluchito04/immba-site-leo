-- Class 11 — permission / RLS tests for the marketplace (Access Control + Negative + Boundary cases).
-- Run in the Supabase SQL editor. It changes NOTHING: everything happens in one transaction that ends in ROLLBACK.
-- Output: the report appears as an error message (PASS / FAIL per test + totals); the error guarantees the rollback. Requires v6.sql + v7.sql (T12 needs v8.sql).
begin;
create temp table results (id text, test text, expected text, got text, verdict text) on commit drop;
grant all on results to public;

insert into auth.users (id, email, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001','t-seller@test.invalid','{"kind":"member"}'),
 ('aaaaaaaa-0000-0000-0000-000000000002','t-buyer@test.invalid','{"kind":"member"}'),
 ('aaaaaaaa-0000-0000-0000-000000000003','t-admin@test.invalid','{"kind":"member"}'),
 ('aaaaaaaa-0000-0000-0000-000000000004','t-pending@test.invalid','{"kind":"member"}');
update public.profiles set role='member'  where id in ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002');
update public.profiles set role='admin'   where id = 'aaaaaaaa-0000-0000-0000-000000000003';
update public.profiles set role='pending' where id = 'aaaaaaaa-0000-0000-0000-000000000004';
alter table public.listings disable trigger listings_guard;
insert into public.listings (id,title,description,price,category,seller_name,seller_id,status,quantity)
values ('bbbbbbbb-0000-0000-0000-000000000001','T listing','x',100,'books','T Seller','aaaaaaaa-0000-0000-0000-000000000001','approved',3);
insert into public.listings (id,title,description,price,category,seller_name,seller_id,status,quantity)
values ('bbbbbbbb-0000-0000-0000-000000000002','T pending listing','x',100,'books','T Seller','aaaaaaaa-0000-0000-0000-000000000001','pending',1);
alter table public.listings enable trigger listings_guard;

create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, true);
      perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true); end $$;
-- runs one statement; PASS when it is blocked/allowed as expected (a zero-row UPDATE/DELETE counts as blocked)
create function pg_temp.t(p_id text, p_test text, p_expected text, p_sql text) returns void language plpgsql as $$
declare got text; v text; n bigint;
begin
  begin
    execute p_sql; get diagnostics n = row_count;
    got := case when n = 0 and p_sql ~* '^\s*(update|delete)' then 'blocked: 0 rows affected (RLS)' else 'allowed' end;
  exception when others then got := 'blocked: ' || left(sqlerrm, 90);
  end;
  v := case when (p_expected = 'blocked' and got like 'blocked%') or (p_expected = 'allowed' and got = 'allowed') then 'PASS' else 'FAIL' end;
  insert into results values (p_id, p_test, p_expected, got, v);
end $$;
grant execute on function pg_temp.t(text,text,text,text) to public;
grant execute on function pg_temp.as_user(uuid) to public;

set local role authenticated;
-- ===== buyer =====
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
select pg_temp.t('T01','buyer cannot edit another seller''s listing','blocked', $q$ update public.listings set price=1 where id='bbbbbbbb-0000-0000-0000-000000000001' $q$);
select pg_temp.t('T02','buyer cannot delete another seller''s listing','blocked', $q$ delete from public.listings where id='bbbbbbbb-0000-0000-0000-000000000001' $q$);
select pg_temp.t('T03','buyer cannot write orders directly','blocked', $q$ insert into public.orders (buyer_name,buyer_contact,seller_name,total,subtotal) values ('x','xxx','s',1,1) $q$);
select pg_temp.t('T04','buyer cannot create an already-approved listing','blocked', $q$ insert into public.listings (title,description,price,category,seller_name,seller_id,status,quantity) values ('own','x',1,'books','me','aaaaaaaa-0000-0000-0000-000000000002','approved',1) $q$);
select pg_temp.t('T05','buyer cannot start a listing with purchased > 0','blocked', $q$ insert into public.listings (title,description,price,category,seller_name,seller_id,status,quantity,purchased) values ('own2','x',1,'books','me','aaaaaaaa-0000-0000-0000-000000000002','pending',5,5) $q$);
select pg_temp.t('T06','buyer cannot change marketplace fees','blocked', $q$ update public.app_settings set platform_fee=0 where id=1 $q$);
select pg_temp.t('B09a','quantity = 0 is rejected','blocked', $q$ select public.place_order('[{"listing_id":"bbbbbbbb-0000-0000-0000-000000000001","quantity":0}]','LINE x') $q$);
select pg_temp.t('B09b','quantity = -1 is rejected','blocked', $q$ select public.place_order('[{"listing_id":"bbbbbbbb-0000-0000-0000-000000000001","quantity":-1}]','LINE x') $q$);
select pg_temp.t('B09c','quantity above available stock (4 of 3) is rejected','blocked', $q$ select public.place_order('[{"listing_id":"bbbbbbbb-0000-0000-0000-000000000001","quantity":4}]','LINE x') $q$);
select pg_temp.t('B09d','quantity = maximum stock (3 of 3) is accepted','allowed', $q$ select public.place_order('[{"listing_id":"bbbbbbbb-0000-0000-0000-000000000001","quantity":3}]','LINE x') $q$);
select pg_temp.t('B09e','after buying all 3, one more is rejected (sold out)','blocked', $q$ select public.place_order('[{"listing_id":"bbbbbbbb-0000-0000-0000-000000000001","quantity":1}]','LINE x') $q$);
create temp table o1 as select id from public.orders where buyer_id='aaaaaaaa-0000-0000-0000-000000000002' limit 1;
grant all on o1 to public;
select pg_temp.t('T07','buyer cannot confirm payment (admin only)','blocked', $q$ select public.advance_order((select id from o1),'payment_confirmed') $q$);
select pg_temp.t('T08','buyer can say "I have paid"','allowed', $q$ select public.advance_order((select id from o1),'payment_submitted','REF-123') $q$);
select pg_temp.t('T09','buyer cannot mark it shipped','blocked', $q$ select public.advance_order((select id from o1),'shipped') $q$);
select pg_temp.t('T10','an order (business record) cannot be deleted','blocked', $q$ delete from public.orders where id=(select id from o1) $q$);
-- ===== seller =====
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.t('S12a','seller cannot confirm payment (admin only)','blocked', $q$ select public.advance_order((select id from o1),'payment_confirmed') $q$);
select pg_temp.t('S12b','seller cannot ship before payment is confirmed','blocked', $q$ select public.advance_order((select id from o1),'shipped') $q$);
select pg_temp.t('S06a','inventory below what was already purchased (0 < 3) is refused','blocked', $q$ update public.listings set quantity=0 where id='bbbbbbbb-0000-0000-0000-000000000001' $q$);
select pg_temp.t('S06b','seller can raise inventory to 10','allowed', $q$ update public.listings set quantity=10 where id='bbbbbbbb-0000-0000-0000-000000000001' $q$);
select pg_temp.t('S04','negative price is rejected','blocked', $q$ insert into public.listings (title,description,price,category,seller_name,seller_id,status,quantity) values ('neg','x',-5,'books','me','aaaaaaaa-0000-0000-0000-000000000001','pending',1) $q$);
select pg_temp.t('T11','seller cannot approve their own pending listing','blocked', $q$ update public.listings set status='approved' where id='bbbbbbbb-0000-0000-0000-000000000002' $q$);
select pg_temp.t('T12','seller cannot rename a listing to the demo store (needs v8)','blocked', $q$ update public.listings set seller_name='imMBA Demo Store' where id='bbbbbbbb-0000-0000-0000-000000000001' $q$);
select pg_temp.t('T13','editing seller_name sends an approved listing back to review (needs v8)','allowed', $q$ do $b$ begin update public.listings set seller_name='Other Name' where id='bbbbbbbb-0000-0000-0000-000000000001'; if (select status from public.listings where id='bbbbbbbb-0000-0000-0000-000000000001') <> 'pending' then raise exception 'stayed approved'; end if; end $b$ $q$);
select pg_temp.t('T14','seller cannot buy their own listing','blocked', $q$ select public.place_order('[{"listing_id":"bbbbbbbb-0000-0000-0000-000000000001","quantity":1}]','LINE x') $q$);
-- ===== pending account =====
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000004');
select pg_temp.t('T15','a pending account cannot create a listing','blocked', $q$ insert into public.listings (title,description,price,category,seller_name,seller_id,status,quantity) values ('p','x',1,'books','p','aaaaaaaa-0000-0000-0000-000000000004','pending',1) $q$);
select pg_temp.t('T16','a pending account cannot place an order','blocked', $q$ select public.place_order('[{"listing_id":"bbbbbbbb-0000-0000-0000-000000000001","quantity":1}]','LINE x') $q$);
-- ===== admin =====
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000003');
select pg_temp.t('T17','admin cannot ship (monitoring is not editing)','blocked', $q$ select public.advance_order((select id from o1),'shipped') $q$);
select pg_temp.t('T18','admin confirms the payment the buyer reported','allowed', $q$ select public.advance_order((select id from o1),'payment_confirmed') $q$);

reset role;
-- the report is raised as an error on purpose: the failed transaction can never be committed, so nothing above is kept
do $r$ declare rep text; begin
  select string_agg(rpad(id,6) || verdict || '  ' || test || '  -> ' || got, E'\n' order by id) || E'\n\nPASSED ' || count(*) filter (where verdict='PASS') || ' / ' || count(*) || '   FAILED ' || count(*) filter (where verdict='FAIL')
    into rep from results;
  raise exception E'\nTEST REPORT (rolled back)\n%', rep;
end $r$;
