-- Apply together with the compatible app during the documented maintenance window.
begin;
alter table public.profiles add column revision uuid not null default gen_random_uuid();

create or replace function public.validate_profile_update() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.nickname := btrim(new.nickname);
  if new.avatar_path is distinct from old.avatar_path and new.avatar_path is not null then
    if new.avatar_path !~ ('^' || new.id::text || '/[0-9a-f-]{36}[.](png|jpg|webp)$')
      or not exists (select 1 from storage.objects where bucket_id='profile-avatars'
        and name=new.avatar_path and nullif(owner_id,'') is null) then
      raise exception 'Validated server avatar required' using errcode='23514';
    end if;
  end if;
  return new;
end $$;

create function public.rotate_profile_revision() returns trigger
language plpgsql set search_path='' as $$
begin
  new.revision := gen_random_uuid();
  return new;
end $$;
revoke all on function public.rotate_profile_revision() from public,anon,authenticated;
create trigger rotate_profile_revision before update on public.profiles
for each row execute function public.rotate_profile_revision();

revoke update on public.profiles from public,anon,authenticated;
-- Table-level REVOKE does not remove historical column privileges.
do $$ declare col record; begin
  for col in select column_name from information_schema.columns
    where table_schema='public' and table_name='profiles' loop
    execute format('revoke update (%I) on public.profiles from public, anon, authenticated',col.column_name);
  end loop;
end $$;
drop policy if exists "Members update own profile" on public.profiles;
drop policy if exists "Members upload avatars" on storage.objects;
drop policy if exists "Members delete own avatars" on storage.objects;
-- Restrictive guards also close other permissive policies for this bucket.
create policy "Server-only avatar insert" on storage.objects as restrictive for insert to authenticated,anon
with check (bucket_id <> 'profile-avatars');
create policy "Server-only avatar update" on storage.objects as restrictive for update to authenticated,anon
using (bucket_id <> 'profile-avatars') with check (bucket_id <> 'profile-avatars');
create policy "Server-only avatar delete" on storage.objects as restrictive for delete to authenticated,anon
using (bucket_id <> 'profile-avatars');

create function public.save_own_profile(p_member_id uuid,p_expected_revision uuid,p_nickname text,p_avatar_path text default null)
returns table(status text,nickname text,avatar_path text,revision uuid,previous_avatar_path text)
language plpgsql security definer set search_path='' as $$
declare current_profile public.profiles%rowtype;
begin
  if not exists(select 1 from auth.users where id=p_member_id
    and not coalesce(is_anonymous,false) and email_confirmed_at is not null) then
    raise exception 'Membership required' using errcode='42501';
  end if;
  if p_expected_revision is null then
    raise exception 'Revision required' using errcode='22023';
  end if;
  select p.* into current_profile from public.profiles p where p.id=p_member_id for update;
  if not found then raise exception 'Profile unavailable' using errcode='P0002'; end if;
  if current_profile.revision <> p_expected_revision then
    return query select 'conflict'::text,null::text,null::text,null::uuid,null::text;
    return;
  end if;
  if p_nickname is null or char_length(btrim(p_nickname)) not between 1 and 20 then
    raise exception 'Invalid nickname' using errcode='23514';
  end if;
  return query update public.profiles p set nickname=btrim(p_nickname),
    avatar_path=coalesce(p_avatar_path,p.avatar_path) where p.id=p_member_id
    returning 'saved'::text,p.nickname,p.avatar_path,p.revision,current_profile.avatar_path;
end $$;
revoke all on function public.save_own_profile(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_own_profile(uuid,uuid,text,text) to service_role;
commit;
