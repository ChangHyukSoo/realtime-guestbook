> Cross-spec planning reference (2026-11-03): [Shared engineering knowledge](shared-engineering.md). Profile implementation and acceptance are complete (34/34); choose applicable patterns and validation for each new spec. Separate unresolved dev checks remain listed below.

# 구현 계획

## T031 재개 준비 (2026-11-02)

- [x] tasks.md의 31/34 완료 상태와 기존 증거를 대조하고 T031~T033 재개 조건을 구체화한다.
- [x] 읽기 전용 `supabase/checks/profile-preflight.sql`과 CLI 실행 절차를 준비하고 PGlite 전환 전/후 판독을 검증한다.
- [ ] 유효한 관리 인증 또는 MCP 연결 후 대상 원격 메타데이터/실제 migration version 이력을 확인한다. 이번 projects list/DB 직접 조회는 Invalid access token(HTTP 401)으로 실패했다.
- [ ] 기존 T031의 백업/staging/maintenance·호환 앱 전환과 T032~T033 실제 검증을 수행한다. 사전 점검 준비만으로 상위 작업을 완료 처리하지 않는다.

## 프로필 후속 구현 결과 (2026-11-02)

- [x] T001~T007: 환경 점검, revision migration/원자 RPC/직접 쓰기 차단/서버 타입·클라이언트, PGlite 검증.
- [x] T008~T015: revision 기반 폼·Action·최신 정보 확인·초안 보존·키보드/390·1440px 검증. US1 중간 상태는 배포하지 않고 사진 기능은 US2에서 완성했다.
- [x] T016~T023: sharp 전체 프레임 검증/서버 업로드, 실패·충돌·응답 유실 보존, 파일 정리/표시 오류 분리와 회귀 검증.
- [x] T024~T030: 작성자 현재 표시/legacy fallback, 10초 polling·지연/중복 요청/서명 갱신/로그아웃 검증, 배포 가이드와 로컬 전체 검증.
- [ ] T031: 유효한 Supabase CLI 관리 인증 또는 MCP 연결을 확보하고 원격 이력/정책 확인 및 maintenance 전환. 현재 Invalid access token으로 차단되었으며 원격 변경 없음.
- [ ] T032: 실제 A/B·동일 회원 독립 세션 인가/Storage/동시성/30초 표시 측정. T031 완료 전 수행하지 않았다.
- [ ] T033: 실제 사용자 5명 SC-001/005 평가. 참가자 미확보, 자동 테스트로 대체하지 않는다.
- [x] T034: 구현·검증 결과와 외부 미완료를 관련 문서와 작업 목록에 동기화.

완료 기준: 아래 계획의 로컬 구현 항목은 이 절로 갱신한다. 전체 기능/서비스 전환 완료는 T031~T033의 실제 증거 확보 이후다. 정기 고아 아바타 청소/보존 기간은 기존 별도 미완료다.

## 상위 3건 보완 후 실행 기준 (2026-11-02)

- [tasks.md](../specs/001-user-profile/tasks.md)의 34개 미실행 작업에 I1/C1/I2를 통합했다. 이전 authenticated RPC·30초 polling 설계는 서버 전용 RPC·10초 polling으로 대체한다.
- 서버 비밀 키의 server-only 모듈/세션 인증 분리, service_role RPC/p_member_id 검사, 회원 Storage 쓰기/직접 UPDATE 차단, 검증 동일 바이트 업로드와 legacy 사진 호환을 구현·검증해야 한다.
- 비로그인 URL 신규 발급 거부/기발급 300초 유효기간/로그아웃 정리, 정상 전체 로딩 10초 조건의 최악 위상 30초 표시 완료 검증을 추가한다. 개별 구현 완료 체크는 바꾸지 않았다.

## 프로필 작업 목록 생성 (2026-11-02)

- [tasks.md](../specs/001-user-profile/tasks.md)에 34개 작업을 정의했다. 실행 순서는 Setup → Foundation → US1 → US2 → US3 → 서비스 통합/사용자 평가/문서 마무리다.
- 작업 목록 생성만 완료했으며 개별 구현·검증 체크는 모두 미완료다. 기존 설계 단계의 'tasks.md 미생성' 기록 이후 상태를 이 절이 대체한다.
- 다음 단계는 speckit-analyze 후 speckit-implement. 실제 서비스 적용과 사용자 평가는 외부 조건이 충족될 때 실행하고 증거를 남긴다.

## 프로필 후속 설계 실행 순서 (2026-11-02)

설계 산출물 작성 완료: [plan.md](../specs/001-user-profile/plan.md), research.md, data-model.md, contracts/profile.md, quickstart.md. 아래는 구현·검증 전이다.

