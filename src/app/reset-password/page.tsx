import AuthForm from '@/components/auth-form';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireMember } from '@/lib/member';
export default async function Page() {
  const member = await requireMember('/');
  if ((await cookies()).get('trace-recovery')?.value !== member.userId) redirect('/forgot-password');
  return <AuthForm mode="reset"/>;
}
