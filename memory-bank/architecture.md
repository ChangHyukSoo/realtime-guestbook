# 아키텍처

## 사용자 프로필 구현 (2026-10-28, 현재 상태)

이 절은 아래 2026-10-27 기록 중 프로필 구조·가입 닉네임·원격 적용 상태를 대체한다.

- `/profile`은 Proxy와 `requireMember('/profile')`로 보호한다. 헤더의 닉네임을 눌러 PC·모바일에서 진입하며, 이동 전에 방명록 초안을 보존한다. `safeNext()`에 `/profile`을 추가했다.
- `profiles`에 `avatar_path`를 추가했다. 회원은 표시용 프로필을 조회하고 자신의 nickname/avatar_path만 수정한다. 이메일은 공개 프로필에 포함하지 않는다. 닉네임은 기존 1~20자 규칙과 `lower(btrim(nickname))` UNIQUE 인덱스로 중복을 제한한다.
- 가입 폼의 닉네임 입력을 제거했다. DB 가입 트리거가 이메일 아이디(최대 20자)로 기본 프로필을 생성한다. 중복 시 UID 기반 접미사를 붙이며 기존 닉네임은 변경하지 않는다.
- 프로필 저장 Server Action은 `getUser()`와 이메일 확인 상태를 검사하고, 파일의 5MiB 제한·MIME·시그니처를 검사한다. private `profile-avatars/<uid>/<uuid>.<ext>`에 업로드한 뒤 프로필을 갱신한다. Storage 버킷도 5MiB/PNG/JPEG/WebP를 제한한다. 직접 API 요청에도 RLS·경로 제약·소유 이미지 검증 트리거가 적용된다.
- 이미지 URL은 DB에 저장하지 않는다. 목록·상세·댓글의 `AuthorProfile`이 5분 서명 URL을 발급하고 4분마다 갱신한다. 프로필은 처음 진입·창 포커스·30초 주기로 갱신한다. 프로필 없는 기존 작성자는 이전 방문자/댓글 스냅샷과 기본 아바타로 표시한다.
- 프로필 갱신 성공 후 이전 이미지를 삭제한다. 참조 중인 이미지는 삭제 정책이 보호한다. 업로드 후 DB 응답이 유실된 경우 새 이미지를 삭제하지 않는다. 고아 이미지 운영 기준은 trouble-shooting.md에 기록했다.
- `202610280001_user_profile.sql`은 PGlite 검증 후 Supabase MCP로 원격 적용했다. 적용 전 기존 닉네임 중복 0건을 확인했고 적용 후 avatar_path 컬럼을 확인했다. 실제 사용자 계정으로 원격 업로드·인증 전체 흐름을 검증한 것은 아니다.

최종 갱신: 2026-10-27. 요구사항은 `prompt_draft.md`의 변경 이력, 인증·이전 기준은 [인증 계획](auth-migration-plan.md)을 따른다. `ui_plan.png`는 기존 작성·목록·상세 화면 참고 자료다.

## 제품과 구현 상태

회원가입·로그인에서 시작하는 실시간 전자방명록이다. 이메일 확인 후 로그인하여 캔버스 필기·사진 합성, 이미지 등록·목록·상세와 계정 닉네임 댓글을 이용한다. 기존 로그인 없는 이용과 익명 인증 제안은 사용자 지시로 대체되었다.

애플리케이션·후속 SQL·이전 스크립트는 구현하고 로컬 검증했다. 원격은 2026-10-27 읽기 전용 조회만 수행했으며 후속 SQL·이미지 이전·Auth 설정·실제 메일/Realtime 검증은 미완료다. 코드가 기대하는 회원 스키마가 아직 원격에 없으므로 운영 전환 전에 README 순서를 따라야 한다.

## 기술과 파일 책임

