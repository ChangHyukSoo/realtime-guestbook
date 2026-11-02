'use server';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { authConfigured, safeNext } from '@/lib/auth-utils';
export type AuthState = { error?: string; message?: string; retryAt?: number };
export async function authenticate(_: AuthState, form: FormData): Promise<AuthState> {
  if (!authConfigured()) return { error: 'Supabase 연결 설정이 필요합니다. 관리자에게 문의해 주세요.' };
  const mode = String(form.get('mode'));
  if (!['login', 'signup', 'forgot', 'reset', 'resend'].includes(mode)) return { error: '잘못된 요청입니다.' };
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (mode !== 'reset' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) return { error: '올바른 이메일 주소를 입력해 주세요.' };
  if (['signup','reset'].includes(mode) && (password.length < 8 || password.length > 128 || password !== form.get('confirm'))) return { error: '비밀번호는 8~128자이며 확인 입력과 같아야 합니다.' };
  const client = await serverClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const host = (await headers()).get('host');
  const origin = site || (process.env.NODE_ENV !== 'production' && host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? `http://${host}` : null);
  if (['signup','forgot','resend'].includes(mode) && !origin) return { error: '인증 메일의 사이트 주소 설정이 필요합니다.' };
  try {
    if (mode === 'login') {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.user || data.user.is_anonymous || !data.user.email_confirmed_at) return { error: '로그인하지 못했습니다. 이메일·비밀번호와 이메일 확인 여부를 확인해 주세요.' };
    } else if (mode === 'signup') {
      const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/confirm` } });
      if (error) return { error: '가입 요청을 처리하지 못했습니다. 입력을 확인하거나 잠시 후 다시 시도해 주세요.' };
      if (data.session) await client.auth.signOut();
      redirect('/signup/check-email');
    } else if (mode === 'forgot') {
      await client.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm` });
      return { message: '해당 주소로 복구할 수 있는 계정이 있다면 안내 메일이 발송됩니다.', retryAt: Date.now() + 60000 };
    } else if (mode === 'resend') {
      await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${origin}/auth/confirm` } });
      return { message: '확인이 필요한 계정이라면 안내 메일이 발송됩니다.', retryAt: Date.now() + 60000 };
    } else {
      const store = await cookies();
      const { data: { user } } = await client.auth.getUser();
      if (!user || user.is_anonymous || store.get('trace-recovery')?.value !== user.id) return { error: '비밀번호 재설정 메일을 다시 요청해 주세요.' };
      const { error } = await client.auth.updateUser({ password });
      if (error) return { error: '비밀번호를 변경하지 못했습니다. 새 비밀번호를 확인해 주세요.' };
      store.delete('trace-recovery');
      await client.auth.signOut();
      redirect('/login?changed=1');
    }
  } catch (error) {
    // Next.js redirects must propagate to the framework.
    if (error && typeof error === 'object' && 'digest' in error && String(error.digest).startsWith('NEXT_REDIRECT')) throw error;
    return { error: '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }
  redirect(safeNext(String(form.get('next') ?? '/')));
}
