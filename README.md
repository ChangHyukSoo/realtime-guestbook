# 한 조각 · 회원 기반 실시간 전자방명록

Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 / Supabase Auth·Database·Storage·Realtime을 사용합니다. 이메일·비밀번호 회원가입과 로그인 후 그림 방명록과 댓글을 이용합니다.

## 로컬 실행

```sh
npm install
npm run dev
```

`.env.example`을 `.env.local`로 복사하고 Supabase 공개 URL·publishable key·`NEXT_PUBLIC_SITE_URL`을 설정합니다. 로컬 Site URL은 `http://localhost:3000`입니다. 첫 진입은 `/login`으로 이동합니다. 환경 변수 누락을 성공적인 데모로 처리하지 않습니다. 이전 localStorage 데모 데이터는 회원 데이터로 자동 이전하지 않습니다.

현재 저장소에는 회원 인증 코드와 후속 SQL이 구현되어 있지만 **원격 회원 마이그레이션은 적용하지 않았습니다.** SQL과 Auth 설정 없이 가입·프로필·새 이미지 저장을 운영에 연결하지 마세요. 세부 상태는 `memory-bank/progress.md`를 확인합니다.

## Supabase Auth 설정

1. Email/password 가입과 이메일 확인을 켜고 익명 로그인을 끕니다. 최소 비밀번호 길이는 UI와 같이 8자 이상으로 설정합니다.
2. Site URL과 Redirect URL에 실제 운영 주소를 설정하고 로컬 개발 주소를 별도로 허용합니다. 운영 `.env.local` 또는 호스팅 환경에도 `NEXT_PUBLIC_SITE_URL`을 설정합니다.
3. 운영 SMTP·발신 도메인을 설정하고 메일 전달, 요청 제한 및 필요 시 CAPTCHA를 검증합니다. 기본 메일 발송 제한은 운영 SMTP 검증을 대체하지 않습니다.
4. Confirm signup 템플릿의 링크를 아래 주소로 설정합니다.

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">이메일 확인</a>
```

Reset password 템플릿은 다음 링크를 사용합니다.

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">비밀번호 재설정</a>
```

서버가 확인한 복구 링크로 발급된 10분짜리 HttpOnly 쿠키가 있어야 재설정 폼을 사용할 수 있습니다. 비밀번호 변경 후 로그아웃하고 다시 로그인합니다. 만료·재사용 링크는 다시 요청합니다. 토큰·비밀번호·확인 링크의 쿼리를 로그에 남기지 마세요.

## DB·Storage 전환

원격 확인 결과(2026-10-27): `guestbooks` 1행, `comments` 2행, 기존 public 이미지 1개, Auth 사용자 0명, 기록된 migration 0개였습니다. 최초 SQL은 수동 적용된 상태로 보이므로 **실제 스키마와 적용 이력을 대조하고 이미 존재하는 테이블을 다시 생성하지 않습니다.**

1. DB 전체 스키마·데이터와 Storage 객체 백업을 확보하고 스테이징에서 복원·업그레이드를 검증합니다. 기존 `public.guestbook` 단일 테이블은 이 앱에서 사용하지 않으며 자동 삭제하지 않습니다.
2. 새 DB는 `202610250001_guestbook.sql`로 기반을 만들고, 기존 DB는 기반 스키마가 일치하는지 확인합니다. 이후 `202610270001_member_expand.sql`을 적용합니다. profiles·작성자·객체 경로·private 버킷·회원 정책·검증 트리거가 추가됩니다.
3. 아래 이미지 스크립트를 먼저 dry-run하고 백업·매핑을 확인한 뒤 `--apply`로 실행합니다. 서비스 키는 서버 환경에만 넣고 저장소나 브라우저에 노출하지 않습니다.

```sh
node --env-file=.env.local scripts/migrate-images.mjs
node --env-file=.env.local scripts/migrate-images.mjs --apply
```

스크립트는 기존 행·참조 이미지와 매핑을 git 제외 `backups/`에 저장하고, 같은 프로젝트의 예상 UUID 이미지 URL만 private 버킷의 `legacy/<id>.png`로 복사합니다. SHA-256을 대조한 뒤 DB 참조를 변경합니다. 전체 DB 백업을 대체하지 않습니다. 새 DB에는 없는 `guestbook` 테이블은 건너뜁니다.

4. `202610270002_member_backfill.sql`로 모든 행의 private 객체 존재를 확인합니다. 작성자를 모르는 기존 행은 `author_id = NULL`로 유지합니다.
5. 회원 클라이언트와 이메일 설정을 검증한 뒤 `202610270003_member_enforce.sql`을 적용합니다. 공개 읽기·쓰기 정책을 제거하고 옛 버킷도 private으로 바꿉니다. 미해결 이미지·프로필 또는 예상하지 않은 public 테이블 정책이 있으면 SQL이 실패하도록 했습니다.
6. 사용자 A/B와 비로그인 직접 REST/Storage 요청, 두 브라우저 Realtime, CDN 캐시를 검증합니다. 과거 공개 이미지의 외부 복사본은 회수할 수 없고, 기존 CDN 캐시는 별도 만료 확인이 필요합니다.

**전환 중 쓰기를 중지해야 합니다.** 확장 SQL의 검증 트리거부터 옛 비회원 클라이언트의 쓰기가 차단됩니다. 클라이언트 배포·최종 이미지 복사·정책 강제를 묶어 진행합니다. 호환 기간의 공개 읽기가 남아 있는 상태를 회원 전용 출시 완료로 보지 않습니다. 정책 강제 후에는 인증 없는 옛 클라이언트나 public 버킷으로 자동 롤백하지 않습니다.

