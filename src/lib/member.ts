import { redirect } from 'next/navigation';
import { serverClient } from './supabase/server';
import { authConfigured } from './auth-utils';
export async function requireMember(next = '/') {
  if (!authConfigured()) redirect('/login?error=config');
  const client = await serverClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.is_anonymous || !user.email_confirmed_at) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { data: profile } = await client.from('profiles').select('nickname').eq('id', user.id).maybeSingle();
  return { userId: user.id, nickname: profile?.nickname as string | undefined };
}
