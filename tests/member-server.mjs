// Local HTTP contract fixture only. It neither validates real JWTs nor tests hosted Auth/RLS/Realtime.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
const id='11111111-1111-4111-8111-111111111111';
const user={id,aud:'authenticated',role:'authenticated',email:'member@example.invalid',email_confirmed_at:new Date().toISOString(),is_anonymous:false,app_metadata:{provider:'email',providers:['email']},user_metadata:{nickname:'테스트 회원'},created_at:new Date().toISOString()};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function session() { return {access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,aud:'authenticated',role:'authenticated',email:user.email,is_anonymous:false,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})}.test-signature`,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'fixture-refresh-token',user}; }
const entries=[],comments=[],images=new Map();
let failComment=false;
let failProfile=false;
const profile={id,nickname:'테스트 회원',avatar_path:null};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:55433');
  res.setHeader('Access-Control-Allow-Origin','http://localhost:3002');
  res.setHeader('Access-Control-Allow-Headers',req.headers['access-control-request-headers'] || 'authorization,apikey,content-type');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if(req.method==='OPTIONS') {res.writeHead(204);res.end();return;}
  const buffers=[];for await(const part of req) buffers.push(part);const bytes=Buffer.concat(buffers);
  let body={};try{body=JSON.parse(bytes.toString());}catch{}
  const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  const path=url.pathname;
  if(path==='/__control') {failComment=Boolean(body.failComment);failProfile=Boolean(body.failProfile);return json({ok:true});}
  if(path==='/rest/v1/profiles') {
    if(req.method==='PATCH') { if(failProfile) return json({code:'23505',message:'Duplicate'},409); Object.assign(profile,body); }
    return json(req.headers.accept?.includes('vnd.pgrst.object')?profile:[profile]);
  }
  if(path==='/auth/v1/token') return body.password==='wrong-password'?json({msg:'Invalid credentials'},400):json(session());
  if(path==='/auth/v1/user') return req.method==='PUT'?json(user):req.headers.authorization?.startsWith('Bearer ')?json(user):json({msg:'Not signed in'},401);
  if(path==='/auth/v1/logout') return json({});
  if(path==='/auth/v1/verify') return ['valid-signup','valid-recovery'].includes(body.token_hash)?json(session()):json({msg:'Expired'},403);
  if(path==='/auth/v1/signup') return json({user,session:null});
  if(path==='/auth/v1/recover'||path==='/auth/v1/resend') return json({});
  for(const [table,rows] of [['guestbooks',entries],['comments',comments]]) {
    if(path!==`/rest/v1/${table}`) continue;
    if(req.method==='POST') {
      if(table==='comments'&&failComment) return json({message:'fixture failure'},500);
      const row={...body,author_id:id,image_path:null,nickname:'테스트 회원',created_at:new Date().toISOString()};rows.push(row);
      return json(row,201);
    }
    let result=rows.filter(row=>(!url.searchParams.get('id')||row.id===url.searchParams.get('id').slice(3))&&(!url.searchParams.get('guestbook_id')||row.guestbook_id===url.searchParams.get('guestbook_id').slice(3)));
    return json(req.headers.accept?.includes('vnd.pgrst.object')?(result[0]??null):result);
  }
  if(path.startsWith('/storage/v1/object/sign/')) {
    const object=path.slice('/storage/v1/object/sign/'.length);
    if(req.method==='POST') return json({signedURL:`/object/sign/${object}?token=fixture`});
    if(images.has(object)) {res.writeHead(200,{'Content-Type':'image/png'});res.end(images.get(object));return;}
    return json({message:'Not found'},404);
  }
  if(path.startsWith('/storage/v1/object/')&&req.method==='POST') {
    const object=path.slice('/storage/v1/object/'.length);
    if(images.has(object)) return json({statusCode:'409',error:'Duplicate',message:'Already exists'},409);
    let image=bytes;
    const boundary=req.headers['content-type']?.match(/boundary=([^;]+)/)?.[1];
    if(boundary) { const header=bytes.indexOf(Buffer.from('filename=')); const start=bytes.indexOf(Buffer.from('\r\n\r\n'),header)+4; const end=bytes.indexOf(Buffer.from(`\r\n--${boundary}`),start); image=bytes.subarray(start,end); }
    images.set(object,image);return json({Key:object,Id:'fixture-object'});
  }
  json({message:'Fixture route missing'},404);
});
server.listen(55433,'127.0.0.1',()=>{
  const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3002','--hostname','localhost'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55433',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_local_fixture',NEXT_PUBLIC_SITE_URL:'http://localhost:3002'}});
  child.on('exit',code=>{server.close();process.exit(code??0);});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill();server.close();});
});
