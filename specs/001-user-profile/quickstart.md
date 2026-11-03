# Quickstart: 프로필 검증

로컬 구현 검증 및 원격 전환 가이드다. 실행 결과와 미완료 항목은 memory-bank/progress.md를 따른다. 상세 기준은 [계약](contracts/profile.md)과 [데이터 모델](data-model.md)을 참조한다.

## Prerequisites

- 기존 Node/npm/lockfile 및 Chrome/Playwright 환경.
- README에 따른 로컬 Supabase 공개 설정·사이트 URL과 서버 전용 SUPABASE_SERVICE_ROLE_KEY 설정. 키는 server-only 관리자 모듈에서만 사용하고 NEXT_PUBLIC 노출 금지. 실제 환경값을 문서/저장소에 복사하지 않는다.
- 확인된 테스트 회원 A/B, 같은 A의 두 독립 세션, 허용/손상/용량 경계 사진 fixtures.
- 후속 migration과 앱 구현 완료. 실제 DB/권한/RPC/버킷/이력은 Supabase MCP 또는 CLI로 확인 후 기존 이력 다음에 적용한다. DB 초기화는 요구하지 않는다.

## Commands

프로젝트 루트 PowerShell에서 실행한다.

```powershell
npm ci
node tests/member-policies.mjs
node tests/profile-image.test.mjs
npx playwright test --config playwright.member.config.ts
npx playwright test
npm run typecheck
npm run build
npm run dev
```

member config는 3002 포트 HTTP fixture다. 실제 통합은 기본 3000 dev 서버와 실제 Supabase 연결로 검증한다. 필요한 브라우저 설치는 기존 프로젝트 지침을 따른다. fixture는 실제 JWT/Storage/DB 동시성을 대체하지 않는다.

## Scenarios

| Scenario | Steps | Expected |
|---|---|---|
| 기본/닉네임 | 가입·재접속, trim/1/20/21자·대소문자 중복·동시 중복 | 기본 프로필 유지, 유효값만 저장 |
| 사진 | PNG/JPEG/WebP, 정확히 5MiB/1바이트 초과, 위조 MIME/정상 헤더 뒤 잘린 픽셀 | 전체 decode 성공한 허용 파일만 저장 |
| 저장/표시 | 이름·사진 각각/함께 저장, 재접속, 목록·상세·댓글 조회 | 현재 프로필 일치, author_id 불변 |
| 같은 회원 충돌 | 두 창 동일 revision 로드, 창1 저장 후 창2 저장 | 창2 전체 거부, 창1 보존, 창2 입력/File/preview 유지 |
| 다른 항목 충돌 | 창1 이름·창2 사진 변경 후 저장 | 병합 없이 창2 전체 거부 |
| 확인/재시도 | 충돌 뒤 재클릭, 최신 조회 실패·성공, 명시 확인 후 저장 | 확인 전 쓰기 없음, 실패 시 잠금, 확인 후만 재시도 |
| 재충돌 | 최신 확인 이후 다른 창 저장 후 다시 제출 | 다시 conflict, 선행 저장 유지 |
| 동시 저장 | 동일 회원 독립 Server Action 요청 또는 서버 전용 RPC 테스트에서 같은 revision 병렬 저장 | saved 1개, 나머지 conflict, 덮어쓰기 0건; 회원 직접 RPC는 거부 |
| 직접 API | anon/authenticated/A/B의 직접 RPC·UPDATE·Storage INSERT/UPDATE/DELETE 및 손상 파일 직접 연결 시도; 인증된 Server Action 정상 요청 | 모든 회원 직접 쓰기/실행 거부, 서버 인증·전체 검증을 거친 본인 저장만 허용 |
| 장애/응답 유실 | upload·DB 실패, commit 뒤 응답 유실, 이전 객체 삭제·URL 발급 실패 | 초안 유지, 유실은 확인 필요, 참조 객체 보존, commit 뒤 부수 실패 분리 |
| 표시 갱신 | 활성 10초 polling 직후 타 창 저장, 조회·URL·사진 로딩 전체 10초 이내 지연 주입, 역순 응답/중복 요청·focus/오프라인 복귀 | 저장부터 30초 내 nickname/사진 표시 완료, 구 응답 덮어쓰기 없음; 비활성/오프라인은 복귀 갱신 확인 |
| URL 접근 | 로그인 발급 URL로 로그아웃 뒤 조회, 비로그인 신규 발급/직접 조회, 로그아웃 메모리/타이머 확인 | 신규 발급·직접 조회 거부, 기발급 URL 300초 유효기간 구분, 앱 URL 제거·갱신 중단 |
| fallback/정리 | 5분 이상 유지, 서명/사진/프로필 실패, 기존 미연결 기록, 화면 이동 | 기본 표시·본문 유지, 타이머/구독/preview 정리 |
| 인증/접근성 | 로그인 만료·다른 계정 재로그인, 키보드, 390/1440px | 초안 보존, 타 회원 자동 제출 금지, 필수 조작 접근 가능 |

## 원격 전환 순서

### T031 읽기 전용 사전 점검

2026-11-02 확인한 Supabase CLI 2.122.0은 `db query --remote=<ref> --read-only --file`을 지원한다. Supabase MCP를 이용할 수 있으면 같은 메타데이터를 MCP로 확인해도 된다. 아래 명령은 프로젝트 루트에서 실행하며 대상 ref는 실제 프로젝트와 대조한다.

