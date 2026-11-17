-- v7 (class 10, part 2): payment confirmed by the platform, shipping method, platform fee, demo store with real photos.
-- Safe to re-run. Requires v6.sql.
--
-- What changes against v6 (the instructor's slides + the student's decision):
--   * Payment: the buyer pays the platform and presses "I have paid" (waiting_payment -> payment_submitted);
--     an ADMINISTRATOR confirms the money arrived (payment_submitted -> payment_confirmed). Sellers no longer confirm payment.
--   * Slide "Shopping cart": shipping method (in-person pickup free / home delivery with a fee).
--   * Slide "Platform admin": a per-transaction platform fee set by the super admin; the order shows subtotal, shipping, fee and Total Due.
--   * An "imMBA Demo Store" seller account (nobody can log into it; the super admin operates it) so the whole flow can be shown with one account.

-- 1. Marketplace settings (one row) ------------------------------------------------------------------
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  title text not null default 'Marketplace settings',
  platform_fee numeric(8,2) not null default 4 check (platform_fee between 0 and 1000),
  delivery_fee numeric(8,2) not null default 80 check (delivery_fee between 0 and 10000),
  payment_instructions text not null default 'Pay the Total Due to the platform account by bank transfer or LINE Pay (details are set by the administrator), then press "I have paid" and add your payment reference. An administrator confirms the payment before the seller prepares your order.'
    check (char_length(payment_instructions) <= 1000),
  demo_store_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings for each row execute function public.touch_updated_at();
drop trigger if exists audit_app_settings on public.app_settings;
create trigger audit_app_settings after update on public.app_settings for each row execute function public.log_change();
alter table public.app_settings enable row level security;
drop policy if exists "settings read" on public.app_settings;
drop policy if exists "settings super update" on public.app_settings;
create policy "settings read" on public.app_settings for select using (true);   -- fees and pay instructions are shown to buyers
create policy "settings super update" on public.app_settings for update using (public.is_super_admin()) with check (public.is_super_admin());

-- 2. Demo store (a seller nobody logs into; the super admin runs it) -------------------------------------
do $$ declare sid uuid; begin
  select demo_store_id into sid from public.app_settings where id = 1;
  if sid is null or not exists (select 1 from auth.users where id = sid) then
    sid := gen_random_uuid();
    insert into auth.users (id, email, raw_user_meta_data) values (sid, 'demo-store@immba.invalid', '{"kind":"member"}');
    update public.app_settings set demo_store_id = sid where id = 1;
  end if;
end $$;

create or replace function public.demo_store_id() returns uuid
language sql stable security definer set search_path = public as $$ select demo_store_id from public.app_settings where id = 1 $$;
-- "acts as the seller": the seller themself, or the super admin for the demo store
create or replace function public.operates(p_seller uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select p_seller is not null and auth.uid() is not null and (p_seller = auth.uid() or (p_seller = public.demo_store_id() and public.is_super_admin())) $$;

-- 3. Orders: shipping, fees, payment evidence ---------------------------------------------------------------
alter table public.orders add column if not exists subtotal numeric(12,2);
update public.orders set subtotal = total where subtotal is null;
alter table public.orders alter column subtotal set not null;
alter table public.orders alter column subtotal set default 0;
alter table public.orders add column if not exists shipping_method text not null default 'pickup';
alter table public.orders drop constraint if exists orders_shipping_method_check;
alter table public.orders add constraint orders_shipping_method_check check (shipping_method in ('pickup','delivery'));
alter table public.orders add column if not exists shipping_fee numeric(8,2) not null default 0 check (shipping_fee >= 0);
alter table public.orders add column if not exists shipping_address text check (char_length(shipping_address) <= 300);
alter table public.orders add column if not exists platform_fee numeric(8,2) not null default 0 check (platform_fee >= 0);
alter table public.orders add column if not exists payment_ref text check (char_length(payment_ref) <= 120);
alter table public.orders add column if not exists payment_submitted_at timestamptz;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('waiting_payment','payment_submitted','payment_confirmed','ready_to_ship','shipped','completed','cancelled'));
-- total = Total Due = subtotal + shipping + platform fee
alter table public.orders drop constraint if exists orders_total_sum_check;
alter table public.orders add constraint orders_total_sum_check check (total = subtotal + shipping_fee + platform_fee) not valid;

