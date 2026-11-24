-- OPTIONAL. Removes the end-to-end test order #1001 (2 x Rechargeable handheld fan, payment reference CLASS11-TEST)
-- created on 24 Nov 2026 and puts the fan's stock back to 0 purchased.
-- NOT run by Claude: it disables the "business records cannot be deleted" triggers for one transaction and deletes that order's
-- audit rows. Decide first: keeping #1001 gives the professor a real completed transaction to look at; deleting it gives a clean shop.
begin;
alter table public.orders disable trigger orders_no_delete;
alter table public.order_items disable trigger items_no_delete;
delete from public.order_items where order_id in (select id from public.orders where order_no = 1001 and payment_ref = 'CLASS11-TEST');
delete from public.orders where order_no = 1001 and payment_ref = 'CLASS11-TEST';
alter table public.orders enable trigger orders_no_delete;
alter table public.order_items enable trigger items_no_delete;
select set_config('app.trade', 'on', true);
update public.listings set purchased = 0 where title like 'Rechargeable%';
delete from public.audit_log where table_name = 'orders' and row_label = '#1001';
alter table public.orders alter column order_no restart with 1001;
commit;
