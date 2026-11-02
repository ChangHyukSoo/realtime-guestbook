import Guestbook from '@/components/guestbook';
import { requireMember } from '@/lib/member';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const member = await requireMember(`/guestbooks/${id}`); return <Guestbook {...member} initialId={id} />; }
