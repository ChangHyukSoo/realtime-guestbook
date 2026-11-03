# Tasks: 닉네임과 프로필 이미지 설정

**Input**: `specs/001-user-profile/`의 spec.md, plan.md, research.md, data-model.md, contracts/profile.md, quickstart.md.

**Prerequisites**: 기존 Next.js·Supabase 유지. 실제 Git 브랜치는 `001-profile`, 기능 문서 경로는 `specs/001-user-profile`이다. constitution은 미작성 템플릿이므로 사용자 지시와 AGENTS.md를 적용한다.

**Tests**: 명세의 Acceptance Scenarios와 SC-002~004에서 요구하는 검증을 작업으로 포함한다. 기존 테스트를 확장하고 새 동작에 대한 실패를 먼저 확인한 뒤 구현한다. 이미 구현된 동작에 인위적으로 실패를 만들지 않는다. 사용자 평가 SC-001/005는 별도 실행이다.

**Organization**: 기존 기능의 재구현이 아닌 후속 보완 작업이다. 체크박스는 실제 구현·검증 결과를 반영한다. 경로는 저장소 루트 기준이다. [P]는 명시된 선행 작업이 끝난 뒤 다른 파일에서 병렬 수행할 수 있다는 의미다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 현재 구성과 검증 환경을 재사용하고 제품 범위를 유지한다.

- [X] T001 `package.json`, `package-lock.json`, `src/app/profile/actions.ts`, `supabase/migrations/202610280001_user_profile.sql`의 실제 설치/구현 상태를 설계와 비교하고 차이 및 Node 실행 버전을 `memory-bank/progress.md`에 기록한다. Next.js·Supabase 버전 업그레이드나 새 프로젝트 생성은 하지 않는다.
- [X] T002 `specs/001-user-profile/quickstart.md`의 계정 A/B·독립 세션·migration 이력과 서버 전용 SUPABASE_SERVICE_ROLE_KEY 설정 조건을 점검해 `memory-bank/progress.md`에 기록한다. 실제 값은 기록하지 않고 원격 조회는 Supabase MCP/CLI만 사용한다.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 사용하는 revision/RPC/권한/결과 타입 기반. T001~T002 이후 수행한다. 원격 전환은 최종 단계까지 하지 않는다.

- [X] T003 `tests/member-policies.mjs`에 UUID revision·서버 전용 RPC·stale 거부·직접 table/column UPDATE 및 anon/authenticated/익명/미확인 RPC 거부를 추가한다. service_role 호출의 p_member_id 회원 검증, 버킷 직접 INSERT/UPDATE/DELETE 및 손상 직접 업로드→연결 우회 거부를 재현하고 새 요구 실패를 확인한다.
- [X] T004 `supabase/migrations/202611020001_profile_revision.sql`에 profiles.revision의 **"non-null UUID, DB 생성 초기값/갱신값"** 추가·기존 행 초기화와 모든 UPDATE의 revision 회전 trigger를 구현한다. **"회원당 1개; trim 후 Unicode code point 1~20; lower(btrim(nickname)) unique"**, **"avatar_path nullable text"**, 기존 id FK/created_at과 소유 사진 검증을 유지한다. 기존 적용 migration은 수정하지 않는다.
- [X] T005 T004의 `supabase/migrations/202611020001_profile_revision.sql`에 `save_own_profile(p_member_id UUID,p_expected_revision UUID,p_nickname TEXT,p_avatar_path nullable TEXT)`를 구현한다. SECURITY DEFINER/빈 search_path/고정 SQL, auth.users의 대상 회원 비익명·이메일 확인, 행 FOR UPDATE/revision 비교·전체 저장/saved-conflict 반환. PUBLIC/anon/authenticated EXECUTE와 table/column UPDATE를 철회하고 service_role EXECUTE만 허용한다. 버킷 회원 INSERT/UPDATE/DELETE 정책을 닫고 읽기는 유지한다. 사진 trigger는 서버 업로드 객체의 UID 경로·버킷·존재를 확인하고 legacy 현재 참조는 유지한다. service owner_id를 회원 UID로 가정하지 않는다.
- [X] T006 [P] `src/lib/profile-contract.ts`에 success/validation_error/conflict/auth_required/unavailable/outcome_unknown·UUID string revision·nullable avatarUrl/displayWarning 타입을 정의한다. `src/lib/supabase/admin.ts`에 server-only 관리자 클라이언트를 만들고 SUPABASE_SERVICE_ROLE_KEY를 서버 환경에서만 읽으며 사용자 세션 클라이언트와 분리한다. NEXT_PUBLIC/클라이언트 import/로그/반환 노출을 금지한다.
- [X] T007 T004~T006 후 `node tests/member-policies.mjs`를 실행해 T003 검증을 통과시키고 실제 SQL/권한 차이를 해결한다. 결과와 PGlite의 실제 PostgreSQL 잠금/Storage 검증 한계를 `memory-bank/progress.md`에 기록한다.