- [ ] revision/trigger/원자 저장 RPC와 기존 table·column UPDATE 권한 철회를 후속 migration으로 구현하고 우회·병렬 요청 검증.
- [ ] page/Action/form의 conflict/최신 조회·확인 상태, 입력·File 보존, 확인 전 제출 차단과 재시도 검증.
- [ ] sharp 직접 의존성과 서버 전체 디코딩 추가, 손상/MIME/5MiB 경계·응답 유실 검증.
- [ ] 기존 로컬 회귀, 실제 계정 A/B·동일 회원 독립 세션, 사용자 5명 평가를 구분 실행.

완료 기준: FR-001~012 및 SC-001~005 실제 실행 증거와 미검증 제약 기록. 다음 명령은 speckit-tasks이며 이번 단계에서 tasks.md는 생성하지 않는다.

## 사용자 프로필 단계 (2026-10-28)

아래 기존 인증 계획의 프로필 관련 구조·원격 현황은 이 절과 architecture.md의 현재 상태를 따른다.

- [x] PRD와 기존 구조, 원격 프로필 컬럼·정책·닉네임 충돌 확인
- [x] 프로필/Storage SQL, 닉네임 UNIQUE와 기본 프로필 생성 트리거 구현 및 PGlite 정책 검증
- [x] 보호된 `/profile`, 편집·미리보기·업로드·입력 보존·모바일 진입 구현 및 HTTP fixture 검증
- [x] 목록·상세·댓글 작성자 프로필 및 서명 URL 갱신 구현
- [x] Supabase MCP로 프로필 마이그레이션 적용 및 컬럼 재확인
- [x] 회원 Playwright 5개/인증 Playwright 3개, typecheck, build 완료
- [x] PRD 보충 기준·설계·진행·운영 제약 동기화
- [ ] 실제 원격 회원 A/B로 프로필 수정·사진 업로드·직접 API 권한과 새로고침 후 표시 통합 검증
- [ ] 미참조 고아 아바타의 보존 기간 확정 및 관리자 청소 도구 구현

완료 기준: P0/P1 기능이 로컬 검증되고 원격 스키마가 적용된 상태이다. 원격 실사용 통합 검증은 별도 미완료로 유지한다.

## 인증·인가 후속 단계 (2026-10-27)

상세 작업·마이그레이션·완료 기준은 [인증 마이그레이션 계획](auth-migration-plan.md)을 따른다. 로컬 코드/정책 검증과 실제 외부 적용을 구분한다.

- [x] 로그인·회원가입·이메일 확인 안내·비밀번호 찾기/재설정 UI 및 폼 상태 구현·로컬 브라우저 검증
- [x] SSR 쿠키 세션·보호 페이지·확인 링크·복구 쿠키 구현, 로컬 HTTP fixture 회원 시나리오 검증
- [x] 계정 닉네임·초안 복원·private 이미지 저장/서명 URL 구현, 로컬 HTTP fixture 저장/실패/복원 검증
- [x] 회원 SQL·RLS/트리거·이전 검사·요청 제한 작성, PGlite 업그레이드·허용/차단 검증
- [x] 이미지 이전·백업/체크섬·고아 파일 정리 dry-run 스크립트와 운영 절차 작성
- [ ] 원격 스키마·정책·Auth·메일 설정·마이그레이션 이력 조사, 백업 및 스테이징 구성
- [ ] 기존 단일 `guestbook`과 로컬 스키마 정합화
- [ ] profiles·작성자·객체 경로 확장 SQL 및 회원 정책 적용·검증
- [ ] 이메일 가입·확인·로그인·로그아웃·복구, SSR 쿠키 세션·보호 라우트 구현·검증
- [ ] 계정 닉네임·실패 초안 복구·회원 전용 저장·서명 URL 구현·검증
- [ ] 기존 이미지 private 버킷 복사·참조 전환·고아 파일 운영 절차 검증
- [ ] 공개 읽기/쓰기 제거, 익명 Auth 차단, UID·Storage 연결·시간 위조 차단 검증
- [ ] 사용자 A/B 및 미인증 직접 API 인가 테스트, Realtime·배포·롤백 검증

완료 기준: 가입→이메일 확인→로그인→방명록 이용→로그아웃과 계정 복구, 비로그인/위조 요청 차단, 기존 콘텐츠 보존, 두 브라우저 실시간 반영을 실제 Supabase 환경에서 확인하고 기록한다. 이전 익명 인증 계획은 대체되었다.

미체크 항목의 실제 Supabase 적용·메일/Storage/Realtime 검증은 아직 수행하지 않았다. 스크립트의 실제 파일 복사/삭제도 실행 전이다. 아래 1~6단계는 초기 비회원 버전의 구현 이력이다.

요구사항은 prompt_draft.md, 구조는 architecture.md, 검증은 progress.md를 기준으로 관리한다. 코드 작성과 외부 검증을 구분한다.

