'use server';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { validateProfileImage } from '@/lib/profile-image';
import type { LatestProfileResult, ProfileResult, ProfileSnapshot } from '@/lib/profile-contract';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const authMessage = '로그인이 만료되었거나 편집 계정이 변경되었습니다. 새 탭에서 같은 계정으로 로그인해주세요.';
function report(stage: string) { console.warn('profile_operation', { stage, traceId: crypto.randomUUID() }); }
async function removeUnreferenced(admin: ReturnType<typeof adminClient>, path: string) {
  try {
    const {data,error}=await admin.from('profiles').select('id').eq('avatar_path',path).limit(1);
    if(error || !data || data.length) return;
    const removed=await admin.storage.from('profile-avatars').remove([path]);
    if(removed.error) report('cleanup');
  } catch { report('cleanup'); }
}
async function memberClient(editingUserId: string) {
  const client = await serverClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.id !== editingUserId || user.is_anonymous || !user.email_confirmed_at) return null;
  return { client, user };
}
async function snapshot(client: Awaited<ReturnType<typeof serverClient>>, row: {nickname: string; revision: string; avatar_path: string | null}): Promise<ProfileSnapshot> {
  let avatarUrl: string | null = null;
  if (row.avatar_path) {
    try { const result = await client.storage.from('profile-avatars').createSignedUrl(row.avatar_path, 300); avatarUrl = result.data?.signedUrl ?? null; }
    catch { report('display'); }
  }
  return { nickname: row.nickname, revision: row.revision, avatarUrl };
}
export async function readLatestOwnProfile(editingUserId: string): Promise<LatestProfileResult> {
  try {
    const member = await memberClient(editingUserId);
    if (!member) return { code: 'auth_required', message: authMessage };
    const { data, error } = await member.client.from('profiles').select('nickname,avatar_path,revision').eq('id', member.user.id).single();
    if (error || !data || !uuid.test(data.revision)) return { code: 'unavailable', message: '최신 정보를 불러오지 못했습니다. 잠금은 유지됩니다. 다시 시도해주세요.' };
    return { code: 'success', profile: await snapshot(member.client, data) };
  } catch { report('read'); return { code: 'unavailable', message: '최신 정보를 불러오지 못했습니다. 다시 시도해주세요.' }; }
}
export async function updateProfile(editingUserId: string, form: FormData): Promise<ProfileResult> {
  let dispatched = false;
  try {
    const member = await memberClient(editingUserId);
    if (!member) return { code: 'auth_required', message: authMessage };
    const nickname = String(form.get('nickname') ?? '').trim();
    const revision = String(form.get('expectedRevision') ?? '');
    if (Array.from(nickname).length < 1 || Array.from(nickname).length > 20) return { code: 'validation_error', message: '닉네임은 공백을 제외하고 1~20자로 입력해주세요.' };
    if (!uuid.test(revision)) return { code: 'validation_error', message: '편집 정보를 확인할 수 없습니다. 새 화면에서 다시 시작해주세요.' };
    const file = form.get('avatar');
    const admin = adminClient();
    let path: string | null=null;
    if (file instanceof File && file.size > 0) {
      let image;
      try { image=await validateProfileImage(file); }
      catch(error) {return {code:'validation_error',message:error instanceof Error?error.message:'이미지 파일을 확인해주세요.'};}
      path=member.user.id+'/'+crypto.randomUUID()+'.'+image.extension;
      const upload=await admin.storage.from('profile-avatars').upload(path,image.bytes,{contentType:image.contentType,upsert:false});
      if(upload.error) return {code:'unavailable',message:'이미지 업로드에 실패했습니다. 선택한 파일로 다시 시도해주세요.'};
    }
    dispatched = true;
    const { data, error } = await admin.rpc('save_own_profile', { p_member_id: member.user.id, p_expected_revision: revision, p_nickname: nickname, p_avatar_path: path });
    if (error) {
      if(path && ['23505','23514','22023','42501','P0002'].includes(error.code)) await removeUnreferenced(admin,path);
      if (error.code === '23505') return { code: 'validation_error', message: '이미 사용 중인 닉네임입니다.' };
      if (['23514','22023','42501','P0002'].includes(error.code)) return { code: 'unavailable', message: '프로필 저장에 실패했습니다. 입력을 확인하고 다시 시도해주세요.' };
      report('commit_unknown');
      return { code: 'outcome_unknown', message: '저장 결과를 확인하지 못했습니다. 최신 정보를 확인해주세요.' };
    }
    const row = data?.[0];
    if (row?.status === 'conflict') {
      if(path) await removeUnreferenced(admin,path);
      return { code: 'conflict', message: '다른 창에서 프로필이 변경되었습니다. 최신 정보를 확인해 주세요.' };
    }
    if (row?.status !== 'saved' || !uuid.test(row.revision)) return { code: 'outcome_unknown', message: '저장 결과를 확인하지 못했습니다. 최신 정보를 확인해주세요.' };
    const profile = await snapshot(member.client, row);
    if(row.previous_avatar_path && row.previous_avatar_path!==row.avatar_path) await removeUnreferenced(admin,row.previous_avatar_path);
    try { revalidatePath('/', 'layout'); } catch { report('revalidate'); }
    return { code: 'success', profile, message: '프로필을 저장했습니다.', ...(row.avatar_path && !profile.avatarUrl ? {displayWarning:'사진을 불러오지 못했습니다. 저장은 완료되었습니다.'} : {}) };
  } catch {
    report(dispatched ? 'commit_unknown' : 'prepare');
    return dispatched ? { code: 'outcome_unknown', message: '저장 결과를 확인하지 못했습니다. 최신 정보를 확인해주세요.' } : { code: 'unavailable', message: '연결에 실패했습니다. 입력 내용은 유지됩니다. 다시 시도해주세요.' };
  }
}
