import Guestbook from '@/components/guestbook';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <Guestbook initialId={id} />; }
