-- Read-only transition prerequisites. No member identities or object paths.
select jsonb_build_object(
  'profiles', (select count(*) from public.profiles),
  'profile_avatars', (select count(*) from storage.objects where bucket_id = 'profile-avatars'),
  'revision_present', exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'revision'
  ),
  'save_rpc_present', to_regprocedure('public.save_own_profile(uuid,uuid,text,text)') is not null,
  'service_role_present', exists (select 1 from pg_roles where rolname = 'service_role')
) as transition_readiness;