```powershell
$profileProjectRef = '<대상 프로젝트 ref>'
npx --yes --package supabase supabase projects list --output json
npx --yes --package supabase supabase db query --remote=$profileProjectRef --read-only --file supabase/checks/profile-preflight.sql
```

사전 점검은 profiles 컬럼/기본값·테이블 RLS·테이블/열 UPDATE 권한·정책·RPC 실행 권한·trigger/제약/인덱스·아바타 버킷을 반환한다. 회원 개인정보나 객체 경로는 반환하지 않는다. 결과의 migration_history_present가 true일 때만 다음 조회로 적용 version을 확인한다.

```powershell
npx --yes --package supabase supabase db query --remote=$profileProjectRef --read-only 'select version from supabase_migrations.schema_migrations order by version'
```

이력 테이블 부재는 과거 SQL이 미적용이라는 증거가 아니다. 실제 스키마와 기존 적용 기록을 함께 대조하고 중복 migration 적용·이력 자동 복구를 하지 않는다. 현재 실행 환경의 SUPABASE_ACCESS_TOKEN이 만료/폐기되었으면 해당 관리 인증을 갱신하거나 MCP를 연결한다. 서버 서비스 키는 관리 토큰으로 사용할 수 없으며, 토큰 값은 명령 인자·출력·문서에 기록하지 않는다.

이번 원격 시도는 프로젝트 목록과 대상 DB 직접 조회 모두 Invalid access token(직접 DB 조회 HTTP 401)으로 실패했다. 아래 전환 절차는 아직 실행하지 않았다. 로컬 PGlite에서 사전 점검 SQL의 전환 전/후 컬럼·권한·RPC·버킷 판독만 확인했다.

### 전환 및 실제 검증

1. Supabase MCP 또는 유효한 CLI 관리 인증으로 현재 프로젝트·migration 이력·profiles 컬럼/권한·RPC·Storage 버킷/정책을 확인한다. 서비스 키는 관리 API access token의 대체 수단이 아니다.
2. 기존 백업·staging 검증 및 쓰기 중지 창을 확보한다. 서버 환경에 SUPABASE_SERVICE_ROLE_KEY를 설정하고 호환 앱 빌드와 202611020001_profile_revision.sql을 함께 준비한다. 키 값은 출력하지 않는다.
3. maintenance 동안 후속 migration과 호환 앱을 전환한다. revision 없는 구버전 폼은 저장에 실패하고 새 화면 진입을 안내해야 한다. DB만 전환한 채 구 앱을 운영하지 않는다.
4. 일반 회원 RPC/직접 UPDATE/버킷 쓰기 거부, 서버 경유 본인 저장, 기존 owner_id 사진 유지와 owner_id 없는 서버 업로드 연결을 확인한다. 같은 revision 두 독립 요청의 saved 1개/conflict, 실제 A/B·URL 접근·30초 표시를 검증한다.
5. 실패 시 maintenance를 유지하고 새 계약을 지원하는 앱 수정 배포를 우선한다. 구 앱 단순 원복·UPDATE/Storage 권한 재부여를 자동 복구로 사용하지 않는다. 기존 데이터나 migration 이력을 초기화하지 않는다.

활성 조회는 10초, 정상 전체 조회/URL/사진 로딩은 10초 이내, 저장부터 표시 완료는 30초 이내다. 사진 서명 URL은 300초/앱 갱신 240초이며 로그아웃 시 앱 URL·타이머를 정리해도 기발급 URL은 즉시 무효화되지 않는다.

## Success evidence

### Hosted development verification (2026-11-03)

The user authorized the development cutover. Version 202611020001 is applied and verified. Backups and a rollback-only remote rehearsal preceded the change; no separate hosted staging or external website deployment is claimed.

To rerun the opt-in hosted checks against the authorized development project, start a compatible production build on port 3004, then run:

```powershell
npm run start -- --hostname 127.0.0.1 --port 3004
# In another terminal, with server credentials available only to Node:
node --env-file=.env.local tests/hosted-profile.mjs --apply
```

This runner creates isolated confirmed/unconfirmed users and cleans its own users, records and objects in finally. It refuses other Supabase project hosts. It writes only non-sensitive check names/results to ignored artifacts/hosted-profile-results.json. Actual URL expiry uses a one-second hosted URL; four-minute browser renewal and logout inactivity advance the browser clock. Failure injection and worst-case delayed polling remain covered by local fixtures. Actual five-person usability observations are still required for T033.

SC-002~004는 로컬과 실제 서비스 결과를 분리해 환경·시나리오·실패 주입 지점·결과를 기록한다. SC-001은 유효 사진을 미리 받은 사용자 5명(PC/모바일 포함) 중 4명 이상이 도움 없이 2분 내 저장. SC-005는 작성자 3명의 기록을 사용자 5명 중 4명 이상이 모두 정확히 연결해야 한다.

실제 실행 결과와 제약은 memory-bank/progress.md, 구현·검증 완료 상태는 implementation-plan.md에 기록한다. 인증 토큰·사진 bytes·서명 URL은 증거 문서에 남기지 않는다.

서버 전용 RPC 테스트는 서버 환경에서만 수행하고 키를 브라우저/테스트 결과에 출력하지 않는다. 신규 서비스 업로드 owner_id를 회원 UID로 가정하지 말고 경로 기반 논리 소유권과 legacy 참조 호환을 확인한다. 직접 Storage 쓰기 차단으로 검증 바이트의 삭제/재업로드 경쟁도 거부되는지 검사한다. 전체 표시 시간 조건 밖의 네트워크 실패는 fallback/복구 검증으로 별도 기록한다.
