-- Hide hero text without deleting saved English or Arabic copy.
alter table public.homepage_content
  add column show_eyebrow boolean not null default true,
  add column show_heading boolean not null default true,
  add column show_description boolean not null default true;