-- 4. Checkout with shipping method and platform fee ------------------------------------------------------------
drop function if exists public.place_order(jsonb, text, text, text);
create or replace function public.place_order(p_items jsonb, p_contact text, p_note text default null, p_name text default null,
                                              p_shipping text default 'pickup', p_address text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); my_email text; bname text; agg jsonb; r record; s uuid; oid uuid; ono bigint;
  sname text; semail text; tot numeric; nfound int; wanted int; result jsonb := '[]'::jsonb;
  pfee numeric; dfee numeric; ship numeric; addr text;
begin
  if me is null or not public.can_trade() then raise exception 'Sign in with a member account to place an order'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Your cart is empty or too large'; end if;
  p_contact := btrim(coalesce(p_contact, ''));
  if char_length(p_contact) not between 3 and 120 then raise exception 'Add a contact (email, LINE or phone) so the seller can reach you'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'The note is too long (500 characters at most)'; end if;
  if p_shipping not in ('pickup', 'delivery') then raise exception 'Choose a shipping method'; end if;
  addr := nullif(btrim(coalesce(p_address, '')), '');
  if p_shipping = 'delivery' and (addr is null or char_length(addr) not between 5 and 300) then raise exception 'Add a delivery address (5 to 300 characters)'; end if;
  if p_shipping = 'pickup' then addr := null; end if;
  select platform_fee, delivery_fee into pfee, dfee from public.app_settings where id = 1;
  ship := case when p_shipping = 'delivery' then coalesce(dfee, 0) else 0 end;
  select email into my_email from public.profiles where id = me;
  bname := coalesce(nullif(btrim(p_name), ''), split_part(my_email, '@', 1), 'buyer');

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'qty', qty)), '[]'::jsonb), count(*) into agg, wanted
    from (select (e->>'listing_id')::uuid as id, sum((e->>'quantity')::int) as qty from jsonb_array_elements(p_items) e group by 1) x;

  nfound := 0;
  for r in
    select l.id, l.title, l.status, l.active, l.seller_id, l.available, (a->>'qty')::int as qty
      from public.listings l join jsonb_array_elements(agg) a on (a->>'id')::uuid = l.id
     order by l.id for update of l
  loop
    nfound := nfound + 1;
    if r.qty not between 1 and 99 then raise exception 'Choose a quantity between 1 and 99 for "%"', r.title; end if;
    if r.status <> 'approved' or not r.active then raise exception '"%" is no longer available', r.title; end if;
    if r.seller_id is null then raise exception '"%" has no seller and cannot be ordered', r.title; end if;
    if r.seller_id = me then raise exception 'You cannot buy your own listing ("%")', r.title; end if;
    if r.available < r.qty then raise exception 'Only % left of "%"', r.available, r.title; end if;
  end loop;
  if nfound <> wanted then raise exception 'Some items in your cart no longer exist'; end if;

  perform set_config('app.trade', 'on', true);
  for s in select distinct l.seller_id from public.listings l join jsonb_array_elements(agg) a on (a->>'id')::uuid = l.id loop
    select p.email into semail from public.profiles p where p.id = s;
    select l.seller_name into sname from public.listings l join jsonb_array_elements(agg) a on (a->>'id')::uuid = l.id where l.seller_id = s limit 1;
    select sum(l.price * (a->>'qty')::int) into tot from public.listings l join jsonb_array_elements(agg) a on (a->>'id')::uuid = l.id where l.seller_id = s;
    insert into public.orders (buyer_id, seller_id, buyer_name, buyer_email, buyer_contact, seller_name, seller_email, note,
                               subtotal, shipping_method, shipping_fee, shipping_address, platform_fee, total)
    values (me, s, bname, my_email, p_contact, sname, semail, nullif(btrim(p_note), ''),
            tot, p_shipping, ship, addr, coalesce(pfee, 0), tot + ship + coalesce(pfee, 0)) returning id, order_no into oid, ono;
    insert into public.order_items (order_id, listing_id, title, unit_price, quantity)
      select oid, l.id, l.title, l.price, (a->>'qty')::int from public.listings l join jsonb_array_elements(agg) a on (a->>'id')::uuid = l.id where l.seller_id = s;
    update public.listings l set purchased = l.purchased + (a->>'qty')::int
      from jsonb_array_elements(agg) a where (a->>'id')::uuid = l.id and l.seller_id = s;
    result := result || jsonb_build_object('id', oid, 'order_no', ono, 'total', tot + ship + coalesce(pfee, 0), 'seller_name', sname);
  end loop;
  return result;
