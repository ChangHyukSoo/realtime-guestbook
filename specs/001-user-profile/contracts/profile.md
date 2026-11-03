# Profile Interface Contracts

추가 예정 계약이며 별도 REST 서버를 만들지 않는다.

## UI: /profile

확인된 비익명 회원만 접근. 초기 nickname/avatar/revision 조회 실패는 재시도·방명록 이동을 제공한다. 저장 입력은 nickname, optional avatar File, expectedRevision UUID다. revision은 권한 증명이 아니다.

conflict 시 입력·File·preview를 보존하고 “다른 창에서 프로필이 변경되었습니다. 최신 정보를 확인해 주세요.” alert를 표시한다. 저장 버튼은 잠근다. 최신 정보 확인은 별도 읽기로 nickname/사진을 draft와 분리 표시한다. “확인 후 계속 편집”에서만 baseline을 교체하며 자동 저장하지 않는다. 읽기 실패 시 잠금 유지. 자동 focus 조회는 baseline을 바꾸지 않는다. File 보존을 위해 폼을 remount하지 않는다.

키보드 접근과 390/1440px 필수 조작 가시성을 검증한다.

## Server Action: updateProfile (extend existing)

FormData: nickname text, avatar optional File, expectedRevision UUID. 요청마다 사용자 세션 클라이언트의 getUser() 및 email_confirmed_at/비익명 회원 확인. 검증한 UID만 서버 전용 RPC의 p_member_id로 전달하며 관리자 클라이언트로 사용자 인증을 대체하지 않는다. 대상 UID는 폼에서 받지 않는다. 이전 Action state도 권한 근거로 신뢰하지 않는다.

| Result code | Payload | Behavior |
|---|---|---|
| success | saved nickname/revision, nullable avatarUrl, optional displayWarning | 실제 commit 뒤 성공, baseline 갱신 |
| validation_error | field/message | 기존 프로필·draft 유지 |
| conflict | message | 전체 거부, 최신 확인 전 잠금 |
| auth_required | message | 초안 보존·로그인 안내 |
| unavailable | message | 확정 실패, 재시도 가능 |
| outcome_unknown | message | commit 불확실, 최신 확인 필요 |

서버는 nickname을 trim 후 Array.from 기준 1~20자로 검증한다. 파일은 원본 5,242,880바이트 이하, MIME/헤더/전체 decode가 PNG/JPEG/WebP에 일치해야 한다. 실패 시 nickname/사진 부분 변경을 하지 않는다.

성공 후 기존 revalidatePath/작성자 조회 재사용. 서명 URL 발급이나 이전 객체 삭제 실패는 이미 commit한 저장과 구분해 안내한다. 로그는 단계/안전한 오류 코드/추적 ID만 기록하고 이메일·토큰·File bytes·signed URL은 제외한다.

## Server Action: readLatestOwnProfile (new)

대상 UID 입력 없음. getUser()로 회원 확인 후 본인 nickname/avatar_path/revision 및 표시용 URL 반환. 읽기/인증 실패 구분. draft를 변경/자동 제출하지 않는다. 폼에 서버가 바인딩한 편집 회원과 현재 세션 UID가 다르면 update/read 모두 거부한다. 바인딩 값은 인증을 대체하지 않는다.

## RPC: public.save_own_profile (new, server-only)

Inputs: p_member_id UUID (Server Action의 검증된 UID), p_expected_revision UUID, p_nickname TEXT, p_avatar_path nullable TEXT. null 사진은 현재 사진 유지. 브라우저 요청에서 대상 UID나 객체 경로를 받지 않는다.

Outputs: status saved/conflict. saved는 대상 회원 nickname/avatar_path/revision/이전 avatar_path. conflict는 변경 없이 반환한다. 인증/검증/unique/check 오류는 안전한 Action 코드로 변환한다.

- SECURITY DEFINER, 빈 search_path, 스키마 명시 고정 SQL. PUBLIC/anon/authenticated EXECUTE 철회, service_role만 실행 허용. service role 인증 문맥의 auth.uid()를 회원 UID로 사용하지 않는다.
- auth.users에서 p_member_id 회원의 존재/비익명/email_confirmed_at을 확인한다. p_member_id는 server-only Action의 인증 결과에서만 가져온다.
- 대상 profiles 행 FOR UPDATE 후 revision 비교. 불일치면 전체 거부, 일치하면 변경하고 trigger가 새 revision 생성. 누락/null/잘못된 revision은 실패한다.
- profiles의 table/column UPDATE는 PUBLIC/anon/authenticated에서 철회한다. nickname unique/trim/length와 사진 경로·실제 객체 검증 유지.
- 신규 사진은 서버가 검증한 동일 바이트를 service_role 클라이언트로 `<p_member_id>/<fresh UUID>.<ext>`에 upsert:false 업로드한 객체만 전달한다. RPC/trigger는 해당 UID 경로/버킷/객체 존재/서버 업로드 객체를 검증한다. service 업로드 owner_id는 회원 UID라고 가정하지 않는다. 기존 member owner_id 사진은 현재 참조로만 유지한다.
- 버킷의 authenticated INSERT/UPDATE/DELETE 경로를 닫아 직접 업로드·삭제/재업로드로 검증 바이트를 바꾸지 못하게 한다. 현재 사진 삭제 방지는 서버 삭제 전 참조 확인으로도 적용한다. 새 저장이 참조할 수 없는 과거 경로만 정리한다.
- SUPABASE_SERVICE_ROLE_KEY는 src/lib/supabase/admin.ts의 server-only 모듈에서만 읽는다. NEXT_PUBLIC 접두사, 클라이언트 번들/import, 폼/Action 반환, 로그 노출 금지. 사용자 세션 인증과 관리자 클라이언트를 분리한다.

## Storage, signed URLs and display

private profile-avatars. 쓰기는 서버 전용이며 기존 회원 SELECT/URL 신규 발급 권한은 유지한다. 비로그인 직접 조회·신규 발급은 거부한다. 기발급 URL은 300초 만료 전 소지자가 사용할 수 있으며 로그아웃 즉시 무효화는 보장하지 않는다. 앱은 로그아웃 시 메모리 URL 제거/갱신 중단을 수행한다. URL 발급 300초/갱신 240초, DB 저장 금지.

활성 화면은 10초 간격 조회와 focus 복귀 즉시 갱신 시작을 사용한다. 중복 요청과 역순 응답 반영을 막는다. 정상 검증 조건은 프로필 조회·URL 발급·사진 로딩 전체 10초 이내이며 저장부터 닉네임·사진(없으면 기본 avatar) 표시 완료까지 30초를 측정한다. 최악 polling 위상/지연 응답을 포함하고 비활성/오프라인은 시간 보장 밖으로 두되 복귀 갱신을 확인한다. 읽기 실패 시 기본 표시/본문 유지, 기존 미연결 작성자 fallback과 구독/타이머 정리를 유지한다.
