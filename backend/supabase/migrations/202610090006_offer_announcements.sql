-- Product discovery for a specific live offer. Keeps the existing RPC signature.
begin;
create or replace function private.catalog_tag_matches(p public.products,p_tag text)
returns boolean language sql stable security invoker set search_path='' as $$
 select case when left(coalesce(p_tag,''),6)='OFFER:' then exists(select 1 from public.offer_products op join public.offers o on o.id=op.offer_id where op.product_id=p.id and o.id::text=substring(p_tag from 7) and o.active and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now())) else case upper(replace(replace(trim(coalesce(p_tag,'')),'-','_'),' ','_'))
 when '' then true
 when 'NEW' then p.new_arrival
 when 'BESTSELLER' then p.best_seller
 when 'SALE' then p.compare_at_price>p.price or private.effective_product_price(p.id,null)<p.price
 when 'RESTOCK' then exists(select 1 from unnest(p.tags) t where upper(replace(replace(trim(t),'-','_'),' ','_'))='RESTOCK') and exists(select 1 from public.product_variants v where v.product_id=p.id and v.active and (not v.track_quantity or v.stock>0))
 when 'ACCESSORIES' then upper(p.product_type)='ACCESSORIES' or exists(select 1 from public.categories c where c.id=p.category_id and (c.slug='accessories' or lower(c.name)='accessories')) or exists(select 1 from unnest(p.tags) t where upper(replace(replace(trim(t),'-','_'),' ','_'))='ACCESSORIES')
 when 'BUY_GET' then exists(select 1 from public.offer_products op join public.offers o on o.id=op.offer_id where op.product_id=p.id and o.discount_type='buy_get' and o.active and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now()))
 when 'BUY_2_GET_1' then exists(select 1 from public.offer_products op join public.offers o on o.id=op.offer_id where op.product_id=p.id and o.discount_type='buy_get' and o.buy_quantity=2 and o.get_quantity=1 and o.active and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now()))
 else exists(select 1 from unnest(p.tags) t where upper(replace(replace(trim(t),'-','_'),' ','_'))=upper(replace(replace(trim(p_tag),'-','_'),' ','_'))) end end;
$$;
revoke all on function private.catalog_tag_matches(public.products,text) from public;
grant execute on function private.catalog_tag_matches(public.products,text) to anon,authenticated;

notify pgrst, 'reload schema';
commit;
