-- Existing stores: run after offers.sql and offer-types.sql. Safe to repeat.
-- Explicit collection rules and independent merchandising flags.
begin;
do $upgrade$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='collections' and column_name='product_rule') then
 alter table public.collections add column product_rule text not null default 'manual';
-- Upgrade the existing system collections once; preserve manual product assignments.
update public.collections set product_rule=case slug
 when 'new-arrivals' then 'NEW' when 'best-sellers' then 'BESTSELLER'
 when 'sale' then 'SALE' when 'restocks' then 'RESTOCK'
 when 'coming-soon' then 'COMING_SOON' when 'accessories' then 'ACCESSORIES'
 when 'buy-2-get-1' then 'BUY_2_GET_1' when 'buy-2-get-1-free' then 'BUY_2_GET_1'
 else product_rule end
where product_rule='manual' and not exists(select 1 from public.product_collections pc where pc.collection_id=collections.id);

 end if;
end $upgrade$;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.collections'::regclass and conname='collection_product_rule') then
  alter table public.collections add constraint collection_product_rule check(product_rule in ('manual','NEW','BESTSELLER','SALE','RESTOCK','COMING_SOON','ACCESSORIES','BUY_GET','BUY_2_GET_1'));
 end if;
end $$;

create or replace function private.catalog_tag_matches(p public.products,p_tag text)
returns boolean language sql stable security invoker set search_path='' as $$
 select case upper(replace(replace(trim(coalesce(p_tag,'')),'-','_'),' ','_'))
 when '' then true
 when 'NEW' then p.new_arrival
 when 'BESTSELLER' then p.best_seller
 when 'SALE' then p.compare_at_price>p.price or private.effective_product_price(p.id,null)<p.price
 when 'RESTOCK' then exists(select 1 from unnest(p.tags) t where upper(replace(replace(trim(t),'-','_'),' ','_'))='RESTOCK') and exists(select 1 from public.product_variants v where v.product_id=p.id and v.active and (not v.track_quantity or v.stock>0))
 when 'ACCESSORIES' then upper(p.product_type)='ACCESSORIES' or exists(select 1 from public.categories c where c.id=p.category_id and (c.slug='accessories' or lower(c.name)='accessories')) or exists(select 1 from unnest(p.tags) t where upper(replace(replace(trim(t),'-','_'),' ','_'))='ACCESSORIES')
 when 'BUY_GET' then exists(select 1 from public.offer_products op join public.offers o on o.id=op.offer_id where op.product_id=p.id and o.discount_type='buy_get' and o.active and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now()))
 when 'BUY_2_GET_1' then exists(select 1 from public.offer_products op join public.offers o on o.id=op.offer_id where op.product_id=p.id and o.discount_type='buy_get' and o.buy_quantity=2 and o.get_quantity=1 and o.active and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now()))
 else exists(select 1 from unnest(p.tags) t where upper(replace(replace(trim(t),'-','_'),' ','_'))=upper(replace(replace(trim(p_tag),'-','_'),' ','_'))) end;
$$;
revoke all on function private.catalog_tag_matches(public.products,text) from public;
grant execute on function private.catalog_tag_matches(public.products,text) to anon,authenticated;

create or replace function public.search_catalog(p_query text default '',p_category uuid default null,p_collection uuid default null,p_type text default '',p_tag text default '',p_size text default '',p_color text default '',p_max_price numeric default null,p_sort text default 'featured',p_page integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 with scope as (
 select p.*,private.effective_product_price(p.id,null) effective_price from public.products p
 where p.active and not p.archived
 and (coalesce(p_query,'')='' or p.name ilike '%'||left(p_query,100)||'%' or p.name_ar ilike '%'||left(p_query,100)||'%')
 and (p_category is null or exists(select 1 from public.categories c where c.id=p_category and c.active and c.id=p.category_id))
 and (p_collection is null or exists(select 1 from public.collections c where c.id=p_collection and c.active and (
  (c.product_rule='manual' and exists(select 1 from public.product_collections pc where pc.product_id=p.id and pc.collection_id=c.id))
  or (c.product_rule<>'manual' and private.catalog_tag_matches(p,c.product_rule)))))
 and (coalesce(p_type,'')='' or p.product_type=p_type)
 and private.catalog_tag_matches(p,p_tag)
 ), matching as (
 select * from scope p where (p_max_price is null or p.effective_price<=p_max_price)
 and ((coalesce(p_size,'')='' and coalesce(p_color,'')='') or exists(select 1 from public.product_variants v where v.product_id=p.id and v.active and (not v.track_quantity or v.stock>0) and (coalesce(p_size,'')='' or v.size=p_size) and (coalesce(p_color,'')='' or v.color_name=p_color)))
 ), page as (
 select id from matching order by
 case when p_sort='low' then effective_price end asc,
 case when p_sort='high' then effective_price end desc,
 case when p_sort='name' then name end asc,
 case when p_sort='featured' then featured::integer end desc,
 created_at desc,id limit 24 offset greatest(0,least(p_page,10000))*24
 ), variants as (
 select distinct v.size,v.color_name from public.product_variants v join scope p on p.id=v.product_id where v.active and (not v.track_quantity or v.stock>0)
 ) select jsonb_build_object('ids',coalesce((select jsonb_agg(id) from page),'[]'::jsonb),'count',(select count(*) from matching),
 'facets',jsonb_build_object('sizes',coalesce((select jsonb_agg(size order by size) from (select distinct size from variants) s),'[]'::jsonb),
 'colors',coalesce((select jsonb_agg(color_name order by color_name) from (select distinct color_name from variants) c),'[]'::jsonb),
 'maxPrice',coalesce((select ceil(max(effective_price)/100)*100 from scope),1000)));
$$;
revoke all on function public.search_catalog(text,uuid,uuid,text,text,text,text,numeric,text,integer) from public;
grant execute on function public.search_catalog(text,uuid,uuid,text,text,text,text,numeric,text,integer) to anon,authenticated;

-- Reject preview-only products centrally, for both quotes and placed orders.
do $guard$
declare definition text;
begin
 select replace(pg_get_functiondef('private.price_basket(jsonb)'::regprocedure), E'\r\n', E'\n') into definition;
 if position('Coming soon products cannot be ordered' in definition)=0 then
  definition:=replace(definition, E'begin\n', E'begin\n if exists(select 1 from jsonb_array_elements(p_items) j join public.product_variants v on v.id=(j->>''variant_id'')::uuid join public.products p on p.id=v.product_id where private.catalog_tag_matches(p,''COMING_SOON'')) then raise exception ''Coming soon products cannot be ordered''; end if;\n');
  execute definition;
 end if;
end $guard$;
notify pgrst, 'reload schema';
commit;

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
