-- Let category editors decide whether its name appears on the category page.
-- Existing categories default to a clean, image-only hero.
alter table public.categories
  add column if not exists show_page_title boolean not null default false;

notify pgrst, 'reload schema';
