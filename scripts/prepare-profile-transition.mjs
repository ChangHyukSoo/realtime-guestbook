// Creates reviewable CLI SQL inputs without reading credentials.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const directory = 'backups/profile-transition-20261103';
await mkdir(directory, { recursive: true });
const source = await readFile('supabase/migrations/202611020001_profile_revision.sql', 'utf8');
if (!/begin;/.test(source) || !/commit;\s*$/.test(source)) throw new Error('Unexpected migration transaction');
const body = source.replace(/commit;\s*$/, '');
const assertions = `
do $check$ begin
  if to_regprocedure('public.save_own_profile(uuid,uuid,text,text)') is null
    or has_any_column_privilege('authenticated','public.profiles','UPDATE')
    or has_function_privilege('authenticated','public.save_own_profile(uuid,uuid,text,text)','EXECUTE')
    or not has_function_privilege('service_role','public.save_own_profile(uuid,uuid,text,text)','EXECUTE')
    or exists(select 1 from public.profiles where revision is null)
  then raise exception 'Profile transition postconditions failed'; end if;
end $check$;
`;
await writeFile(`${directory}/rehearsal.sql`, body + assertions + '\nrollback;\n');
const quoted = source.replaceAll("'", "''");
const history = `insert into supabase_migrations.schema_migrations(version,name,statements)
values ('202611020001','profile_revision',array['${quoted}']);\n`;
await writeFile(`${directory}/apply.sql`, body + assertions + history + '\ncommit;\n');
await writeFile(`${directory}/migration-sha256.txt`, createHash('sha256').update(source).digest('hex') + '\n');
console.log('Prepared transactional rehearsal and migration with atomic history recording.');
