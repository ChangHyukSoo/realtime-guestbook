-- Read-only metadata snapshot for T031. No tokens, email addresses or object paths.
-- Run with: supabase db query --remote=<project-ref> --read-only --file <this-file>
select jsonb_build_object(
  'migration_history_present', to_regclass('supabase_migrations.schema_migrations') is not null,
  'tables', coalesce((
    select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('profiles','guestbooks','comments') and c.relkind='r'
  ),'[]'::jsonb),
  'profile_columns', coalesce((
    select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=to_regclass('public.profiles') and a.attnum>0 and not a.attisdropped
  ),'[]'::jsonb),
  'profile_privileges', coalesce((
    select jsonb_agg(jsonb_build_object('role',r.rolname,
      'select',has_table_privilege(r.oid,c.oid,'SELECT'),
      'table_update',has_table_privilege(r.oid,c.oid,'UPDATE'),
      'any_column_update',has_any_column_privilege(r.oid,c.oid,'UPDATE')) order by r.rolname)
    from pg_roles r join pg_class c on c.oid=to_regclass('public.profiles')
    where r.rolname in ('anon','authenticated','service_role')
  ),'[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname)
    from pg_policies p where (p.schemaname='public' and p.tablename='profiles')
      or (p.schemaname='storage' and p.tablename='objects')
  ),'[]'::jsonb),
  'functions', coalesce((
    select jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
      'result',pg_get_function_result(p.oid),'security_definer',p.prosecdef,'settings',p.proconfig,
      'execute_anon',has_function_privilege('anon',p.oid,'EXECUTE'),
      'execute_authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
      'execute_service_role',has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.proname,p.oid)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('save_own_profile','validate_profile_update','rotate_profile_revision','create_member_profile')
  ),'[]'::jsonb),
  'profile_triggers', coalesce((
    select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname)
    from pg_trigger t where t.tgrelid=to_regclass('public.profiles') and not t.tgisinternal
  ),'[]'::jsonb),
  'profile_constraints', coalesce((
    select jsonb_agg(jsonb_build_object('name',c.conname,'definition',pg_get_constraintdef(c.oid)) order by c.conname)
    from pg_constraint c where c.conrelid=to_regclass('public.profiles')
  ),'[]'::jsonb),
  'profile_indexes', coalesce((
    select jsonb_agg(jsonb_build_object('name',i.indexname,'definition',i.indexdef) order by i.indexname)
    from pg_indexes i where i.schemaname='public' and i.tablename='profiles'
  ),'[]'::jsonb),
  'avatar_bucket', coalesce((
    select jsonb_agg(jsonb_build_object('id',b.id,'public',b.public,'file_size_limit',b.file_size_limit,'allowed_mime_types',b.allowed_mime_types))
    from storage.buckets b where b.id='profile-avatars'
  ),'[]'::jsonb)
) as profile_preflight;
