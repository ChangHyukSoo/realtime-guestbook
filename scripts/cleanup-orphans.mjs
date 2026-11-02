import { createClient } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('Server environment credentials required');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const apply=process.argv.includes('--apply');
const cutoff=Date.now()-24*60*60*1000;
async function walk(prefix='') {
  const all=[];
  for(let offset=0;;offset+=1000) {
    const {data,error}=await client.storage.from('guestbook-images-private').list(prefix,{limit:1000,offset,sortBy:{column:'name',order:'asc'}});
    if(error) throw error;
    for(const item of data) {
      const path=prefix?`${prefix}/${item.name}`:item.name;
      if(!item.id) all.push(...await walk(path)); else all.push({...item,path});
    }
    if(data.length<1000) return all;
  }
}
// Enumerate before deleting so pagination offsets do not skip objects.
for(const item of await walk()) {
  if(!item.created_at||new Date(item.created_at).getTime()>=cutoff) continue;
  const {data,error}=await client.from('guestbooks').select('id').eq('image_object_path',item.path).limit(1);
  if(error) throw error;
  if(data.length) continue;
  console.log(`${apply?'Removing':'Would remove'} ${item.path}`);
  if(apply) { const result=await client.storage.from('guestbook-images-private').remove([item.path]); if(result.error) throw result.error; }
}
// Run during a write pause: DB references and Storage deletion are not atomic.
