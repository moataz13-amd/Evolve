-- EVOLVE: run once on a NEW Supabase project. Includes the default homepage, but no products or stock.
-- Existing stores must use updates.sql instead of rerunning this initialization.
do $setup_guard$
begin
  if to_regclass('public.admin_profiles') is not null then
    raise exception 'EVOLVE is already initialized. Run backend/supabase/updates.sql for the latest updates; do not rerun setup.sql.';
  end if;
end;
$setup_guard$;
-- Migration: 202610070001_schema.sql
-- EVOLVE relational commerce schema. Apply through Supabase migrations.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;
create table public.admin_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null, role text not null check (role in ('super_admin','admin','editor')),
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function private.admin_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.admin_profiles where id=(select auth.uid()) and active;
$$;
create function private.can_edit() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.admin_role() in ('super_admin','admin','editor'),false); $$;
create function private.can_manage() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.admin_role() in ('super_admin','admin'),false); $$;
create table public.media (
 id uuid primary key default gen_random_uuid(), path text unique not null, name text not null,
 mime_type text not null, size bigint not null check(size between 1 and 10485760), folder text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
 id uuid primary key default gen_random_uuid(), name text not null, name_ar text not null default '', slug text unique not null,
 description text not null default '', image_id uuid references public.media on delete restrict,
 active boolean not null default true, display_order integer not null default 0,
 meta_title text not null default '', meta_description text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.collections (
 id uuid primary key default gen_random_uuid(), name text not null, name_ar text not null default '', slug text unique not null,
 description text not null default '', image_id uuid references public.media on delete restrict,
 active boolean not null default true, featured boolean not null default false, display_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.products (
 id uuid primary key default gen_random_uuid(), name text not null, name_ar text not null default '', slug text unique not null,
 short_description text not null default '', description text not null default '', description_ar text not null default '',
 category_id uuid references public.categories on delete restrict, product_type text not null default 'T-Shirts',
 gender text not null default 'Men' check(gender in ('Men','Women','Unisex')),
 price numeric(12,2) not null check(price>=0), compare_at_price numeric(12,2) check(compare_at_price>=0),
 active boolean not null default false, featured boolean not null default false, best_seller boolean not null default false,
 new_arrival boolean not null default false, archived boolean not null default false, tags text[] not null default '{}',
 meta_title text not null default '', meta_description text not null default '', og_image_id uuid references public.media on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Cost is private; never included in the public catalog.
create table public.product_costs (product_id uuid primary key references public.products on delete cascade, cost numeric(12,2) not null default 0 check(cost>=0));
create table public.product_images (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products on delete cascade,
 media_id uuid references public.media on delete restrict, external_url text check(external_url is null or external_url ~ '^https://'),
 alt text not null default '', display_order integer not null default 0, color_name text,
 check((media_id is not null)::integer + (external_url is not null)::integer=1),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_variants (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products on delete cascade,
 sku text unique not null, size text not null check(size in ('XS','S','M','L','XL','XXL')),
 color_name text not null, color_hex text not null default '#20231f' check(color_hex ~ '^#[0-9A-Fa-f]{6}$'),
 stock integer not null default 0 check(stock>=0), low_stock_threshold integer not null default 5 check(low_stock_threshold>=0),
 track_quantity boolean not null default true, price_override numeric(12,2) check(price_override>=0), active boolean not null default true,
 unique(product_id,size,color_name), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_collections (
 product_id uuid references public.products on delete cascade, collection_id uuid references public.collections on delete cascade,
 primary key(product_id,collection_id)
);
create table public.customers (
 id uuid primary key references auth.users on delete cascade, name text not null, email text not null, phone text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.customer_addresses (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers on delete cascade,
 address text not null, city text not null, country text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.promo_codes (
 id uuid primary key default gen_random_uuid(), code text unique not null check(code=upper(code)),
 discount_type text not null check(discount_type in ('percentage','fixed')), discount_value numeric(12,2) not null check(discount_value>0),
 minimum_order numeric(12,2) not null default 0 check(minimum_order>=0), starts_at timestamptz, ends_at timestamptz,
 usage_limit integer check(usage_limit>0), usage_count integer not null default 0 check(usage_count>=0), active boolean not null default true,
 check(discount_type!='percentage' or discount_value<=100), check(ends_at is null or starts_at is null or ends_at>starts_at),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), order_number bigint generated always as identity unique,
 customer_id uuid not null references public.customers on delete restrict, request_key uuid not null,
 status text not null default 'pending' check(status in ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
 payment_status text not null default 'pending' check(payment_status in ('pending','paid','failed','refunded','partially_refunded')),
 fulfillment_status text not null default 'unfulfilled' check(fulfillment_status in ('unfulfilled','processing','shipped','delivered','cancelled')),
 name text not null, email text not null, phone text not null default '', address text not null, city text not null, country text not null,
 subtotal numeric(12,2) not null check(subtotal>=0), shipping numeric(12,2) not null check(shipping>=0),
 discount numeric(12,2) not null default 0 check(discount>=0), total numeric(12,2) not null check(total>=0),
 currency text not null, promo_id uuid references public.promo_codes on delete restrict,
 unique(customer_id,request_key), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.order_notes (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders on delete cascade,
 admin_id uuid not null references public.admin_profiles on delete restrict, note text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders on delete cascade,
 product_id uuid references public.products on delete restrict, variant_id uuid references public.product_variants on delete restrict,
 product_name text not null, image_url text, sku text not null, size text not null, color_name text not null,
 quantity integer not null check(quantity>0), unit_price numeric(12,2) not null check(unit_price>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.order_status_history (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders on delete cascade,
 status text not null, note text not null default '', actor_id uuid references auth.users on delete set null, created_at timestamptz not null default now()
);
create table public.inventory_movements (
 id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.product_variants on delete restrict,
 delta integer not null, stock_after integer not null check(stock_after>=0), reason text not null,
 order_id uuid references public.orders on delete restrict, admin_id uuid references auth.users on delete set null, created_at timestamptz not null default now()
);
create table public.homepage_sections (
 id uuid primary key default gen_random_uuid(), key text unique not null, title text not null,
 active boolean not null default true, published boolean not null default false, display_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.homepage_content (
 id uuid primary key default gen_random_uuid(), section_id uuid not null references public.homepage_sections on delete cascade,
 eyebrow text not null default '', heading text not null default '', heading_ar text not null default '',
 description text not null default '', description_ar text not null default '', cta_label text not null default '', cta_label_ar text not null default '',
 cta_url text not null default '/shop' check(cta_url ~ '^/[^/]'), image_id uuid references public.media on delete restrict,
 background text not null default 'ivory' check(background in ('ivory','charcoal','red')),
 category_id uuid references public.categories on delete restrict, collection_id uuid references public.collections on delete restrict,
 display_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.homepage_products (
 section_id uuid references public.homepage_sections on delete cascade, product_id uuid references public.products on delete cascade,
 display_order integer not null default 0, primary key(section_id,product_id)
);
create table public.faqs (
 id uuid primary key default gen_random_uuid(), question text not null, question_ar text not null default '', answer text not null, answer_ar text not null default '',
 display_order integer not null default 0, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.banners (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null default '', image_id uuid references public.media on delete restrict,
 cta_label text not null default '', cta_url text not null default '/shop' check(cta_url ~ '^/[^/]'),
 active boolean not null default false, display_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.newsletter_subscribers (
 id uuid primary key default gen_random_uuid(), email text unique not null, status text not null default 'subscribed' check(status in ('subscribed','unsubscribed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.site_settings (
 id uuid primary key default gen_random_uuid(), singleton boolean not null default true unique check(singleton),
 store_name text not null default 'EVOLVE', store_email text not null default '', phone text not null default '',
 currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'), country text not null default 'Egypt',
 instagram text not null default '', facebook text not null default '', tiktok text not null default '',
 shipping_fee numeric(12,2) not null default 0 check(shipping_fee>=0), free_shipping_threshold numeric(12,2) check(free_shipping_threshold>=0),
 meta_title text not null default 'EVOLVE', meta_description text not null default '', og_image_id uuid references public.media on delete restrict,
 maintenance_mode boolean not null default false, allow_checkout boolean not null default false,
 low_stock_threshold integer not null default 5 check(low_stock_threshold>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.admin_activity_logs (
 id uuid primary key default gen_random_uuid(), admin_id uuid references public.admin_profiles on delete set null,
 action text not null, entity_type text not null, entity_id text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id,active,created_at);
create index variants_product_idx on public.product_variants(product_id);
create index orders_customer_idx on public.orders(customer_id,created_at);
create index orders_status_idx on public.orders(status,created_at);
create index movements_variant_idx on public.inventory_movements(variant_id,created_at);
create index images_product_idx on public.product_images(product_id,display_order);
create index order_items_order_idx on public.order_items(order_id);
create index history_order_idx on public.order_status_history(order_id,created_at);
create index notes_order_idx on public.order_notes(order_id);
create index products_name_search_idx on public.products using gin(to_tsvector('simple',name));
create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if private.can_edit() then
 insert into public.admin_activity_logs(admin_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),lower(tg_op),tg_table_name,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'product_id',to_jsonb(old)->>'product_id',''),jsonb_build_object('operation',tg_op));
 end if;
 if tg_op='DELETE' then return old; end if; return new;
 end $$;
-- All tables are protected. Explicit grants do not replace RLS.
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename in ('admin_profiles','media','categories','collections','products','product_costs','product_images','product_variants','product_collections','customers','customer_addresses','promo_codes','orders','order_notes','order_items','order_status_history','inventory_movements','homepage_sections','homepage_content','homepage_products','faqs','banners','newsletter_subscribers','site_settings','admin_activity_logs') loop
 execute format('alter table public.%I enable row level security',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='updated_at') then
 execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
 end if;
 if t not in ('admin_activity_logs','admin_profiles','customers','customer_addresses','orders','order_items','order_status_history','inventory_movements','newsletter_subscribers') then
 execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
 end if;
 end loop;
end $$;
-- Public catalog policies. A hidden/inactive parent cannot leak through children.
create policy catalog_read on public.products for select to anon,authenticated using((active and not archived) or private.can_edit());
create policy categories_read on public.categories for select to anon,authenticated using(active or private.can_edit());
create policy collections_read on public.collections for select to anon,authenticated using(active or private.can_edit());
create policy variants_read on public.product_variants for select to anon,authenticated using(private.can_edit() or (active and exists(select 1 from public.products p where p.id=product_id and p.active and not p.archived)));
create policy images_read on public.product_images for select to anon,authenticated using(private.can_edit() or exists(select 1 from public.products p where p.id=product_id and p.active and not p.archived));
create policy product_collections_read on public.product_collections for select to anon,authenticated using(private.can_edit() or (exists(select 1 from public.products p where p.id=product_id and p.active and not p.archived) and exists(select 1 from public.collections c where c.id=collection_id and c.active)));
create policy sections_read on public.homepage_sections for select to anon,authenticated using((active and published) or private.can_edit());
create policy content_read on public.homepage_content for select to anon,authenticated using(private.can_edit() or exists(select 1 from public.homepage_sections s where s.id=section_id and s.active and s.published));
create policy home_products_read on public.homepage_products for select to anon,authenticated using(private.can_edit() or (exists(select 1 from public.homepage_sections s where s.id=section_id and s.active and s.published) and exists(select 1 from public.products p where p.id=product_id and p.active and not p.archived)));
create policy faq_read on public.faqs for select to anon,authenticated using(active or private.can_edit());
create policy banners_read on public.banners for select to anon,authenticated using(active or private.can_edit());
create policy settings_read on public.site_settings for select to anon,authenticated using(true);
-- Media metadata is private. Public image URLs refer to objects in the public assets bucket.
create policy media_read on public.media for select to authenticated using(private.can_edit());
create policy costs_read on public.product_costs for select to authenticated using(private.can_manage());
create policy costs_write on public.product_costs for all to authenticated using(private.can_manage()) with check(private.can_manage());
create policy admin_read on public.admin_profiles for select to authenticated using(id=auth.uid() or private.admin_role()='super_admin');
create policy admin_manage on public.admin_profiles for all to authenticated using(private.admin_role()='super_admin') with check(private.admin_role()='super_admin');
do $$ declare t text; begin
 foreach t in array array['products','categories','collections','product_variants','product_images','product_collections','homepage_sections','homepage_content','homepage_products','faqs','banners','media'] loop
 execute format('create policy editor_insert on public.%I for insert to authenticated with check(private.can_edit())',t);
 execute format('create policy editor_update on public.%I for update to authenticated using(private.can_edit()) with check(private.can_edit())',t);
 execute format('create policy manager_delete on public.%I for delete to authenticated using(private.can_manage())',t);
 end loop;
 foreach t in array array['promo_codes','newsletter_subscribers'] loop
 execute format('create policy manager_access on public.%I for all to authenticated using(private.can_manage()) with check(private.can_manage())',t);
 end loop;
end $$;
create policy settings_update on public.site_settings for update to authenticated using(private.admin_role()='super_admin') with check(private.admin_role()='super_admin');
create policy customer_read on public.customers for select to authenticated using(id=auth.uid() or private.can_manage());
create policy customer_insert on public.customers for insert to authenticated with check(id=auth.uid() and email=auth.jwt()->>'email');
create policy customer_update on public.customers for update to authenticated using(id=auth.uid() or private.can_manage()) with check(id=auth.uid() or private.can_manage());
create policy address_access on public.customer_addresses for all to authenticated using(customer_id=auth.uid() or private.can_manage()) with check(customer_id=auth.uid() or private.can_manage());
create policy order_read on public.orders for select to authenticated using(customer_id=auth.uid() or private.can_manage());
create policy items_read on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or private.can_manage())));
create policy history_read on public.order_status_history for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or private.can_manage())));
create policy notes_read on public.order_notes for select to authenticated using(private.can_manage());
create policy notes_insert on public.order_notes for insert to authenticated with check(private.can_manage() and admin_id=auth.uid());
create policy inventory_read on public.inventory_movements for select to authenticated using(private.can_edit());
create policy audit_read on public.admin_activity_logs for select to authenticated using(private.can_edit());
grant select on public.products,public.categories,public.collections,public.product_variants,public.product_images,public.product_collections,public.homepage_sections,public.homepage_content,public.homepage_products,public.faqs,public.banners,public.site_settings to anon;
grant usage,select on all sequences in schema public to authenticated;
-- Prevent direct writes to inventory/commerce totals even by an admin client.
revoke insert,update,delete on public.orders,public.order_items,public.order_status_history,public.inventory_movements,public.admin_activity_logs from authenticated;
create function private.guard_stock() returns trigger language plpgsql set search_path='' as $$ begin
 if current_user not in ('postgres','supabase_admin') and ((tg_op='INSERT' and new.stock<>0) or (tg_op='UPDATE' and new.stock<>old.stock)) then
 raise exception 'Stock must be changed using adjust_inventory'; end if; return new;
end $$;
create trigger guard_stock before insert or update on public.product_variants for each row execute function private.guard_stock();
-- Restrict execution of helpers to the necessary roles; no public privileged RPC.
revoke all on all functions in schema private from public;
grant execute on function private.admin_role(),private.can_edit(),private.can_manage() to authenticated,anon;

-- Migration: 202610070002_commerce.sql
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

-- Migration: 202610070003_product_editor.sql
-- Atomically saves the relational product editor. Stock always creates a movement.
create function public.save_product(p_id uuid,p_product jsonb,p_variants jsonb,p_images jsonb,p_collections uuid[],p_cost numeric default null) returns uuid
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
<<editor>>
declare product_id uuid; entry jsonb; variant_id uuid; old_stock integer; wanted_stock integer; begin
 if not private.can_edit() then raise exception 'Catalog editor access required'; end if;
 product_id:=coalesce(p_id,gen_random_uuid());
 if not private.can_manage() and coalesce((p_product->>'archived')::boolean,false) is distinct from coalesce((select p.archived from public.products p where p.id=product_id),false) then raise exception 'Archive requires administrator access'; end if;
 insert into public.products(id,name,name_ar,slug,short_description,description,description_ar,category_id,product_type,gender,price,compare_at_price,active,featured,best_seller,new_arrival,archived,tags,meta_title,meta_description,og_image_id)
 values(product_id,p_product->>'name',coalesce(p_product->>'name_ar',''),p_product->>'slug',coalesce(p_product->>'short_description',''),coalesce(p_product->>'description',''),coalesce(p_product->>'description_ar',''),nullif(p_product->>'category_id','')::uuid,coalesce(p_product->>'product_type','T-Shirts'),coalesce(p_product->>'gender','Men'),(p_product->>'price')::numeric,nullif(p_product->>'compare_at_price','')::numeric,coalesce((p_product->>'active')::boolean,false),coalesce((p_product->>'featured')::boolean,false),coalesce((p_product->>'best_seller')::boolean,false),coalesce((p_product->>'new_arrival')::boolean,false),coalesce((p_product->>'archived')::boolean,false),array(select jsonb_array_elements_text(coalesce(p_product->'tags','[]'))),coalesce(p_product->>'meta_title',''),coalesce(p_product->>'meta_description',''),nullif(p_product->>'og_image_id','')::uuid)
 on conflict(id) do update set name=excluded.name,name_ar=excluded.name_ar,slug=excluded.slug,short_description=excluded.short_description,description=excluded.description,description_ar=excluded.description_ar,category_id=excluded.category_id,product_type=excluded.product_type,gender=excluded.gender,price=excluded.price,compare_at_price=excluded.compare_at_price,active=excluded.active,featured=excluded.featured,best_seller=excluded.best_seller,new_arrival=excluded.new_arrival,archived=excluded.archived,tags=excluded.tags,meta_title=excluded.meta_title,meta_description=excluded.meta_description,og_image_id=excluded.og_image_id;
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

-- Migration: 202610070004_overview.sql
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


-- Migration: 202610070005_customer_checkout.sql
create function private.create_customer_profile() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.customers(id,name,email) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),new.email) on conflict(id) do nothing; return new;
end $$;
create trigger customer_after_signup after insert on auth.users for each row execute function private.create_customer_profile();
create function public.quote_order(p_items jsonb,p_promo text default null) returns jsonb language plpgsql security definer set search_path='' as $$
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
 fee:=case when settings.free_shipping_threshold is not null and subtotal-discount>=settings.free_shipping_threshold then 0 else settings.shipping_fee end;
 return jsonb_build_object('subtotal',subtotal,'discount',discount,'shipping',fee,'total',subtotal-discount+fee,'currency',settings.currency);
end $$;
revoke all on function public.quote_order(jsonb,text) from public;
grant execute on function public.quote_order(jsonb,text) to anon,authenticated;

-- Migration: 202610070006_catalog_and_cms.sql
-- Paginated discovery runs in PostgreSQL, so filters cover the entire catalog.
create function public.search_catalog(p_query text default '',p_category uuid default null,p_collection uuid default null,p_type text default '',p_tag text default '',p_size text default '',p_color text default '',p_max_price numeric default null,p_sort text default 'featured',p_page integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 with matching as (
 select p.id,p.price,p.name,p.created_at,p.featured from public.products p
 where p.active and not p.archived
 and (coalesce(p_query,'')='' or p.name ilike '%'||left(p_query,100)||'%' or p.name_ar ilike '%'||left(p_query,100)||'%')
 and (p_category is null or p.category_id=p_category)
 and (p_collection is null or exists(select 1 from public.product_collections c where c.product_id=p.id and c.collection_id=p_collection))
 and (coalesce(p_type,'')='' or p.product_type=p_type)
 and (coalesce(p_tag,'')='' or (p_tag='NEW' and p.new_arrival) or (p_tag='BESTSELLER' and p.best_seller) or (p_tag='SALE' and p.compare_at_price>p.price) or p_tag=any(p.tags))
 and (p_max_price is null or p.price<=p_max_price)
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

create function public.set_homepage_products(p_section uuid,p_products uuid[]) returns void
language plpgsql security definer set search_path='' as $$ begin
 if not private.can_edit() then raise exception 'Content editor access required'; end if;
 if coalesce(array_length(p_products,1),0)>24 then raise exception 'Choose at most 24 products'; end if;
 delete from public.homepage_products where section_id=p_section;
 insert into public.homepage_products(section_id,product_id,display_order)
 select p_section,id,ord-1 from unnest(p_products) with ordinality as a(id,ord);
end $$;
revoke all on function public.set_homepage_products(uuid,uuid[]) from public;
grant execute on function public.set_homepage_products(uuid,uuid[]) to authenticated;

-- A shopper cannot overwrite their account identity/email via the profile editor.
drop policy customer_update on public.customers;
create policy customer_update on public.customers for update to authenticated
 using(id=auth.uid() or private.can_manage())
 with check(private.can_manage() or (id=auth.uid() and email=auth.jwt()->>'email'));

-- Migration: 202610070007_admin_catalog.sql
create function public.admin_catalog(p_filters jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if not private.can_edit() then raise exception 'Team access required'; end if;
 with catalog as (
 select p.*,c.name category,
 coalesce((select sum(stock) from public.product_variants v where v.product_id=p.id and v.active and v.track_quantity),0) stock,
 (select min(sku) from public.product_variants v where v.product_id=p.id and v.active) sku,
 (select coalesce(i.external_url,m.path) from public.product_images i left join public.media m on m.id=i.media_id where i.product_id=p.id order by i.display_order limit 1) image,
 exists(select 1 from public.product_variants v where v.product_id=p.id and v.active and v.track_quantity and v.stock<=v.low_stock_threshold and v.stock>0) low_stock,
 exists(select 1 from public.product_variants v where v.product_id=p.id and v.active and (not v.track_quantity or v.stock>0)) available
 from public.products p left join public.categories c on c.id=p.category_id
 ), filtered as (
 select * from catalog p where
 (coalesce(p_filters->>'q','')='' or p.name ilike '%'||left(p_filters->>'q',100)||'%' or p.slug ilike '%'||left(p_filters->>'q',100)||'%' or exists(select 1 from public.product_variants v where v.product_id=p.id and v.sku ilike '%'||left(p_filters->>'q',100)||'%'))
 and (coalesce(p_filters->>'category_id','')='' or p.category_id=(p_filters->>'category_id')::uuid)
 and (coalesce(p_filters->>'collection_id','')='' or exists(select 1 from public.product_collections pc where pc.product_id=p.id and pc.collection_id=(p_filters->>'collection_id')::uuid))
 and (coalesce(p_filters->>'gender','')='' or p.gender=p_filters->>'gender')
 and (coalesce(p_filters->>'status','')='' or (p_filters->>'status'='active' and p.active and not p.archived) or (p_filters->>'status'='draft' and not p.active and not p.archived) or (p_filters->>'status'='archived' and p.archived))
 and (coalesce(p_filters->>'stock','')='' or (p_filters->>'stock'='low' and p.low_stock) or (p_filters->>'stock'='out' and not p.available) or (p_filters->>'stock'='in' and p.available))
 and (coalesce(p_filters->>'flag','')='' or (p_filters->>'flag'='featured' and p.featured) or (p_filters->>'flag'='best_seller' and p.best_seller) or (p_filters->>'flag'='new_arrival' and p.new_arrival))
 ), paged as (
 select * from filtered order by
 case when p_filters->>'sort'='name' then name end asc,
 case when p_filters->>'sort'='price_low' then price end asc,
 case when p_filters->>'sort'='price_high' then price end desc,
 case when p_filters->>'sort'='stock' then stock end asc,
 case when p_filters->>'sort'='oldest' then created_at end asc,
 created_at desc,id limit 20 offset (greatest(1,least(coalesce((p_filters->>'page')::integer,1),10000))-1)*20
 ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p)) from paged p),'[]'::jsonb),'count',(select count(*) from filtered)) into result;
 return result;
end $$;
revoke all on function public.admin_catalog(jsonb) from public;
grant execute on function public.admin_catalog(jsonb) to authenticated;

create function private.guard_archive() returns trigger language plpgsql set search_path='' as $$ begin
 if new.archived is distinct from old.archived and current_user not in ('postgres','supabase_admin') and not private.can_manage() then raise exception 'Archive requires administrator access'; end if; return new;
end $$;
create trigger guard_archive before update on public.products for each row execute function private.guard_archive();
-- save_product runs as the owner, so its role check must be explicit too.

-- Migration: 202610070008_initial_settings.sql
-- Minimum operational settings; checkout stays closed until the owner configures it.
insert into public.site_settings(store_name) values('EVOLVE') on conflict(singleton) do nothing;

-- Migration: 202610070009_team_profile.sql
create function public.rename_admin(p_name text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.can_edit() or length(trim(p_name)) not between 1 and 80 then raise exception 'Enter a valid team profile name'; end if;
 update public.admin_profiles set name=trim(p_name) where id=auth.uid();
end $$;
revoke all on function public.rename_admin(text) from public;
grant execute on function public.rename_admin(text) to authenticated;

create function private.protect_last_super_admin() returns trigger language plpgsql security definer set search_path='' as $$ begin
 perform pg_advisory_xact_lock(707070);
 if old.role='super_admin' and old.active and (tg_op='DELETE' or new.role<>'super_admin' or not new.active) and not exists(select 1 from public.admin_profiles where id<>old.id and role='super_admin' and active) then raise exception 'Keep at least one active super administrator'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger protect_last_super_admin before update or delete on public.admin_profiles for each row execute function private.protect_last_super_admin();

-- Migration: 202610070010_admin_views.sql
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

-- Migration: 202610070011_initial_homepage.sql
-- Initial editorial content for an empty homepage. No products, stock or checkout changes.
do $homepage$
begin
if exists(select 1 from public.homepage_sections) then return; end if;
insert into public.media(id,path,name,mime_type,size,folder) values('e7010000-0000-4000-8000-000000000010','https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1800&q=85&fm=webp','Hero training','image/webp',1,'homepage') on conflict do nothing;
insert into public.media(id,path,name,mime_type,size,folder) values('e7010000-0000-4000-8000-000000000011','https://images.unsplash.com/photo-1552902865-b72c031ac5ea?auto=format&fit=crop&w=1100&q=85&fm=webp','Sweatpants lifestyle','image/webp',1,'homepage') on conflict do nothing;
insert into public.media(id,path,name,mime_type,size,folder) values('e7010000-0000-4000-8000-000000000012','https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=85&fm=webp','Core collection','image/webp',1,'homepage') on conflict do nothing;
insert into public.categories(id,name,name_ar,slug,image_id,display_order,active) values('e7010000-0000-4000-8000-000000000020','Gym wear','ملابس التدريب','gym-wear',(select id from public.media where path='https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1800&q=85&fm=webp'),0,true) on conflict do nothing;
insert into public.categories(id,name,name_ar,slug,image_id,display_order,active) values('e7010000-0000-4000-8000-000000000021','Sweatpants','البناطيل الرياضية','sweatpants',(select id from public.media where path='https://images.unsplash.com/photo-1552902865-b72c031ac5ea?auto=format&fit=crop&w=1100&q=85&fm=webp'),1,true) on conflict do nothing;
insert into public.collections(id,name,slug,active,featured,display_order) values('e7010000-0000-4000-8000-000000000030','Core Collection','core',true,true,0) on conflict do nothing;
insert into public.collections(id,name,slug,active,featured,display_order) values('e7010000-0000-4000-8000-000000000031','Best Sellers','best-sellers',true,false,1) on conflict do nothing;
insert into public.collections(id,name,slug,active,featured,display_order) values('e7010000-0000-4000-8000-000000000032','New Arrivals','new-arrivals',true,false,2) on conflict do nothing;
insert into public.homepage_sections(id,key,title,display_order,active,published) values('e7010000-0000-4000-8000-000000000300','hero','Hero',0,true,true) on conflict do nothing;
insert into public.homepage_sections(id,key,title,display_order,active,published) values('e7010000-0000-4000-8000-000000000301','strip','Moving brand strip',1,true,true) on conflict do nothing;
insert into public.homepage_sections(id,key,title,display_order,active,published) values('e7010000-0000-4000-8000-000000000302','categories','Categories',2,true,true) on conflict do nothing;
insert into public.homepage_sections(id,key,title,display_order,active,published) values('e7010000-0000-4000-8000-000000000303','products','Featured products',3,true,true) on conflict do nothing;
insert into public.homepage_sections(id,key,title,display_order,active,published) values('e7010000-0000-4000-8000-000000000304','core_collection','Core collection',4,true,true) on conflict do nothing;
insert into public.homepage_sections(id,key,title,display_order,active,published) values('e7010000-0000-4000-8000-000000000305','story','Our story',5,true,true) on conflict do nothing;
insert into public.homepage_sections(id,key,title,display_order,active,published) values('e7010000-0000-4000-8000-000000000306','values','Brand values',6,true,true) on conflict do nothing;
insert into public.homepage_sections(id,key,title,display_order,active,published) values('e7010000-0000-4000-8000-000000000307','faq','FAQ',7,true,true) on conflict do nothing;
insert into public.homepage_content(id,section_id,cta_url,background,display_order,eyebrow,heading,heading_ar,description,description_ar,cta_label,cta_label_ar,image_id) values('e7010000-0000-4000-8000-000000000400',(select id from public.homepage_sections where key='hero'),'/shop','charcoal',0,'ENGINEERED TO WORK. BUILT TO LIVE.','STRENGTH IN
EVERY MOVE.','القوة في
كل حركة.','Purpose-built essentials for the way you move. From your first rep to your next chapter.','ملابس أساسية تواكب طموحك. من أول تكرار إلى آخر خطوة.','Shop Now','تسوق الآن',(select id from public.media where path='https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1800&q=85&fm=webp')) on conflict do nothing;
insert into public.homepage_content(id,section_id,cta_url,background,display_order,eyebrow,heading,heading_ar) values('e7010000-0000-4000-8000-000000000401',(select id from public.homepage_sections where key='categories'),'/shop','ivory',0,'THE RIGHT GEAR. YOUR WAY.','Built for your everyday.','مصممة لكل يوم.') on conflict do nothing;
insert into public.homepage_content(id,section_id,cta_url,background,display_order,heading,heading_ar,category_id,image_id) values('e7010000-0000-4000-8000-000000000402',(select id from public.homepage_sections where key='categories'),'/shop','ivory',1,'Gym wear','ملابس التدريب',(select id from public.categories where slug='gym-wear'),(select id from public.media where path='https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1800&q=85&fm=webp')) on conflict do nothing;
insert into public.homepage_content(id,section_id,cta_url,background,display_order,heading,heading_ar,category_id,image_id) values('e7010000-0000-4000-8000-000000000403',(select id from public.homepage_sections where key='categories'),'/shop','ivory',2,'Sweatpants','البناطيل الرياضية',(select id from public.categories where slug='sweatpants'),(select id from public.media where path='https://images.unsplash.com/photo-1552902865-b72c031ac5ea?auto=format&fit=crop&w=1100&q=85&fm=webp')) on conflict do nothing;
insert into public.homepage_content(id,section_id,cta_url,background,display_order,eyebrow,heading,heading_ar,collection_id) values('e7010000-0000-4000-8000-000000000404',(select id from public.homepage_sections where key='products'),'/shop','ivory',0,'HEAVY ROTATION. FOR A REASON.','Your next go-to.','قطع أساسية مميزة.',(select id from public.collections where slug='best-sellers')) on conflict do nothing;
insert into public.homepage_content(id,section_id,cta_url,background,display_order,eyebrow,heading,heading_ar,description,description_ar,cta_label,cta_label_ar,image_id) values('e7010000-0000-4000-8000-000000000405',(select id from public.homepage_sections where key='core_collection'),'/collections/core','charcoal',0,'THE CORE COLLECTION / VOL. 01','LESS NOISE.
MORE FOCUS.','أقل ضوضاء.
أكثر تركيزًا.','Essentials that show up when you do.','قطع أساسية معاك في كل خطوة.','Discover the core collection','اكتشف مجموعة كور',(select id from public.media where path='https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=85&fm=webp')) on conflict do nothing;
insert into public.homepage_content(id,section_id,cta_url,background,display_order,eyebrow,heading,heading_ar,description,description_ar,cta_label,cta_label_ar) values('e7010000-0000-4000-8000-000000000406',(select id from public.homepage_sections where key='story'),'/about','red',0,'MORE THAN A ROTATION','FOR THOSE WHO SHOW UP.','للي بيختاروا يكملوا.','From the first step to the final rep. Get to know the mindset behind EVOLVE.','من أول خطوة لآخر تكرار. اكتشف الفكرة وراء EVOLVE.','Our story','قصة EVOLVE') on conflict do nothing;
insert into public.homepage_content(id,section_id,cta_url,background,display_order,heading,heading_ar,description,description_ar) values('e7010000-0000-4000-8000-000000000407',(select id from public.homepage_sections where key='values'),'/shop','ivory',0,'Made to move','مصممة للحركة','Fits that give you space to move your way.','قصات تسيب لك مساحة تتحرك بطريقتك.') on conflict do nothing;
insert into public.homepage_content(id,section_id,cta_url,background,display_order,heading,heading_ar,description,description_ar) values('e7010000-0000-4000-8000-000000000408',(select id from public.homepage_sections where key='values'),'/shop','ivory',1,'Purpose in every detail','كل تفصيلة لها هدف','Clean lines and practical details, without the noise.','خطوط نظيفة وتفاصيل عملية بدون تعقيد.') on conflict do nothing;
insert into public.homepage_content(id,section_id,cta_url,background,display_order,heading,heading_ar,description,description_ar) values('e7010000-0000-4000-8000-000000000409',(select id from public.homepage_sections where key='values'),'/shop','ivory',2,'Beyond the gym','أبعد من الجيم','A rotation that feels at home in and beyond the gym.','قطع تقدر تلبسها في النادي وخارجه.') on conflict do nothing;
insert into public.homepage_content(id,section_id,cta_url,background,display_order,eyebrow,heading,description,cta_label) values('e7010000-0000-4000-8000-000000000410',(select id from public.homepage_sections where key='faq'),'/contact','ivory',0,'GOOD TO KNOW / FAQ','FAQ','A few details to help you make your next move.','Contact us') on conflict do nothing;
insert into public.faqs(id,question,question_ar,answer,answer_ar,active,display_order) values('e7010000-0000-4000-8000-000000000500','How do I choose a size?','أختار المقاس إزاي؟','Check the size guide on the product page. Development measurements are illustrative until final garment specifications are supplied.','راجع دليل المقاسات في صفحة المنتج. القياسات توضيحية لحد إضافة مواصفات القطع النهائية.',true,0) on conflict do nothing;
insert into public.faqs(id,question,question_ar,answer,answer_ar,active,display_order) values('e7010000-0000-4000-8000-000000000501','Can I place an order?','أقدر أعمل طلب؟','Checkout stays unavailable until the store owner enables it. Card payments are not supported by this installation.','إتمام الطلب غير متاح لحد ما صاحب المتجر يفعله. النسخة الحالية لا تدعم الدفع بالبطاقات.',true,1) on conflict do nothing;
end;
$homepage$;

-- Migration: 202610080001_delivery_estimates.sql
-- Store owner confirmed two days preparation and delivery within five days after dispatch.
alter table public.site_settings
  add column delivery_estimates_enabled boolean not null default true,
  add column dispatch_days_min integer default 2,
  add column dispatch_days_max integer default 2,
  add column transit_days_min integer default 1,
  add column transit_days_max integer default 5,
  add column delivery_skip_weekends boolean not null default false,
  add column delivery_timezone text not null default 'Africa/Cairo',
  add constraint delivery_estimate_ranges check (
    (dispatch_days_min is null or dispatch_days_min between 0 and 30) and
    (dispatch_days_max is null or dispatch_days_max between 0 and 30) and
    (transit_days_min is null or transit_days_min between 1 and 60) and
    (transit_days_max is null or transit_days_max between 1 and 60) and
    (dispatch_days_min is null or dispatch_days_max is null or dispatch_days_max >= dispatch_days_min) and
    (transit_days_min is null or transit_days_max is null or transit_days_max >= transit_days_min) and
    (not delivery_estimates_enabled or (
      dispatch_days_min is not null and dispatch_days_max is not null and
      transit_days_min is not null and transit_days_max is not null
    ))
  );

-- Existing settings RLS keeps updates restricted to the super admin.

-- Migration: 202610080002_hero_text_visibility.sql
-- Hide hero text without deleting saved English or Arabic copy.
alter table public.homepage_content
  add column show_eyebrow boolean not null default true,
  add column show_heading boolean not null default true,
  add column show_description boolean not null default true;

-- Migration: 202610090001_governorate_shipping.sql
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

notify pgrst, 'reload schema';
commit;

-- Migration: 202610090002_product_offers.sql
-- Automatic product offers and configurable card badges. Safe to repeat.
begin;
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
commit;

-- Migration: 202610090003_quantity_offers.sql
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

-- Migration: 202610090004_custom_offer_types.sql
begin;

create table if not exists public.offer_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 80),
  name_ar text not null default '' check(length(name_ar)<=80),
  calculation text not null check(calculation in ('percentage','fixed','buy_get')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists offer_types_name_unique on public.offer_types(lower(trim(name)));
alter table public.offer_types enable row level security;
drop policy if exists offer_types_manage on public.offer_types;
create policy offer_types_manage on public.offer_types for all to authenticated
  using(private.can_manage()) with check(private.can_manage());
grant select,insert,update,delete on public.offer_types to authenticated;

alter table public.offers add column if not exists offer_type_id uuid references public.offer_types(id) on delete set null;
create index if not exists offers_type_idx on public.offers(offer_type_id);

-- Custom names retain the trusted calculation engine; no executable rules come from clients.
create or replace function private.assign_offer_type() returns trigger
language plpgsql security definer set search_path='' as $$
declare selected public.offer_types; begin
  if new.offer_type_id is null then return new; end if;
  select * into selected from public.offer_types where id=new.offer_type_id for share;
  if not found then raise exception 'Offer type does not exist'; end if;
  if not selected.active and (tg_op='INSERT' or new.offer_type_id is distinct from old.offer_type_id) then
    raise exception 'Choose an active offer type';
  end if;
  new.discount_type:=selected.calculation;
  return new;
end $$;
revoke all on function private.assign_offer_type() from public;
drop trigger if exists assign_offer_type on public.offers;
create trigger assign_offer_type before insert or update on public.offers
  for each row execute function private.assign_offer_type();

create or replace function private.guard_offer_type_method() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  if new.calculation is distinct from old.calculation and exists(select 1 from public.offers where offer_type_id=old.id) then
    raise exception 'This type is already used by offers. Create a new type to use a different calculation method.';
  end if;
  return new;
end $$;
revoke all on function private.guard_offer_type_method() from public;
drop trigger if exists guard_offer_type_method on public.offer_types;
create trigger guard_offer_type_method before update on public.offer_types
  for each row execute function private.guard_offer_type_method();
drop trigger if exists touch_updated_at on public.offer_types;
create trigger touch_updated_at before update on public.offer_types
  for each row execute function private.touch_updated_at();
drop trigger if exists audit_changes on public.offer_types;
create trigger audit_changes after insert or update or delete on public.offer_types
  for each row execute function private.audit_change();

notify pgrst, 'reload schema';
commit;

-- Migration: 202610090005_catalog_placement.sql
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

-- Migration: 202610090006_offer_announcements.sql
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

-- Migration: 202610110001_category_page_title.sql
-- Let category editors decide whether its name appears on the category page.
-- Existing categories default to a clean, image-only hero.
alter table public.categories
  add column if not exists show_page_title boolean not null default false;

notify pgrst, 'reload schema';