- Next.js 16 App Router / React 19 / TypeScript / Tailwind CSS 4. 아이보리·세이지 테마와 반응형 폼·그리드를 사용한다.
- `src/components/auth-form.tsx`: 로그인·가입·메일 재발송·비밀번호 찾기/변경 UI, 제출 잠금·오류·이메일/닉네임 보존. 비밀번호는 영속화하지 않는다.
- `src/app/auth/actions.ts`: Server Action 입력 검증과 Supabase Auth 호출. 서버에 비밀번호를 별도 저장하지 않는다. 메일 링크의 사이트 주소는 운영 환경 변수로 고정한다.
- `src/lib/supabase/client.ts`, `server.ts`: SSR 패키지의 쿠키 기반 브라우저/요청별 서버 클라이언트. 기존 `src/lib/supabase.ts`는 브라우저 클라이언트의 호환 export다.
- `src/proxy.ts`: 쿠키 갱신과 기본 리다이렉트, 캐시 금지. `src/lib/member.ts`의 `requireMember()`가 각 보호 페이지에서 검증된 사용자와 프로필을 다시 조회한다. 라우트 그룹 이동 대신 기존 URL의 페이지별 가드를 재사용했다.
- `src/app/auth/confirm/route.ts`: signup/recovery 유형과 token hash를 검증하고 상대 내부 경로로 이동한다. 복구 시 HttpOnly/SameSite 쿠키를 10분 발급한다. 재설정 화면과 Action 모두 사용자·쿠키를 확인한다.
- `src/components/guestbook.tsx`: 기존 캔버스·그리드·상세·댓글·조회/저장/구독을 재사용한다. 회원 UID·프로필 닉네임을 서버 props로 전달받되 실제 인가는 RLS/트리거가 수행한다.
- `supabase/migrations`: 최초 기반 SQL과 회원 확장→이전 확인→정책 강제의 후속 SQL 세 개. 원격에는 아직 적용하지 않았다.
- `scripts/migrate-images.mjs`, `cleanup-orphans.mjs`: 서버 전용 키로 실행하는 기본 dry-run 운영 도구. `backups/`는 git 제외다.

## 라우트

| 경로 | 접근과 역할 |
| --- | --- |
| `/login`, `/signup` | 비로그인 인증 UI, 회원은 목록으로 이동 |
| `/signup/check-email`, `/forgot-password` | 이메일 확인 안내·재발송 및 복구 요청 |
| `/auth/confirm` | 서버 확인 링크 처리, 공개 진입 가능 |
| `/reset-password` | 검증된 회원과 복구 쿠키 필요 |
| `/`, `/write`, `/guestbooks/[id]` | 이메일 확인된 비익명 회원만 접근 |

`safeNext()`는 `/`, `/write`, UUID 상세 경로만 허용한다. 서버 Actions의 쿠키 변경은 Next.js 출처 검증을 사용하며 데이터 RLS는 별도로 적용한다. 로그인 상태를 공유 캐시에 저장하지 않는다.

## 목표 데이터 모델 (SQL 작성·로컬 검증 완료, 원격 적용 전)

| 테이블 | 주요 필드와 규칙 |
| --- | --- |
| `profiles` | auth.users FK `id`, nickname 1~20자, created_at. 가입 트리거 생성, 본인 SELECT만 허용 |
| `guestbooks` | UUID id, nullable author_id, image_object_path, 호환용 nullable image_path, created_at. 신규 행은 UID/객체 소유권 검증 |
| `comments` | UUID id, guestbook_id FK cascade, nullable author_id, nickname snapshot, content 1~500자, created_at |

기존 author_id는 NULL로 유지하고 가입자의 닉네임으로 자동 귀속시키지 않는다. 새 행은 `auth.uid()`와 일치해야 한다. auth.users 삭제 시 콘텐츠 작성자는 NULL로 남는 보존 정책이며 탈퇴 기능은 별도 범위다. 닉네임은 가입 메타데이터에서 길이를 검증해 프로필에 기록하고 댓글 INSERT 때 DB가 프로필 스냅샷으로 강제한다. 작성 시간도 DB가 강제한다.

