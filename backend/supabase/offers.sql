-- Complete, repeatable offer updates, including quantity gifts.
begin;
-- Automatic product offers and configurable card badges. Safe to repeat.

alter table public.products
 add column if not exists badge_mode text not null default 'auto' check(badge_mode in ('auto','hidden','custom')),
 add column if not exists badge_label text not null default '' check(length(badge_label)<=40),
 add column if not exists badge_label_ar text not null default '' check(length(badge_label_ar)<=40),
 add column if not exists badge_variant text not null default 'new' check(badge_variant in ('new','bestseller','sale','restock','coming-soon'));
create table if not exists public.offers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 discount_type text not null check(discount_type in ('percentage','fixed')),
 discount_value numeric(12,2) not null check(discount_value>0 and (discount_type<>'percentage' or discount_value<=100)),
 active boolean not null default true, starts_at timestamptz, ends_at timestamptz,
 show_badge boolean not null default true, badge_label text not null default 'Offer' check(length(badge_label)<=40),
 badge_label_ar text not null default 'عرض' check(length(badge_label_ar)<=40),
 badge_variant text not null default 'sale' check(badge_variant in ('new','bestseller','sale','restock','coming-soon')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(starts_at is null or ends_at is null or ends_at>starts_at)
);
create table if not exists public.offer_products (
 offer_id uuid not null references public.offers on delete cascade,
 product_id uuid not null references public.products on delete cascade,
 primary key(offer_id,product_id)
);
create index if not exists offer_products_product_idx on public.offer_products(product_id);
alter table public.offers enable row level security;
alter table public.offer_products enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='offers' and policyname='offers_read') then
 create policy offers_read on public.offers for select to anon,authenticated using(private.can_manage() or (active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())));
 create policy offers_manage on public.offers for all to authenticated using(private.can_manage()) with check(private.can_manage());
 create policy offer_products_read on public.offer_products for select to anon,authenticated using(private.can_manage() or (exists(select 1 from public.products p where p.id=product_id and p.active and not p.archived) and exists(select 1 from public.offers o where o.id=offer_id)));
 create policy offer_products_manage on public.offer_products for all to authenticated using(private.can_manage()) with check(private.can_manage());
 end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.offers'::regclass and tgname='touch_updated_at') then
 create trigger touch_updated_at before update on public.offers for each row execute function private.touch_updated_at();
 create trigger audit_changes after insert or update or delete on public.offers for each row execute function private.audit_change();
 end if;
end $$;
grant select on public.offers,public.offer_products to anon;
grant select,insert,update,delete on public.offers,public.offer_products to authenticated;
create or replace function private.effective_product_price(p_product uuid,p_variant uuid default null) returns numeric
language plpgsql stable security definer set search_path='' as $$
declare base numeric; result numeric; begin
 select coalesce(v.price_override,p.price) into base from public.products p left join public.product_variants v on v.product_id=p.id and v.id=p_variant where p.id=p_product and (private.can_edit() or (p.active and not p.archived));
 if base is null then return null; end if;
 select min(greatest(0,round(base-case when o.discount_type='percentage' then base*o.discount_value/100 else o.discount_value end,2))) into result
 from public.offers o join public.offer_products op on op.offer_id=o.id
 where op.product_id=p_product and o.active and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now());
 return least(base,coalesce(result,base));
end $$;
revoke all on function private.effective_product_price(uuid,uuid) from public;
grant execute on function private.effective_product_price(uuid,uuid) to anon,authenticated;
create or replace function public.set_offer_products(p_offer uuid,p_products uuid[]) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.can_manage() then raise exception 'Administrator access required'; end if;
 if coalesce(array_length(p_products,1),0)>1000 then raise exception 'Choose at most 1000 products'; end if;
 perform 1 from public.offers where id=p_offer for update;
 if not found then raise exception 'Offer not found'; end if;
 if exists(select 1 from unnest(p_products) id where not exists(select 1 from public.products p where p.id=id)) then raise exception 'A selected product does not exist'; end if;
 delete from public.offer_products where offer_id=p_offer;
 insert into public.offer_products(offer_id,product_id) select p_offer,id from (select distinct unnest(p_products) id) ids;
end $$;
revoke all on function public.set_offer_products(uuid,uuid[]) from public;
grant execute on function public.set_offer_products(uuid,uuid[]) to authenticated;

