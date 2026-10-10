create function public.adjust_inventory(p_variant uuid,p_delta integer,p_reason text) returns integer
language plpgsql security definer set search_path='' as $$ declare result integer; begin
 if not private.can_manage() then raise exception 'Inventory management requires an admin'; end if;
 if p_delta=0 or nullif(trim(p_reason),'') is null then raise exception 'A non-zero adjustment and reason are required'; end if;
 update public.product_variants set stock=stock+p_delta where id=p_variant and stock+p_delta>=0 returning stock into result;
 if result is null then raise exception 'Variant unavailable or adjustment would make stock negative'; end if;
 insert into public.inventory_movements(variant_id,delta,stock_after,reason,admin_id) values(p_variant,p_delta,result,p_reason,auth.uid());
 return result; end $$;
-- All totals, discounts, shipping and stock are calculated in one database transaction.
create function public.create_order(p_items jsonb,p_details jsonb,p_request_key uuid,p_promo text default null) returns uuid
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
 delivery:=case when settings.free_shipping_threshold is not null and subtotal-discount>=settings.free_shipping_threshold then 0 else settings.shipping_fee end;
 insert into public.orders(customer_id,request_key,name,email,phone,address,city,country,subtotal,shipping,discount,total,currency,promo_id)
 values(auth.uid(),p_request_key,trim(p_details->>'name'),customer.email,coalesce(p_details->>'phone',''),trim(p_details->>'address'),trim(p_details->>'city'),trim(p_details->>'country'),subtotal,delivery,discount,subtotal-discount+delivery,settings.currency,promotion.id) returning id into new_order;
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
create function public.update_order_status(p_order uuid,p_status text,p_payment text,p_note text default '') returns void
language plpgsql security definer set search_path='' as $$ declare existing public.orders; line record; result integer; begin
 if not private.can_manage() then raise exception 'Administrator access required'; end if;
 select * into existing from public.orders where id=p_order for update;
 if not found then raise exception 'Order not found'; end if;
 if existing.status in ('cancelled','refunded') and p_status<>existing.status then raise exception 'Terminal orders cannot be reopened'; end if;
 if p_status not in ('pending','confirmed','processing','shipped','delivered','cancelled','refunded') or p_payment not in ('pending','paid','failed','refunded','partially_refunded') then raise exception 'Invalid status'; end if;
 if p_status='cancelled' and existing.status<>p_status then
 if existing.status in ('shipped','delivered') then raise exception 'Shipped orders require a return workflow'; end if;
 for line in select oi.* from public.order_items oi where order_id=p_order order by variant_id loop
 update public.product_variants set stock=stock+line.quantity where id=line.variant_id and track_quantity returning stock into result;
 if found then insert into public.inventory_movements(variant_id,delta,stock_after,reason,order_id,admin_id) values(line.variant_id,line.quantity,result,'Order cancelled',p_order,auth.uid()); end if;
 end loop;
 end if;
 update public.orders set status=p_status,payment_status=p_payment,fulfillment_status=case when p_status in ('processing','shipped','delivered','cancelled') then p_status else fulfillment_status end where id=p_order;
 insert into public.order_status_history(order_id,status,note,actor_id) values(p_order,p_status,p_note,auth.uid());
 insert into public.admin_activity_logs(admin_id,action,entity_type,entity_id,metadata) values(auth.uid(),'status_changed','orders',p_order::text,jsonb_build_object('from',existing.status,'to',p_status,'payment',p_payment));
end $$;
-- Public URL resolver exposes only media referenced by published content/catalog.

-- Media URLs are assembled from object paths on the client; public media rows are reference-gated.
create policy media_public_references on public.media for select to anon,authenticated using(
 exists(select 1 from public.product_images i join public.products p on p.id=i.product_id where i.media_id=media.id and p.active and not p.archived)
 or exists(select 1 from public.categories c where c.image_id=media.id and c.active)
 or exists(select 1 from public.collections c where c.image_id=media.id and c.active)
 or exists(select 1 from public.homepage_content c join public.homepage_sections s on s.id=c.section_id where c.image_id=media.id and s.active and s.published)
 or exists(select 1 from public.banners b where b.image_id=media.id and b.active)
 or exists(select 1 from public.site_settings s where s.og_image_id=media.id)
 or exists(select 1 from public.products p where p.og_image_id=media.id and p.active and not p.archived)
);
grant select on public.media to anon;
create function public.subscribe_newsletter(p_email text) returns void language plpgsql security definer set search_path='' as $$ begin
 if length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email'; end if;
 insert into public.newsletter_subscribers(email) values(lower(trim(p_email))) on conflict(email) do nothing;
end $$;
revoke all on function public.adjust_inventory(uuid,integer,text),public.create_order(jsonb,jsonb,uuid,text),public.update_order_status(uuid,text,text,text),public.subscribe_newsletter(text) from public;
grant execute on function public.adjust_inventory(uuid,integer,text),public.create_order(jsonb,jsonb,uuid,text),public.update_order_status(uuid,text,text,text) to authenticated;
grant execute on function public.subscribe_newsletter(text) to anon,authenticated;
-- Only admins may write image objects. No service key is used in the browser.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('evolve-media','evolve-media',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']) on conflict(id) do nothing;
create policy assets_read on storage.objects for select to anon,authenticated using(bucket_id='evolve-media');
create policy assets_insert on storage.objects for insert to authenticated with check(bucket_id='evolve-media' and private.can_edit());
create policy assets_update on storage.objects for update to authenticated using(bucket_id='evolve-media' and private.can_edit()) with check(bucket_id='evolve-media' and private.can_edit());
create policy assets_delete on storage.objects for delete to authenticated using(bucket_id='evolve-media' and private.can_manage() and not exists(select 1 from public.media m where m.path=name));
