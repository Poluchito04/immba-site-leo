-- v6 (class 10): role-based C2C marketplace — sellers, inventory, cart checkout, order workflow, transaction records.
-- Safe to re-run. Requires schema.sql + v2.sql + v3.sql (is_admin(), audit_log, touch_updated_at(), member role).
--
-- Roles (one account can be buyer AND seller; administrators only monitor):
--   visitor  : browse approved listings                       (anon key, no account)
--   member   : buyer + seller (sells its own listings, buys other members' listings)
--   admin / super_admin : moderate listings, READ every order (no write policy on orders at all)
-- Orders are never written directly by the browser: only place_order() and advance_order() can change them,
-- and they check who is asking. Completed orders can never be deleted (trigger) — they are business records.

-- 1. Who may trade ---------------------------------------------------------------------------------
create or replace function public.can_trade() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.current_role_name() in ('member','admin','super_admin'), false) $$;

-- 2. Listings: seller identity, inventory, image, hide switch -------------------------------------------
alter table public.listings add column if not exists seller_id uuid references auth.users(id) on delete set null;
alter table public.listings add column if not exists quantity  int not null default 1 check (quantity between 0 and 9999);
alter table public.listings add column if not exists purchased int not null default 0 check (purchased >= 0);
alter table public.listings add column if not exists active    boolean not null default true;
alter table public.listings add column if not exists image_url text;
alter table public.listings add column if not exists updated_at timestamptz not null default now();
-- Available Stock = Current Inventory − Purchased Quantity (the formula on the slide, kept by the database)
alter table public.listings drop constraint if exists listings_stock_check;
alter table public.listings add constraint listings_stock_check check (purchased <= quantity);
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='listings' and column_name='available') then
    alter table public.listings add column available int generated always as (quantity - purchased) stored;
  end if;
end $$;
-- the public no longer needs a phone/e-mail on the card: buyers order through the platform
alter table public.listings alter column contact drop not null;
create index if not exists listings_seller_idx on public.listings (seller_id);

update public.listings set quantity = 5 where seller_id is null and quantity = 1;   -- demo listings look stocked

drop trigger if exists listings_touch on public.listings;
create trigger listings_touch before update on public.listings for each row execute function public.touch_updated_at();

-- sellers can edit their own rows, but cannot approve themselves, move stock counters or change owner
create or replace function public.guard_listing() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.purchased <> 0 then raise exception 'purchased must start at 0'; end if;
    return new;
  end if;
  if new.purchased is distinct from old.purchased and coalesce(current_setting('app.trade', true), '') <> 'on' then
    raise exception 'Purchased quantity is maintained by orders only';
  end if;
  if public.is_admin() then return new; end if;            -- moderators may change the status
  if new.seller_id is distinct from old.seller_id then raise exception 'A listing cannot change owner'; end if;
  if new.status is distinct from old.status then raise exception 'Only an administrator can approve or reject a listing'; end if;
  -- changing what buyers read goes back to review; stock, hiding and purchased counters do not
  if (new.title, new.description, new.price, new.category, new.image_url)
     is distinct from (old.title, old.description, old.price, old.category, old.image_url) and old.status in ('approved','rejected') then
    new.status := 'pending';
  end if;
  return new;
end $$;
drop trigger if exists listings_guard on public.listings;
create trigger listings_guard before insert or update on public.listings for each row execute function public.guard_listing();

-- audit: stock bookkeeping done by orders is not an "edit" (the order itself is audited below)
drop trigger if exists audit_listings on public.listings;
drop trigger if exists audit_listings_ins on public.listings;
drop trigger if exists audit_listings_upd on public.listings;
drop trigger if exists audit_listings_del on public.listings;
create trigger audit_listings_ins after insert on public.listings for each row execute function public.log_change();
create trigger audit_listings_upd after update on public.listings for each row
  when (coalesce(current_setting('app.trade', true), '') <> 'on') execute function public.log_change();
create trigger audit_listings_del after delete on public.listings for each row execute function public.log_change();

