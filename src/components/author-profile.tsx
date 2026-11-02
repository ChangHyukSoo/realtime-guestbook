'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
export type Author = { id: string; nickname: string; avatar_path: string | null };
export default function AuthorProfile({ profile, fallback = '이전 방문자' }: { profile?: Author; fallback?: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true; setUrl('');
    async function refresh() { if (!profile?.avatar_path || !supabase) return; const { data } = await supabase.storage.from('profile-avatars').createSignedUrl(profile.avatar_path,300); if (active) setUrl(data?.signedUrl ?? ''); }
    void refresh(); const timer = setInterval(() => void refresh(),240000);
    return () => { active=false; clearInterval(timer); };
  }, [profile?.avatar_path]);
  const name = profile?.nickname ?? fallback;
  return <span className="author-profile"><span className="avatar">{url ? <img src={url} alt="" onError={() => setUrl('')}/> : name.slice(0,1)}</span><span>{name}</span></span>;
}
