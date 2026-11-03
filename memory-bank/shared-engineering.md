# 스펙 간 공유할 구현·검증 지식

기준일: 2026-11-03. `001-user-profile` 구현과 검증에서 확인한 내용이다. 다른 스펙은 아래 구현을 먼저 확인하고 재사용하되, 프로필에 맞춘 제한값과 권한을 다른 도메인에 그대로 적용하지 않는다.

## 인증과 신뢰 경계

- SSR 사용자 클라이언트는 `src/lib/supabase/server.ts`, 브라우저 클라이언트는 `src/lib/supabase/client.ts`를 사용한다. 페이지 접근 보호는 `src/lib/member.ts`와 `src/proxy.ts`를 참고한다.
- 서버 변경 작업은 `auth.getUser()`로 현재 사용자를 다시 확인한다. 프로필 Action은 편집을 시작한 UID와 현재 UID 일치 여부, 익명 여부, 이메일 확인 상태도 검사한다. 화면 접근 제한만으로 변경 권한을 보장하지 않는다.
- `src/lib/supabase/admin.ts`는 `server-only` 관리자 클라이언트다. `SUPABASE_SERVICE_ROLE_KEY`는 서버에만 두며 세션 저장·토큰 자동 갱신을 사용하지 않는다. 서비스 역할은 RLS를 우회하므로 호출 전에 사용자 인증·인가를 수행하고, 대상 UID는 검증한 서버 사용자에서 결정한다.
- 현재 프로필 RPC는 서비스 역할만 실행할 수 있다. 다른 데이터의 직접 쓰기 가능 여부는 해당 테이블 정책으로 판단한다. 프로필의 직접 쓰기 차단이 모든 테이블에 적용된 것은 아니다.

## 동시 수정과 저장 결과

- `src/lib/profile-contract.ts`, `src/app/profile/actions.ts`, `src/components/profile-form.tsx`, `supabase/migrations/202611020001_profile_revision.sql`이 참조 구현이다. 도메인 전용 코드이므로 범용 저장 라이브러리로 간주하지 않는다.
- DB가 발급하고 변경 시 회전시키는 UUID revision을 기준으로 원자적으로 비교·저장한다. 같은 revision으로 동시에 저장하면 하나만 성공하고 나머지는 conflict가 된다. 클라이언트 시각으로 충돌을 판정하지 않는다.
- conflict나 저장 결과 불명(`outcome_unknown`)이면 입력·선택 File·미리보기를 유지하고 재제출을 잠근다. 최신 상태를 읽고 사용자가 명시적으로 확인한 뒤 기준 revision을 바꾼다. 자동 덮어쓰기는 하지 않는다.
- 응답을 받지 못했다고 DB 저장 실패로 단정하지 않는다. 저장 확정 이후의 표시 URL 발급 실패는 저장 성공과 별도로 알린다.
- 권한 전환 시 테이블 GRANT뿐 아니라 기존 컬럼 GRANT도 확인한다. 테이블 UPDATE 권한 회수만으로 컬럼 UPDATE 권한이 사라지지 않는다.

## 파일과 DB를 함께 변경할 때

- `src/lib/profile-image.ts`는 파일 크기, 선언 MIME, 실제 시그니처, 전체 이미지 디코딩을 검증한다. 현재 프로필 기준은 PNG/JPEG/WebP, 5MiB, 16,777,216 입력 픽셀, 디코딩 제한 5초다. 다른 파일 기능은 별도 요구사항에 맞춰 제한을 결정한다.
- 새 파일은 고유 경로에 `upsert:false`로 업로드한 뒤 DB 참조를 변경한다. 업로드와 DB 저장은 하나의 트랜잭션이 아니므로 실패 단계별 정리가 필요하다.
- 확정된 거절·충돌에서는 DB가 참조하지 않는 신규 파일만 정리한다. commit 결과가 불명확하면 신규 파일을 즉시 삭제하지 않는다. 이전 파일은 저장 성공 이후 참조 여부를 확인해 정리한다.
- 서비스 역할 업로드의 Storage `owner_id`를 회원 UID라고 가정하지 않는다. 기존 회원 업로드와 서버 업로드의 소유 형태를 구분한다.
- private 객체는 경로를 저장하고 표시 시 signed URL을 발급한다. signed URL은 만료 전 소지자가 접근할 수 있으므로 즉시 철회나 로그아웃에 따른 서비스 측 무효화를 보장하지 않는다. 비밀값·signed URL·파일 원문은 로그와 문서에 남기지 않는다.

## 여러 화면의 최신 데이터와 수명 관리

- 작성자는 `author_id`로 연결하고 현재 프로필을 조회한다. nullable 작성자·삭제 회원·기존 댓글 snapshot·사진 없음의 fallback을 구분한다. 닉네임을 관계 키로 사용하지 않는다.
- 현재 프로필 반영은 `guestbook.tsx`의 10초 polling과 focus/online/visibility 재조회다. 요청 중복 방지·10초 요청 제한·늦은 응답 무시·해제 시 abort를 함께 참고한다. 기존 방명록/댓글 Realtime과 프로필 polling은 별개다.
- `author-profile.tsx`의 signed URL은 300초 유효, 240초 주기 갱신이다. 로그아웃·계정 변경·unmount에서 타이머/구독/진행 요청과 오래된 응답을 처리한다.
- 프로필의 30초 반영 목표는 정해진 네트워크/응답 조건의 검증 결과다. 다른 기능의 SLA나 운영 환경 지연 보장으로 확대하지 않는다.

