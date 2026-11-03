'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
export type Author = { id: string; nickname: string; avatar_path: string | null };
export default function AuthorProfile({ profile, fallback = '이전 방문자' }: { profile?: Author; fallback?: string }) {
  const [image, setImage] = useState<{path: string;url: string}|null>(null);
  useEffect(() => {
    const path=profile?.avatar_path;
    if(!path || !supabase) {setImage(null);return;}
    const client=supabase;
    let active=true,paused=false,busy=false,generation=0;
    let timer: ReturnType<typeof setInterval> | undefined;
    let wake: ReturnType<typeof setTimeout> | undefined;
    setImage(null);
    async function refresh() {
      if(!active||paused||busy) return;
      busy=true;const version=generation;
      try {const {data}=await client.storage.from('profile-avatars').createSignedUrl(path!,300);if(active&&!paused&&version===generation)setImage({path:path!,url:data?.signedUrl??''});}
      catch {if(active&&!paused&&version===generation)setImage(null);}
      finally {busy=false;}
    }
    const start=()=>{clearInterval(timer);timer=setInterval(()=>void refresh(),240000);void refresh();};
    start();
    const {data:auth}=client.auth.onAuthStateChange((_event,session)=>{
      if(!session||session.user.is_anonymous||!session.user.email_confirmed_at){paused=true;generation++;clearInterval(timer);clearTimeout(wake);setImage(null);}
      else if(paused){paused=false;wake=setTimeout(start,0);}
    });
    return ()=>{active=false;generation++;clearInterval(timer);clearTimeout(wake);auth.subscription.unsubscribe();};
  }, [profile?.avatar_path]);
  const name = profile?.nickname ?? fallback;
  const url=image?.path===profile?.avatar_path?image?.url:null;
  return <span className="author-profile"><span className="avatar">{url ? <img src={url} alt="" onError={() => setImage(null)}/> : Array.from(name)[0]}</span><span>{name}</span></span>;
}
