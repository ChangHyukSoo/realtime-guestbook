# Data Model

## Entities

| Entity | Fields / relationships | Invariants |
|---|---|---|
| profiles | id UUID PK/FK auth.users; nickname text; avatar_path nullable text; created_at timestamp | 회원당 1개; trim 후 Unicode code point 1~20; lower(btrim(nickname)) unique |
| profiles.revision (new) | non-null UUID, DB 생성 초기값/갱신값 | 성공 저장마다 새 값, 권한/시간/순서 표현 아님; TS UUID string |
| profile-avatars object | bucket/name/owner_id/MIME/size; 신규 논리 소유자는 서버 생성 경로 UID | private `<uid>/<uuid>.<png|jpg|webp>`; 최대 5MiB; 참조 중 삭제 금지 |
| guestbooks | 기존 nullable author_id 및 이미지 경로 | 프로필 변경과 독립적인 작성자 귀속 유지 |
| comments | 기존 guestbook_id/nullable author_id/nickname snapshot/content/created_at | 회원 연결 시 현재 프로필, 기존 미연결 기록은 snapshot |

기존 닉네임/경로 검증은 유지하고 사진 소유권 trigger를 서버 업로드 모델에 맞게 갱신한다. 신규 객체는 서버 전용 생성 경로의 UID와 p_member_id 일치, 버킷/존재/서버 업로드 객체를 확인한다. 서비스 업로드 owner_id를 회원 UID라고 가정하지 않는다. 기존 회원 owner_id 사진은 현재 참조를 그대로 유지한다. 별도 revision trigger는 모든 UPDATE에서 revision을 교체한다. 클라이언트는 revision을 직접 수정하지 못한다. RPC는 행 잠금 후 expected_revision 비교, nickname/avatar_path 변경을 하나의 DB 트랜잭션에서 수행한다. unique/check 실패는 전체 롤백이다. 이메일을 공개 프로필에 추가하지 않는다.

## Transient UI data and states

- Baseline: 편집 시작 또는 명시적 최신 확인에서 받은 nickname/avatar/revision.
- Draft: nickname, 선택 File, preview object URL. 현재 브라우저 메모리에만 보존.
- LatestSnapshot: 충돌 후 별도 조회한 nickname/avatar/revision, Draft와 분리 표시.
- loaded → editing → submitting: 제출 중 중복 조작 차단.
- success → editing: 반환된 revision으로 baseline 갱신, 선택 File/preview 정리, 저장된 avatar 표시.
- validation/upload/DB 확정 실패 → editing: 기존 프로필과 draft 유지.
- conflict → conflict_locked → loading_latest → latest_visible: 제출 잠금 유지, 읽기 실패 시 잠금 해제 안 함.
- latest_visible → editing: 사용자가 최신 정보를 확인했다는 명시적 조작에서만 baseline 교체, draft 유지. 저장은 별도 클릭. 그 사이 다른 저장이 있으면 다시 conflict.
- outcome_unknown → 최신 확인 필요: 성공 단정/자동 재제출 금지, 업로드 객체 유지.
- auth_required: 현재 화면 draft 유지, 재로그인 안내. 다른 회원으로 로그인했으면 기존 draft를 자동 제출하지 않는다.

## Storage and transaction boundary

사용자 세션 클라이언트로 회원 확인 → 입력/전체 이미지 decode → 별도 server-only 관리자 클라이언트로 동일 바이트 새 UID/UUID 객체 업로드 → 서버 전용 RPC에 검증된 p_member_id 전달 → 대상 회원 재검사/행 잠금/expected revision 비교/전체 변경/새 revision 반환. 사진 미선택(null)은 DB 현재 사진 유지이며 삭제 의미가 아니다.

업로드 후 충돌 가능성을 전제로 한다. 확정 거부로 미참조임을 확인한 새 객체만 안전하게 정리할 수 있다. commit 응답 유실 시 새 객체를 지우지 않는다. 성공 후 이전 객체 삭제는 부수 작업이며 실패해도 commit 성공은 유지한다. 현재 참조 객체 삭제 보호는 항상 유지하고 미참조 객체는 기존 운영 절차로 처리한다.

## Migration and compatibility

기존 migration은 수정하지 않고 후속 migration을 추가한다. revision 초기화·회전 trigger·RPC·grants 변경을 한 migration으로 적용한다. 기존 nickname/avatar_path column UPDATE grant 및 RPC의 PUBLIC/anon/authenticated EXECUTE도 명시적으로 철회한다. service_role만 RPC를 실행한다. profile-avatars의 회원 INSERT/UPDATE/DELETE 정책을 닫고 기존 읽기 정책은 유지한다. 서버가 새 경로를 생성하므로 클라이언트에서 경로를 받지 않는다. 직접 업로드·삭제·재업로드를 통한 검증 우회가 불가능해야 한다.

revision 없는 구버전 열린 폼은 저장에 실패하고 새 화면 진입 안내를 받는다. maintenance 창에서 DB 계약과 앱을 함께 전환한다. 구버전 앱으로 단순 원복하면 저장이 실패하므로 새 계약을 지원하는 앱 수정 배포를 우선한다. UPDATE 권한 재부여는 충돌 보장을 없애므로 자동 원복으로 삼지 않는다.

적용 전/후 Supabase MCP 또는 CLI로 실제 schema/grants/RLS/RPC/버킷/이력을 확인한다. 이번 계획에서는 원격을 조회·변경하지 않았다.

서명 URL은 300초, 앱 갱신은 240초다. 로그아웃 시 메모리 URL 제거와 갱신 중단을 수행하지만 기발급 URL 즉시 폐기는 보장하지 않는다. 활성 화면 프로필은 10초 조회하며 역순 응답과 중복 요청을 차단한다.