-- 3. Orders and their lines -----------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity (start with 1001) unique,
  buyer_id  uuid references auth.users(id) on delete set null,
  seller_id uuid references auth.users(id) on delete set null,
  -- who was who at the time of the sale (records survive account changes)
  buyer_name text not null check (char_length(buyer_name) between 1 and 120),
  buyer_email text,
  buyer_contact text not null check (char_length(buyer_contact) between 3 and 120),
  seller_name text not null,
  seller_email text,
  note text check (char_length(note) <= 500),
  total numeric(12,2) not null check (total >= 0),
  status text not null default 'waiting_payment'
    check (status in ('waiting_payment','payment_confirmed','ready_to_ship','shipped','completed','cancelled')),
  created_at timestamptz not null default now(),
  status_at timestamptz not null default now(),
  paid_at timestamptz, ready_at timestamptz, shipped_at timestamptz, completed_at timestamptz, cancelled_at timestamptz
);
create index if not exists orders_buyer_idx  on public.orders (buyer_id, created_at desc);
create index if not exists orders_seller_idx on public.orders (seller_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  listing_id uuid not null references public.listings(id) on delete restrict,
  title text not null,                                   -- snapshot: the sale stays readable if the listing is edited
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity int not null check (quantity between 1 and 99),
  line_total numeric(12,2) generated always as (unit_price * quantity) stored
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_listing_idx on public.order_items (listing_id);

-- business records: nobody (not even an administrator or the table owner's app role) deletes or rewrites them
create or replace function public.protect_records() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Transactions are business records and cannot be deleted'; end if;
  raise exception 'Order lines cannot be edited after the order is placed';
end $$;
drop trigger if exists orders_no_delete on public.orders;
create trigger orders_no_delete before delete on public.orders for each row execute function public.protect_records();
drop trigger if exists items_no_delete on public.order_items;
create trigger items_no_delete before delete on public.order_items for each row execute function public.protect_records();
drop trigger if exists items_no_update on public.order_items;
create trigger items_no_update before update on public.order_items for each row execute function public.protect_records();

-- audit trail: placing an order and every status change (who -> what -> which order -> when)
create or replace function public.log_order_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  select email into who from public.profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, action, row_label, actor_email, record_id, changes)
    values ('orders', 'INSERT', '#' || new.order_no, coalesce(who, 'system'), new.id::text,
            jsonb_build_object('status', new.status, 'total', new.total, 'buyer', new.buyer_email, 'seller', new.seller_email));
  elsif new.status is distinct from old.status then
    insert into public.audit_log (table_name, action, row_label, actor_email, record_id, changes)
    values ('orders', 'UPDATE', '#' || new.order_no, coalesce(who, 'system'), new.id::text,
            jsonb_build_object('status', jsonb_build_object('from', old.status, 'to', new.status)));
  end if;
  return null;
end $$;
drop trigger if exists audit_orders on public.orders;
create trigger audit_orders after insert or update on public.orders for each row execute function public.log_order_change();

-- 4. Row Level Security ------------------------------------------------------------------------------------
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname='public' and tablename in ('orders','order_items','listings') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- listings: the public sees approved + visible ones; a seller also sees their own; admins see all
create policy "listings read" on public.listings for select
  using ((status = 'approved' and active) or seller_id = auth.uid() or public.is_admin());
create policy "listings seller insert" on public.listings for insert
  with check ((seller_id = auth.uid() and status = 'pending' and public.can_trade()) or public.is_admin());
create policy "listings seller or admin update" on public.listings for update
  using (seller_id = auth.uid() or public.is_admin()) with check (seller_id = auth.uid() or public.is_admin());
create policy "listings seller or admin delete" on public.listings for delete
  using (seller_id = auth.uid() or public.is_admin());

-- orders: buyer sees theirs, seller sees theirs, administrators see all. NO insert/update/delete policy:
-- the only way to write is place_order() / advance_order() below, which run the role checks.
create policy "orders read involved or admin" on public.orders for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy "order lines read via order" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id));   -- inherits the order's visibility