**Checkpoint**: 로컬 DB 계약과 결과 타입 준비 완료. 공통 기반 완료 전 스토리 구현에 착수하지 않는다.

## Phase 3: User Story 1 — 나를 표현하는 닉네임 설정 (Priority: P1) — MVP

**Goal**: 기존 닉네임 편집을 유지하면서 동일 회원의 오래된 화면에서 저장하면 전체 거부한다.

**Independent Test**: 사진을 선택하지 않고 이름 저장·재접속 확인. 동일 회원 두 창이 같은 revision을 읽은 뒤 창1 저장/창2 저장 시 창2 입력 보존과 충돌 안내, 최신 확인 전 재제출 금지, 확인 후 명시 재시도 및 재충돌을 검증한다.

### Tests for User Story 1

- [X] T008 [US1] `tests/member-server.mjs`에 서버 전용 서비스 인증과 일반 회원 RPC 거부, p_member_id별 revision 저장/최신 읽기, 동일 회원 두 창 상태·충돌·읽기 실패·세션 교체·응답 유실 fixture를 추가한다. 실제 JWT/RLS 검증을 대체하지 않는다.
- [X] T009 [US1] `tests/member-ui.spec.ts`에 사진 없는 닉네임 저장/재접속, trim·1/20/21 code point·공백·영문 대소문자 중복·기존 이름 유지, 두 창 stale 저장·확인 전 재클릭·최신 읽기 실패·확인 후 저장·재충돌·다른 계정 재로그인 거부 시나리오를 추가하고 새 동작 실패를 확인한다.

### Implementation for User Story 1

- [X] T010 [US1] `src/app/profile/page.tsx`에서 nickname/avatar_path/revision을 초기 조회하고 편집 회원 UID를 서버 바인딩한 Action으로 전달한다. `src/lib/member.ts`의 기존 회원 검증과 초기 조회 실패 재시도 화면을 재사용한다. revision 없는 폼은 저장하지 못하게 한다.
- [X] T011 [US1] `src/app/profile/actions.ts`를 T005 RPC/T006 타입으로 전환한다. 요청마다 사용자 세션 getUser()/비익명/이메일 확인/서버 바인딩 편집 UID 일치 검사 후 검증된 UID를 관리자 클라이언트 RPC의 p_member_id에 전달한다. 폼 UID/경로 입력은 금지하며 UUID/이름 검증·unique/conflict 구분·성공 revision 반환·revalidatePath를 구현한다. 기존 사진 경로도 서버 전용 계약과 호환시킨다.
- [X] T012 [US1] `src/app/profile/actions.ts`에 readLatestOwnProfile을 구현한다. 대상 UID를 폼에서 받지 않고 본인 최신 nickname/사진/revision만 반환한다. 인증/읽기 오류를 구분하며 자동 쓰기는 수행하지 않는다. 안전한 단계/오류 코드/추적 ID 로그만 남기고 이메일·토큰·File bytes·서명 URL은 제외한다.
- [X] T013 [US1] `src/components/profile-form.tsx`에 baseline/draft/latest snapshot과 submitting/conflict_locked/loading_latest/latest_visible 상태를 연결한다. 충돌·불확실 응답은 제출을 잠그고 입력/File/preview를 유지한다. 최신 정보를 별도 표시하고 명시적 확인에서만 baseline을 교체하며 저장은 별도 클릭이다. 자동 focus 조회·읽기 실패·재클릭으로 잠금을 우회하지 못하게 한다.
- [X] T014 [P] [US1] T013 이후 `src/app/globals.css`에 최신 snapshot/충돌 안내/확인 버튼의 기존 테마 스타일을 추가한다. 390px·1440px에서 가로 넘침·필수 조작 가림이 없고 키보드 focus가 식별되어야 한다. 새 디자인 시스템은 만들지 않는다.
- [X] T015 [US1] T013 이후 `tests/member-ui.spec.ts`의 US1 시나리오와 보호된 /profile 진입·기본 닉네임 생성·키보드/오류 텍스트·390/1440px 검증을 실행하고 실패를 해결한다. T014 스타일 확인 후 실행 결과를 `memory-bank/progress.md`에 기록한다.

