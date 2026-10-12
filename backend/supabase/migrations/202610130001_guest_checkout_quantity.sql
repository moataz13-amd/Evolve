-- Guest checkout uses a short-lived Supabase anonymous user so orders retain
-- the same customer isolation and stock transaction as signed-in checkout.
begin;

create or replace function private.create_customer_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Anonymous Auth users have no email until checkout supplies one.
  if new.email is null then return new; end if;
  insert into public.customers(id,name,email)
  values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),new.email)
  on conflict(id) do nothing;
  return new;
end $$;

create or replace function public.prepare_guest_checkout(p_name text,p_email text) returns void
language plpgsql security definer set search_path='' as $$
declare clean_email text := lower(trim(coalesce(p_email,'')));
declare clean_name text := trim(coalesce(p_name,''));
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false') <> 'true' then
    raise exception 'Guest checkout requires an anonymous session';
  end if;
  if length(clean_name) not between 1 and 80 then raise exception 'Enter your name'; end if;
  if length(clean_email) not between 3 and 254 or
     clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address';
  end if;
  insert into public.customers(id,name,email) values(auth.uid(),clean_name,clean_email)
  on conflict(id) do update set name=excluded.name,email=excluded.email;
end $$;
revoke all on function public.prepare_guest_checkout(text,text) from public;
grant execute on function public.prepare_guest_checkout(text,text) to authenticated;

create or replace function private.valid_order_quantity(p_value text) returns boolean
language plpgsql immutable set search_path='' as $$
begin
  if p_value is null or p_value !~ '^[1-9][0-9]{0,9}$' then return false; end if;
  return p_value::bigint <= 2147483647;
end $$;
revoke all on function private.valid_order_quantity(text) from public;

-- Keep all existing pricing, offers and transactional stock logic intact while
-- removing the old 100-pieces-per-variant rule. The integer storage range and
-- actual variant stock remain the only quantity limits.
do $quantity$
declare definition text; signature regprocedure;
declare old_validation text := 'coalesce(j->>''quantity'','''') !~ ''^[1-9][0-9]{0,2}$''';
declare old_limit text := 'item.qty not between 1 and 100';
declare validation_end text := 'then raise exception ''Invalid item quantity or variant''; end if;';
begin
  for signature in
    select unnest(array[
      'public.quote_order(jsonb,text,text)'::regprocedure,
      'public.create_order(jsonb,jsonb,uuid,text)'::regprocedure
    ])
  loop
    definition := pg_get_functiondef(signature);
    if position(old_validation in definition)=0 and
       position('private.valid_order_quantity' in definition)>0 then
      continue;
    end if;
    if position(old_validation in definition)=0 or position(old_limit in definition)=0 or
       position(validation_end in definition)=0 then
      raise exception 'Unexpected commerce function definition: %',signature;
    end if;
    definition := replace(definition,old_validation,
      'not private.valid_order_quantity(j->>''quantity'')');
    definition := replace(definition,old_limit,'item.qty < 1');
    definition := replace(definition,validation_end,validation_end || E'\n' ||
      'if exists(select 1 from (select sum((j->>''quantity'')::bigint) qty from jsonb_array_elements(p_items) j group by j->>''variant_id'') grouped where qty>2147483647) then raise exception ''Item quantity exceeds database capacity''; end if;');
    execute definition;
  end loop;
end $quantity$;

notify pgrst, 'reload schema';
commit;