기본 조회 인덱스와 author_id 인덱스, 이미지 경로 unique 인덱스를 둔다. 회원은 타 회원 콘텐츠도 조회할 수 있으므로 author_id는 회원 간 활동 연결 정보가 될 수 있다. 이메일은 public 모델에 저장하지 않는다.

## 인가와 저장 흐름

1. 미인증과 익명 Auth는 테이블·Storage 접근을 차단한다. 회원은 SELECT/INSERT만 허용하고 사용자 UPDATE/DELETE 및 소유권 변경은 차단한다. 기존 공개 정책과 GRANT는 최종 SQL이 제거한다.
2. 등록 전 `getUser()`로 동일 회원을 확인한다. PNG 최대 5MB를 private 버킷의 `<uid>/<entry-id>.png`에 업로드하고 DB에 객체 키를 기록한다. DB 트리거가 경로·객체 존재·owner_id를 확인한다.
3. Storage와 DB는 단일 트랜잭션이 아니다. 같은 작성 내용의 재시도는 ID를 유지하고 기존 행을 먼저 확인한다. 내용을 바꾸면 새 ID를 사용한다. 실패한 업로드의 고아 객체는 24시간 유예 후 쓰기 중지 시간의 운영 스크립트로 정리한다.
4. 이미지 표시에는 5분 서명 URL을 사용하고 4분마다 갱신한다. DB/Realtime에는 URL을 저장하지 않는다. 원격 이전 전의 공개 URL로 자동 폴백하지 않는다. 기존 이미지는 private `legacy/<id>.png`로 복사·체크섬 대조 후 참조를 갱신한다.
5. 회원 콘텐츠 등록은 계정별 직렬화 잠금과 분당 방명록 5개/댓글 20개 제한을 적용한다. Storage INSERT는 본인 폴더·소유자·파일명과 분당 업로드 10개를 확인한다. Auth/IP 남용 설정은 외부 검증 항목이다.
6. 목록 최대 100개, 상세 직접 진입은 해당 ID를 추가 조회한다. Realtime INSERT를 ID로 병합하고 구독 완료·재연결 시 재조회한다. 상세 필터 및 구독 해제를 유지하며 로그인 토큰 갱신을 전달한다. 로그아웃·계정 전환 때 구독과 콘텐츠를 비운다.
7. 현재 캔버스·댓글은 저장 실패 시 유지한다. 탭 sessionStorage에 UID별 초안을 보존하고 동일 계정 재로그인 시 복원한다. 저장소가 가득 찼거나 사용할 수 없으면 이동하지 않고 현재 내용을 유지하며 새 탭 재로그인을 안내한다. 동일 계정 재확인 후 원래 탭의 저장·구독을 복구한다. 다른 계정에 자동 제출하지 않는다. 탭 종료에 따른 복구 제약은 README에 기록했다.

## 원격 현황과 배포 경계

원격 재조회에서 `guestbooks` 1행·`comments` 2행·공개 이미지 1개·Auth 사용자 0명, migration 이력 0개를 확인했다. 별도 `public.guestbook`은 0행이고 RLS가 꺼져 있다. 사용처 확인 없이 자동 변경하지 않는다.

확장 SQL부터 옛 비회원 쓰기가 차단되므로 전체 백업·스테이징 검증 후 쓰기 중지 시간에 전환한다. 실제 이미지 이전에 필요한 서버 전용 키와 전체 백업이 현재 없어 원격은 변경하지 않았다. PGlite/HTTP fixture 테스트는 호스팅된 Auth·SMTP·Storage·Realtime 검증을 대체하지 않는다.

## Spec Kit integration (2026-10-29)

- Installed specify-cli version: 1.2.6.dev0; Codex integration uses .agents/skills/speckit-<name>/SKILL.md.
- This installed integration deprecates legacy commands and defaults to skills; absence of .codex/prompts is expected. No compatibility copies were added.