**Checkpoint**: 닉네임만으로 독립 검증 가능한 로컬 MVP. 사진 미선택은 기존 사진을 유지한다. US2 전체 디코딩/서버 업로드 완료 전 사진 등록·교체는 비활성화하고 중간 상태는 배포하지 않는다.

## Phase 4: User Story 2 — 프로필 사진 등록과 교체 (Priority: P1)

**Goal**: 기존 사진 기능을 유지하고 손상 파일 거부·전체 저장 일관성·응답 유실·충돌 보존을 보완한다.

**Independent Test**: 닉네임을 유지한 채 사진만 등록/교체하고 재접속한다. 이름만 바꾼 다른 창과도 충돌하는지, 실패 시 이름·사진 모두 기존 저장값을 유지하고 File이 보존되는지 확인한다.

### Tests for User Story 2

- [X] T016 [US2] `tests/profile-image.test.mjs`와 `tests/fixtures/profile-images/`에 유효 PNG/JPEG/WebP·정확히 5,242,880바이트·1바이트 초과·위조 MIME·정상 헤더 뒤 잘린 픽셀 파일 검증을 추가하고 현재 헤더 검사 한계가 드러나는 실패를 확인한다. 테스트는 실제 서버 디코딩 모듈을 호출하며 실행 방법을 `specs/001-user-profile/quickstart.md`에 추가한다.
- [X] T017 [P] [US2] `tests/member-server.mjs`에 업로드 실패/DB 확정 거부/commit 뒤 응답 유실/이전 객체 삭제 실패/서명 URL 발급 실패 주입을 추가한다. 서로 다른 항목 충돌과 참조 중인 사진 삭제 보호 상태를 재현한다.
- [X] T018 [US2] T017 이후 `tests/member-ui.spec.ts`에 사진만/이름+사진 저장, 사진 미선택 유지, 다른 항목 충돌·File/preview 보존, 중복 제출·응답 유실 잠금, commit 뒤 표시 오류와 사진 교체 재접속 시나리오를 추가하고 새 동작 실패를 확인한다.

### Implementation for User Story 2

