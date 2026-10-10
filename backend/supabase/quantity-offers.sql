-- Buy X, get Y free: gifts are chosen from eligible pieces already in the bag.
begin;
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