## 1. 프로젝트 기반

- [x] AGENTS.md·memory-bank·원문·참고 이미지와 초기 저장소 확인
- [x] Next.js·TypeScript·Tailwind, 공개 환경 변수 예시, 세 라우트 구성
- [x] 타입·빌드 검사와 Chrome 직접 라우트 진입 검증
- [x] 이미지·입력 제한, 공개 URL 방식과 고아 파일 운영 방안 기록

완료 기준: 세 화면 접근, 타입·빌드 통과, 비밀값 없는 설정 예시 제공. 충족했다.

## 2. Supabase 데이터 기반

- [x] 스키마·외래 키·검증 제약·인덱스 SQL 작성
- [x] 익명 읽기·등록 RLS, Storage PNG/5MB 정책, Realtime 발행 SQL 작성
- [x] 관리자 고아 파일 정리 절차 명시
- [ ] 실제 Supabase 적용 및 허용·차단 정책 검증

완료 기준: 실제 읽기·등록과 잘못된 입력·수정·삭제 차단 확인. 외부 설정이 없어 단계 전체는 미완료.

## 3. 작성·저장

- [x] 작성·캔버스·색상·굵기·사진·지우기·등록 UI 구현
- [x] Chrome 빈 캔버스 차단·마우스 필기·데모 저장 검증
- [ ] 사진 합성·실제 터치 기기·실패 재시도 브라우저 검증 (코드 작성 완료)
- [ ] 실제 Storage 업로드·DB 등록 검증

완료 기준: 데스크톱·터치에서 사진 필기와 외부 저장 성공·실패 동작 확인.

## 4. 목록·실시간

- [x] 카드 그리드·필터·작성·상세·로딩·빈 상태·오류 UI 구현
- [x] 데모 저장 후 목록 반영과 새로고침 후 보존 검증
- [ ] 실제 Realtime·중복 제거·구독 해제·재연결 검증 (코드 작성 완료)

완료 기준: 다른 브라우저에 새 방명록이 새로고침 없이 한 번만 반영된다.

## 5. 상세·댓글

- [x] 이미지·닉네임·댓글·상대 시간·목록 복귀 UI 구현
- [x] Chrome 데모 댓글 등록·새로고침 후 보존·없는 상세 상태 검증
- [ ] 실제 댓글 저장·상세별 구독과 해제·상대 시간 갱신 검증 (코드 작성 완료)

완료 기준: 두 브라우저의 같은 상세에 댓글이 한 번만 나타나고 다른 상세와 섞이지 않는다.

## 6. 통합 검증·안내

- [x] 실행·환경 변수·SQL·Storage·RLS·Realtime README 작성
- [x] 타입·프로덕션 빌드와 Chrome 데모 회귀 검사
- [x] 데스크톱·모바일 스크린샷 열람, 모바일 가로 넘침 수정 및 재검증
- [ ] 잘못된 이미지·과도한 입력·저장 실패·빈 목록 통합 검증
- [ ] 실제 Supabase 두 브라우저 통합 검증
- [x] 구현 구조·진행·제약 문서 갱신

완료 기준: 실제 수행한 검증과 외부 설정에 따른 미검증 사항을 구분해 기록한다.

## Spec Kit installation verification (2026-10-29)

### 프로필 Spec Kit 계획 (2026-11-02)

- [x] 기존 PRD·설계·진행 문서와 화면 참고를 확인하고 프로필 명세를 작성한다.
- [x] 명세 품질 체크리스트 16개를 검토하고 활성 기능 경로를 등록한다.
- [x] `$speckit-plan`: 기존 구현과 [명세](../specs/001-user-profile/spec.md)를 비교하고 남은 설계·검증 계획을 확정한다.
- [ ] 후속 작업에서 실제 계정 간 권한·이미지 접근·변경 반영과 실패 복구를 검증한다.
- [ ] 명세 SC-001/005의 사용자 평가를 수행하고 SC-002~004의 시나리오 결과를 기록한다.

완료 기준: 문서 품질 검토와 실제 기능 검증을 구분하며, 후속 항목은 실제 수행과 결과 기록 후에만 완료 처리한다.

- [x] Identify the installed integration format and verify managed file status.
- [x] Confirm all 10 generated Codex skills exist; document skills-based usage instead of legacy prompt files.

## 동시 편집 후속 작업 (2026-11-02)

- [ ] FR-012의 오래된 편집 화면 저장 거부를 설계·구현하고, 같은 항목 및 다른 항목 수정 모두에서 먼저 저장된 프로필 유지와 입력·선택 파일 보존을 검증한다.
- [ ] 최신 정보 확인 전 재제출 차단과 확인 후 재시도를 검증한다.

