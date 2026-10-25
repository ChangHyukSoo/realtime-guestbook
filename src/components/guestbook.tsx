'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ImagePlus, MessageCircle, PenLine, Plus, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Entry = { id: string; image_path: string; created_at: string; art?: number };
type Comment = { id: string; guestbook_id: string; nickname: string; content: string; created_at: string };
const samples: Entry[] = Array.from({ length: 6 }, (_, i) => ({ id: `sample-${i}`, image_path: '', created_at: new Date(Date.now() - i * 1080000).toISOString(), art: i }));
const palettes = ['#315c48', '#3e5d86', '#b25d44', '#6d587c', '#b58d42'];
const messages = [['안녕, 반가워요!', '이곳에 머문 모든 순간이', '좋은 기억으로 남기를.'], ['오늘도', '당신의 하루를 응원해요', '☀'], ['작은 순간들이 모여', '큰 행복이 되길', '♡'], ['우리의 계절은', '언제나 지금', 'see you again'], ['여기,', '마음을 두고 갑니다.', '✳'], ['참 좋은 날,', '참 좋은 사람들과', '함께여서 행복해요']];
function Artwork({ entry }: { entry: Entry }) {
  if (entry.image_path) return <img src={entry.image_path} alt="방문자가 남긴 그림 방명록" draggable={false} />;
  const i = entry.art ?? 0;
  return <div className={`art art-${i}`}><span className="art-doodle">{['✳', '☀', '♡', '✦', '❋', '〰'][i]}</span><div>{messages[i].map((line, j) => <span key={j}>{line}</span>)}</div><span className="art-sign">{['지우', 'from. 민서', '다정한 방문자', '서연', '도윤', '수빈'][i]}</span></div>;
}
function relative(date: string) { const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000)); return minutes < 1 ? '방금 전' : minutes < 60 ? `${minutes}분 전` : minutes < 1440 ? `${Math.floor(minutes / 60)}시간 전` : new Date(date).toLocaleDateString('ko-KR'); }
export default function Guestbook({ initialWrite = false, initialId }: { initialWrite?: boolean; initialId?: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [writing, setWriting] = useState(initialWrite);
  const [selected, setSelected] = useState<string | null>(initialId ?? null);
  const [filter, setFilter] = useState('전체');
  const [nickname, setNickname] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const [notice, setNotice] = useState('');
  const [connection, setConnection] = useState(supabase ? '연결 중' : '데모 모드');
  const canvas = useRef<HTMLCanvasElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [color, setColor] = useState(palettes[0]);
  const [width, setWidth] = useState(4);
  const merge = useCallback((row: Entry) => setEntries(old => [row, ...old.filter(e => e.id !== row.id)].sort((a, b) => b.created_at.localeCompare(a.created_at))), []);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    if (!supabase) {
      try { const saved = JSON.parse(localStorage.getItem('trace-entries') || 'null'); setEntries(saved ?? samples); setComments(JSON.parse(localStorage.getItem('trace-comments') || '[]')); } catch { setError('저장된 데모 데이터를 불러오지 못했어요.'); }
    } else {
      const { data, error } = await supabase.from('guestbooks').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) setError('방명록을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.'); else setEntries(old => Array.from(new Map([...old, ...(data ?? [])].map(e => [e.id, e])).values()).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); if (!supabase) { const sync = () => { void load(); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }
    const client = supabase;
    const channel = client.channel('guestbook-feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guestbooks' }, p => merge(p.new as Entry)).subscribe(status => { setConnection(status === 'SUBSCRIBED' ? '실시간 연결됨' : '재연결 중'); if (status === 'SUBSCRIBED') void load(); });
    return () => { void client.removeChannel(channel); };
  }, [load, merge]);
  useEffect(() => { if (!selected || !supabase) return; const client = supabase; let active = true;
    const fetchComments = async () => { const { data, error } = await client.from('comments').select('*').eq('guestbook_id', selected).order('created_at'); if (!active) return; if (error) setError('댓글을 불러오지 못했어요.'); else setComments(old => [...old.filter(c => c.guestbook_id !== selected), ...(data ?? [])]); };
    void fetchComments();
    const channel = client.channel(`comments-${selected}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `guestbook_id=eq.${selected}` }, p => setComments(old => [...old.filter(c => c.id !== p.new.id), p.new as Comment])).subscribe(s => { if (s === 'SUBSCRIBED') void fetchComments(); });
    return () => { active = false; void client.removeChannel(channel); };
  }, [selected]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (!writing) return; const ctx = canvas.current?.getContext('2d'); if (ctx) { ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, 1000, 620); dirty.current = false; } }, [writing]);
  useEffect(() => { if (!writing && !selected) return; const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy && !writing) setSelected(null); }; document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, [writing, selected, busy]);
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(timer); }, []);
  const clear = () => { const ctx = canvas.current?.getContext('2d'); if (!ctx) return; ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, 1000, 620); dirty.current = false; };
  const save = async () => {
    if (busy || !canvas.current) return;
    if (!dirty.current) { setNotice('마음을 담은 글이나 그림을 먼저 남겨 주세요.'); return; }
    setBusy(true); setError('');
    try {
      const dataUrl = canvas.current.toDataURL('image/png'); const id = crypto.randomUUID(); let row: Entry;
      if (supabase) {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(b => b ? resolve(b) : reject(new Error()), 'image/png'));
        if (blob.size > 5 * 1024 * 1024) throw new Error('이미지는 5MB 이하로 작성해 주세요.');
        const path = `${id}.png`; const upload = await supabase.storage.from('guestbook-images').upload(path, blob, { contentType: 'image/png', upsert: false }); if (upload.error) throw upload.error;
        const url = supabase.storage.from('guestbook-images').getPublicUrl(path).data.publicUrl;
        const insert = await supabase.from('guestbooks').insert({ id, image_path: url }).select().single(); if (insert.error) throw insert.error; row = insert.data;
      } else { row = { id, image_path: dataUrl, created_at: new Date().toISOString() }; localStorage.setItem('trace-entries', JSON.stringify([row, ...entries])); }
      merge(row); setWriting(false); setNotice('당신의 한 조각이 방명록에 남았어요.');
    } catch { setError('등록하지 못했어요. 작성 내용은 그대로예요. 잠시 후 다시 시도해 주세요.'); } finally { setBusy(false); }
  };
  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy || !selected || !nickname.trim() || !content.trim()) return; setBusy(true); setError('');
    try { let row: Comment = { id: crypto.randomUUID(), guestbook_id: selected, nickname: nickname.trim(), content: content.trim(), created_at: new Date().toISOString() };
      if (supabase) { const result = await supabase.from('comments').insert(row).select().single(); if (result.error) throw result.error; row = result.data; }
      else localStorage.setItem('trace-comments', JSON.stringify([...comments, row]));
      setComments(old => [...old.filter(c => c.id !== row.id), row]); setContent('');
    } catch { setError('댓글을 등록하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.'); } finally { setBusy(false); }
  };
  const entry = entries.find(e => e.id === selected);
  const shown = entries.filter(e => filter !== '직접 남긴' || !!e.image_path);
  return <div className="site">
    <header className="header"><a href="/" className="brand"><span className="brand-icon">✳</span> 한 조각<span className="brand-en">a little trace</span></a><div className="header-right"><span className="connection"><i />{connection}</span><button className="button small" onClick={() => setWriting(true)}><Plus size={15} /> 방명록 남기기</button></div></header>
    <main>
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span /> OUR LITTLE GUESTBOOK</div><h1>당신이 머문 순간,<br /><span>한 조각의 마음을 남겨요.</span></h1><p>짧은 인사도, 서툰 그림도 좋아요.<br />우리의 작은 흔적들이 모여 특별한 이야기가 됩니다.</p><button className="button" onClick={() => setWriting(true)}><PenLine size={17} /> 나의 한 조각 남기기 <ArrowRight size={16} /></button><div className="hero-note">로그인 없이, 마음 가는 대로 자유롭게</div></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="floating-star">✳</span><div className="hero-paper paper-back"><span>오늘의 작은 행복</span><b>☀</b></div><div className="hero-paper paper-front"><span className="paper-tape"/><span className="paper-flower">✿</span><strong>당신의 오늘이<br />다정하기를.</strong><span className="paper-sign">마음을 담아, 누군가로부터</span><span className="paper-heart">♡</span></div><span className="visual-caption">a small note, a warm connection</span></div></section>
      <section className="feed" id="guestbook"><div className="section-heading"><div><div className="eyebrow">LITTLE TRACES, BIG STORIES</div><h2>우리가 남긴 조각들 <span>{entries.length.toString().padStart(2, '0')}</span></h2><p>서로의 마음을 살짝 들여다보세요.</p></div><span className="feed-hint"><span className="green-dot" />{supabase ? '새로운 마음이 실시간으로 도착해요' : '데모 방명록을 둘러보고 직접 남겨보세요'}</span></div><div className="feed-toolbar"><div className="tabs">{['전체', '직접 남긴'].map(label => <button key={label} className={filter === label ? 'active' : ''} onClick={() => setFilter(label)}>{label}{label === '전체' && <span>{entries.length}</span>}</button>)}</div><span className="sort">최신순 <ArrowDown size={13}/></span></div>
      {error && <div className="error" role="alert">{error} <button onClick={() => void load()}>다시 불러오기</button></div>}
      {loading ? <div className="cards">{[0, 1, 2].map(i => <div className="skeleton" key={i} />)}</div> : <div className="cards"><button className="new-card" onClick={() => setWriting(true)}><span className="new-icon"><Plus size={26}/></span><strong>당신의 이야기도 궁금해요</strong><span>글씨로, 그림으로, 사진으로<br />자유롭게 마음을 남겨보세요.</span><b>방명록 남기기 <ArrowRight size={14}/></b></button>{shown.map(e => <button className="entry-card" key={e.id} onClick={() => { setSelected(e.id); setError(''); }}><div className="art-frame"><Artwork entry={e}/><span className="open-card">마음 들여다보기 <ArrowRight size={15}/></span></div><div className="card-bottom"><span><i /> {e.id.startsWith('sample') ? '어느 다정한 방문자' : '새로운 방문자의 한 조각'}</span><span><MessageCircle size={14}/>{comments.filter(c => c.guestbook_id === e.id).length}</span></div><div className="card-time">{relative(e.created_at)}</div></button>)}</div>}
      {!loading && shown.length === 0 && <p className="empty">아직 남겨진 조각이 없어요. 첫 번째 이야기를 남겨주세요.</p>}<div className="feed-end"><span />작은 흔적 하나에도, 마음은 전해지니까요.<span /></div></section>
      <section className="bottom-note"><Sparkles size={22}/><div><h3>잘 쓰지 않아도 괜찮아요.</h3><p>당신만의 글씨, 당신만의 마음이면 충분해요.</p></div><button onClick={() => setWriting(true)}>가볍게 한 조각 남기기 <ArrowRight size={16}/></button></section>
    </main><footer><a href="/" className="brand"><span className="brand-icon">✳</span> 한 조각</a><span>우리가 만난 순간을 오래도록.</span><small>© {new Date().getFullYear()} a little trace</small></footer>
    {writing && <div className="overlay"><section className="modal write-modal" role="dialog" aria-modal="true" aria-labelledby="write-title"><div className="modal-head"><div><div className="eyebrow">LEAVE YOUR LITTLE TRACE</div><h2 id="write-title">나의 한 조각 남기기</h2></div><button aria-label="작성 닫기" className="icon-button" disabled={busy} onClick={() => { if (!dirty.current || window.confirm('작성 중인 그림을 닫을까요?')) { setWriting(false); setError(''); } }}><X/></button></div><p className="modal-description">손끝으로 자유롭게 그려보세요. 서툴러도 당신의 마음은 전해져요.</p><div className="drawing-tools"><div className="colors">{palettes.map(c => <button key={c} aria-label={`${c} 펜 색상`} aria-pressed={c === color} style={{ background: c }} onClick={() => setColor(c)}>{c === color && <Check size={14}/>}</button>)}</div><label>펜 굵기 <input aria-label="펜 굵기" type="range" min="2" max="14" value={width} onChange={e => setWidth(+e.target.value)}/></label></div><canvas ref={canvas} width={1000} height={620} aria-label="마우스나 터치로 글씨와 그림을 남기는 캔버스" onPointerDown={e => { if (busy) return; const el = e.currentTarget; el.setPointerCapture(e.pointerId); const r = el.getBoundingClientRect(); const ctx = el.getContext('2d')!; ctx.beginPath(); ctx.moveTo((e.clientX - r.left) * 1000 / r.width, (e.clientY - r.top) * 620 / r.height); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; drawing.current = true; }} onPointerMove={e => { if (!drawing.current) return; const el = e.currentTarget; const r = el.getBoundingClientRect(); const ctx = el.getContext('2d')!; ctx.lineTo((e.clientX - r.left) * 1000 / r.width, (e.clientY - r.top) * 620 / r.height); ctx.stroke(); dirty.current = true; }} onPointerUp={e => { if (drawing.current) { const ctx = e.currentTarget.getContext('2d')!; ctx.lineTo(ctx.getTransform().e + (e.clientX - e.currentTarget.getBoundingClientRect().left) * 1000 / e.currentTarget.getBoundingClientRect().width + .01, (e.clientY - e.currentTarget.getBoundingClientRect().top) * 620 / e.currentTarget.getBoundingClientRect().height); ctx.stroke(); dirty.current = true; } drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }}/><div className="canvas-caption">이 작은 종이에 당신의 순간을 담아주세요.</div><input hidden ref={file} type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => { const upload = e.target.files?.[0]; e.target.value = ''; if (!upload) return; if (!['image/png', 'image/jpeg', 'image/webp'].includes(upload.type) || upload.size > 5 * 1024 * 1024) { setNotice('PNG, JPG, WebP 이미지를 5MB 이하로 첨부해 주세요.'); return; } const url = URL.createObjectURL(upload); const img = new Image(); img.onload = () => { const ctx = canvas.current?.getContext('2d'); if (ctx) { const scale = Math.min(900 / img.width, 520 / img.height); ctx.drawImage(img, (1000 - img.width * scale) / 2, (620 - img.height * scale) / 2, img.width * scale, img.height * scale); dirty.current = true; } URL.revokeObjectURL(url); }; img.onerror = () => { URL.revokeObjectURL(url); setNotice('이미지를 읽지 못했어요. 다른 파일을 선택해 주세요.'); }; img.src = url; }}/>{error && <p role="alert" className="error">{error}</p>}<div className="modal-actions"><div><button className="secondary" disabled={busy} onClick={() => file.current?.click()}><ImagePlus size={16}/> 사진 첨부</button><button className="secondary" disabled={busy} onClick={clear}><RotateCcw size={15}/> 지우기</button></div><button className="button" disabled={busy} onClick={() => void save()}>{busy ? '등록하는 중…' : '마음 등록하기'}<ArrowRight size={16}/></button></div></section></div>}
    {selected && !writing && <div className="overlay"><section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div className="modal-head"><h2 id="detail-title">마음 한 조각</h2><button className="icon-button" aria-label="상세 닫기" onClick={() => { setSelected(null); setError(''); }}><X/></button></div>{entry ? <><div className="detail-art"><Artwork entry={entry}/></div><div className="detail-meta">어느 다정한 방문자가 남긴 마음 <span>{relative(entry.created_at)}</span></div><h3 className="comments-title">나누는 마음 <span>{comments.filter(c => c.guestbook_id === selected).length}</span></h3><div className="comments">{comments.filter(c => c.guestbook_id === selected).map(c => <div className="comment" key={c.id}><span className="avatar">{c.nickname.slice(0, 1)}</span><div><strong>{c.nickname}</strong><time>{relative(c.created_at)}</time><p>{c.content}</p></div></div>)}{!comments.some(c => c.guestbook_id === selected) && <p className="empty">첫 번째 다정한 인사를 건네보세요.</p>}</div><form onSubmit={submitComment} className="comment-form"><input aria-label="닉네임" placeholder="닉네임" required maxLength={20} value={nickname} onChange={e => setNickname(e.target.value)}/><div><textarea aria-label="댓글" placeholder="따뜻한 마음을 나눠주세요." required maxLength={500} value={content} onChange={e => setContent(e.target.value)}/><button className="button" disabled={busy || !nickname.trim() || !content.trim()} type="submit" aria-label="댓글 등록"><Send size={17}/></button></div><span>{content.length} / 500</span></form></> : <p className="empty">{loading ? '방명록을 불러오는 중이에요…' : '이 방명록을 찾을 수 없어요.'}</p>}{error && <p className="error" role="alert">{error}</p>}<button className="back-link" onClick={() => { setSelected(null); setError(''); }}><ArrowLeft size={15}/> 목록으로 돌아가기</button></section></div>}
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
  </div>;
}
