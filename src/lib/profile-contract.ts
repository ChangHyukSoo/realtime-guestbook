export type ProfileSnapshot = { nickname: string; revision: string; avatarUrl: string | null };
export type ProfileResult =
  | { code: 'success'; profile: ProfileSnapshot; message: string; displayWarning?: string }
  | { code: 'validation_error' | 'conflict' | 'auth_required' | 'unavailable' | 'outcome_unknown'; message: string };
export type LatestProfileResult =
  | { code: 'success'; profile: ProfileSnapshot }
  | { code: 'auth_required' | 'unavailable'; message: string };
export type SaveProfileAction = (form: FormData) => Promise<ProfileResult>;
export type ReadProfileAction = () => Promise<LatestProfileResult>;