## 마이그레이션과 원격 검증

- Supabase 현황 조회·변경은 MCP 또는 CLI로 수행한다. 사전 확인 예시는 `supabase/checks/profile-preflight.sql`, `profile-transition-readiness.sql`이다. 로컬 migration 파일명만 보지 말고 원격 migration history와 실제 schema/grants/RLS/RPC/Storage를 함께 확인한다.
- 데이터·권한 전환은 백업, 리허설, 앱/DB 호환 시점 조율, 적용 후 권한 및 동작 검증을 포함한다. `scripts/prepare-profile-transition.mjs`는 프로필 전용 리허설/적용 SQL 생성 예시다.
- 이번에는 사용자가 즉시 전환을 승인한 개발 환경에서 실제 DB의 rollback-only 트랜잭션으로 리허설했다. 별도 hosted staging을 수행한 것은 아니며, 이 선택을 다른 환경에 대한 승인으로 간주하지 않는다.
- CLI schema/data dump는 Storage 객체 바이트 백업을 포함하지 않는다. `backups/`는 git 제외 대상이며 Auth 데이터 등 민감 내용을 출력·커밋하지 않는다.

## 검증 증거를 구분하는 방법

| 검증 | 재사용할 예시 | 확인 범위와 한계 |
| --- | --- | --- |
| SQL/정책 | `tests/member-policies.mjs` | PGlite에서 권한·revision·RPC 분기 확인. Hosted Storage/Auth 전체 증거는 아님 |
| 이미지 | `tests/profile-image.test.mjs` | 실제 디코딩과 제한 검증 |
| UI/장애 주입 | `tests/member-ui.spec.ts`, `tests/member-server.mjs` | 충돌·입력 보존·응답 지연·실패와 모바일 화면을 재현. 실제 서비스 통합과 구분 |
| 실제 서비스 | `tests/hosted-profile.mjs --apply` | 개발 프로젝트에서 계정/레코드/객체를 생성하고 finally에서 정리하는 명시적 변경 실행. 대상 프로젝트 제한 유지 |
| 사용성 | `specs/001-user-profile/usability-results.md` | 실제 참여자 관찰을 사용. 자동화 결과로 대체하지 않음 |

- 기존 검증은 정책/이미지, Playwright 회원 10개·인증 3개, build/typecheck, hosted 11개 통합 확인을 포함한다. 이는 당시 실행 증거이며 후속 변경마다 최신 통과를 의미하지 않는다.
- 실제 짧은 signed URL 만료 확인과 Playwright clock을 전진시킨 갱신·로그아웃 확인은 구분해서 기록한다. 타이머 테스트는 clock을 설치한 다음 컴포넌트를 mount/reload한다.
- Next.js route announcer도 `role=alert`를 사용하므로 오류 assertion은 대상 form/컴포넌트 범위로 제한한다. 모달이 열려 있으면 배경 헤더 조작 전에 닫는다.
- 이번 사용성 관찰은 PC 3명·모바일 2명, 닉네임 10~20초, 두 기준 모두 5/5 통과다. 새 스펙의 사용자 평가를 대체하지 않으며 누락된 세션 메타데이터를 추정해 채우지 않는다.

## 개발 환경에서 다시 만날 수 있는 문제

- Windows에서 환경 변수를 바꿔도 이미 실행 중인 앱은 이전 토큰을 상속할 수 있다. 이번 CLI 인증은 새 Windows 사용자 환경 값을 자식 프로세스에 전달한 뒤 성공했다. 토큰 형식 검사만으로 유효성을 판단하지 않고 실제 인증 결과를 확인한다.
- 모바일 LAN 개발 접속은 `next.config.ts`의 `allowedDevOrigins`에 요청 Origin의 hostname을 명시하고 dev 서버를 재시작한다. 현재 `192.168.55.162`는 환경별 주소이며 다른 환경에서 그대로 재사용할 값이 아니다. dev 명령은 `0.0.0.0`에 바인딩한다.
- 최근 typecheck는 생성된 `.next/dev/types/validator.ts`가 `./routes.js`를 찾지 못해 실패했다. 해결·재검증 완료로 기록하지 않는다. 생성 타입 갱신 후 재검증과 실제 모바일 HMR 확인은 별도 미확인 사항이다.

## 새 스펙에서 참조할 순서

현재 상태는 `progress.md`, 설계는 `architecture.md`, 인증 전환의 배경은 `auth-migration-plan.md`를 확인한다. 이 문서로 재사용 후보를 찾고 실제 코드·해당 스펙 요구사항·현행 원격 상태로 적용 가능성을 판단한다. 프로필 34개 작업 완료는 다른 기능이나 외부 배포까지 완료했다는 의미가 아니다.