- [X] T019 [US2] `package.json`과 `package-lock.json`에 로컬 사용 중 sharp 0.35.5를 직접 의존성으로 명시하고 `src/lib/profile-image.ts`에 **"PNG/JPEG/WebP ≤ 5MiB"**(원본 5,242,880바이트 이하) MIME/헤더/전체 픽셀 decode 검증을 구현한다. metadata만으로 성공 처리하지 않고 자원 제한을 유지한다. 원본 형식/크기 정책과 `next.config.ts`의 기존 6mb body 한도를 유지한다.
- [X] T020 [US2] `src/app/profile/actions.ts`에 T019 전체 디코딩 후 동일 바이트를 server-only 관리자 클라이언트로 private `<uid>/<fresh UUID>.<png|jpg|webp>`에 upsert:false 업로드하고 서버 전용 RPC로 연결한다. 클라이언트 경로를 받지 않는다. 서버 객체의 논리 소유자는 인증 UID 경로이며 service owner_id를 회원 UID로 가정하지 않는다. 직접 Storage 쓰기와 RPC 우회를 차단한다. 확정 실패의 미참조 새 객체만 정리하고 commit 불확실 시 보존하며 이전 객체 삭제/URL 오류는 commit 결과와 분리한다.
- [X] T021 [US2] `src/components/profile-form.tsx`에서 사진 성공 저장 후 File/preview를 정리하고 저장된 URL/fallback을 표시한다. 오류·충돌·불확실 응답은 선택 File을 보존하고 URL 발급만 실패한 저장은 성공+표시 오류로 안내한다. object URL 해제와 사진 미선택 유지, 다음 연속 저장의 최신 revision을 보장한다.
- [X] T022 [P] [US2] `memory-bank/trouble-shooting.md`에 확정 충돌/미참조 파일과 commit 응답 유실 파일 처리, 현재 참조 객체 삭제 금지, 부수 정리 실패 기록을 보완한다. 기존 고아 파일 보존 기간·자동 정리 구현은 별도 미완료 항목으로 유지하고 임의의 보존 기간을 확정하지 않는다.
- [X] T023 [US2] T019~T022 이후 `tests/profile-image.test.mjs`, `tests/member-policies.mjs`, `tests/member-ui.spec.ts`의 US2 검증을 실행해 사진 경계·원자적 프로필 저장·File 보존·세션 만료·응답 유실·참조 사진 보호를 확인하고 결과를 `memory-bank/progress.md`에 기록한다.

**Checkpoint**: 사진만 또는 이름+사진을 저장할 수 있고, 손상·충돌·실패가 기존 프로필을 훼손하지 않는다.

## Phase 5: User Story 3 — 방명록에서 작성자 알아보기 (Priority: P1)

**Goal**: 기존 목록·상세·댓글에서 현재 프로필과 fallback을 유지하고 변경·서명 만료 이후 표시를 검증한다.

**Independent Test**: 서로 다른 두 회원의 글·댓글을 제시하여 현재 nickname/avatar와 author_id 일치를 확인한다. 다른 활성 창 저장 후 30초 이내 표시 완료, focus 복귀, 5분 이상 서명 갱신, 읽기 실패 fallback을 검증한다.

### Tests for User Story 3

- [X] T024 [US3] `tests/member-ui.spec.ts`에 목록·상세·댓글의 두 회원 현재 프로필, 프로필 변경 후 기존 기록 반영, **"기존 nullable author_id"** 미연결 글과 댓글 snapshot, 기본 avatar·프로필 읽기 실패 본문 유지 시나리오를 추가한다. 기존 기능은 회귀 통과를 확인하고 새 결함이 확인될 때만 실패 회귀를 추가한다.
- [X] T025 [US3] `tests/member-ui.spec.ts`에 활성 10초 조회의 최악 위상(조회 직후 타 창 저장), 전체 조회/URL/사진 로딩 10초 이내 지연 조건에서 저장부터 30초 내 표시 완료, 중복 요청/역순 응답 차단, focus 즉시 갱신·오프라인 복귀, 300초 URL/240초 갱신을 검증한다. 로그아웃 시 URL 메모리 제거·갱신 중단, 비로그인 신규 발급 거부와 기발급 URL 유효기간도 검사한다. 실제 동작은 T032에서 별도 확인한다.

### Implementation / Integration for User Story 3

