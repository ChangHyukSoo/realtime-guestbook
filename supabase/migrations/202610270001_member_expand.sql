-- Apply after the baseline schema, once the remote schema has been inventoried.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 20),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
create policy "Members read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()) and not coalesce((auth.jwt()->>'is_anonymous')::boolean, true));

create function public.create_member_profile() returns trigger language plpgsql security definer set search_path = '' as $$
declare display_name text := btrim(new.raw_user_meta_data->>'nickname');
begin
  if coalesce(new.is_anonymous, false) then return new; end if;
  if display_name is null or char_length(display_name) not between 1 and 20 then
    raise exception 'Nickname must contain 1 to 20 characters';
  end if;
  insert into public.profiles(id,nickname) values(new.id,display_name);
  return new;
end $$;
revoke all on function public.create_member_profile() from public, anon, authenticated;
create trigger create_member_profile after insert on auth.users for each row execute function public.create_member_profile();
-- Existing accounts need an explicitly reviewed nickname; do not invent ownership.
insert into public.profiles(id,nickname)
select id,btrim(raw_user_meta_data->>'nickname') from auth.users
where not coalesce(is_anonymous,false) and char_length(btrim(raw_user_meta_data->>'nickname')) between 1 and 20
on conflict(id) do nothing;

alter table public.guestbooks add column author_id uuid default auth.uid() references auth.users(id) on delete set null;
alter table public.comments add column author_id uuid default auth.uid() references auth.users(id) on delete set null;
alter table public.guestbooks add column image_object_path text;
alter table public.guestbooks alter column image_path drop not null;
create unique index guestbooks_object_path_idx on public.guestbooks(image_object_path) where image_object_path is not null;
create index guestbooks_author_idx on public.guestbooks(author_id);
create index comments_author_idx on public.comments(author_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('guestbook-images-private','guestbook-images-private',false,5242880,array['image/png'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/png'];

grant select,insert on public.guestbooks,public.comments to authenticated;
create policy "Members read guestbooks" on public.guestbooks for select to authenticated
using (not coalesce((auth.jwt()->>'is_anonymous')::boolean,true));
create policy "Members read comments" on public.comments for select to authenticated
using (not coalesce((auth.jwt()->>'is_anonymous')::boolean,true));
create policy "Members insert guestbooks" on public.guestbooks for insert to authenticated
with check (author_id=(select auth.uid()) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,true));
create policy "Members insert comments" on public.comments for insert to authenticated
with check (author_id=(select auth.uid()) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,true));
create policy "Members read private images" on storage.objects for select to authenticated
using (bucket_id='guestbook-images-private' and not coalesce((auth.jwt()->>'is_anonymous')::boolean,true));
create function public.member_upload_allowed() returns boolean language plpgsql security definer set search_path = '' as $$
declare member_id uuid := auth.uid();
begin
  if member_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then return false; end if;
  if not exists(select 1 from public.profiles where id=member_id) then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(member_id::text,0));
  return (select count(*) from storage.objects where bucket_id='guestbook-images-private' and owner_id=member_id::text and created_at > now()-interval '1 minute') < 10;
end $$;
revoke all on function public.member_upload_allowed() from public,anon,authenticated;
grant execute on function public.member_upload_allowed() to authenticated;
create policy "Members upload own images" on storage.objects for insert to authenticated
with check (bucket_id='guestbook-images-private' and not coalesce((auth.jwt()->>'is_anonymous')::boolean,true)
  and owner_id=(select auth.uid())::text and public.member_upload_allowed()
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]png$'));

-- SECURITY DEFINER is restricted to trigger invocation, with no caller-controlled SQL.
create function public.validate_member_content() returns trigger language plpgsql security definer set search_path = '' as $$
declare member_id uuid := auth.uid(); display_name text;
begin
  if member_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception 'Membership required'; end if;
  if new.author_id is distinct from member_id then raise exception 'Invalid author'; end if;
  select nickname into display_name from public.profiles where id=member_id;
  if display_name is null then raise exception 'Member profile required'; end if;
  -- Serialize per account, including concurrent direct REST requests.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(member_id::text,0));
  if tg_table_name='guestbooks' then
    if new.image_path is not null then raise exception 'Client image URLs not accepted'; end if;
    if (select count(*) from public.guestbooks where author_id=member_id and created_at > now()-interval '1 minute') >= 5 then raise exception 'Posting limit reached'; end if;
    if new.image_object_path is distinct from member_id::text || '/' || new.id::text || '.png' then raise exception 'Invalid image path'; end if;
    if not exists(select 1 from storage.objects where bucket_id='guestbook-images-private' and name=new.image_object_path and owner_id=member_id::text) then raise exception 'Owned image required'; end if;
    new.image_path := null;
  else
    if (select count(*) from public.comments where author_id=member_id and created_at > now()-interval '1 minute') >= 20 then raise exception 'Comment limit reached'; end if;
    new.nickname := display_name;
    new.content := btrim(new.content);
  end if;
  new.created_at := now();
  return new;
end $$;
revoke all on function public.validate_member_content() from public,anon,authenticated;
create trigger validate_member_guestbook before insert on public.guestbooks for each row execute function public.validate_member_content();
create trigger validate_member_comment before insert on public.comments for each row execute function public.validate_member_content();
