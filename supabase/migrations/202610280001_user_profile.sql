-- Existing duplicate nicknames must be resolved explicitly before this migration.
alter table public.profiles add column avatar_path text;
create unique index profiles_nickname_unique on public.profiles (lower(btrim(nickname)));
-- Signup always starts from the email local part. Collisions receive a UID suffix.
create or replace function public.create_member_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare base_name text; display_name text; attempt integer := 0;
begin
  if coalesce(new.is_anonymous,false) then return new; end if;
  base_name := left(coalesce(nullif(split_part(new.email,'@',1),''),'member'),20);
  display_name := base_name;
  loop
    begin
      insert into public.profiles(id,nickname) values(new.id,display_name);
      return new;
    exception when unique_violation then
      if exists(select 1 from public.profiles where id=new.id) then return new; end if;
      attempt := attempt+1;
      display_name := left(base_name,7) || '-' || left(replace(new.id::text,'-',''),8) || '-' || attempt::text;
    end;
  end loop;
end $$;
alter table public.profiles add constraint profiles_avatar_path_check check (
  avatar_path is null or avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}[.](png|jpg|webp)$')
);
drop policy "Members read own profile" on public.profiles;
create policy "Members read profiles" on public.profiles for select to authenticated
using (not coalesce((auth.jwt()->>'is_anonymous')::boolean,true));
grant update(nickname,avatar_path) on public.profiles to authenticated;
create policy "Members update own profile" on public.profiles for update to authenticated
using (id=(select auth.uid()) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,true))
with check (id=(select auth.uid()) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,true));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-avatars','profile-avatars',false,5242880,array['image/png','image/jpeg','image/webp']);
create policy "Members read avatars" on storage.objects for select to authenticated
using (bucket_id='profile-avatars' and not coalesce((auth.jwt()->>'is_anonymous')::boolean,true));
create policy "Members upload avatars" on storage.objects for insert to authenticated
with check (bucket_id='profile-avatars' and owner_id=(select auth.uid())::text
  and not coalesce((auth.jwt()->>'is_anonymous')::boolean,true)
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}[.](png|jpg|webp)$'));
create policy "Members delete own avatars" on storage.objects for delete to authenticated
using (bucket_id='profile-avatars' and owner_id=(select auth.uid())::text
  and not coalesce((auth.jwt()->>'is_anonymous')::boolean,true)
  and not exists(select 1 from public.profiles where avatar_path=storage.objects.name));

create function public.validate_profile_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.nickname := btrim(new.nickname);
  if new.avatar_path is not null and new.avatar_path is distinct from old.avatar_path and not exists (
    select 1 from storage.objects where bucket_id='profile-avatars' and name=new.avatar_path and owner_id=new.id::text
  ) then raise exception 'Owned avatar required'; end if;
  return new;
end $$;
revoke all on function public.validate_profile_update() from public,anon,authenticated;
create trigger validate_profile_update before update on public.profiles for each row execute function public.validate_profile_update();
