# 진행 상황

## 사용자 프로필 완료 기록 (2026-10-28)

이 절은 아래 과거 기록 중 사용자 프로필과 원격 스키마 현황을 갱신한다.

- PRD P0/P1 구현: 회원 전용 프로필 설정, 이메일 아이디 기본 닉네임 자동 생성, 닉네임 변경·중복 제한, 사진 선택·미리보기·업로드, 목록/상세/댓글 작성자 프로필 표시, 실패 시 입력·선택 파일 보존, 중복 제출 방지, 모바일 진입 링크.
- 원격 Supabase MCP 조회 결과 profiles/guestbooks/comments가 이미 존재했다. 기존 중복 닉네임이 없음을 확인한 뒤 프로필 마이그레이션을 적용했고 avatar_path 추가를 재확인했다. 10-27의 미적용 기록은 당시 상태이다.
- `node tests/member-policies.mjs`: 통과. 기존 회원 정책과 함께 기본 닉네임 생성/충돌, 닉네임 중복/공백, 타인 수정 차단, 아바타 소유권, 사용 중 이미지 삭제 차단, 익명 프로필 조회 차단을 검증했다.
- `npx playwright test --config playwright.member.config.ts`: 5개 통과. 프로필 중복 오류 후 입력 보존, 사진 저장/재조회, 5MiB 초과 차단, 390px 레이아웃과 기존 회원 흐름 회귀를 HTTP fixture로 검증했다.
- 최초 프로필 테스트는 Next.js route announcer와 폼 오류가 모두 role=alert여서 strict mode 오류가 발생했다. `.profile-page form [role="alert"]`로 범위를 좁혀 해결했다. NO_COLOR/FORCE_COLOR·파일시스템 경고는 실패 원인이 아니었다.
- `npx playwright test`: 3개 통과. 비회원 `/profile` 접근 보호와 닉네임 입력 없는 가입 화면도 포함한다. `npm run typecheck`, `npm run build` 통과.
- `artifacts/profile-mobile.png`를 렌더링해 390px 화면을 확인했다. 스크린샷은 git 제외이다.
- 제약: 원격의 실제 회원 A/B로 Auth·Storage API·브라우저 통합 흐름을 실행하지 않았다. 로컬 fixture와 PGlite 검증은 원격 서비스 통합 검증을 대신하지 않는다. 업로드 후 저장 실패/응답 유실로 남는 고아 아바타의 자동 청소는 미구현이며 운영 기준을 trouble-shooting.md에 기록했다.

최종 갱신: 2026-10-27

## 회원 인증 구현 (2026-10-27)

- 로그인·회원가입·메일 확인 안내/재발송·비밀번호 찾기/변경 UI와 Server Action, 확인 링크 Route Handler를 구현했다. 운영 Site URL·메일 템플릿 설정은 README에 기록했다.
- `@supabase/ssr` 쿠키 클라이언트와 Proxy 갱신, 각 보호 페이지의 `getUser()` 재검증, 익명/미확인 사용자 차단, 안전한 내부 리다이렉트를 구현했다.
- 기존 방명록을 회원 UID·계정 닉네임·private 객체 키·서명 URL로 전환했다. 재시도 ID, 댓글 실패 보존, 사용자별 탭 초안과 재로그인 복원, 로그아웃 구독 정리를 구현했다. 자동 localStorage 데모 진입을 제거했다.
- profiles·작성자/객체 경로·RLS·객체 소유권/닉네임/시간 검증·글/댓글/업로드 제한 SQL을 작성했다. 이미지 이전·백업/체크섬 확인·고아 파일 정리 스크립트는 기본 dry-run이다.
- 원격을 읽기 전용 재조회했다: `guestbooks` 1행, `comments` 2행, public 이미지 1개, Auth 사용자 0명, migration 이력 0개. `public.guestbook`은 별도로 0행/RLS 비활성이다. 기존 10-26 조사 이후 상태가 바뀌었다.
- 원격 SQL/Storage/Auth 설정은 변경하지 않았다. 전체 백업과 서버 전용 키가 없어 원격 이미지 복사·전체 전환을 실행할 수 없다. 원격 조회와 로컬 PostgreSQL fixture 검증을 스테이징 전체 검증으로 표시하지 않는다.

