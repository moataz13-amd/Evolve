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
