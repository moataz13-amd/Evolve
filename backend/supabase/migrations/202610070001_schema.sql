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