### 이번 검증 결과

- `npm install @supabase/ssr`, 로컬 정책 검증용 PGlite 설치 성공, npm audit 0개 보고.
- `node tests/member-policies.mjs`: 통과. 기반 SQL 업그레이드, 프로필 생성, 이미지 이전 전 강제 중단, 회원/비회원/익명 RLS, UID/경로 위조, 닉네임·시간 강제, 요청 제한, 기존 NULL 작성자 보존 확인. 테스트용 Auth/Storage 스키마이며 Realtime 서비스는 제외다.
- `npx playwright test`: 3개 통과. 보호 URL 로그인 이동, 가입 서버 검증, 메일/복구 화면, 유효하지 않은 링크, 내부 경로 제한, 390px 가로 넘침 확인. 실제 메일은 보내지 않았다.
- `npx playwright test --config playwright.member.config.ts`: 로컬 HTTP fixture 4개 통과. 쿠키 로그인·그림/댓글 저장·댓글 실패 보존/재시도·로그아웃, 가입 확인·복구 쿠키/비밀번호 변경, 같은 계정 재로그인 후 캔버스 초안 복원, 저장소 할당량 초과 시 캔버스 유지와 새 탭 재로그인 후 원래 탭 등록까지 확인했다. 실제 Supabase JWT 검증·RLS·Storage·Realtime 검증 결과는 아니다.
- 390px/1440px 인증 화면 스크린샷을 열어 확인했다: `artifacts/auth-mobile.png`, `artifacts/auth-desktop.png` (git 제외).
- `npm run typecheck`, `npm run build`, PGlite 정책 검증과 기본/회원 Playwright 총 7개 시나리오가 통과했다. 운영 스크립트 두 개의 `node --check` 및 `git diff --check`도 통과했다.

### 남은 외부 작업과 제약

- 전체 DB/Storage 백업, 원격 복제 스테이징·복원 검증, 서버 전용 키 설정 후 이미지 이전, 후속 SQL 적용과 공개 접근 종료가 필요하다. 현재 원격에는 회원 스키마가 없어 새 코드의 실제 가입/프로필/저장은 아직 운영 준비가 끝나지 않았다.
- SMTP·이메일 확인·익명 로그인 해제·Site/Redirect URL·비밀번호/CAPTCHA/메일 요청 제한을 설정하고 실제 A/B 계정·직접 REST/Storage 차단·두 브라우저 Realtime을 검증해야 한다.
- 별도 `public.guestbook`의 RLS 비활성 문제는 사용처를 확인한 후 별도 정책을 결정해야 한다. 자동 보정하지 않았으며 README에 SQL을 제시했다.
- sessionStorage 할당량/사용 제한 시 현재 탭에서 이동하지 않고 캔버스를 유지하며 새 탭의 동일 계정 재로그인을 안내하도록 보완했다. 저장하지 못한 채 탭을 닫으면 복구할 수 없다. 이전 공개 이미지의 외부 복사본 회수와 기존 CDN 캐시 즉시 제거도 보장하지 않는다.

아래 계획 작성 및 초기 구현 기록은 당시의 이력이다. 현재 상태는 위 구현 기록을 우선한다.

## 인증·인가 계획 작성 (2026-10-27)

- 후속 사용자 지시에 따라 익명 인증 계획을 로그인·회원가입 UI 우선 계획으로 전면 개정했다. 이메일 확인·비밀번호 복구·SSR 쿠키 세션·회원 전용 접근·프로필·private 이미지 이전을 포함한다.
- 기존 익명 인증 제안은 폐기된 이력이며 아래 최초 작성 기록과 구분한다. `AGENTS.md`와 요구사항 변경 이력도 동기화했다.
- 문서 수정 및 `git diff --check`만 수행했다. 코드·SQL 적용, 원격 재조회, 메일 발송·빌드·브라우저 검증은 미수행이다. 다음 구현은 인증 UI부터 시작하며 원격 변경은 조사·백업·스테이징 후 수행한다.

