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
