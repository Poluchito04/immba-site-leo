-- v8 (class 11, testing & verification): fixes found while testing the marketplace. Safe to re-run. Requires v6.sql + v7.sql.
--
-- Bug found by reading the guard against the "Access Control" test cases (S12 / B14):
--   guard_listing() sent an edited listing back to review when title, description, price, category or image changed,
--   but NOT when seller_name changed. A seller could get "My Shop" approved and then rename it to "imMBA Demo Store"
--   (or to another seller's name) without anybody re-checking it — and orders copy seller_name from the listing.
-- Fix: seller_name is part of what buyers read, so changing it also goes back to review; and only administrators
--   may use the reserved name of the demo store.

create or replace function public.guard_listing() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.purchased <> 0 then raise exception 'purchased must start at 0'; end if;
    if not public.is_admin() and lower(btrim(new.seller_name)) = 'immba demo store' then
      raise exception 'This seller name is reserved for the demo store';
    end if;
    return new;
  end if;
  if new.purchased is distinct from old.purchased and coalesce(current_setting('app.trade', true), '') <> 'on' then
    raise exception 'Purchased quantity is maintained by orders only';
  end if;
  if public.is_admin() then return new; end if;            -- moderators may change the status
  if new.seller_id is distinct from old.seller_id then raise exception 'A listing cannot change owner'; end if;
  if new.status is distinct from old.status then raise exception 'Only an administrator can approve or reject a listing'; end if;
  if new.seller_name is distinct from old.seller_name and lower(btrim(new.seller_name)) = 'immba demo store' then
    raise exception 'This seller name is reserved for the demo store';
  end if;
  -- changing what buyers read goes back to review; stock, hiding and purchased counters do not
  if (new.title, new.description, new.price, new.category, new.image_url, new.seller_name)
     is distinct from (old.title, old.description, old.price, old.category, old.image_url, old.seller_name) and old.status in ('approved','rejected') then
    new.status := 'pending';
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
