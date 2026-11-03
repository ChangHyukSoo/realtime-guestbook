import { requireMember } from '@/lib/member';
import { serverClient } from '@/lib/supabase/server';
import ProfileForm from '@/components/profile-form';
import { updateProfile, readLatestOwnProfile } from './actions';
export default async function ProfilePage() {
  const member = await requireMember('/profile');
  const client = await serverClient();
  const { data, error } = await client.from('profiles').select('nickname,avatar_path,revision').eq('id', member.userId).single();
  if (error || !data?.revision) return <main className="profile-page"><h1>프로필을 불러오지 못했습니다.</h1><a href="/profile">다시 시도</a> · <a href="/">방명록으로</a></main>;
  const { data: avatar } = data.avatar_path ? await client.storage.from('profile-avatars').createSignedUrl(data.avatar_path, 300) : { data: null };
  return <ProfileForm initial={{nickname:data.nickname,revision:data.revision,avatarUrl:avatar?.signedUrl ?? null}} saveAction={updateProfile.bind(null,member.userId)} readAction={readLatestOwnProfile.bind(null,member.userId)}/>;
}
