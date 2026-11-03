'use client';
import { useEffect, useRef, useState } from 'react';
import type { ProfileSnapshot, ProfileResult, SaveProfileAction, ReadProfileAction } from '@/lib/profile-contract';
export default function ProfileForm({ initial, saveAction, readAction }: {initial: ProfileSnapshot; saveAction: SaveProfileAction; readAction: ReadProfileAction}) {
  const [baseline, setBaseline] = useState(initial);
  const [name, setName] = useState(initial.nickname);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState('');
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [locked, setLocked] = useState(false);
  const [latest, setLatest] = useState<ProfileSnapshot | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!file) { setPreview(null); return; } const url=URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current || locked || fileError) return;
    inFlight.current=true; setPending(true); setResult(null);
    try {
      const form=new FormData(); form.set('nickname',name); form.set('expectedRevision',baseline.revision); if(file) form.set('avatar',file);
      const next=await saveAction(form); setResult(next);
      if (next.code==='success') {setBaseline(next.profile); setName(next.profile.nickname); setFile(null); if(fileInput.current) fileInput.current.value='';}
      if (next.code==='conflict' || next.code==='outcome_unknown') {setLocked(true);setLatest(null);}
    } catch {setLocked(true);setLatest(null);setResult({code:'outcome_unknown',message:'저장 결과를 확인하지 못했습니다. 최신 정보를 확인해주세요.'});}
    finally {inFlight.current=false;setPending(false);}
  }
  async function readLatest() {
    if(inFlight.current) return; inFlight.current=true; setReading(true);
    try {
      const next=await readAction();
      if(next.code==='success') {setLatest(next.profile);setResult(null);}
      else {setLatest(null);setResult(next);}
    } catch {setLatest(null);setResult({code:'unavailable',message:'최신 정보를 불러오지 못했습니다. 다시 시도해주세요.'});}
    finally {inFlight.current=false;setReading(false);}
  }
  const image=preview || baseline.avatarUrl;
  return <main className="profile-page"><a href="/">← 방명록으로</a><h1>내 프로필</h1><p>방명록과 댓글에 표시할 이름과 사진을 설정하세요.</p>
    <form onSubmit={save} aria-busy={pending}>
      <div className="profile-preview">{image ? <img src={image} alt="내 프로필 미리보기" onError={()=>{if(!preview)setBaseline(v=>({...v,avatarUrl:null}));}}/> : <span aria-label="기본 프로필 이미지">{Array.from(name)[0] || '나'}</span>}</div>
      <label htmlFor="profile-name">닉네임</label><input id="profile-name" name="nickname" value={name} onChange={e=>setName(e.target.value)} required maxLength={80} disabled={pending} autoComplete="nickname" aria-describedby="profile-name-help"/><small id="profile-name-help">앞뒤 공백을 제외한 1~20자 · 다른 회원과 중복 불가</small>
      <label htmlFor="profile-file">프로필 사진</label><input ref={fileInput} id="profile-file" type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={e=>{const next=e.target.files?.[0];if(!next){setFile(null);setFileError('');return;}if(!['image/png','image/jpeg','image/webp'].includes(next.type)||next.size>5242880||!next.size){setFileError('PNG, JPG, WebP 이미지를 5MB 이하로 선택해주세요.');e.target.value='';return;}setFileError('');setFile(next);}}/><small>PNG, JPG, WebP · 최대 5MiB (5MB)</small>
      {fileError && <p role="alert">{fileError}</p>}
      {result && <p role={result.code==='success'?'status':'alert'}>{result.message}{result.code==='success'&&result.displayWarning&&<span> {result.displayWarning}</span>}{result.code==='auth_required'&&<> <a href="/login" target="_blank" rel="noopener noreferrer">같은 계정으로 로그인</a></>}</p>}
      {locked && <section className="profile-conflict" aria-label="최신 프로필 확인"><p>입력과 선택한 사진은 유지됩니다. 최신 정보를 확인한 뒤 다시 저장하세요.</p><button className="button secondary" type="button" disabled={reading} onClick={()=>void readLatest()}>{reading?'최신 정보 확인 중…':'최신 정보 불러오기'}</button>
        {latest&&<div className="latest-profile"><h2>현재 저장된 프로필</h2>{latest.avatarUrl&&<img src={latest.avatarUrl} alt="현재 저장된 프로필 사진"/>}<p>{latest.nickname}</p><button className="button secondary" type="button" onClick={()=>{setBaseline(latest);setLatest(null);setLocked(false);setResult(null);}}>확인 후 계속 편집</button></div>}
      </section>}
      <button className="button" type="submit" disabled={pending||locked||!!fileError||!baseline.revision}>{pending?'저장 중…':'프로필 저장'}</button>
    </form></main>;
}
