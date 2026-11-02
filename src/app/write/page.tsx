import Guestbook from '@/components/guestbook';
import { requireMember } from '@/lib/member';
export default async function Page() { const member = await requireMember('/write'); return <Guestbook {...member} initialWrite />; }
