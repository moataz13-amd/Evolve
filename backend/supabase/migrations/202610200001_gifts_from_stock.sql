-- Cart quantities are paid pieces. Earned gifts are extra pieces drawn from the
-- same selected variants and must fit inside their real inventory.
begin;

create or replace function private.price_basket(p_items jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  plan jsonb; applied jsonb := '[]'; offer record; candidate_ids uuid[]; best_ids uuid[];
  gifts_map jsonb; best_gifts jsonb; pieces bigint; free_pieces bigint; allocated bigint;
  base_sum numeric; current_sum numeric; free_value numeric; saving numeric;
  best_saving numeric; best_offer jsonb; subtotal numeric; original_total numeric;
  insufficient_gifts boolean;
begin
  if exists(
    select 1 from jsonb_array_elements(p_items) j
    join public.product_variants v on v.id=(j->>'variant_id')::uuid
    join public.products p on p.id=v.product_id
    where private.catalog_tag_matches(p,'COMING_SOON')
  ) then raise exception 'Coming soon products cannot be ordered'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'variant_id',v.id,'product_id',v.product_id,'paid_quantity',b.qty,
    'quantity',b.qty,'base_price',coalesce(v.price_override,p.price),
    'unit_price',private.effective_product_price(p.id,v.id),
    'free_quantity',0,'claimed',false
  ) order by v.id),'[]') into plan
  from (
    select (j->>'variant_id')::uuid id,sum((j->>'quantity')::integer)::integer qty
    from jsonb_array_elements(p_items) j group by 1
  ) b
  join public.product_variants v on v.id=b.id
  join public.products p on p.id=v.product_id;

  loop
    best_saving := 0; best_ids := null; insufficient_gifts := false;
    for offer in
      select * from public.offers o
      where o.discount_type='buy_get' and o.active
        and (o.starts_at is null or o.starts_at<=now())
        and (o.ends_at is null or o.ends_at>now())
      order by o.id
    loop
      select array_agg(j.variant_id),sum(j.paid_quantity),
        sum(j.base_price*j.paid_quantity),sum(j.unit_price*j.paid_quantity)
      into candidate_ids,pieces,base_sum,current_sum
      from jsonb_to_recordset(plan) j(
        variant_id uuid,product_id uuid,paid_quantity integer,
        base_price numeric,unit_price numeric,claimed boolean
      )
      where not j.claimed and exists(
        select 1 from public.offer_products op
        where op.offer_id=offer.id and op.product_id=j.product_id
      );
      if candidate_ids is null then continue; end if;
      free_pieces := (pieces/offer.buy_quantity)*offer.get_quantity;
      if free_pieces=0 then continue; end if;

      -- Allocate to the cheapest selected variants with spare inventory. A
      -- window sum avoids generating one SQL row per piece for large orders.
      with capacities as (
        select j.variant_id,j.base_price,
          case when v.track_quantity then greatest(0,v.stock::bigint-j.paid_quantity)
               else free_pieces end as capacity
        from jsonb_to_recordset(plan) j(
          variant_id uuid,paid_quantity integer,base_price numeric
        )
        join public.product_variants v on v.id=j.variant_id
        where j.variant_id=any(candidate_ids)
      ), ranked as (
        select *,coalesce(sum(capacity) over (
          order by base_price,variant_id rows between unbounded preceding and 1 preceding
        ),0) used_before from capacities
      ), gifts as (
        select variant_id,base_price,
          least(capacity,greatest(0,free_pieces-used_before))::integer qty
        from ranked
      )
      select coalesce(sum(qty),0),coalesce(sum(base_price*qty),0),
        coalesce(jsonb_object_agg(variant_id::text,qty) filter(where qty>0),'{}'::jsonb)
      into allocated,free_value,gifts_map from gifts;
      if allocated<free_pieces then
        insufficient_gifts := true;
        continue;
      end if;

      saving := current_sum-(base_sum-free_value);
      if saving>best_saving then
        best_saving := saving; best_ids := candidate_ids; best_gifts := gifts_map;
        best_offer := jsonb_build_object(
          'id',offer.id,'name',offer.name,'buy_quantity',offer.buy_quantity,
          'get_quantity',offer.get_quantity,'free_quantity',free_pieces
        );
      end if;
    end loop;
    if best_ids is null and insufficient_gifts then
      raise exception 'Not enough stock for the free gifts. Reduce the paid quantity.';
    end if;
    exit when best_ids is null;
    if exists(
      select 1 from jsonb_array_elements(plan) j
      where (j->>'variant_id')::uuid=any(best_ids)
        and (j->>'paid_quantity')::bigint
          +coalesce((best_gifts->>(j->>'variant_id'))::bigint,0)>2147483647
    ) then raise exception 'Item quantity exceeds database capacity'; end if;
    select jsonb_agg(case when (j->>'variant_id')::uuid=any(best_ids) then
      j||jsonb_build_object(
        'unit_price',(j->>'base_price')::numeric,
        'free_quantity',coalesce((best_gifts->>(j->>'variant_id'))::integer,0),
        'quantity',(j->>'paid_quantity')::integer
          +coalesce((best_gifts->>(j->>'variant_id'))::integer,0),
        'claimed',true
      ) else j end)
    into plan from jsonb_array_elements(plan) j;
    applied := applied||jsonb_build_array(best_offer);
  end loop;

  select sum(j.unit_price*j.paid_quantity),sum(j.base_price*j.quantity)
  into subtotal,original_total
  from jsonb_to_recordset(plan) j(
    unit_price numeric,base_price numeric,paid_quantity integer,quantity integer
  );
  select jsonb_agg(j-'claimed') into plan from jsonb_array_elements(plan) j;
  return jsonb_build_object(
    'subtotal',subtotal,'offer_discount',greatest(0,original_total-subtotal),
    'items',plan,'applied_offers',applied
  );
