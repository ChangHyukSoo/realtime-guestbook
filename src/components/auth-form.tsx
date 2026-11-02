'use client';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { authenticate, type AuthState } from '@/app/auth/actions';
export default function AuthForm({ mode, next = '/', initialError = '', changed = false }: { mode: 'login'|'signup'|'forgot'|'reset'|'resend'; next?: string; initialError?: string; changed?: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(authenticate, {});
  const [now, setNow] = useState(0);
  const [email, setEmail] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const title = { login: '다시 만나 반가워요', signup: '우리의 이야기를 시작해요', forgot: '비밀번호를 잊으셨나요?', reset: '새 비밀번호를 정해 주세요', resend: '메일함을 확인해 주세요' }[mode];
  const label = { login: '로그인', signup: '회원가입', forgot: '재설정 메일 보내기', reset: '비밀번호 변경', resend: '확인 메일 다시 보내기' }[mode];
  const waiting = Boolean(state.retryAt && state.retryAt > (now || Date.now()));
  return <main className="auth-page"><section className="auth-card"><Link href="/login" className="brand"><span className="brand-icon">✳</span> 한 조각</Link><div className="eyebrow">A LITTLE TRACE, TOGETHER</div><h1>{title}</h1><p>{mode === 'resend' ? '가입한 이메일의 확인 링크를 눌러 주세요. 메일이 없다면 스팸함을 확인하거나 다시 요청해 주세요.' : '로그인하고 당신만의 한 조각을 남겨보세요.'}</p><form action={action}>
    <input type="hidden" name="mode" value={mode}/><input type="hidden" name="next" value={next}/>
    {mode !== 'reset' && <label>이메일<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>}
    {mode === 'signup' && <p>닉네임은 이메일 아이디로 자동 생성되며, 가입 후 내 프로필에서 변경할 수 있습니다.</p>}
    {['login','signup','reset'].includes(mode) && <label>비밀번호<input name="password" type="password" required minLength={mode === 'login' ? 1 : 8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? '비밀번호' : '8자 이상 입력해 주세요'}/></label>}
    {['signup','reset'].includes(mode) && <label>비밀번호 확인<input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password"/></label>}
    {(state.error || initialError) && <p className="error" role="alert">{state.error || initialError}</p>}
    {(state.message || changed) && <p role="status">{state.message || '비밀번호가 변경되었습니다. 다시 로그인해 주세요.'}</p>}
    <button className="button" disabled={pending || waiting}>{pending ? '처리 중…' : waiting ? '잠시 후 다시 요청해 주세요' : label}</button>
  </form><nav className="auth-links">{mode === 'login' ? <><Link href="/signup">회원가입</Link><Link href="/forgot-password">비밀번호 찾기</Link></> : <Link href="/login">로그인으로 돌아가기</Link>}</nav></section><p className="auth-caption">작은 흔적 하나에도, 마음은 전해지니까요.</p></main>;
}
