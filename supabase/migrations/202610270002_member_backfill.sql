-- Run scripts/migrate-images.mjs --apply first. Refuse to hide unresolved images.
do $$ begin
  if exists(select 1 from public.guestbooks g where g.image_object_path is null or not exists(
    select 1 from storage.objects o where o.bucket_id='guestbook-images-private' and o.name=g.image_object_path
  )) then raise exception 'Complete and verify private image migration before proceeding'; end if;
end $$;