- [X] T026 [P] [US3] `src/components/guestbook.tsx`의 활성 프로필 조회를 30초에서 10초로 변경하고 중복 요청·역순 응답 반영을 막으며 focus 복귀 즉시 갱신을 시작한다. 비활성/오프라인 복귀, 로그아웃 메모리 URL/타이머 정리, 현재 작성자·legacy snapshot·본문 보존·구독 해제를 유지한다. 새 프로필 전용 Realtime 구독은 추가하지 않는다.
- [X] T027 [P] [US3] T024~T025에서 발견한 avatar 결함을 `src/components/author-profile.tsx`에서 수정한다. URL 300초/240초 갱신·사진 변경 시 이전 URL 초기화·기본 avatar·해제 후 비동기 갱신 방지를 유지한다. 결함이 없으면 무변경 검증 결과를 기록한다.
- [X] T028 [US3] T026~T027 이후 `tests/member-ui.spec.ts`의 US3 시나리오를 실행하고 목록·상세·댓글 및 legacy fallback·표시 갱신 결과를 `memory-bank/progress.md`에 기록한다. 로컬 fixture를 실제 서비스 검증 완료로 표시하지 않는다.

**Checkpoint**: 각 회원의 현재 프로필로 글·댓글 작성자를 일관되게 구분할 수 있다.

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T029 `README.md`와 `specs/001-user-profile/quickstart.md`에 서버 키의 서버 전용 설정(실제 값 금지), 서버 전용 RPC/Storage 쓰기 전환·구버전 폼 실패·maintenance/호환 앱 복구와 테스트 명령을 반영한다. 기발급 URL 300초와 로그아웃 동작, 활성 10초 조회/정상 전체 로딩 10초/30초 표시 완료를 명시한다. 권한 재부여를 자동 원복으로 쓰지 않는다.
- [X] T030 `specs/001-user-profile/quickstart.md`의 로컬 명령(추가 이미지 검사 포함)을 실행하여 PGlite·회원/인증 Playwright·typecheck·build 및 `git diff --check` 결과를 `memory-bank/progress.md`에 기록한다. 실패는 수정 후 해당 검사만 필요한 범위에서 재실행한다.
- [X] T031 Supabase MCP 또는 CLI로 실제 migration 이력·schema/grants/RLS/RPC/버킷을 확인한 뒤 `supabase/migrations/202611020001_profile_revision.sql`과 호환 앱을 계획된 전환 절차로 적용하고 적용 전후 검증을 `memory-bank/progress.md`에 기록한다. 접근 불가 시 로컬로 대체 완료하지 말고 외부 차단 사유를 남긴다. 데이터 초기화나 기존 정책의 임의 제거는 하지 않는다.
- [X] T032 T031 이후 `specs/001-user-profile/quickstart.md`의 실제 A/B·비로그인/익명/미확인 요청·일반 회원 직접 RPC/UPDATE/Storage 쓰기·손상 직접 업로드 연결 우회 거부와 서버 p_member_id 위조 방지를 확인한다. 동일 회원 독립 요청은 Server Action 경유 또는 서버 전용 RPC 신뢰 테스트로 수행해 같은 revision의 saved 1개/나머지 conflict를 확인한다. 비로그인 신규 URL 거부/기발급 URL 유효기간/로그아웃 정리와 활성 10초 조회의 최악 위상·전체 로딩 10초 이내 지연에서 30초 표시 완료를 실제 측정하고 SC-002~004를 `memory-bank/progress.md`에 기록한다.
- [X] T033 T032 이후 `specs/001-user-profile/quickstart.md`의 SC-001/005 사용자 평가를 실행하고 `memory-bank/progress.md`에 익명 집계한다. PC/모바일 포함 5명 중 4명 이상 도움 없이 2분 내 저장, 작성자 3명의 기록 연결은 5명 중 4명 이상 모두 정답이어야 한다. 참가자 미확보 시 미완료로 남긴다.
- [X] T034 `memory-bank/architecture.md`, `memory-bank/progress.md`, `memory-bank/implementation-plan.md`, `memory-bank/prd-user-profile.md` 및 `specs/001-user-profile/tasks.md`를 실제 구현/검증 증거와 동기화하고 외부 차단·미완료를 유지한다. 작업 규칙 변경이 있을 때만 `AGENTS.md`를 갱신한다.

## Dependencies & Execution Order

