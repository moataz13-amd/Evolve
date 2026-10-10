-- Egyptian governorate shipping. Repeatable; keeps existing orders and custom rates.
begin;
alter table public.site_settings add column if not exists shipping_rates jsonb not null default '{}';
alter table public.site_settings alter column currency set default 'EGP';
update public.site_settings set currency='EGP' where currency='USD';
alter table public.orders add column if not exists governorate text;
create or replace function private.valid_governorate(code text) returns boolean language sql immutable set search_path='' as $$ select code = any(array['cairo','giza','alexandria','dakahlia','red-sea','beheira','fayoum','gharbia','ismailia','monufia','minya','qalyubia','new-valley','suez','aswan','assiut','beni-suef','port-said','damietta','sharqia','south-sinai','kafr-el-sheikh','matrouh','luxor','qena','north-sinai','sohag']) $$;
create or replace function private.valid_shipping_rates(rates jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare entry record; begin
 if jsonb_typeof(rates) is distinct from 'object' then return false; end if;
 for entry in select * from jsonb_each(rates) loop
  if not private.valid_governorate(entry.key) or entry.key='cairo' or jsonb_typeof(entry.value)<>'number' then return false; end if;
  if (entry.value::text)::numeric not between 0 and 1000000 then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function private.valid_governorate(text),private.valid_shipping_rates(jsonb) from public;
grant execute on function private.valid_governorate(text),private.valid_shipping_rates(jsonb) to authenticated;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.site_settings'::regclass and conname='valid_shipping_rates') then
  alter table public.site_settings add constraint valid_shipping_rates check(private.valid_shipping_rates(shipping_rates));
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='valid_governorate') then
  alter table public.orders add constraint valid_governorate check(governorate is null or private.valid_governorate(governorate));
 end if;
end $$;
create or replace function private.shipping_charge(code text,subtotal numeric,discount numeric) returns numeric language plpgsql stable security definer set search_path='' as $$
declare settings public.site_settings; selected text:=coalesce(nullif(trim(code),''),'cairo'); begin
 if not private.valid_governorate(selected) then raise exception 'Select a valid Egyptian governorate'; end if;
 select * into settings from public.site_settings limit 1;
 if settings.free_shipping_threshold is not null and subtotal-discount>=settings.free_shipping_threshold then return 0; end if;
 return coalesce((settings.shipping_rates->>selected)::numeric,settings.shipping_fee);
end $$;
revoke all on function private.shipping_charge(text,numeric,numeric) from public;

-- Preserve newer offer-aware checkout functions when reapplying shipping settings.
do $shipping_functions$
begin
 if to_regclass('public.offers') is null then
 execute $definitions$
drop function if exists public.quote_order(jsonb,text);
create or replace function public.quote_order(p_items jsonb,p_promo text default null,p_governorate text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare item record; variant record; subtotal numeric:=0; discount numeric:=0; fee numeric:=0; settings public.site_settings; promo public.promo_codes; begin
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid basket'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) j where jsonb_typeof(j)<>'object' or coalesce(j->>'variant_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(j->>'quantity','') !~ '^[1-9][0-9]{0,2}$') then raise exception 'Invalid item quantity or variant'; end if;
 select * into settings from public.site_settings limit 1;
 if not found or not settings.allow_checkout or settings.maintenance_mode then raise exception 'Checkout is unavailable'; end if;
 for item in select (j->>'variant_id')::uuid variant_id,sum((j->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) j group by 1 loop
 select v.*,p.price into variant from public.product_variants v join public.products p on p.id=v.product_id where v.id=item.variant_id and v.active and p.active and not p.archived;
 if not found or item.qty not between 1 and 100 or (variant.track_quantity and variant.stock<item.qty) then raise exception 'An item is unavailable or has insufficient stock'; end if;
 subtotal:=subtotal+coalesce(variant.price_override,variant.price)*item.qty;
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
 new_order uuid; subtotal numeric:=0; discount numeric:=0; delivery numeric:=0; item_count integer:=0;
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
 subtotal:=subtotal+coalesce(v.price_override,v.price)*item.qty; item_count:=item_count+1;
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
 values(new_order,v.product_id,v.id,v.name,v.sku,v.size,v.color_name,item.qty,coalesce(v.price_override,v.price),
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

$definitions$;
 end if;
end;
$shipping_functions$;

notify pgrst, 'reload schema';
commit;