end $$;

-- 5. Workflow: buyer says "I have paid", the ADMINISTRATOR confirms the money, the seller ships --------------------
--   waiting_payment -> payment_submitted (buyer: "I have paid")
--   payment_submitted -> payment_confirmed (admin) | back to waiting_payment (admin: payment not received)
--   payment_confirmed -> ready_to_ship -> shipped (seller or, for the demo store, the super admin)
--   shipped -> completed (buyer confirms receipt; the seller may also close the sale)
--   cancel: buyer or seller while waiting for payment; seller or admin once paid (refund handled by the platform). Stock returns.
drop function if exists public.advance_order(uuid, text);
create or replace function public.advance_order(p_order uuid, p_to text, p_ref text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); o public.orders; as_seller boolean; as_buyer boolean; as_admin boolean; ok boolean; ref text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  as_seller := public.operates(o.seller_id); as_buyer := o.buyer_id = me; as_admin := public.is_admin();
  if not (as_seller or as_buyer or as_admin) then raise exception 'Only the buyer, the seller or an administrator can change this order'; end if;
  ok := case
    when o.status = 'waiting_payment'   and p_to = 'payment_submitted' then as_buyer
    when o.status = 'payment_submitted' and p_to = 'payment_confirmed' then as_admin
    when o.status = 'payment_submitted' and p_to = 'waiting_payment'   then as_admin
    when o.status = 'payment_confirmed' and p_to = 'ready_to_ship'     then as_seller
    when o.status = 'ready_to_ship'     and p_to = 'shipped'           then as_seller
    when o.status = 'shipped'           and p_to = 'completed'         then as_buyer or as_seller
    when o.status = 'waiting_payment'   and p_to = 'cancelled'         then as_buyer or as_seller
    when o.status = 'payment_submitted' and p_to = 'cancelled'         then as_admin
    when o.status in ('payment_confirmed','ready_to_ship') and p_to = 'cancelled' then as_seller or as_admin
    else false end;
  if not ok then raise exception 'You cannot move this order from % to %', o.status, p_to; end if;
  ref := nullif(btrim(coalesce(p_ref, '')), '');
  if ref is not null and char_length(ref) > 120 then raise exception 'The payment reference is too long (120 characters at most)'; end if;
  if p_to = 'cancelled' then
    perform set_config('app.trade', 'on', true);
    update public.listings l set purchased = greatest(0, l.purchased - i.quantity)
      from public.order_items i where i.order_id = o.id and l.id = i.listing_id;
  end if;
  update public.orders set status = p_to, status_at = now(),
    payment_ref          = case when p_to = 'payment_submitted' then ref when p_to = 'waiting_payment' then null else payment_ref end,
    payment_submitted_at = case when p_to = 'payment_submitted' then now() when p_to = 'waiting_payment' then null else payment_submitted_at end,
    paid_at      = case when p_to = 'payment_confirmed' then now() else paid_at end,
    ready_at     = case when p_to = 'ready_to_ship'     then now() else ready_at end,
    shipped_at   = case when p_to = 'shipped'           then now() else shipped_at end,
    completed_at = case when p_to = 'completed'         then now() else completed_at end,
    cancelled_at = case when p_to = 'cancelled'         then now() else cancelled_at end
   where id = o.id;
  return jsonb_build_object('id', o.id, 'order_no', o.order_no, 'status', p_to);
