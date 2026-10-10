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
