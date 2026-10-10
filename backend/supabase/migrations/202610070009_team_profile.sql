create function public.rename_admin(p_name text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.can_edit() or length(trim(p_name)) not between 1 and 80 then raise exception 'Enter a valid team profile name'; end if;
 update public.admin_profiles set name=trim(p_name) where id=auth.uid();
end $$;
revoke all on function public.rename_admin(text) from public;
grant execute on function public.rename_admin(text) to authenticated;

create function private.protect_last_super_admin() returns trigger language plpgsql security definer set search_path='' as $$ begin
 perform pg_advisory_xact_lock(707070);
 if old.role='super_admin' and old.active and (tg_op='DELETE' or new.role<>'super_admin' or not new.active) and not exists(select 1 from public.admin_profiles where id<>old.id and role='super_admin' and active) then raise exception 'Keep at least one active super administrator'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger protect_last_super_admin before update or delete on public.admin_profiles for each row execute function private.protect_last_super_admin();