완료 기준: 동일 회원 두 창의 저장 충돌에서 덮어쓰기 0건, 충돌 안내와 입력·선택 파일 보존 확인.
## 잔여 작업 재개 기준 (2026-11-03)

- [x] CLI 인증 재확인: `projects list --output json` 실행, `Invalid access token` 실패 확인.
- [x] T033 사용자 평가 기록 양식 준비: `specs/001-user-profile/usability-results.md`.
- [ ] CLI 재로그인 후 T031 원격 읽기 전용 사전 점검 및 migration 이력 확인.
- [ ] 사전 점검 결과에 따라 기존 배포 절차로 T031 반영 후 T032 실계정 통합 검증.
- [ ] T032 통과 후 실제 참가자 5명으로 T033 평가 및 결과 기록. 양식 준비만으로 완료 처리하지 않는다.

2026-11-03 추가 확인: 사용자 별도 PowerShell 로그인 성공 후에도 에이전트의 CLI 조회는 실패했다. 명령 단위 SUPABASE_ACCESS_TOKEN 제거 및 sandbox 밖 재시도도 동일했다. 실행 환경 인증 복구 후 T031을 재개한다.

## Token reset retry outcome (2026-11-03)

- [x] Retry CLI authentication after the reported environment reset; API returned Invalid access token.
- [ ] T031: authenticate successfully, inspect remote metadata and migration history, then determine the required migration action.
- [ ] T032: run real-account integration verification after T031.
- [ ] T033: collect actual five-participant usability evidence after T032.

The current process may still inherit the earlier environment. Refresh the Codex session environment before retrying. No remote modifications were made.

## Latest token reset verification (2026-11-03)

- [x] Retry projects list in sandbox and escalated execution; both returned Invalid access token. Check inherited token presence and basic format without exposing its value.
- [ ] T031: authenticate in a refreshed application environment, then inspect remote metadata/history and execute the documented transition prerequisites.
- [ ] T032/T033: retain pending status until remote transition and actual integration/participant evidence are available.
## Refreshed-token continuation (2026-11-03)

- [x] Authenticate CLI with the refreshed Windows user token without disclosing or persisting it.
- [x] Inspect hosted schema, grants, policies, functions, bucket, aggregate counts and migration history using read-only CLI queries.
- [x] Re-run policy/image tests, typecheck and Playwright (10 member + 3 auth tests passed).
- [x] Finish production build verification (npm run build passed).
- [ ] T031: obtain full backup and staging evidence, confirm maintenance/app transition conditions, apply the revision migration and verify resulting permissions/history. Docker daemon is currently unavailable; transition question is pending.
- [ ] T032: real-account integration after the hosted transition.
- [ ] T033: actual five-participant usability evaluation after T032.

## Authorized development cutover (2026-11-03)

- [x] User confirmed development use and immediate transition.
- [x] Start Docker and create pre-change CLI schema/data backups (Storage metadata, not object binaries).
- [x] Rehearse DDL and privilege assertions in a remote transaction ending in rollback; use this development check instead of a separate hosted staging deployment.
- [x] T031: apply revision migration and history atomically, inspect resulting grants/RPC/RLS/Storage policies and run the compatible local production build.
- [x] T032: extended hosted runner passed all 11 checks and cleanup; local fixtures retain failure-injection/worst-case polling coverage.
- [ ] T033: collect actual five-participant observations; automation is not participant evidence.
## T033 session preparation (2026-11-03)

- [x] Prepare Korean facilitator instructions and measurement/acceptance rules in usability-results.md.
- [ ] Obtain actual P1-P5 observations with desktop/mobile coverage; participant availability/results requested from the user.
- [ ] Evaluate SC-001/SC-005 and record findings, then update T033 only when the evidence supports the result.

## Mobile LAN development access (2026-11-03)

- [x] Add the reported 192.168.55.162 hostname to allowedDevOrigins and verify Next.js loads it in development config.
- [ ] Restart the active dev server and confirm mobile reload/HMR without the cross-origin warning.
- [ ] Re-run typecheck after regenerating Next.js dev route types; current generated validator cannot resolve ./routes.js.


## Final usability acceptance (2026-11-03)

- [x] Review actual five-participant observations and evaluate SC-001/SC-005.
- [x] Complete T033 and synchronize acceptance results, tasks, PRD, architecture and progress.

All 34 profile feature tasks are complete. SC-001/005 passed with 5/5 participants each; desktop/mobile coverage is 3/2. Earlier pending feature entries are historical. The separate mobile LAN restart/HMR and generated route-type checks remain unverified by this documentation-only review.


## Cross-spec handoff (2026-11-03)

- [x] Consolidate reusable implementation and verification knowledge with source references and explicit scope limits.
- [x] Link the shared reference from required entry documents and troubleshooting.
- [x] Check document references and whitespace; preserve unresolved mobile HMR/generated-type checks without claiming completion.