-- Atomically saves the relational product editor. Stock always creates a movement.
create or replace function public.save_product(p_id uuid,p_product jsonb,p_variants jsonb,p_images jsonb,p_collections uuid[],p_cost numeric default null) returns uuid
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
<<editor>>
declare product_id uuid; entry jsonb; variant_id uuid; old_stock integer; wanted_stock integer; begin
 if not private.can_edit() then raise exception 'Catalog editor access required'; end if;
 product_id:=coalesce(p_id,gen_random_uuid());
 if not private.can_manage() and coalesce((p_product->>'archived')::boolean,false) is distinct from coalesce((select p.archived from public.products p where p.id=product_id),false) then raise exception 'Archive requires administrator access'; end if;
 insert into public.products(id,name,name_ar,slug,short_description,description,description_ar,category_id,product_type,gender,price,compare_at_price,active,featured,best_seller,new_arrival,archived,tags,meta_title,meta_description,og_image_id,badge_mode,badge_label,badge_label_ar,badge_variant)
 values(product_id,p_product->>'name',coalesce(p_product->>'name_ar',''),p_product->>'slug',coalesce(p_product->>'short_description',''),coalesce(p_product->>'description',''),coalesce(p_product->>'description_ar',''),nullif(p_product->>'category_id','')::uuid,coalesce(p_product->>'product_type','T-Shirts'),coalesce(p_product->>'gender','Men'),(p_product->>'price')::numeric,nullif(p_product->>'compare_at_price','')::numeric,coalesce((p_product->>'active')::boolean,false),coalesce((p_product->>'featured')::boolean,false),coalesce((p_product->>'best_seller')::boolean,false),coalesce((p_product->>'new_arrival')::boolean,false),coalesce((p_product->>'archived')::boolean,false),array(select jsonb_array_elements_text(coalesce(p_product->'tags','[]'))),coalesce(p_product->>'meta_title',''),coalesce(p_product->>'meta_description',''),nullif(p_product->>'og_image_id','')::uuid,coalesce(p_product->>'badge_mode','auto'),coalesce(p_product->>'badge_label',''),coalesce(p_product->>'badge_label_ar',''),coalesce(p_product->>'badge_variant','new'))
 on conflict(id) do update set name=excluded.name,name_ar=excluded.name_ar,slug=excluded.slug,short_description=excluded.short_description,description=excluded.description,description_ar=excluded.description_ar,category_id=excluded.category_id,product_type=excluded.product_type,gender=excluded.gender,price=excluded.price,compare_at_price=excluded.compare_at_price,active=excluded.active,featured=excluded.featured,best_seller=excluded.best_seller,new_arrival=excluded.new_arrival,archived=excluded.archived,tags=excluded.tags,meta_title=excluded.meta_title,meta_description=excluded.meta_description,og_image_id=excluded.og_image_id,badge_mode=excluded.badge_mode,badge_label=excluded.badge_label,badge_label_ar=excluded.badge_label_ar,badge_variant=excluded.badge_variant;
 if p_cost is not null then
 if not private.can_manage() then raise exception 'Cost editing requires an admin'; end if;
 insert into public.product_costs(product_id,cost) values(product_id,p_cost) on conflict on constraint product_costs_pkey do update set cost=excluded.cost;
 end if;
 update public.product_variants set active=false where product_variants.product_id=editor.product_id;
 for entry in select * from jsonb_array_elements(p_variants) loop
 variant_id:=coalesce(nullif(entry->>'id','')::uuid,gen_random_uuid());
 select stock into old_stock from public.product_variants where id=variant_id and product_variants.product_id=editor.product_id for update;
 old_stock:=coalesce(old_stock,0); wanted_stock:=(entry->>'stock')::integer;
 if not private.can_manage() and wanted_stock<>old_stock then raise exception 'Inventory adjustment requires an admin'; end if;
 if exists(select 1 from public.product_variants where id=variant_id and product_variants.product_id<>editor.product_id) then raise exception 'Variant belongs to a different product'; end if;
 insert into public.product_variants(id,product_id,sku,size,color_name,color_hex,stock,low_stock_threshold,track_quantity,price_override,active)
 values(variant_id,product_id,entry->>'sku',entry->>'size',entry->>'color_name',entry->>'color_hex',wanted_stock,coalesce((entry->>'low_stock_threshold')::integer,5),coalesce((entry->>'track_quantity')::boolean,true),nullif(entry->>'price_override','')::numeric,coalesce((entry->>'active')::boolean,true))
 on conflict(id) do update set sku=excluded.sku,size=excluded.size,color_name=excluded.color_name,color_hex=excluded.color_hex,stock=excluded.stock,low_stock_threshold=excluded.low_stock_threshold,track_quantity=excluded.track_quantity,price_override=excluded.price_override,active=excluded.active;
 if wanted_stock<>old_stock then insert into public.inventory_movements(variant_id,delta,stock_after,reason,admin_id) values(variant_id,wanted_stock-old_stock,wanted_stock,'Product editor adjustment',auth.uid()); end if;
 end loop;
 -- Omitted variants remain inactive, preserving historical references.
 delete from public.product_images where product_images.product_id=editor.product_id;
 insert into public.product_images(product_id,media_id,external_url,alt,display_order,color_name)
 select product_id,nullif(j->>'media_id','')::uuid,nullif(j->>'external_url',''),coalesce(j->>'alt',''),ord-1,nullif(j->>'color_name','') from jsonb_array_elements(p_images) with ordinality as a(j,ord);
 delete from public.product_collections where product_collections.product_id=editor.product_id;
 insert into public.product_collections(product_id,collection_id) select product_id,unnest(p_collections);
 return product_id;
