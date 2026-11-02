'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ImagePlus, MessageCircle, PenLine, Plus, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AuthorProfile, { type Author } from './author-profile';

type Entry = { id: string; image_path: string; image_object_path?: string; author_id?: string | null; created_at: string; art?: number };
type Comment = { author_id?: string | null; id: string; guestbook_id: string; nickname: string; content: string; created_at: string };
const palettes = ['#315c48', '#3e5d86', '#b25d44', '#6d587c', '#b58d42'];
const messages = [['안녕, 반가워요!', '이곳에 머문 모든 순간이', '좋은 기억으로 남기를.'], ['오늘도', '당신의 하루를 응원해요', '☀'], ['작은 순간들이 모여', '큰 행복이 되길', '♡'], ['우리의 계절은', '언제나 지금', 'see you again'], ['여기,', '마음을 두고 갑니다.', '✳'], ['참 좋은 날,', '참 좋은 사람들과', '함께여서 행복해요']];
function Artwork({ entry }: { entry: Entry }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (!supabase || !entry.image_object_path) return;
      const result = await supabase.storage.from('guestbook-images-private').createSignedUrl(entry.image_object_path, 300);
      if (active) { setFailed(Boolean(result.error)); setUrl(result.data?.signedUrl ?? ''); }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 240000);
    return () => { active = false; clearInterval(timer); };
  }, [entry.image_object_path, retry]);
  if (entry.image_object_path) return failed ? <span role="status">이미지를 불러오지 못했어요. <span role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setRetry(n => n + 1); } }} onClick={e => { e.stopPropagation(); setRetry(n => n + 1); }}>다시 시도</span></span> : url ? <img src={url} alt="방문자가 남긴 그림 방명록" draggable={false} onError={() => setFailed(true)}/> : <span>이미지 불러오는 중…</span>;
  if (entry.image_path) return <span>이미지 이전 작업이 필요합니다.</span>;
  const i = entry.art ?? 0;
  return <div className={`art art-${i}`}><span className="art-doodle">{['✳', '☀', '♡', '✦', '❋', '〰'][i]}</span><div>{messages[i].map((line, j) => <span key={j}>{line}</span>)}</div><span className="art-sign">{['지우', 'from. 민서', '다정한 방문자', '서연', '도윤', '수빈'][i]}</span></div>;
}
function relative(date: string) { const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000)); return minutes < 1 ? '방금 전' : minutes < 60 ? `${minutes}분 전` : minutes < 1440 ? `${Math.floor(minutes / 60)}시간 전` : new Date(date).toLocaleDateString('ko-KR'); }
export default function Guestbook({ initialWrite = false, initialId, userId, nickname: profileNickname }: { initialWrite?: boolean; initialId?: string; userId: string; nickname?: string }) {
  const [profiles, setProfiles] = useState<Record<string, Author>>({});
  useEffect(() => {
    if (!supabase) return; const client = supabase; let active = true;
    const refresh = async () => { const { data } = await client.from('profiles').select('id,nickname,avatar_path'); if (active && data) setProfiles(Object.fromEntries(data.map(p => [p.id,p]))); };
    void refresh(); const timer = setInterval(() => void refresh(), 30000);
    const focus = () => void refresh(); window.addEventListener('focus',focus);
    return () => { active=false; clearInterval(timer); window.removeEventListener('focus',focus); };
  }, []);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [writing, setWriting] = useState(initialWrite);
  const [selected, setSelected] = useState<string | null>(initialId ?? null);
  const [filter, setFilter] = useState('전체');
  const nickname = profiles[userId]?.nickname ?? profileNickname ?? '';
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [reauthRequired, setReauthRequired] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [, tick] = useState(0);
  const [notice, setNotice] = useState('');
  const [connection, setConnection] = useState(supabase ? '연결 중' : '데모 모드');
  const canvas = useRef<HTMLCanvasElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const pendingEntry = useRef<string | null>(null);
  const pendingComment = useRef<string | null>(null);
  const pendingImage = useRef<string | null>(null);
  const pendingCommentBody = useRef<string | null>(null);
  const loggingOut = useRef(false);
  const awaitingReauth = useRef(false);
  const contentRef = useRef(content);
  contentRef.current = content;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const draftKey = `trace-draft-${userId}`;
  const preserveDraft = useCallback(() => {
    if (loggingOut.current) return true;
    try { sessionStorage.setItem(draftKey, JSON.stringify({ image: dirty.current ? canvas.current?.toDataURL('image/png') : null, content: contentRef.current, selected: selectedRef.current, entryId: pendingEntry.current, commentId: pendingComment.current })); return true; } catch { return false; }
  }, [draftKey]);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!session || session.user.id !== userId) {
        const saved = preserveDraft();
        setEntries([]); setComments([]); void client.removeAllChannels();
        if (saved) window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        else { awaitingReauth.current = true; setReauthRequired(true); }
      } else {
        if (awaitingReauth.current) { awaitingReauth.current = false; setReauthRequired(false); setSessionVersion(n => n + 1); }
        if (event === 'TOKEN_REFRESHED') void client.realtime.setAuth(session.access_token);
      }
    });
    window.addEventListener('pagehide', preserveDraft);
    return () => { data.subscription.unsubscribe(); window.removeEventListener('pagehide', preserveDraft); };
  }, [userId, preserveDraft]);
  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
      if (draft) { setContent(draft.content || ''); setSelected(draft.selected || initialId || null); if (draft.image) setWriting(true); pendingEntry.current = draft.entryId || null; pendingImage.current = draft.image || null; pendingComment.current = draft.commentId || null; pendingCommentBody.current = `${draft.selected}:${(draft.content || '').trim()}`; }
    } catch { setNotice('이전 작성 내용을 복원하지 못했어요.'); }
  }, [draftKey, initialId]);
  const ensureSession = async () => {
    if (!supabase) throw new Error('연결 설정이 필요합니다.');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId || user.is_anonymous || !user.email_confirmed_at) {
      if (preserveDraft()) window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      else { awaitingReauth.current = true; setReauthRequired(true); }
      throw new Error('다시 로그인해 주세요.');
    }
    setReauthRequired(false);
    if (awaitingReauth.current) { awaitingReauth.current = false; setSessionVersion(n => n + 1); }
    if (!nickname) throw new Error('회원 프로필을 준비하지 못했습니다. 관리자에게 문의해 주세요.');
  };
  const logout = async () => {
    if (dirty.current || content.trim()) { if (!window.confirm('작성 중인 내용을 지우고 로그아웃할까요?')) return; }
    if (!supabase) return;
    loggingOut.current = true;
    const { error } = await supabase.auth.signOut();
    if (error) { loggingOut.current = false; setError('로그아웃하지 못했습니다. 다시 시도해 주세요.'); return; }
    sessionStorage.removeItem(draftKey); void supabase.removeAllChannels(); setEntries([]); setComments([]); window.location.assign('/login');
  };
  const [color, setColor] = useState(palettes[0]);
  const [width, setWidth] = useState(4);
  const merge = useCallback((row: Entry) => setEntries(old => [row, ...old.filter(e => e.id !== row.id)].sort((a, b) => b.created_at.localeCompare(a.created_at))), []);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    if (!supabase) { setError('Supabase 연결 설정이 필요합니다.'); } else {
      const { data, error } = await supabase.from('guestbooks').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) setError('방명록을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.'); else setEntries(old => Array.from(new Map([...old, ...(data ?? [])].map(e => [e.id, e])).values()).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); if (!supabase) { const sync = () => { void load(); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }
    const client = supabase;
    const channel = client.channel('guestbook-feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guestbooks' }, p => merge(p.new as Entry)).subscribe(status => { setConnection(status === 'SUBSCRIBED' ? '실시간 연결됨' : '재연결 중'); if (status === 'SUBSCRIBED') void load(); });
    return () => { void client.removeChannel(channel); };
  }, [load, merge, sessionVersion]);
  useEffect(() => { if (!selected || !supabase) return; const client = supabase; let active = true;
    const fetchComments = async () => { const { data, error } = await client.from('comments').select('*').eq('guestbook_id', selected).order('created_at'); if (!active) return; if (error) setError('댓글을 불러오지 못했어요.'); else setComments(old => Array.from(new Map([...old, ...(data ?? [])].map(c => [c.id,c])).values()).sort((a,b) => a.created_at.localeCompare(b.created_at))); };
    if (/^[0-9a-f-]{36}$/i.test(selected)) void client.from('guestbooks').select('*').eq('id', selected).maybeSingle().then(({ data }) => { if (active && data) merge(data); });
    void fetchComments();
    const channel = client.channel(`comments-${selected}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `guestbook_id=eq.${selected}` }, p => setComments(old => [...old.filter(c => c.id !== p.new.id), p.new as Comment])).subscribe(s => { if (s === 'SUBSCRIBED') void fetchComments(); });
    return () => { active = false; void client.removeChannel(channel); };
  }, [selected, merge, sessionVersion]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (!writing) return; const ctx = canvas.current?.getContext('2d'); if (ctx) {
    ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, 1000, 620); dirty.current = false;
    try { const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null'); if (draft?.image) { const img = new Image(); img.onload = () => { ctx.drawImage(img, 0, 0); dirty.current = true; }; img.src = draft.image; } } catch { /* Invalid drafts are ignored. */ }
  } }, [writing, draftKey]);
  useEffect(() => { if (!writing && !selected) return; const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy && !writing) setSelected(null); }; document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, [writing, selected, busy]);
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(timer); }, []);
  const clear = () => { const ctx = canvas.current?.getContext('2d'); if (!ctx) return; ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, 1000, 620); dirty.current = false; };
  const save = async () => {
    if (busy || !canvas.current) return;
    if (!dirty.current) { setNotice('마음을 담은 글이나 그림을 먼저 남겨 주세요.'); return; }
    setBusy(true); setError('');
    try {
      await ensureSession();
      const image = canvas.current.toDataURL('image/png');
      if (pendingImage.current !== image) pendingEntry.current = null;
      pendingImage.current = image;
      const id = pendingEntry.current ?? crypto.randomUUID(); pendingEntry.current = id; let row: Entry;
      if (supabase) {
        const existing = await supabase.from('guestbooks').select('*').eq('id', id).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) { merge(existing.data); pendingEntry.current = null; dirty.current = false; sessionStorage.removeItem(draftKey); setWriting(false); return; }
        const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(b => b ? resolve(b) : reject(new Error()), 'image/png'));
        if (blob.size > 5 * 1024 * 1024) throw new Error('이미지는 5MB 이하로 작성해 주세요.');
        const path = `${userId}/${id}.png`; const upload = await supabase.storage.from('guestbook-images-private').upload(path, blob, { contentType: 'image/png', upsert: false });
        if (upload.error && String(upload.error.statusCode) !== '409') throw upload.error;
        const insert = await supabase.from('guestbooks').insert({ id, author_id: userId, image_object_path: path }).select().single(); if (insert.error) throw insert.error; row = insert.data;
      } else throw new Error('설정이 필요합니다.');
      merge(row); pendingEntry.current = null; dirty.current = false; sessionStorage.removeItem(draftKey); setWriting(false); setNotice('당신의 한 조각이 방명록에 남았어요.');
    } catch { setError('등록하지 못했어요. 작성 내용은 그대로예요. 잠시 후 다시 시도해 주세요.'); } finally { setBusy(false); }
  };
  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy || !selected || !nickname.trim() || !content.trim()) return; setBusy(true); setError('');
    try { await ensureSession(); const bodyKey = `${selected}:${content.trim()}`; if (pendingCommentBody.current !== bodyKey) pendingComment.current = null; pendingCommentBody.current = bodyKey; const id = pendingComment.current ?? crypto.randomUUID(); pendingComment.current = id; let row: Comment;
      if (supabase) { const existing = await supabase.from('comments').select('*').eq('id', id).maybeSingle(); if (existing.error) throw existing.error;
        if (existing.data) row = existing.data;
        else { const result = await supabase.from('comments').insert({ id, guestbook_id: selected, author_id: userId, content: content.trim() }).select().single(); if (result.error) throw result.error; row = result.data; }
      } else throw new Error('설정이 필요합니다.');
      setComments(old => [...old.filter(c => c.id !== row.id), row]); setContent(''); pendingComment.current = null; sessionStorage.removeItem(draftKey);
    } catch { setError('댓글을 등록하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.'); } finally { setBusy(false); }
  };
  const entry = entries.find(e => e.id === selected);
  const shown = entries.filter(e => filter !== '직접 남긴' || e.author_id === userId);
  return <div className="site">
    {reauthRequired && <div className="reauth-banner" role="alert">작성 내용을 보존하려면 이 탭을 열어 두세요. 초안 저장 공간이 부족하거나 사용할 수 없습니다. <a href="/login" target="_blank" rel="noopener noreferrer">새 탭에서 같은 계정으로 로그인</a>한 뒤 여기에서 다시 등록해 주세요.</div>}
    <header className="header"><a href="/" className="brand"><span className="brand-icon">✳</span> 한 조각<span className="brand-en">a little trace</span></a><div className="header-right"><a href="/profile" className="account-name" onClick={e => { if (!preserveDraft()) { e.preventDefault(); setError("작성 내용을 보존하지 못했습니다. 먼저 저장한 뒤 프로필로 이동해주세요."); } }}>{nickname || '프로필 준비 필요'}</a><button className="account-logout" onClick={() => void logout()}>로그아웃</button><span className="connection"><i />{connection}</span><button className="button small" onClick={() => setWriting(true)}><Plus size={15} /> 방명록 남기기</button></div></header>
    <main>
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span /> OUR LITTLE GUESTBOOK</div><h1>당신이 머문 순간,<br /><span>한 조각의 마음을 남겨요.</span></h1><p>짧은 인사도, 서툰 그림도 좋아요.<br />우리의 작은 흔적들이 모여 특별한 이야기가 됩니다.</p><button className="button" onClick={() => setWriting(true)}><PenLine size={17} /> 나의 한 조각 남기기 <ArrowRight size={16} /></button><div className="hero-note">우리의 계정으로, 마음 가는 대로 자유롭게</div></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="floating-star">✳</span><div className="hero-paper paper-back"><span>오늘의 작은 행복</span><b>☀</b></div><div className="hero-paper paper-front"><span className="paper-tape"/><span className="paper-flower">✿</span><strong>당신의 오늘이<br />다정하기를.</strong><span className="paper-sign">마음을 담아, 누군가로부터</span><span className="paper-heart">♡</span></div><span className="visual-caption">a small note, a warm connection</span></div></section>
      <section className="feed" id="guestbook"><div className="section-heading"><div><div className="eyebrow">LITTLE TRACES, BIG STORIES</div><h2>우리가 남긴 조각들 <span>{entries.length.toString().padStart(2, '0')}</span></h2><p>서로의 마음을 살짝 들여다보세요.</p></div><span className="feed-hint"><span className="green-dot" />{supabase ? '새로운 마음이 실시간으로 도착해요' : '데모 방명록을 둘러보고 직접 남겨보세요'}</span></div><div className="feed-toolbar"><div className="tabs">{['전체', '직접 남긴'].map(label => <button key={label} className={filter === label ? 'active' : ''} onClick={() => setFilter(label)}>{label}{label === '전체' && <span>{entries.length}</span>}</button>)}</div><span className="sort">최신순 <ArrowDown size={13}/></span></div>
      {error && <div className="error" role="alert">{error} <button onClick={() => void load()}>다시 불러오기</button></div>}
      {loading ? <div className="cards">{[0, 1, 2].map(i => <div className="skeleton" key={i} />)}</div> : <div className="cards"><button className="new-card" onClick={() => setWriting(true)}><span className="new-icon"><Plus size={26}/></span><strong>당신의 이야기도 궁금해요</strong><span>글씨로, 그림으로, 사진으로<br />자유롭게 마음을 남겨보세요.</span><b>방명록 남기기 <ArrowRight size={14}/></b></button>{shown.map(e => <button className="entry-card" key={e.id} onClick={() => { setSelected(e.id); setError(''); }}><div className="art-frame"><Artwork entry={e}/><span className="open-card">마음 들여다보기 <ArrowRight size={15}/></span></div><div className="card-bottom"><span><i /> <AuthorProfile profile={e.author_id ? profiles[e.author_id] : undefined}/></span><span><MessageCircle size={14}/>{comments.filter(c => c.guestbook_id === e.id).length}</span></div><div className="card-time">{relative(e.created_at)}</div></button>)}</div>}
      {!loading && shown.length === 0 && <p className="empty">아직 남겨진 조각이 없어요. 첫 번째 이야기를 남겨주세요.</p>}<div className="feed-end"><span />작은 흔적 하나에도, 마음은 전해지니까요.<span /></div></section>
      <section className="bottom-note"><Sparkles size={22}/><div><h3>잘 쓰지 않아도 괜찮아요.</h3><p>당신만의 글씨, 당신만의 마음이면 충분해요.</p></div><button onClick={() => setWriting(true)}>가볍게 한 조각 남기기 <ArrowRight size={16}/></button></section>
    </main><footer><a href="/" className="brand"><span className="brand-icon">✳</span> 한 조각</a><span>우리가 만난 순간을 오래도록.</span><small>© {new Date().getFullYear()} a little trace</small></footer>
    {writing && <div className="overlay"><section className="modal write-modal" role="dialog" aria-modal="true" aria-labelledby="write-title"><div className="modal-head"><div><div className="eyebrow">LEAVE YOUR LITTLE TRACE</div><h2 id="write-title">나의 한 조각 남기기</h2></div><button aria-label="작성 닫기" className="icon-button" disabled={busy} onClick={() => { if (!dirty.current || window.confirm('작성 중인 그림을 닫을까요?')) { setWriting(false); setError(''); } }}><X/></button></div><p className="modal-description">손끝으로 자유롭게 그려보세요. 서툴러도 당신의 마음은 전해져요.</p><div className="drawing-tools"><div className="colors">{palettes.map(c => <button key={c} aria-label={`${c} 펜 색상`} aria-pressed={c === color} style={{ background: c }} onClick={() => setColor(c)}>{c === color && <Check size={14}/>}</button>)}</div><label>펜 굵기 <input aria-label="펜 굵기" type="range" min="2" max="14" value={width} onChange={e => setWidth(+e.target.value)}/></label></div><canvas ref={canvas} width={1000} height={620} aria-label="마우스나 터치로 글씨와 그림을 남기는 캔버스" onPointerDown={e => { if (busy) return; const el = e.currentTarget; el.setPointerCapture(e.pointerId); const r = el.getBoundingClientRect(); const ctx = el.getContext('2d')!; ctx.beginPath(); ctx.moveTo((e.clientX - r.left) * 1000 / r.width, (e.clientY - r.top) * 620 / r.height); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; drawing.current = true; }} onPointerMove={e => { if (!drawing.current) return; const el = e.currentTarget; const r = el.getBoundingClientRect(); const ctx = el.getContext('2d')!; ctx.lineTo((e.clientX - r.left) * 1000 / r.width, (e.clientY - r.top) * 620 / r.height); ctx.stroke(); dirty.current = true; }} onPointerUp={e => { if (drawing.current) { const ctx = e.currentTarget.getContext('2d')!; ctx.lineTo(ctx.getTransform().e + (e.clientX - e.currentTarget.getBoundingClientRect().left) * 1000 / e.currentTarget.getBoundingClientRect().width + .01, (e.clientY - e.currentTarget.getBoundingClientRect().top) * 620 / e.currentTarget.getBoundingClientRect().height); ctx.stroke(); dirty.current = true; } drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }}/><div className="canvas-caption">이 작은 종이에 당신의 순간을 담아주세요.</div><input hidden ref={file} type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => { const upload = e.target.files?.[0]; e.target.value = ''; if (!upload) return; if (!['image/png', 'image/jpeg', 'image/webp'].includes(upload.type) || upload.size > 5 * 1024 * 1024) { setNotice('PNG, JPG, WebP 이미지를 5MB 이하로 첨부해 주세요.'); return; } const url = URL.createObjectURL(upload); const img = new Image(); img.onload = () => { const ctx = canvas.current?.getContext('2d'); if (ctx) { const scale = Math.min(900 / img.width, 520 / img.height); ctx.drawImage(img, (1000 - img.width * scale) / 2, (620 - img.height * scale) / 2, img.width * scale, img.height * scale); dirty.current = true; } URL.revokeObjectURL(url); }; img.onerror = () => { URL.revokeObjectURL(url); setNotice('이미지를 읽지 못했어요. 다른 파일을 선택해 주세요.'); }; img.src = url; }}/>{error && <p role="alert" className="error">{error}</p>}<div className="modal-actions"><div><button className="secondary" disabled={busy} onClick={() => file.current?.click()}><ImagePlus size={16}/> 사진 첨부</button><button className="secondary" disabled={busy} onClick={clear}><RotateCcw size={15}/> 지우기</button></div><button className="button" disabled={busy} onClick={() => void save()}>{busy ? '등록하는 중…' : '마음 등록하기'}<ArrowRight size={16}/></button></div></section></div>}
    {selected && !writing && <div className="overlay"><section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div className="modal-head"><h2 id="detail-title">마음 한 조각</h2><button className="icon-button" aria-label="상세 닫기" onClick={() => { setSelected(null); setError(''); }}><X/></button></div>{entry ? <><div className="detail-art"><Artwork entry={entry}/></div><div className="detail-meta"><AuthorProfile profile={entry.author_id ? profiles[entry.author_id] : undefined}/> <span>{relative(entry.created_at)}</span></div><h3 className="comments-title">나누는 마음 <span>{comments.filter(c => c.guestbook_id === selected).length}</span></h3><div className="comments">{comments.filter(c => c.guestbook_id === selected).map(c => <div className="comment" key={c.id}><div><strong><AuthorProfile profile={c.author_id ? profiles[c.author_id] : undefined} fallback={c.nickname}/></strong><time>{relative(c.created_at)}</time><p>{c.content}</p></div></div>)}{!comments.some(c => c.guestbook_id === selected) && <p className="empty">첫 번째 다정한 인사를 건네보세요.</p>}</div><form onSubmit={submitComment} className="comment-form"><p>{nickname || '프로필을 준비하지 못했습니다. 관리자에게 문의해 주세요.'}</p><div><textarea aria-label="댓글" placeholder="따뜻한 마음을 나눠주세요." required maxLength={500} value={content} onChange={e => setContent(e.target.value)}/><button className="button" disabled={busy || !nickname.trim() || !content.trim()} type="submit" aria-label="댓글 등록"><Send size={17}/></button></div><span>{content.length} / 500</span></form></> : <p className="empty">{loading ? '방명록을 불러오는 중이에요…' : '이 방명록을 찾을 수 없어요.'}</p>}{error && <p className="error" role="alert">{error}</p>}<button className="back-link" onClick={() => { setSelected(null); setError(''); }}><ArrowLeft size={15}/> 목록으로 돌아가기</button></section></div>}
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
  </div>;
}
