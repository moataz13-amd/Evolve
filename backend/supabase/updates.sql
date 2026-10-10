-- EVOLVE updates for an ALREADY configured store. Safe to run more than once.
-- Does not recreate tables, remove data, or change saved content/settings.
begin;

do $$
begin
  if to_regclass('public.site_settings') is null or to_regclass('public.homepage_content') is null then
    raise exception 'This update requires an existing EVOLVE database. Use setup.sql only on a new project.';
  end if;
end $$;

alter table public.site_settings
  add column if not exists delivery_estimates_enabled boolean not null default true,
  add column if not exists dispatch_days_min integer default 2,
  add column if not exists dispatch_days_max integer default 2,
  add column if not exists transit_days_min integer default 1,
  add column if not exists transit_days_max integer default 5,
  add column if not exists delivery_skip_weekends boolean not null default false,
  add column if not exists delivery_timezone text not null default 'Africa/Cairo';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.site_settings'::regclass and conname = 'delivery_estimate_ranges'
  ) then
    alter table public.site_settings add constraint delivery_estimate_ranges check (
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
  end if;
end $$;

alter table public.homepage_content
  add column if not exists show_eyebrow boolean not null default true,
  add column if not exists show_heading boolean not null default true,
  add column if not exists show_description boolean not null default true;

notify pgrst, 'reload schema';
commit;