end $$;
revoke all on function public.save_product(uuid,jsonb,jsonb,jsonb,uuid[],numeric) from public;
grant execute on function public.save_product(uuid,jsonb,jsonb,jsonb,uuid[],numeric) to authenticated;

create or replace function public.quote_order(p_items jsonb,p_promo text default null,p_governorate text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare item record; variant record; subtotal numeric:=0; discount numeric:=0; fee numeric:=0; settings public.site_settings; promo public.promo_codes; begin
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid basket'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) j where jsonb_typeof(j)<>'object' or coalesce(j->>'variant_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(j->>'quantity','') !~ '^[1-9][0-9]{0,2}$') then raise exception 'Invalid item quantity or variant'; end if;
 select * into settings from public.site_settings limit 1;
 if not found or not settings.allow_checkout or settings.maintenance_mode then raise exception 'Checkout is unavailable'; end if;
 for item in select (j->>'variant_id')::uuid variant_id,sum((j->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) j group by 1 loop
 select v.*,p.price into variant from public.product_variants v join public.products p on p.id=v.product_id where v.id=item.variant_id and v.active and p.active and not p.archived;
 if not found or item.qty not between 1 and 100 or (variant.track_quantity and variant.stock<item.qty) then raise exception 'An item is unavailable or has insufficient stock'; end if;
 subtotal:=subtotal+private.effective_product_price(variant.product_id,variant.id)*item.qty;
 end loop;
 if nullif(trim(p_promo),'') is not null then
 select * into promo from public.promo_codes where code=upper(trim(p_promo));
 if not found or not promo.active or subtotal<promo.minimum_order or (promo.starts_at is not null and promo.starts_at>now()) or (promo.ends_at is not null and promo.ends_at<=now()) or (promo.usage_limit is not null and promo.usage_count>=promo.usage_limit) then raise exception 'Promo code is invalid or unavailable'; end if;
 discount:=least(subtotal,case when promo.discount_type='percentage' then round(subtotal*promo.discount_value/100,2) else promo.discount_value end);
 end if;
 fee:=private.shipping_charge(p_governorate,subtotal,discount);
 return jsonb_build_object('subtotal',subtotal,'discount',discount,'shipping',fee,'total',subtotal-discount+fee,'currency',settings.currency);
end $$;
revoke all on function public.quote_order(jsonb,text,text) from public;
grant execute on function public.quote_order(jsonb,text,text) to anon,authenticated;


create or replace function public.create_order(p_items jsonb,p_details jsonb,p_request_key uuid,p_promo text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 settings public.site_settings; customer public.customers; v record; item record; promotion public.promo_codes;
 new_order uuid; subtotal numeric:=0; discount numeric:=0; delivery numeric:=0; item_count integer:=0; unit_price numeric; captured_prices jsonb:='{}';
begin
 if auth.uid() is null then raise exception 'Sign in before ordering'; end if;
 -- Serializes retries for this customer, not the whole store.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select id into new_order from public.orders where customer_id=auth.uid() and request_key=p_request_key;
 if new_order is not null then return new_order; end if;
 select * into settings from public.site_settings limit 1;
 if settings.id is null or not settings.allow_checkout or settings.maintenance_mode then raise exception 'Checkout is currently unavailable'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid basket'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) j where jsonb_typeof(j)<>'object' or coalesce(j->>'variant_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(j->>'quantity','') !~ '^[1-9][0-9]{0,2}$') then raise exception 'Invalid item quantity or variant'; end if;
 if length(coalesce(p_details->>'phone',''))>50 then raise exception 'Phone number is too long'; end if;
 if length(trim(coalesce(p_details->>'name',''))) not between 1 and 80 or length(trim(coalesce(p_details->>'address',''))) not between 1 and 300 or length(trim(coalesce(p_details->>'city',''))) not between 1 and 100 or length(trim(coalesce(p_details->>'country',''))) not between 1 and 100 then raise exception 'Complete all address fields'; end if;
 select * into customer from public.customers where id=auth.uid();
 if customer.id is null then raise exception 'Complete your customer profile first'; end if;
 -- Price/publication cannot change between calculating the total and capturing items.
 perform 1 from public.products p where p.id in (
 select pv.product_id from public.product_variants pv where pv.id in (select (j->>'variant_id')::uuid from jsonb_array_elements(p_items) j)
 ) order by p.id for update;
 -- Group duplicate lines, then lock variants in deterministic order to avoid deadlocks.
 for item in select (j->>'variant_id')::uuid variant_id,sum((j->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) j group by 1 order by 1 loop
 if item.qty not between 1 and 100 then raise exception 'Invalid item quantity'; end if;
 select pv.*,p.name,p.price,p.active product_active,p.archived into v from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=item.variant_id for update of pv;
 if not found or not v.active or not v.product_active or v.archived then raise exception 'An item is no longer available'; end if;
 if v.track_quantity and v.stock<item.qty then raise exception 'Insufficient stock for %',v.sku; end if;
 unit_price:=private.effective_product_price(v.product_id,v.id);
 captured_prices:=captured_prices||jsonb_build_object(v.id::text,unit_price);
 subtotal:=subtotal+unit_price*item.qty; item_count:=item_count+1;
 end loop;
 if item_count=0 then raise exception 'Empty basket'; end if;
 if nullif(trim(p_promo),'') is not null then
 select * into promotion from public.promo_codes where code=upper(trim(p_promo)) for update;
 if not found or not promotion.active or (promotion.starts_at is not null and promotion.starts_at>now()) or (promotion.ends_at is not null and promotion.ends_at<=now()) or (promotion.usage_limit is not null and promotion.usage_count>=promotion.usage_limit) or subtotal<promotion.minimum_order then raise exception 'Promo code is invalid or unavailable'; end if;
 discount:=least(subtotal,case when promotion.discount_type='percentage' then round(subtotal*promotion.discount_value/100,2) else promotion.discount_value end);
 update public.promo_codes set usage_count=usage_count+1 where id=promotion.id;
 end if;
 if lower(trim(p_details->>'country')) not in ('egypt','مصر') then raise exception 'Delivery is available within Egypt only'; end if;
 delivery:=private.shipping_charge(p_details->>'governorate',subtotal,discount);
 insert into public.orders(customer_id,request_key,name,email,phone,address,city,country,governorate,subtotal,shipping,discount,total,currency,promo_id)
 values(auth.uid(),p_request_key,trim(p_details->>'name'),customer.email,coalesce(p_details->>'phone',''),trim(p_details->>'address'),trim(p_details->>'city'),trim(p_details->>'country'),coalesce(nullif(trim(p_details->>'governorate'),''),'cairo'),subtotal,delivery,discount,subtotal-discount+delivery,settings.currency,promotion.id) returning id into new_order;
 for item in select (j->>'variant_id')::uuid variant_id,sum((j->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) j group by 1 order by 1 loop
 select pv.*,p.name,p.price into v from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=item.variant_id;
 insert into public.order_items(order_id,product_id,variant_id,product_name,sku,size,color_name,quantity,unit_price,image_url)
 values(new_order,v.product_id,v.id,v.name,v.sku,v.size,v.color_name,item.qty,(captured_prices->>v.id::text)::numeric,
 (select coalesce(pi.external_url,m.path) from public.product_images pi left join public.media m on m.id=pi.media_id where pi.product_id=v.product_id order by pi.display_order limit 1));
 if v.track_quantity then
 update public.product_variants set stock=stock-item.qty where id=v.id;
 insert into public.inventory_movements(variant_id,delta,stock_after,reason,order_id) values(v.id,-item.qty,v.stock-item.qty,'Order placed',new_order);
 end if;
 end loop;
 insert into public.order_status_history(order_id,status,note,actor_id) values(new_order,'pending','Order placed; payment pending',auth.uid());
 update public.customers set name=trim(p_details->>'name'),phone=coalesce(p_details->>'phone','') where id=auth.uid();
 insert into public.customer_addresses(customer_id,address,city,country)
 select auth.uid(),trim(p_details->>'address'),trim(p_details->>'city'),trim(p_details->>'country')
 where not exists(select 1 from public.customer_addresses a where a.customer_id=auth.uid() and a.address=trim(p_details->>'address') and a.city=trim(p_details->>'city') and a.country=trim(p_details->>'country'));
 return new_order;
end $$;


-- Paginated discovery runs in PostgreSQL, so filters cover the entire catalog.
create or replace function public.search_catalog(p_query text default '',p_category uuid default null,p_collection uuid default null,p_type text default '',p_tag text default '',p_size text default '',p_color text default '',p_max_price numeric default null,p_sort text default 'featured',p_page integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 with matching as (
 select p.id,private.effective_product_price(p.id,null) price,p.name,p.created_at,p.featured from public.products p
 where p.active and not p.archived
 and (coalesce(p_query,'')='' or p.name ilike '%'||left(p_query,100)||'%' or p.name_ar ilike '%'||left(p_query,100)||'%')
 and (p_category is null or p.category_id=p_category)
 and (p_collection is null or exists(select 1 from public.product_collections c where c.product_id=p.id and c.collection_id=p_collection))
 and (coalesce(p_type,'')='' or p.product_type=p_type)
 and (coalesce(p_tag,'')='' or (p_tag='NEW' and p.new_arrival) or (p_tag='BESTSELLER' and p.best_seller) or (p_tag='SALE' and (p.compare_at_price>p.price or private.effective_product_price(p.id,null)<p.price)) or p_tag=any(p.tags))
 and (p_max_price is null or private.effective_product_price(p.id,null)<=p_max_price)
 and ((coalesce(p_size,'')='' and coalesce(p_color,'')='') or exists(select 1 from public.product_variants v where v.product_id=p.id and v.active and (not v.track_quantity or v.stock>0) and (coalesce(p_size,'')='' or v.size=p_size) and (coalesce(p_color,'')='' or v.color_name=p_color)))
 ), page as (
 select id from matching order by
 case when p_sort='low' then price end asc,
 case when p_sort='high' then price end desc,
 case when p_sort='name' then name end asc,
 case when p_sort='featured' then featured::integer end desc,
 created_at desc,id limit 24 offset greatest(0,least(p_page,10000))*24
 ) select jsonb_build_object('ids',coalesce((select jsonb_agg(id) from page),'[]'::jsonb),'count',(select count(*) from matching));
$$;
revoke all on function public.search_catalog(text,uuid,uuid,text,text,text,text,numeric,text,integer) from public;
grant execute on function public.search_catalog(text,uuid,uuid,text,text,text,text,numeric,text,integer) to anon,authenticated;


notify pgrst, 'reload schema';

-- Buy X, get Y free: gifts are chosen from eligible pieces already in the bag.

alter table public.offers add column if not exists buy_quantity integer, add column if not exists get_quantity integer;
alter table public.offers alter column discount_value drop not null;
do $$ declare item record; begin
 for item in select conname from pg_constraint where conrelid='public.offers'::regclass and contype='c' and (pg_get_constraintdef(oid) like '%discount_type%' or pg_get_constraintdef(oid) like '%discount_value%') loop
 execute format('alter table public.offers drop constraint %I',item.conname);
 end loop;
end $$;
alter table public.offers add constraint offers_type_rule check(discount_type in ('percentage','fixed','buy_get'));
alter table public.offers add constraint offers_discount_rule check(
 (discount_type='buy_get' and discount_value is null and buy_quantity is not null and get_quantity is not null and buy_quantity between 1 and 100 and get_quantity between 1 and 100)
 or (discount_type in ('percentage','fixed') and discount_value is not null and discount_value>0 and (discount_type<>'percentage' or discount_value<=100))
);
alter table public.order_items add column if not exists free_quantity integer not null default 0 check(free_quantity>=0 and free_quantity<=quantity);
alter table public.orders add column if not exists offer_discount numeric(12,2) not null default 0 check(offer_discount>=0);

create or replace function private.effective_product_price(p_product uuid,p_variant uuid default null) returns numeric
language plpgsql stable security definer set search_path='' as $$
declare base numeric; result numeric; begin
 select coalesce(v.price_override,p.price) into base from public.products p left join public.product_variants v on v.product_id=p.id and v.id=p_variant where p.id=p_product and (private.can_edit() or (p.active and not p.archived));
 if base is null then return null; end if;
 select min(greatest(0,round(base-case when o.discount_type='percentage' then base*o.discount_value/100 else o.discount_value end,2))) into result
 from public.offers o join public.offer_products op on op.offer_id=o.id
 where op.product_id=p_product and o.discount_type in ('percentage','fixed') and o.active and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now());
 return least(base,coalesce(result,base));
end $$;
revoke all on function private.effective_product_price(uuid,uuid) from public;
grant execute on function private.effective_product_price(uuid,uuid) to anon,authenticated;


create or replace function private.price_basket(p_items jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare plan jsonb; applied jsonb:='[]'; offer record; candidate_ids uuid[]; best_ids uuid[]; gifts_map jsonb; best_gifts jsonb;
 pieces integer; free_pieces integer; best_free integer; base_sum numeric; current_sum numeric; free_value numeric;
 saving numeric; best_saving numeric; best_offer jsonb; subtotal numeric; original_total numeric;
begin
 select coalesce(jsonb_agg(jsonb_build_object('variant_id',v.id,'product_id',v.product_id,'quantity',b.qty,'base_price',coalesce(v.price_override,p.price),'unit_price',private.effective_product_price(p.id,v.id),'free_quantity',0,'claimed',false) order by v.id),'[]') into plan
 from (select (j->>'variant_id')::uuid id,sum((j->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) j group by 1) b
 join public.product_variants v on v.id=b.id join public.products p on p.id=v.product_id;
 select sum(j.base_price*j.quantity) into original_total from jsonb_to_recordset(plan) j(base_price numeric,quantity integer);
 loop
  best_saving:=0; best_ids:=null;
  for offer in select * from public.offers o where o.discount_type='buy_get' and o.active and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now()) order by o.id loop
   select array_agg(j.variant_id),sum(j.quantity)::integer,sum(j.base_price*j.quantity),sum(j.unit_price*(j.quantity-j.free_quantity))
   into candidate_ids,pieces,base_sum,current_sum
   from jsonb_to_recordset(plan) j(variant_id uuid,product_id uuid,quantity integer,base_price numeric,unit_price numeric,free_quantity integer,claimed boolean)
   where not j.claimed and exists(select 1 from public.offer_products op where op.offer_id=offer.id and op.product_id=j.product_id);
   if candidate_ids is null then continue; end if;
   free_pieces:=(pieces/(offer.buy_quantity+offer.get_quantity))*offer.get_quantity;
   if free_pieces=0 then continue; end if;
   with units as (
    select j.variant_id,j.base_price,n from jsonb_to_recordset(plan) j(variant_id uuid,quantity integer,base_price numeric)
    cross join lateral generate_series(1,j.quantity) n where j.variant_id=any(candidate_ids)
    order by j.base_price,j.variant_id,n limit free_pieces
   ), gifts as (select variant_id,count(*)::integer qty,max(base_price) price from units group by variant_id)
   select sum(price*qty),jsonb_object_agg(variant_id::text,qty) into free_value,gifts_map from gifts;
   saving:=current_sum-(base_sum-free_value);
   if saving>best_saving then
    best_saving:=saving; best_ids:=candidate_ids; best_gifts:=gifts_map; best_free:=free_pieces;
    best_offer:=jsonb_build_object('id',offer.id,'name',offer.name,'buy_quantity',offer.buy_quantity,'get_quantity',offer.get_quantity,'free_quantity',free_pieces);
   end if;
  end loop;
  exit when best_ids is null;
  select jsonb_agg(case when (j->>'variant_id')::uuid=any(best_ids) then j||jsonb_build_object('unit_price',(j->>'base_price')::numeric,'free_quantity',coalesce((best_gifts->>(j->>'variant_id'))::integer,0),'claimed',true) else j end) into plan from jsonb_array_elements(plan) j;
  applied:=applied||jsonb_build_array(best_offer);
 end loop;
 select sum(j.unit_price*(j.quantity-j.free_quantity)) into subtotal from jsonb_to_recordset(plan) j(unit_price numeric,quantity integer,free_quantity integer);
 select jsonb_agg(j-'claimed') into plan from jsonb_array_elements(plan) j;
 return jsonb_build_object('subtotal',subtotal,'offer_discount',greatest(0,original_total-subtotal),'items',plan,'applied_offers',applied);
end $$;
revoke all on function private.price_basket(jsonb) from public;

create or replace function public.quote_order(p_items jsonb,p_promo text default null,p_governorate text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare item record; variant record; subtotal numeric:=0; discount numeric:=0; fee numeric:=0; settings public.site_settings; promo public.promo_codes; basket jsonb; begin
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid basket'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) j where jsonb_typeof(j)<>'object' or coalesce(j->>'variant_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(j->>'quantity','') !~ '^[1-9][0-9]{0,2}$') then raise exception 'Invalid item quantity or variant'; end if;
 select * into settings from public.site_settings limit 1;
 if not found or not settings.allow_checkout or settings.maintenance_mode then raise exception 'Checkout is unavailable'; end if;
 for item in select (j->>'variant_id')::uuid variant_id,sum((j->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) j group by 1 loop
 select v.*,p.price into variant from public.product_variants v join public.products p on p.id=v.product_id where v.id=item.variant_id and v.active and p.active and not p.archived;
 if not found or item.qty not between 1 and 100 or (variant.track_quantity and variant.stock<item.qty) then raise exception 'An item is unavailable or has insufficient stock'; end if;
 subtotal:=subtotal+private.effective_product_price(variant.product_id,variant.id)*item.qty;
 end loop;
 basket:=private.price_basket(p_items); subtotal:=(basket->>'subtotal')::numeric;
 if nullif(trim(p_promo),'') is not null then
 select * into promo from public.promo_codes where code=upper(trim(p_promo));
 if not found or not promo.active or subtotal<promo.minimum_order or (promo.starts_at is not null and promo.starts_at>now()) or (promo.ends_at is not null and promo.ends_at<=now()) or (promo.usage_limit is not null and promo.usage_count>=promo.usage_limit) then raise exception 'Promo code is invalid or unavailable'; end if;
 discount:=least(subtotal,case when promo.discount_type='percentage' then round(subtotal*promo.discount_value/100,2) else promo.discount_value end);
 end if;
 fee:=private.shipping_charge(p_governorate,subtotal,discount);
 return jsonb_build_object('subtotal',subtotal,'discount',discount,'shipping',fee,'total',subtotal-discount+fee,'currency',settings.currency,'offer_discount',basket->'offer_discount','items',basket->'items','applied_offers',basket->'applied_offers');
end $$;
revoke all on function public.quote_order(jsonb,text,text) from public;
grant execute on function public.quote_order(jsonb,text,text) to anon,authenticated;



create or replace function public.create_order(p_items jsonb,p_details jsonb,p_request_key uuid,p_promo text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 settings public.site_settings; customer public.customers; v record; item record; promotion public.promo_codes;
 new_order uuid; subtotal numeric:=0; discount numeric:=0; delivery numeric:=0; item_count integer:=0; unit_price numeric; captured_prices jsonb:='{}'; basket jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in before ordering'; end if;
 -- Serializes retries for this customer, not the whole store.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select id into new_order from public.orders where customer_id=auth.uid() and request_key=p_request_key;
 if new_order is not null then return new_order; end if;
 select * into settings from public.site_settings limit 1;
 if settings.id is null or not settings.allow_checkout or settings.maintenance_mode then raise exception 'Checkout is currently unavailable'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid basket'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) j where jsonb_typeof(j)<>'object' or coalesce(j->>'variant_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(j->>'quantity','') !~ '^[1-9][0-9]{0,2}$') then raise exception 'Invalid item quantity or variant'; end if;
 if length(coalesce(p_details->>'phone',''))>50 then raise exception 'Phone number is too long'; end if;
 if length(trim(coalesce(p_details->>'name',''))) not between 1 and 80 or length(trim(coalesce(p_details->>'address',''))) not between 1 and 300 or length(trim(coalesce(p_details->>'city',''))) not between 1 and 100 or length(trim(coalesce(p_details->>'country',''))) not between 1 and 100 then raise exception 'Complete all address fields'; end if;
 select * into customer from public.customers where id=auth.uid();
 if customer.id is null then raise exception 'Complete your customer profile first'; end if;
 -- Price/publication cannot change between calculating the total and capturing items.
 perform 1 from public.products p where p.id in (
 select pv.product_id from public.product_variants pv where pv.id in (select (j->>'variant_id')::uuid from jsonb_array_elements(p_items) j)
 ) order by p.id for update;
 -- Group duplicate lines, then lock variants in deterministic order to avoid deadlocks.
 for item in select (j->>'variant_id')::uuid variant_id,sum((j->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) j group by 1 order by 1 loop
 if item.qty not between 1 and 100 then raise exception 'Invalid item quantity'; end if;
 select pv.*,p.name,p.price,p.active product_active,p.archived into v from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=item.variant_id for update of pv;
 if not found or not v.active or not v.product_active or v.archived then raise exception 'An item is no longer available'; end if;
 if v.track_quantity and v.stock<item.qty then raise exception 'Insufficient stock for %',v.sku; end if;
 unit_price:=private.effective_product_price(v.product_id,v.id);
 captured_prices:=captured_prices||jsonb_build_object(v.id::text,unit_price);
 subtotal:=subtotal+unit_price*item.qty; item_count:=item_count+1;
 end loop;
 if item_count=0 then raise exception 'Empty basket'; end if;
 basket:=private.price_basket(p_items); subtotal:=(basket->>'subtotal')::numeric;
 select jsonb_object_agg(j->>'variant_id',j) into captured_prices from jsonb_array_elements(basket->'items') j;
 if nullif(trim(p_promo),'') is not null then
 select * into promotion from public.promo_codes where code=upper(trim(p_promo)) for update;
 if not found or not promotion.active or (promotion.starts_at is not null and promotion.starts_at>now()) or (promotion.ends_at is not null and promotion.ends_at<=now()) or (promotion.usage_limit is not null and promotion.usage_count>=promotion.usage_limit) or subtotal<promotion.minimum_order then raise exception 'Promo code is invalid or unavailable'; end if;
 discount:=least(subtotal,case when promotion.discount_type='percentage' then round(subtotal*promotion.discount_value/100,2) else promotion.discount_value end);
 update public.promo_codes set usage_count=usage_count+1 where id=promotion.id;
 end if;
 if lower(trim(p_details->>'country')) not in ('egypt','مصر') then raise exception 'Delivery is available within Egypt only'; end if;
 delivery:=private.shipping_charge(p_details->>'governorate',subtotal,discount);
 insert into public.orders(customer_id,request_key,name,email,phone,address,city,country,governorate,subtotal,shipping,discount,total,currency,promo_id,offer_discount)
 values(auth.uid(),p_request_key,trim(p_details->>'name'),customer.email,coalesce(p_details->>'phone',''),trim(p_details->>'address'),trim(p_details->>'city'),trim(p_details->>'country'),coalesce(nullif(trim(p_details->>'governorate'),''),'cairo'),subtotal,delivery,discount,subtotal-discount+delivery,settings.currency,promotion.id,(basket->>'offer_discount')::numeric) returning id into new_order;
 for item in select (j->>'variant_id')::uuid variant_id,sum((j->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) j group by 1 order by 1 loop
 select pv.*,p.name,p.price into v from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=item.variant_id;
 insert into public.order_items(order_id,product_id,variant_id,product_name,sku,size,color_name,quantity,free_quantity,unit_price,image_url)
 values(new_order,v.product_id,v.id,v.name,v.sku,v.size,v.color_name,item.qty,(captured_prices->v.id::text->>'free_quantity')::integer,(captured_prices->v.id::text->>'unit_price')::numeric,
 (select coalesce(pi.external_url,m.path) from public.product_images pi left join public.media m on m.id=pi.media_id where pi.product_id=v.product_id order by pi.display_order limit 1));
 if v.track_quantity then
 update public.product_variants set stock=stock-item.qty where id=v.id;
 insert into public.inventory_movements(variant_id,delta,stock_after,reason,order_id) values(v.id,-item.qty,v.stock-item.qty,'Order placed',new_order);
 end if;
 end loop;
 insert into public.order_status_history(order_id,status,note,actor_id) values(new_order,'pending','Order placed; payment pending',auth.uid());
 update public.customers set name=trim(p_details->>'name'),phone=coalesce(p_details->>'phone','') where id=auth.uid();
 insert into public.customer_addresses(customer_id,address,city,country)
 select auth.uid(),trim(p_details->>'address'),trim(p_details->>'city'),trim(p_details->>'country')
 where not exists(select 1 from public.customer_addresses a where a.customer_id=auth.uid() and a.address=trim(p_details->>'address') and a.city=trim(p_details->>'city') and a.country=trim(p_details->>'country'));
 return new_order;
end $$;



notify pgrst, 'reload schema';

commit;

-- Keep catalog discovery and preview-only ordering rules current.
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