- 현재 코드·SQL·요구사항·화면 참고 자료와 Supabase 공식 문서를 확인하고 [인증 마이그레이션 계획](auth-migration-plan.md)을 작성했다.
- 최초에는 익명 인증 권장안과 이전 절차를 정리했으나 후속 요청으로 위 회원 인증 계획으로 대체했다.
- 코드·SQL·원격 설정 변경은 없다. 이번 작업은 문서 작성이므로 빌드·타입 검사·브라우저 테스트를 재실행하지 않았다.
- 원격 상태는 2026-10-26 기록만 참조했고 재조회하지 않았다. 다음 구현 작업은 원격 스키마와 적용 이력 재확인 및 스테이징 준비부터 시작한다.

## 현재 단계

회원 인증 애플리케이션·후속 SQL 및 운영 스크립트 구현과 로컬 검증 완료. 원격 회원 전환·실제 메일/두 브라우저 Supabase 통합 검증과 배포는 미완료.

## 완료한 작업

- AGENTS.md·memory-bank 전체 문서·요구사항·화면 참고 이미지를 확인했다.
- Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 앱과 목록·작성·상세 라우트를 구성했다.
- 아이보리·세이지 그린 테마, 반응형 카드 그리드, 소개 영역, 작성·상세 모달을 구현했다.
- 필기 캔버스, 색상·굵기, 사진 합성, 초기화, 빈 입력 차단, 그림 저장과 닉네임 댓글을 구현했다.
- 로딩·빈 상태·오류 표시, 저장 중 버튼 비활성화, 실패 시 작성 내용 보존을 구현했다.
- Supabase 연동, ID 병합, 재연결 재조회, 상세별 댓글 구독과 해제 코드를 작성했다.
- 설정이 없을 때 예시 6개와 localStorage 데모를 제공한다.
- SQL에 테이블·인덱스·RLS·Storage 정책·Realtime 발행을 작성했다. 외부 프로젝트 적용 전이다.
- README에 실행·환경 변수·SQL·두 브라우저 검증 절차와 고아 파일 정리 제약을 기록했다.

## 검증 결과

- 패키지 설치 성공. npm audit 취약점 0개 보고.
- `npm run typecheck`: 통과.
- `npm run build`: 통과. 최초 샌드박스 하위 프로세스 EPERM 실패 후 승인된 권한으로 성공했다.
- Chrome / Playwright 1개 시나리오 통과: 초기 카드 6개, 빈 캔버스 차단, 마우스 필기·등록, 댓글 작성, 새로고침 후 그림·댓글 보존, 작성 URL 진입, 존재하지 않는 상세 URL 상태.
- 390px 모바일 가로 넘침을 발견해 수정 후 회귀 검사 통과.
- 1440px 데스크톱 및 390px 모바일 전체 스크린샷을 열어 확인했다. 결과는 artifacts/desktop.png, artifacts/mobile.png (git 제외).

## 제약과 다음 작업

- 실제 Supabase 프로젝트 정보가 없어 업로드·RLS 차단·재연결·두 브라우저 Realtime은 미검증이다.
- 사진 합성·실제 터치 기기 필기·저장 실패 후 재시도는 코드 구현 완료, 브라우저 시나리오 검증은 후속 작업이다.
- Storage 고아 파일 자동 정리는 미구현. 공개 삭제 권한을 넓히지 않고 관리자 정기 정리를 안내했다.
- 목록은 최신 100개까지 조회하며 페이지네이션은 없다.
- 모달의 키보드 포커스 트랩은 후속 접근성 개선 항목이다.
- 다음 단계는 실제 환경 변수 설정·SQL 적용 후 README의 두 브라우저 검증 절차 수행이다.
# Supabase MCP check (2026-10-26)

- Confirmed 20 registered Supabase MCP tools. Read-only calls to get_project_url and list_tables succeeded.
- Remote public schema currently contains public.guestbook (0 rows, RLS disabled). This differs from the planned guestbooks/comments schema; no remote changes were applied.
- App integration, Storage policies, and Realtime behavior remain unverified. Review the existing schema and RLS policies before applying the project migration.


## Spec Kit installation diagnosis (2026-10-29)

- Inspected init-options.json, integration manifests, installed Codex integration source, and CLI help.
- Confirmed ai_skills=true and all 10 Spec Kit skills installed under .agents/skills.
- specify integration status: OK; modified managed files 0, missing managed files 0, invalid manifest paths 0.
- No installation repair required. Skill execution was not tested; existing feature implementation status is unchanged.
