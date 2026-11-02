import AuthForm from '@/components/auth-form';
import { safeNext } from '@/lib/auth-utils';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const query = await searchParams;
  return <AuthForm mode="login" next={safeNext(query.next)} changed={query.changed === '1'} initialError={query.error === 'config' ? 'Supabase 연결 설정이 필요합니다.' : query.error ? '인증 링크가 만료되었거나 유효하지 않습니다. 다시 요청해 주세요.' : ''}/>;
}