```text
T001 -> T002 -> Foundation
Foundation: T003 -> T004 -> T005 -> T007
                      T006 --------> T007
T007 -> US1 (T008..T015) -> US2 (T016..T023) -> US3 (T024..T028)
All stories -> T029 -> T030 -> T031 -> T032 -> T033 -> T034
```

- T006은 Phase 1 이후 T003~T005와 다른 파일에서 병렬 가능하다. 서버 키 설정은 T002에서 조건을 점검하며 실제 값은 문서에 넣지 않는다. Phase 2 완료 체크는 T007 통과 이후다.
- US1: T008 → T009 → T010 → T011 → T012 → T013. T014와 T015는 T013 후 다른 파일에서 작업할 수 있지만 T015 최종 화면 검증은 T014 완료 후 수행한다.
- US2: T016과 T017 병렬 가능. T017 → T018, T016 → T019, T018/T019 → T020 → T021 → T023. T022는 기반 완료 후 독립 문서 작업이나 최종 내용은 T020과 대조한다.
- US3: T024 → T025 → (T026 ∥ T027) → T028.
- 세 스토리 모두 P1이나 US2는 US1의 동일 폼/Action을 수정하므로 순서대로 수행한다. US3는 기존 읽기 계약으로 독립 테스트 가능하지만 최종 통합은 US2 완료 뒤 수행한다. 같은 테스트 파일 수정끼리는 병렬화하지 않는다.
- T031~T033은 외부 실행 조건이 필요하다. 접근/계정/참가자 조건이 충족되지 않으면 그 작업을 체크하지 않으며 T034에 제약을 기록할 수 있다. 전체 기능 완료로 선언하지 않는다.

## Parallel Execution Examples

| Story / phase | 병렬 가능한 작업 | 합류 조건 |
|---|---|---|
| Foundation | T003~T005 SQL/정책 흐름과 T006 결과 타입 | T007 전 모두 완료 |
| US1 | T014 CSS와 T015 테스트 준비 | T013 이후, 최종 화면 검증은 T014 후 |
| US2 | T016 디코더 테스트와 T017 서비스 실패 fixture | T018/구현 전 각 선행 완료 |
| US2 | T022 운영 문서와 T019~T021 구현 | T023 전 최종 대조 |
| US3 | T026 guestbook 데이터 수정과 T027 avatar 수정 | T024/T025 이후, T028 전 합류 |

이는 실행 가능한 작업 관계이며 이번 tasks 생성에서 병렬 에이전트나 구현을 실행했다는 뜻은 아니다.

## Requirement Traceability

| Requirements / success | Primary tasks |
|---|---|
| FR-001, FR-002, FR-003 | T003~T005, T009~T015 |
| FR-004 | T016, T019, T020, T023 |
| FR-005, FR-006 | T011~T013, T017~T023 |
| FR-007 | T003~T007, T010~T012, T031~T032 |
| FR-008, FR-009, FR-010 | T024~T028, T032 |
| FR-011 | T013~T015, T021, T030 |
| FR-012 | T003~T015, T017~T018, T023, T032 |
| SC-001, SC-005 | T033 |
| SC-002, SC-003, SC-004 | T007, T015, T023, T028, T030, T032 |

## Implementation Strategy

MVP는 Phase 1~3(US1)이다. 사진 미선택 상태로 nickname 저장과 동시 편집 거부를 독립 검증한다. 기존 사진 경로가 새 RPC와 호환되어야 하며 MVP만으로 전체 명세 완료를 선언하지 않는다.

이후 US2의 손상 이미지/사진 장애 보완, US3의 표시 회귀를 순서대로 완료한다. 로컬 통과 뒤 실제 서비스 전환과 SC-002~004, 사용자 평가 SC-001/005까지 증거를 모은다. 기존 구현에 결함이 없는 항목은 불필요한 코드를 만들지 않고 검증 결과로 완료한다. 체크박스는 해당 구현과 요구 검증이 실제 완료된 때만 갱신한다.

## Analysis Remediation Traceability

