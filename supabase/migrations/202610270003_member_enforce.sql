-- Require the image migration, a backup, and tested authenticated client deployment.
do $$ begin
  if exists(select 1 from public.guestbooks g where g.image_object_path is null or not exists(
    select 1 from storage.objects o where o.bucket_id='guestbook-images-private' and o.name=g.image_object_path
  )) then raise exception 'Private images are not ready'; end if;
  if exists(select 1 from auth.users u where not coalesce(u.is_anonymous,false) and not exists(select 1 from public.profiles p where p.id=u.id)) then raise exception 'Repair missing member profiles first'; end if;
end $$;
drop policy if exists "Public guestbook read" on public.guestbooks;
drop policy if exists "Public guestbook insert" on public.guestbooks;
drop policy if exists "Public comment read" on public.comments;
drop policy if exists "Public comment insert" on public.comments;
revoke all on public.guestbooks,public.comments from public,anon;
revoke update,delete,truncate,references,trigger on public.guestbooks,public.comments from authenticated;
drop policy if exists "Public image upload" on storage.objects;
drop policy if exists "Public image read" on storage.objects;
update storage.buckets set public=false where id='guestbook-images';
-- Fail closed if unrelated permissive policies remain; inspect them manually.
do $$ begin
  if exists(select 1 from pg_policies where schemaname='public' and tablename in ('guestbooks','comments','profiles') and ('anon'=any(roles) or 'public'=any(roles))) then raise exception 'Unexpected public policies remain'; end if;
end $$;
-- Intentionally do not alter the unrelated legacy public.guestbook table.
