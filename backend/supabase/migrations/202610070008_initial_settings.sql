-- Minimum operational settings; checkout stays closed until the owner configures it.
insert into public.site_settings(store_name) values('EVOLVE') on conflict(singleton) do nothing;