end $$;
revoke all on function private.price_basket(jsonb) from public;

-- Preserve the deployed guest checkout, promo, shipping and quantity rules;
-- change only the stock check and the captured quantity after pricing.
do $upgrade$
declare definition text; signature regprocedure;
declare pricing_line text := 'basket:=private.price_basket(p_items); subtotal:=(basket->>''subtotal'')::numeric;';
declare stock_check text := E'\n if exists(select 1 from jsonb_to_recordset(basket->''items'') j(variant_id uuid,quantity bigint) join public.product_variants pv on pv.id=j.variant_id where pv.track_quantity and j.quantity>pv.stock) then raise exception ''Insufficient stock for paid items and free gifts''; end if;';
begin
  for signature in select unnest(array[
    'public.quote_order(jsonb,text,text)'::regprocedure,
    'public.create_order(jsonb,jsonb,uuid,text)'::regprocedure
  ]) loop
    definition := pg_get_functiondef(signature);
    if position(stock_check in definition)>0 then continue; end if;
    if position(pricing_line in definition)=0 then
      raise exception 'Unexpected pricing function definition: %',signature;
    end if;
    definition := replace(definition,pricing_line,pricing_line||stock_check);
    if signature='public.create_order(jsonb,jsonb,uuid,text)'::regprocedure then
      if position('values(new_order,v.product_id,v.id,v.name,v.sku,v.size,v.color_name,item.qty,' in definition)=0 or
         position('set stock=stock-item.qty where id=v.id' in definition)=0 then
        raise exception 'Unexpected order capture function definition';
      end if;
      definition := replace(definition,
        'values(new_order,v.product_id,v.id,v.name,v.sku,v.size,v.color_name,item.qty,',
        'values(new_order,v.product_id,v.id,v.name,v.sku,v.size,v.color_name,(captured_prices->v.id::text->>''quantity'')::integer,');
      definition := replace(definition,'set stock=stock-item.qty where id=v.id',
        'set stock=stock-(captured_prices->v.id::text->>''quantity'')::integer where id=v.id');
      definition := replace(definition,'values(v.id,-item.qty,v.stock-item.qty,',
        'values(v.id,-(captured_prices->v.id::text->>''quantity'')::integer,v.stock-(captured_prices->v.id::text->>''quantity'')::integer,');
    end if;
    execute definition;
  end loop;
end $upgrade$;

notify pgrst, 'reload schema';
commit;