별도 `public.guestbook`은 RLS가 비활성화된 상태였습니다. 다른 소비자를 확인하고 권한 방침을 결정한 뒤 아래 SQL과 해당 정책을 별도로 적용해야 합니다. 이번 마이그레이션에서 자동 변경하지 않습니다.

```sql
ALTER TABLE public.guestbook ENABLE ROW LEVEL SECURITY;
```

## 동작과 운영 제약

- Proxy가 쿠키를 갱신하고 각 서버 페이지가 `getUser()`로 회원을 다시 확인합니다. 실제 데이터 접근은 RLS로 보호합니다. 세 페이지의 기존 URL을 유지하며 페이지별 가드를 재사용합니다.
- 회원은 목록·상세·댓글·이미지를 읽고 본인 UID로 등록합니다. 익명 Auth도 차단합니다. 수정·삭제·소유권 변경은 허용하지 않습니다. 프로필은 본인만 조회합니다.
- 댓글 닉네임과 작성 시간은 DB가 설정합니다. 닉네임은 중복 가능하며 권한 기준은 UID입니다. 프로필이 없는 기존 회원은 관리자가 확인한 닉네임으로 `profiles` 행을 복구해야 하며 UI는 임의 프로필을 생성하지 않습니다.
- 새 이미지는 `guestbook-images-private/<uid>/<id>.png`에 PNG 최대 5MB로 저장합니다. 서명 URL은 5분 유효하고 4분마다 갱신합니다. URL은 만료 전까지 링크 소지자가 사용할 수 있습니다.
- DB 검증은 계정당 분당 방명록 5개·댓글 20개, Storage 정책은 업로드 분당 10개로 제한합니다. 가입/로그인/IP 기반 남용 방지는 Auth 설정에서 별도로 검증해야 합니다.
- 저장 실패 시 현재 작성 내용을 유지하고 동일 내용의 재시도는 기존 요청 ID를 확인합니다. 내용을 바꾸면 새 ID를 사용합니다. 세션 만료 후 같은 계정으로 재로그인하면 탭의 sessionStorage 초안을 복원합니다. 저장소 할당량/사용 제한으로 초안 저장에 실패하면 현재 페이지를 유지하고 새 탭의 재로그인을 안내합니다. 재로그인 후 원래 탭에서 등록할 수 있습니다. 탭을 닫으면 저장하지 못한 내용은 복구할 수 없습니다.
- 업로드와 DB는 단일 트랜잭션이 아닙니다. 24시간 이상 지난 비참조 객체를 정리하는 아래 스크립트는 기본 dry-run입니다. 참조 검사와 삭제 사이 경쟁을 막기 위해 **쓰기를 중지한 운영 시간에만** `--apply`를 실행합니다.

```sh
node --env-file=.env.local scripts/cleanup-orphans.mjs
node --env-file=.env.local scripts/cleanup-orphans.mjs --apply
```

## 검증

```sh
npm run typecheck
npm run build
node tests/member-policies.mjs
npx playwright test
npx playwright test --config playwright.member.config.ts
```

PGlite 검증은 실제 PostgreSQL 정책·트리거의 로컬 실행이며 Auth/Storage 스키마는 테스트 fixture입니다. Realtime 서비스는 포함하지 않습니다. 기본 Playwright는 비로그인 접근·가입 폼 서버 검증·메일 화면·모바일을 확인하고, member 설정은 외부 메일을 보내지 않는 로컬 HTTP fixture로 쿠키 로그인·회원 저장·복구·초안 복원을 확인합니다. 이 결과를 실제 Supabase 가입·메일·RLS·Storage·Realtime 검증으로 간주하지 않습니다.

실제 통합 확인은 서로 다른 두 브라우저에서 A/B 계정으로 가입·이메일 확인·로그인 후 진행합니다. A의 새 그림/댓글이 B에서 새로고침 없이 한 번만 보이는지, 서로 다른 상세 댓글이 섞이지 않는지, 재접속 후 누락이 없는지 확인합니다. 로그아웃한 브라우저와 UID/경로를 위조한 직접 API 요청이 거부되는지도 확인하고 결과를 진행 문서에 기록합니다.

## 사용자 프로필

로그인 후 헤더의 닉네임에서 `/profile`로 이동해 닉네임과 사진을 변경합니다. 가입 시 이메일 아이디로 기본 닉네임을 자동 생성합니다. 사진은 PNG/JPEG/WebP, 최대 5MiB이며 private `profile-avatars` 버킷을 사용합니다.

새 환경에서는 기존 회원 마이그레이션 이후 `supabase/migrations/202610280001_user_profile.sql`을 적용합니다. 기존 닉네임의 대소문자/앞뒤 공백을 제외한 중복이 있으면 먼저 검토해 해결해야 합니다. 현재 연결된 원격 프로젝트에는 Supabase MCP로 적용했습니다. 이미 적용한 SQL을 다시 실행하지 마세요.

검증: `node tests/member-policies.mjs`, `npx playwright test --config playwright.member.config.ts`, `npx playwright test`, `npm run typecheck`, `npm run build`. 앞의 DB/회원 UI 테스트는 로컬 fixture이며 원격 Auth/Storage 통합 검증과 구분합니다.
