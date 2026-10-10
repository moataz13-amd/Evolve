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
