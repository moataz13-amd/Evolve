create function public.admin_overview(p_days integer default 30) returns jsonb language plpgsql security definer set search_path='' as $$
declare since timestamptz; previous_since timestamptz; payload jsonb; manage boolean; begin
 if not private.can_edit() then raise exception 'Team access required'; end if;
 if p_days not in (7,30,90,365) then raise exception 'Invalid range'; end if;
 since:=case when p_days=365 then date_trunc('year',now()) else now()-make_interval(days=>p_days) end;
 previous_since:=since-(now()-since); manage:=private.can_manage();
 select jsonb_build_object(
 'currency',coalesce((select currency from public.site_settings limit 1),'USD'),
 'stats',jsonb_build_object(
 'revenue',case when manage then coalesce((select sum(total) from public.orders where payment_status='paid' and status not in ('cancelled','refunded') and created_at>=since),0) else 0 end,
 'orders',case when manage then (select count(*) from public.orders) else 0 end,
 'customers',case when manage then (select count(*) from public.customers) else 0 end,
 'products',(select count(*) from public.products where not archived),
 'low_stock',(select count(*) from public.product_variants where active and track_quantity and stock>0 and stock<=low_stock_threshold),
 'out_of_stock',(select count(*) from public.product_variants where active and track_quantity and stock=0)),
 'previous_revenue',case when manage then coalesce((select sum(total) from public.orders where payment_status='paid' and status not in ('cancelled','refunded') and created_at>=previous_since and created_at<since),0) else 0 end,
 'sales',case when manage then coalesce((select jsonb_agg(to_jsonb(s)) from(select created_at::date::text as day,sum(total) revenue from public.orders where payment_status='paid' and status not in ('cancelled','refunded') and created_at>=since group by 1 order by 1) s),'[]'::jsonb) else '[]'::jsonb end,
 'recent_orders',case when manage then coalesce((select jsonb_agg(to_jsonb(o)) from(select id,order_number,name,status,total,created_at from public.orders order by created_at desc limit 8) o),'[]'::jsonb) else '[]'::jsonb end,
 'top_products',case when manage then coalesce((select jsonb_agg(to_jsonb(p)) from(select i.product_name,sum(i.quantity) quantity from public.order_items i join public.orders o on o.id=i.order_id where o.payment_status='paid' and o.status not in ('cancelled','refunded') and o.created_at>=since group by 1 order by 2 desc limit 6)p),'[]'::jsonb) else '[]'::jsonb end,
 'low_stock',coalesce((select jsonb_agg(to_jsonb(v)) from(select id,sku,stock from public.product_variants where active and track_quantity and stock<=low_stock_threshold order by stock limit 8)v),'[]'::jsonb),
 'activity',coalesce((select jsonb_agg(to_jsonb(a)) from(select id,action,entity_type,created_at from public.admin_activity_logs order by created_at desc limit 8)a),'[]'::jsonb)
 ) into payload; return payload;
end $$;
revoke all on function public.admin_overview(integer) from public;
grant execute on function public.admin_overview(integer) to authenticated;

