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