| Finding | Updated tasks |
|---|---|
| I1 서명 URL 접근 기준 | T025, T029, T032 |
| C1 서버 검증 우회 차단 | T002~T006, T008, T011, T020, T029, T032 |
| I2 표시 시간 여유 | T025~T026, T029, T032 |

34개 ID를 유지하고 실제 완료 항목만 표시한다. 기존 헌법 미작성 사항은 이번 구현 범위 밖으로 유지한다.

## Execution status (2026-11-02)

T001~T030/T034 로컬 구현·검증·문서 동기화 완료. T031은 CLI 관리 인증 Invalid access token으로 원격 확인/전환 미완료, T032는 실제 계정/독립 세션 검증 미실행, T033은 사용자 평가 참가자 미확보다. 전체 기능 완료로 선언하지 않는다. 자세한 증거는 memory-bank/progress.md에 있다.

## 후속 실행 점검 (2026-11-02)

완료 체크 31개/전체 34개와 이전 실행 증거를 대조했다. 이번 작업은 완료 항목을 다시 실행한 것으로 간주하지 않으며 T031~T033의 미완료 표시를 유지한다.

| 작업 | 이번 수행 내용 | 현재 상태와 재개 조건 |
|---|---|---|
| T031 | CLI projects list 재시도 및 대상 프로젝트에 직접 `db query --remote=<ref> --read-only --file supabase/checks/profile-preflight.sql` 실행. 메타데이터 점검 SQL 준비 및 PGlite 전환 전/후 검증 통과 | 두 원격 요청 모두 Invalid access token(직접 DB 조회 HTTP 401). 유효한 관리 토큰을 현재 실행 환경에 제공하거나 Supabase MCP 연결 필요. 실제 schema/grants/RPC/Storage/migration 이력 확인·전환은 미실행 |
| T032 | quickstart의 계정 A/B·독립 세션·API/표시 검증 순서 유지 | T031의 백업/staging/호환 앱·DB 전환 완료 후 실제 계정으로 수행 |
| T033 | SC-001/005 평가 기준 및 증거 기록 조건 유지 | T032 이후 PC/모바일 포함 실제 참가자 5명 확보 후 수행 |

다음 실행은 T031 사전 점검이다. CLI read-only 결과의 migration_history_present가 true이면 version 이력을 추가 조회하고 로컬 migration과 대조한다. 메타데이터 조회 성공만으로 T031을 완료 표시하지 않는다. 점검 SQL은 토큰·이메일·객체 경로·회원 프로필 값을 반환하지 않는다.
## Continuation evidence (2026-11-03)

Refreshed user-environment token authentication and remote read-only inspection now succeed. Hosted migration history: 20261028023957. revision/save_own_profile remain absent; 2 profiles and 1 avatar object exist. T031 remains unchecked pending backup/staging, coordinated app transition, migration execution and postchecks. Docker daemon is unavailable; development/maintenance confirmation is pending. T032/T033 remain unchecked. Revalidation: policy/image/typecheck and 13 Playwright tests pass. See memory-bank/progress.md for the final build result.

## Development cutover final evidence (2026-11-03)

T031 complete: user authorized immediate development transition; CLI schema/data dumps, rollback-only remote rehearsal, atomic migration/history commit and hosted postflight passed. No separate hosted staging/external app deployment is claimed. T032 complete for hosted core integration: all 11 real-account checks passed with cleanup, alongside existing fixture failure/worst-case timing tests. See memory-bank/progress.md and artifacts/hosted-profile-results.json for scope. T033 remains unchecked: five actual participants are required.


## Final participant acceptance (2026-11-03)

User-provided actual P1-P5 observations in usability-results.md satisfy SC-001 (5/5 unassisted within 120 seconds) and SC-005 (5/5 successful three-change sequences without confusion). Desktop/mobile coverage is 3/2. T033 is complete; all 34 tasks are checked. This final status supersedes earlier pending-status snapshots. No code changes or repeated integration checks were needed for this evidence review.