end $$;

revoke all on function public.place_order(jsonb, text, text, text, text, text) from public, anon;
grant execute on function public.place_order(jsonb, text, text, text, text, text) to authenticated;
revoke all on function public.advance_order(uuid, text, text) from public, anon;
grant execute on function public.advance_order(uuid, text, text) to authenticated;

-- 6. Demo store catalogue with real photos (files live in /public/market, credits in CREDITS.md) -------------------
update public.listings set seller_id = (select demo_store_id from public.app_settings where id = 1)
 where seller_id is null;
update public.listings set seller_name = 'imMBA Demo Store' where seller_id = (select demo_store_id from public.app_settings where id = 1);
update public.listings set title = 'Principles of Marketing (Kotler)', image_url = '/market/textbooks.jpg', quantity = 5,
  description = 'Textbook, 15th edition, light highlighting. Demo product of the imMBA Demo Store (class project).'
 where title = 'Principles of Marketing (Kotler) - sample listing';
update public.listings set title = 'Statistics for Managers: lecture notes', image_url = '/market/notes.jpg', quantity = 8,
  description = 'Typed notes for the full semester. Demo product of the imMBA Demo Store (class project).'
 where title = 'Statistics for Managers - lecture notes - sample listing';
update public.listings set title = 'USB-C hub for laptops', image_url = '/market/usb-hub.jpg', quantity = 6,
  description = 'Aluminium USB-C hub: HDMI, 2 x USB 3.0 and an SD card reader. Demo product of the imMBA Demo Store (class project).'
 where title = 'USB-C hub for laptops - sample listing';

insert into public.listings (title, description, price, category, seller_name, seller_id, status, quantity, image_url)
select v.title, v.description, v.price, v.category, 'imMBA Demo Store', (select demo_store_id from public.app_settings where id = 1), 'approved', v.quantity, v.image_url
from (values
  ('Wireless Bluetooth earbuds', 'True wireless earbuds with a charging case. Demo product of the imMBA Demo Store (class project).', 1500, 'electronics', 4, '/market/earbuds.jpg'),
  ('Laptop and desk setup, second hand', 'Used laptop in good condition, charger included. Demo product of the imMBA Demo Store (class project).', 25000, 'electronics', 1, '/market/laptop.jpg'),
  ('Tablet with keyboard cover', '2-in-1 tablet with detachable keyboard and pen. Demo product of the imMBA Demo Store (class project).', 9800, 'electronics', 2, '/market/tablet.jpg'),
  ('Rechargeable handheld fan', 'USB rechargeable fan, three speeds: useful for the Taipei summer. Demo product of the imMBA Demo Store (class project).', 250, 'other', 10, '/market/fan.jpg'),
  ('Student backpack', 'Canvas and leather backpack, fits a 13-inch laptop. Demo product of the imMBA Demo Store (class project).', 890, 'other', 3, '/market/backpack.jpg')
) as v(title, description, price, category, quantity, image_url)
where not exists (select 1 from public.listings l where l.title = v.title);

-- 7. Tidy numbering when nothing has been ordered yet -----------------------------------------------------------------
do $$ begin
  if not exists (select 1 from public.orders) then alter table public.orders alter column order_no restart with 1001; end if;
end $$;

notify pgrst, 'reload schema';
