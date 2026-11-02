'use server';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
export type ProfileState = { error?: string; message?: string; avatarUrl?: string };
export async function updateProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const nickname = String(form.get('nickname') ?? '').trim();
  if (Array.from(nickname).length < 1 || Array.from(nickname).length > 20) return { error: '닉네임은 공백을 제외하고 1~20자로 입력해주세요.' };
  try {
    const client = await serverClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user || user.is_anonymous || !user.email_confirmed_at) return { error: '로그인이 만료되었습니다. 새 탭에서 로그인한 후 다시 저장해주세요.' };
    const { data: previous, error: readError } = await client.from('profiles').select('avatar_path').eq('id', user.id).single();
    if (readError) return { error: '프로필을 확인하지 못했습니다. 다시 시도해주세요.' };
    let path = previous.avatar_path as string | null;
    const file = form.get('avatar');
    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) return { error: '이미지는 5MB 이하로 선택해주세요.' };
      const bytes = Buffer.from(await file.arrayBuffer());
      const type = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? ['image/png','png'] : bytes[0]===255 && bytes[1]===216 && bytes[2]===255 ? ['image/jpeg','jpg'] : bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP' ? ['image/webp','webp'] : null;
      if (!type || type[0] !== file.type) return { error: 'PNG, JPG, WebP 이미지 파일을 선택해주세요.' };
      path = `${user.id}/${crypto.randomUUID()}.${type[1]}`;
      const { error } = await client.storage.from('profile-avatars').upload(path, bytes, { contentType: type[0], upsert: false });
      if (error) return { error: '이미지 업로드에 실패했습니다. 선택한 파일로 다시 시도해주세요.' };
    }
    const { error } = await client.from('profiles').update({ nickname, avatar_path: path }).eq('id', user.id).select('id').single();
    // A lost response can hide a successful commit; do not delete the new object here.
    if (error) return { error: error.code === '23505' ? '이미 사용 중인 닉네임입니다.' : '프로필 저장에 실패했습니다. 입력 내용을 확인하고 다시 시도해주세요.' };
    if (previous.avatar_path && previous.avatar_path !== path) await client.storage.from('profile-avatars').remove([previous.avatar_path]);
    const { data } = path ? await client.storage.from('profile-avatars').createSignedUrl(path, 300) : { data: null };
    revalidatePath('/', 'layout');
    return { message: '프로필을 저장했습니다.', avatarUrl: data?.signedUrl };
  } catch { return { error: '연결에 실패했습니다. 입력 내용은 유지됩니다. 다시 시도해주세요.' }; }
}
