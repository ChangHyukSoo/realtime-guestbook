// Local HTTP contract fixture only. It neither validates real JWTs nor tests hosted Auth/RLS/Realtime.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const id='11111111-1111-4111-8111-111111111111';
const user={id,aud:'authenticated',role:'authenticated',email:'member@example.invalid',email_confirmed_at:new Date().toISOString(),is_anonymous:false,app_metadata:{provider:'email',providers:['email']},user_metadata:{nickname:'테스트 회원'},created_at:new Date().toISOString()};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function session() { return {access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,aud:'authenticated',role:'authenticated',email:user.email,is_anonymous:false,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})}.test-signature`,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'fixture-refresh-token',user}; }
const entries=[],comments=[],images=new Map();
let failComment=false;
let failProfile=false;
const fixtureServiceKey='local-server-only-fixture-key';
const profile={id,nickname:'테스트 회원',avatar_path:null,revision:randomUUID()};
const otherProfile={id:'22222222-2222-4222-8222-222222222222',nickname:'다른 회원',avatar_path:null,revision:randomUUID()};
let controls={};
let saveCount=0,profileReads=0,signCount=0;
let concurrentReads=0,maxConcurrentReads=0;
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
  if(path==='/__control') {
    if(req.method==='GET') return json({saveCount,profileReads,signCount,maxConcurrentReads,profile,images:[...images.keys()]});
    if(body.reset) {controls={};failComment=false;failProfile=false; Object.assign(profile,{nickname:'테스트 회원',avatar_path:null,revision:randomUUID()}); entries.length=0;comments.length=0;images.clear();saveCount=0;profileReads=0;signCount=0;}
    controls={...controls,...body};
    if('failComment' in body) failComment=Boolean(body.failComment);
    if('failProfile' in body) failProfile=Boolean(body.failProfile);
    if(body.profile) Object.assign(profile,body.profile,{revision:randomUUID()});
    if(body.seed) {entries.push({id:'33333333-3333-4333-8333-333333333333',author_id:id,created_at:new Date().toISOString()},{id:'44444444-4444-4444-8444-444444444444',author_id:null,created_at:new Date().toISOString()});comments.push({id:'55555555-5555-4555-8555-555555555555',guestbook_id:entries[0].id,author_id:otherProfile.id,nickname:'옛 이름',content:'다른 회원 댓글',created_at:new Date().toISOString()},{id:'66666666-6666-4666-8666-666666666666',guestbook_id:entries[0].id,author_id:null,nickname:'이전 댓글 이름',content:'이전 댓글',created_at:new Date().toISOString()});}
    return json({ok:true});
  }
  if(path==='/rest/v1/rpc/save_own_profile') {
    if(req.headers.authorization!==`Bearer ${fixtureServiceKey}`) return json({code:'42501',message:'Server only'},403);
    saveCount++;
    if(controls.saveDelay) await new Promise(r=>setTimeout(r,controls.saveDelay));
    if(body.p_member_id!==id || controls.unconfirmed || controls.anonymous) return json({code:'42501',message:'Membership required'},403);
    if(body.p_expected_revision!==profile.revision) return json([{status:'conflict'}]);
    if(failProfile || body.p_nickname.toLowerCase()==='다른 회원') return json({code:'23505',message:'Duplicate'},409);
    if(controls.dbReject) return json({code:'23514',message:'Rejected'},400);
    const previous=profile.avatar_path;
    Object.assign(profile,{nickname:body.p_nickname,avatar_path:body.p_avatar_path??profile.avatar_path,revision:randomUUID()});
    if(controls.outcomeUnknown) return json({message:'Response lost'},400);
    return json([{status:'saved',...profile,previous_avatar_path:previous}]);
  }
  if(path==='/rest/v1/profiles') {
    if(req.method==='PATCH') return json({code:'42501',message:'Direct update denied'},403);
    profileReads++;
    if(controls.readFail) return json({code:'P0002',message:'Read failed'},400);
    const snapshot={...profile};
    concurrentReads++;maxConcurrentReads=Math.max(maxConcurrentReads,concurrentReads);
    if(controls.readDelay) await new Promise(r=>setTimeout(r,controls.readDelay));
    concurrentReads--;
    if(url.searchParams.has('avatar_path')) return json(profile.avatar_path===url.searchParams.get('avatar_path').slice(3)?[snapshot]:[]);
    return json(req.headers.accept?.includes('vnd.pgrst.object')?snapshot:[snapshot,otherProfile]);
  }
  if(path==='/auth/v1/token') return body.password==='wrong-password'?json({msg:'Invalid credentials'},400):json(session());
  if(path==='/auth/v1/user') return controls.expired?json({msg:'Expired'},401):req.method==='PUT'?json(user):req.headers.authorization?.startsWith('Bearer ')?json({...user,id:controls.otherAccount?otherProfile.id:id,is_anonymous:!!controls.anonymous,email_confirmed_at:controls.unconfirmed?null:user.email_confirmed_at}):json({msg:'Not signed in'},401);
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
    if(req.method==='POST') {signCount++; if(controls.signFail) return json({message:'Sign failed'},400); if(!req.headers.authorization || controls.expired) return json({message:'Denied'},403); return json({signedURL:`/object/sign/${object}?token=fixture`});}
    if(images.has(object)) {res.writeHead(200,{'Content-Type':'image/png'});res.end(images.get(object));return;}
    return json({message:'Not found'},404);
  }
  if(path==='/storage/v1/object/profile-avatars'&&req.method==='DELETE') {
    if(req.headers.authorization!==`Bearer ${fixtureServiceKey}`) return json({message:'Server only'},403);
    if(controls.deleteFail) return json({message:'Delete failed'},503);
    for(const name of body.prefixes??[]) {if(name===profile.avatar_path) return json({message:'Referenced'},409); images.delete(`profile-avatars/${name}`);}
    return json([]);
  }
  if(path.startsWith('/storage/v1/object/')&&req.method==='POST') {
    const object=path.slice('/storage/v1/object/'.length);
    if(object.startsWith('profile-avatars/') && req.headers.authorization!==`Bearer ${fixtureServiceKey}`) return json({message:'Server only'},403);
    if(controls.uploadFail) return json({message:'Upload failed'},503);
    if(images.has(object)) return json({statusCode:'409',error:'Duplicate',message:'Already exists'},409);
    let image=bytes;
    const boundary=req.headers['content-type']?.match(/boundary=([^;]+)/)?.[1];
    if(boundary) { const header=bytes.indexOf(Buffer.from('filename=')); const start=bytes.indexOf(Buffer.from('\r\n\r\n'),header)+4; const end=bytes.indexOf(Buffer.from(`\r\n--${boundary}`),start); image=bytes.subarray(start,end); }
    images.set(object,image);return json({Key:object,Id:'fixture-object'});
  }
  json({message:'Fixture route missing'},404);
});
server.listen(55433,'127.0.0.1',()=>{
  const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3002','--hostname','localhost'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55433',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_local_fixture',NEXT_PUBLIC_SITE_URL:'http://localhost:3002',SUPABASE_SERVICE_ROLE_KEY:fixtureServiceKey}});
  child.on('exit',code=>{server.close();process.exit(code??0);});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill();server.close();});
});
