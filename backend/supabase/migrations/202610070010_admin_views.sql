-- Invoker views preserve underlying customer/order RLS for every caller.
create view public.admin_customers with(security_invoker=true) as
 select c.*,count(o.id)::integer orders,
 coalesce(sum(o.total) filter(where o.payment_status='paid' and o.status not in ('cancelled','refunded')),0) total_spent,
 max(o.created_at) last_order_at from public.customers c left join public.orders o on o.customer_id=c.id group by c.id;
create view public.admin_orders with(security_invoker=true) as
 select o.*,coalesce((select sum(i.quantity) from public.order_items i where i.order_id=o.id),0)::integer items from public.orders o;
create view public.admin_inventory with(security_invoker=true) as
 select v.*,p.name product,
 case when not v.track_quantity then 'untracked' when v.stock=0 then 'out of stock' when v.stock<=v.low_stock_threshold then 'low stock' else 'in stock' end stock_status
 from public.product_variants v join public.products p on p.id=v.product_id;
grant select on public.admin_customers,public.admin_orders,public.admin_inventory to authenticated;
revoke all on function private.protect_last_super_admin(),private.guard_archive(),private.create_customer_profile() from public;