-- 5. Listing images ------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('listing-images', 'listing-images', true) on conflict (id) do nothing;
drop policy if exists "listing images public read"   on storage.objects;
drop policy if exists "listing images member insert" on storage.objects;
drop policy if exists "listing images owner update"  on storage.objects;
drop policy if exists "listing images owner delete"  on storage.objects;
create policy "listing images public read"   on storage.objects for select using (bucket_id = 'listing-images');
create policy "listing images member insert" on storage.objects for insert
  with check (bucket_id = 'listing-images' and public.can_trade() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "listing images owner update"  on storage.objects for update
  using (bucket_id = 'listing-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "listing images owner delete"  on storage.objects for delete
  using (bucket_id = 'listing-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- 6. Checkout: one cart -> one order per seller, stock checked and reserved atomically ----------------------
create or replace function public.place_order(p_items jsonb, p_contact text, p_note text default null, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); my_email text; bname text; agg jsonb; r record; s uuid; oid uuid; ono bigint;
  sname text; semail text; tot numeric; nfound int; wanted int; result jsonb := '[]'::jsonb;
begin
  if me is null or not public.can_trade() then raise exception 'Sign in with a member account to place an order'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Your cart is empty or too large'; end if;
  p_contact := btrim(coalesce(p_contact, ''));
  if char_length(p_contact) not between 3 and 120 then raise exception 'Add a contact (email, LINE or phone) so the seller can reach you'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'The note is too long (500 characters at most)'; end if;
  select email into my_email from public.profiles where id = me;
  bname := coalesce(nullif(btrim(p_name), ''), split_part(my_email, '@', 1), 'buyer');

  -- one line per listing, quantities merged
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'qty', qty)), '[]'::jsonb), count(*) into agg, wanted
    from (select (e->>'listing_id')::uuid as id, sum((e->>'quantity')::int) as qty from jsonb_array_elements(p_items) e group by 1) x;

  -- pass 1: lock every listing (ordered, so two buyers cannot deadlock) and validate
  nfound := 0;
  for r in
    select l.id, l.title, l.status, l.active, l.seller_id, l.available, (a->>'qty')::int as qty
      from public.listings l join jsonb_array_elements(agg) a on (a->>'id')::uuid = l.id
     order by l.id for update of l
  loop
    nfound := nfound + 1;
    if r.qty not between 1 and 99 then raise exception 'Choose a quantity between 1 and 99 for "%"', r.title; end if;
    if r.status <> 'approved' or not r.active then raise exception '"%" is no longer available', r.title; end if;
    if r.seller_id is null then raise exception '"%" is a demo listing and cannot be ordered', r.title; end if;
    if r.seller_id = me then raise exception 'You cannot buy your own listing ("%")', r.title; end if;
    if r.available < r.qty then raise exception 'Only % left of "%"', r.available, r.title; end if;
  end loop;
  if nfound <> wanted then raise exception 'Some items in your cart no longer exist'; end if;

  -- pass 2: one order per seller
  perform set_config('app.trade', 'on', true);
  for s in select distinct l.seller_id from public.listings l join jsonb_array_elements(agg) a on (a->>'id')::uuid = l.id loop
    select p.email into semail from public.profiles p where p.id = s;
    select l.seller_name into sname from public.listings l join jsonb_array_elements(agg) a on (a->>'id')::uuid = l.id where l.seller_id = s limit 1;
    select sum(l.price * (a->>'qty')::int) into tot from public.listings l join jsonb_array_elements(agg) a on (a->>'id')::uuid = l.id where l.seller_id = s;
    insert into public.orders (buyer_id, seller_id, buyer_name, buyer_email, buyer_contact, seller_name, seller_email, note, total)
    values (me, s, bname, my_email, p_contact, sname, semail, nullif(btrim(p_note), ''), tot) returning id, order_no into oid, ono;
    insert into public.order_items (order_id, listing_id, title, unit_price, quantity)
      select oid, l.id, l.title, l.price, (a->>'qty')::int from public.listings l join jsonb_array_elements(agg) a on (a->>'id')::uuid = l.id where l.seller_id = s;
    update public.listings l set purchased = l.purchased + (a->>'qty')::int
      from jsonb_array_elements(agg) a where (a->>'id')::uuid = l.id and l.seller_id = s;
    result := result || jsonb_build_object('id', oid, 'order_no', ono, 'total', tot, 'seller_name', sname);
  end loop;
  return result;
end $$;

-- 7. Order workflow: who may move an order where (administrators are deliberately absent) ----------------------
--   waiting_payment -> payment_confirmed -> ready_to_ship -> shipped -> completed
--   seller: confirms payment, prepares, ships, (and may close the sale)   buyer: confirms receipt (completed)
--   cancel: buyer or seller while waiting for payment; seller only after payment (refund is arranged offline). Stock returns.
create or replace function public.advance_order(p_order uuid, p_to text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); o public.orders; as_seller boolean; as_buyer boolean; ok boolean;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  as_seller := o.seller_id = me; as_buyer := o.buyer_id = me;
  if not (as_seller or as_buyer) then raise exception 'Only the buyer or the seller can change this order'; end if;
  ok := case
    when o.status = 'waiting_payment'   and p_to = 'payment_confirmed' then as_seller
    when o.status = 'payment_confirmed' and p_to = 'ready_to_ship'     then as_seller
    when o.status = 'ready_to_ship'     and p_to = 'shipped'           then as_seller
    when o.status = 'shipped'           and p_to = 'completed'         then true
    when o.status = 'waiting_payment'   and p_to = 'cancelled'         then true
    when o.status in ('payment_confirmed','ready_to_ship') and p_to = 'cancelled' then as_seller
    else false end;
  if not ok then raise exception 'You cannot move this order from % to %', o.status, p_to; end if;
  if p_to = 'cancelled' then
    perform set_config('app.trade', 'on', true);
    update public.listings l set purchased = greatest(0, l.purchased - i.quantity)
      from public.order_items i where i.order_id = o.id and l.id = i.listing_id;
  end if;
  update public.orders set status = p_to, status_at = now(),
    paid_at      = case when p_to = 'payment_confirmed' then now() else paid_at end,
    ready_at     = case when p_to = 'ready_to_ship'     then now() else ready_at end,
    shipped_at   = case when p_to = 'shipped'           then now() else shipped_at end,
    completed_at = case when p_to = 'completed'         then now() else completed_at end,
    cancelled_at = case when p_to = 'cancelled'         then now() else cancelled_at end
   where id = o.id;
  return jsonb_build_object('id', o.id, 'order_no', o.order_no, 'status', p_to);
end $$;

revoke all on function public.place_order(jsonb, text, text, text) from public, anon;
grant execute on function public.place_order(jsonb, text, text, text) to authenticated;
revoke all on function public.advance_order(uuid, text) from public, anon;
grant execute on function public.advance_order(uuid, text) to authenticated;
