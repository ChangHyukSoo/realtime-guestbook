// Service key stays in this process. Dry-run is the default. Never run in a browser.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this server process.');
const apply = process.argv.includes('--apply');
const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const backup = `backups/member-${new Date().toISOString().replace(/[:.]/g,'-')}`;
await mkdir(backup,{recursive:true});
async function rows(table) {
  const result=[];
  for(let start=0;;start+=1000) {
    const {data,error}=await client.from(table).select('*').order('id').range(start,start+999);
    if(error) throw error;
    result.push(...data); if(data.length<1000) return result;
  }
}
const entries=await rows('guestbooks');
await writeFile(`${backup}/guestbooks.json`,JSON.stringify(entries,null,2));
await writeFile(`${backup}/comments.json`,JSON.stringify(await rows('comments'),null,2));
const legacy=await client.from('guestbook').select('*').order('id');
if(legacy.error && !['42P01','PGRST205'].includes(legacy.error.code)) throw legacy.error;
await writeFile(`${backup}/legacy-guestbook.json`,JSON.stringify(legacy.data ?? [],null,2));
const manifest=[];
for(const entry of entries) {
  if(entry.image_object_path) continue;
  const source=new URL(entry.image_path);
  const prefix='/storage/v1/object/public/guestbook-images/';
  if(source.origin!==new URL(url).origin || !source.pathname.startsWith(prefix) || source.search || source.hash) throw new Error(`Untrusted legacy image URL for ${entry.id}`);
  const name=decodeURIComponent(source.pathname.slice(prefix.length));
  if(name!==`${entry.id}.png`) throw new Error(`Unexpected legacy object path for ${entry.id}`);
  const {data,error}=await client.storage.from('guestbook-images').download(name);
  if(error) throw error;
  const bytes=Buffer.from(await data.arrayBuffer());
  const sha256=createHash('sha256').update(bytes).digest('hex');
  await writeFile(`${backup}/${entry.id}.png`,bytes);
  const target=`legacy/${entry.id}.png`;
  if(apply) {
    const upload=await client.storage.from('guestbook-images-private').upload(target,bytes,{contentType:'image/png',upsert:false});
    if(upload.error && String(upload.error.statusCode)!=='409') throw upload.error;
    const copied=await client.storage.from('guestbook-images-private').download(target);
    if(copied.error) throw copied.error;
    if(createHash('sha256').update(Buffer.from(await copied.data.arrayBuffer())).digest('hex')!==sha256) throw new Error(`Checksum mismatch for ${entry.id}`);
    const update=await client.from('guestbooks').update({image_object_path:target}).eq('id',entry.id).is('image_object_path',null);
    if(update.error) throw update.error;
  }
  manifest.push({id:entry.id,source:name,target,sha256,bytes:bytes.length,applied:apply});
  await writeFile(`${backup}/manifest.json`,JSON.stringify(manifest,null,2));
}
console.log(`${apply?'Applied':'Dry run'}: ${manifest.length} images verified. Backup: ${backup}`);
console.log('Keep a full database/schema backup too; this export covers application rows and referenced legacy images only.');
