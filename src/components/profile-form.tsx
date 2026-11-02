'use client';
import { useActionState, useEffect, useState } from 'react';
import { updateProfile } from '@/app/profile/actions';
export default function ProfileForm({ nickname, avatarUrl }: { nickname: string; avatarUrl: string | null }) {
  const [state, action, pending] = useActionState(updateProfile, {});
  const [name, setName] = useState(nickname);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (!file) { setPreview(null); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  async function save(data: FormData) { if (file) data.set('avatar', file); await action(data); }
  return <main className="profile-page"><a href="/">← 방명록으로</a><h1>내 프로필</h1><p>방명록과 댓글에 표시할 이름과 사진을 설정하세요.</p><form action={save}>
    <div className="profile-preview">{preview || state.avatarUrl || avatarUrl ? <img src={preview || state.avatarUrl || avatarUrl!} alt="내 프로필 미리보기"/> : <span aria-label="기본 프로필 이미지">{name.slice(0,1) || '나'}</span>}</div>
    <label htmlFor="profile-name">닉네임</label><input id="profile-name" name="nickname" value={name} onChange={e => setName(e.target.value)} required maxLength={40} disabled={pending} autoComplete="nickname"/><small>앞뒤 공백을 제외한 1~20자 · 다른 회원과 중복 불가</small>
    <label htmlFor="profile-file">프로필 사진</label><input id="profile-file" type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={e => { const next=e.target.files?.[0]; if (!next) return; if (!['image/png','image/jpeg','image/webp'].includes(next.type) || next.size > 5*1024*1024 || !next.size) { setError('PNG, JPG, WebP 이미지를 5MB 이하로 선택해주세요.'); e.target.value=''; return; } setError(''); setFile(next); }}/><small>PNG, JPG, WebP · 최대 5MB</small>
    {error && <p role="alert">{error}</p>}{state.error && <p role="alert">{state.error} <a href="/login" target="_blank" rel="noopener noreferrer">로그인</a></p>}{state.message && <p role="status">{state.message}</p>}
    <button className="button" disabled={pending || !!error}>{pending ? '저장 중…' : '프로필 저장'}</button>
  </form></main>;
}
