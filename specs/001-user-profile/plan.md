# Implementation Plan: 닉네임과 프로필 이미지 설정

**Branch**: `001-profile` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: 기존 Next.js·Supabase 유지. `memory-bank/architecture.md`, `memory-bank/implementation-plan.md`, PRD 및 clarification B를 기준으로 한다.

## Summary

기존 프로필 편집·private 사진 저장·작성자 표시를 재사용한다. 핵심 추가 작업은 FR-012의 동일 회원 동시 편집 충돌 거부와 FR-004의 손상 이미지 전체 디코딩 검증이다. 기존 기능과 새 요구사항의 차이를 구현하고 회귀 검증하며 새 백엔드는 도입하지 않는다.

프로필 저장은 사용자 인증·전체 이미지 검증을 수행한 Server Action에서만 서버 전용 RPC로 실행한다. 서버 비밀 키는 server-only 모듈에만 두고 브라우저에는 전달하지 않는다. 프로필 UUID revision을 편집 시작 시 캡처한다. DB 함수가 본인 행을 잠근 뒤 revision 비교와 전체 변경을 같은 트랜잭션으로 수행한다. 오래된 저장은 전체 거부하고 입력·선택 파일을 보존한다. 최신 정보를 별도로 조회·표시하고 사용자가 확인해야만 새 revision으로 명시적 재시도가 가능하다.

## Technical Context

**Language/Version**: TypeScript ^5.9, Node.js 서버 런타임, SQL/PLpgSQL. Node 실행 버전은 검증 환경 기록에 포함한다.

**Primary Dependencies**: 현재 Next.js ^16.0.0 App Router, React ^19.2.0, Tailwind ^4.1, @supabase/ssr ^0.12.7, @supabase/supabase-js ^2.76.0 유지. 정확한 설치 버전은 package-lock.json 기준. 로컬에 설치된 sharp 0.35.5를 이미지 전체 디코딩에 사용하고 구현 시 직접 의존성으로 명시한다. 스택 업그레이드는 범위 밖이다.

**Storage**: 기존 Supabase PostgreSQL profiles/guestbooks/comments, private profile-avatars, 기존 Auth/Realtime 유지.

**Testing**: PGlite 정책 테스트, Playwright 회원 HTTP fixture/인증 회귀, typecheck/build. 실제 Supabase 계정 A/B와 동일 회원 독립 세션 테스트를 별도 수행한다.

**Target Platform**: 현재 Next.js Node.js 웹 앱, 모바일 390px·PC 1440px 및 키보드 접근.

**Project Type**: 단일 웹 애플리케이션 + 기존 Supabase.

**Performance Goals**: 정상 네트워크에서 다른 활성 창 표시 30초 이내(SC-004); 사용자 5명 중 4명은 2분 내 설정 완료(SC-001). 새 SLA/처리량 목표는 추가하지 않는다.

**Constraints**: PNG/JPEG/WebP ≤ 5MiB; nickname trim 후 Unicode code point 1~20자, 대소문자 무시 중복 금지; 관리자 키 노출 금지; 실패/충돌 초안 보존. Storage/DB 간 단일 트랜잭션은 없으므로 불확실 응답과 고아 객체를 별도 처리한다.

**Scale/Scope**: 회원당 프로필 하나/현재 사진 최대 하나. 기존 최신 목록 100개, 활성 화면 프로필 조회 주기를 10초로 단축. 사진 삭제·계정 삭제·공개 프로필·회원 검색·새 페이지네이션은 범위 밖이다.

## Constitution Check

`.specify/memory/constitution.md`는 미작성 템플릿이므로 예시 문구를 승인된 규칙으로 취급하지 않는다. 사용자 지시와 AGENTS.md를 적용한 설계 게이트는 다음과 같다. 정식 헌법에 대한 준수 인증은 하지 않는다.

| Gate | Phase 0 전 | Phase 1 후 | 근거 |
|---|---|---|---|
| 기존 스택/코드 재사용 | PASS | PASS | 기존 경로와 서비스 유지 |
| PRD·명세 및 문서 일관성 | PASS | PASS | FR-001~012 추적, memory-bank 동기화 |
| 인증·인가·RLS·Storage | PASS | PASS | 요청별 인증, 제한된 RPC, 직접 UPDATE 철회 |
| 실패 보존·중복 방지·충돌 처리 | PASS | PASS | conflict 상태와 명시적 최신 확인 |
| 검증 결과와 계획 구분 | PASS | PASS | 실행 가이드 및 미완료 항목 분리 |

적용 규칙 위반 및 미해결 설계 결정 없음. 원격 현황은 이번 계획에서 재조회하지 않았으며 과거 기록을 현재 상태로 단정하지 않는다.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-profile/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/profile.md
  quickstart.md
  checklists/requirements.md
```

[tasks.md](tasks.md)에 후속 작업 34개가 생성되어 있다. setup-plan JSON의 논리 기능명은 `001-user-profile`이며 실제 Git 브랜치는 `001-profile`이다. feature.json의 현재 기능 경로를 유지한다.

### Source Code (repository root)

```text
src/app/profile/page.tsx          # revision 포함 초기 조회
src/app/profile/actions.ts        # 저장/최신 확인 액션
src/components/profile-form.tsx  # conflict와 초안 보존
src/components/author-profile.tsx
src/components/guestbook.tsx
src/lib/member.ts
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/admin.ts         # 추가 예정: server-only 서버 비밀 키 클라이언트
src/lib/profile-image.ts          # 추가 예정: 전체 디코딩
supabase/migrations/              # 후속 migration 추가
tests/member-policies.mjs
tests/member-server.mjs
tests/member-ui.spec.ts
tests/guestbook.spec.ts
```

**Structure Decision**: 기존 Server Action/클라이언트 폼/Supabase 분리 유지. 별도 서버·repository 계층은 추가하지 않는다.

## Phase 0: Research

[research.md](research.md)에 원자적 충돌 검사·권한 우회 차단·이미지 디코딩·응답 유실 결정을 기록했다. 로컬 코드 및 공식 문서를 근거로 설계 불확실성을 해소했다.

## Phase 1: Design and Contracts

[data-model.md](data-model.md), [contracts/profile.md](contracts/profile.md), [quickstart.md](quickstart.md)에 데이터·상태 전이·인터페이스·검증을 정의한다.

| 요구사항 | 기존 구현 | 남은 작업/검증 |
|---|---|---|
| FR-001~003 | 가입 기본 프로필, nickname unique/trim | 경계·동시 중복 회귀 |
| FR-004 | 크기/MIME/시그니처 검사 | 전체 디코딩, 손상·5MiB 경계 검증 |
| FR-005~006 | 저장/미리보기/초안 유지 | 성공 후 파일 상태 정리, 장애/응답 유실 검증 |
| FR-007 | 회원 보호/RLS/Storage 소유권 | 서버 전용 RPC·Storage 쓰기·직접 UPDATE 우회 차단, 실제 A/B 검증 |
| FR-008~010 | 현재 작성자 표시/fallback/30초 갱신 | 10초 조회와 30초 표시 완료, 이미지 교체·만료·실패 회귀 |
| FR-011 | 반응형 labels/alerts | 최신 확인 단계의 키보드·390/1440px 검증 |
| FR-012 | 무조건 UPDATE, 미구현 | revision 원자 비교·확인 전 잠금·재시도 |

## Delivery Sequence and Completion

1. DB revision·trigger·RPC·권한 후속 migration과 정책 fixture. 완료 기준: 동일 revision 병렬 저장 1개 성공, 나머지 conflict; 직접 UPDATE 불가.
2. page/Action/form에 baseline과 충돌 확인 흐름 연결. 완료 기준: 같은 항목·다른 항목 충돌 전체 거부, File 보존, 확인 전 재제출 금지, 확인 후 재시도 및 재충돌 처리.
3. 서버 전체 이미지 디코딩과 실패/응답 유실 처리. 완료 기준: 손상 파일 거부, 현재 참조 객체 보존, commit 후 부수 오류 분리.
4. 로컬 회귀, 실제 Supabase 인가/동시성/Storage/표시 검증, SC-001/005 사용자 5명 평가. 각 결과를 분리 기록한다.

원격 적용 전 Supabase MCP 또는 CLI로 실제 스키마·권한·함수·버킷·migration 이력을 확인한다. 이번 단계는 설계까지만 수행하며 코드·DB 적용·기능 테스트는 수행하지 않는다.

## Complexity Tracking

규칙 위반 없음. 좁은 SECURITY DEFINER RPC는 직접 UPDATE를 막으면서 원자 비교/저장을 허용하기 위한 최소 추가 요소다. 고아 이미지 자동 청소/보존 기간 확정은 기존 별도 미완료 작업으로 유지한다.

## Approved Analysis Remediation (2026-11-02)

- I1: 비로그인 신규 URL 발급·직접 조회는 차단한다. 기발급 URL의 300초 유효기간과 로그아웃 즉시 무효화 불가를 명세/계약/검증에 반영한다. 로그아웃 시 메모리 URL/타이머를 정리한다.
- C1: RPC의 PUBLIC/anon/authenticated EXECUTE를 철회하고 service_role만 허용한다. Server Action이 요청별 getUser()로 검증한 UID를 p_member_id에 전달하고 RPC가 auth.users에서 비익명·email_confirmed_at을 재검사한다. 서비스 JWT의 auth.uid()를 회원 UID로 오인하지 않는다. 직접 profiles UPDATE는 계속 금지한다.
- 서버 비밀 키 SUPABASE_SERVICE_ROLE_KEY를 src/lib/supabase/admin.ts의 server-only 모듈에서만 사용한다. NEXT_PUBLIC 접두사/클라이언트 import/로그/폼 반환을 금지한다. 사용자 세션 검증용 클라이언트와 관리자 클라이언트는 분리한다. 이 결정은 이전 연구의 서버 관리자 키 미사용 대안을 대체한다.
- 사진 업로드·삭제도 서버가 수행한다. profile-avatars의 authenticated INSERT/UPDATE/DELETE 경로를 닫아 검증한 파일의 교체·재업로드 경쟁을 막는다. 읽기/서명 발급용 기존 회원 SELECT 정책은 유지한다. 서버는 검증한 동일 바이트를 새 UID/UUID 경로에 upsert:false로 업로드한다.
- 서버 업로드 객체의 owner_id는 회원 UID가 아닐 수 있으므로 회원 소유권을 클라이언트 owner_id 조작으로 맞추지 않는다. 신규 객체의 논리 소유자는 서버가 생성한 경로의 UID다. RPC/검증 trigger는 p_member_id 경로·버킷·객체 존재와 서버 업로드 객체를 확인한다. 기존 owner_id 기반 사진은 현재 참조 그대로 유지하고 사용자 입력으로 기존 경로를 새로 연결하지 않는다. 서버 전용 경로 선택과 버킷 쓰기 차단을 함께 보장한다.
- I2: 활성 화면 10초 조회, 중복 요청 방지, 역순 응답 무시, focus 즉시 시작으로 변경한다. 정상 조건은 조회부터 사진 표시까지 전체 10초 이내이며 저장 완료부터 표시 완료까지 30초를 검증한다. 최악 polling 위상·지연 응답을 포함하고 비활성/오프라인 복귀를 별도 검증한다. 기존 대비 조회량은 약 3배다.

이번 수정은 설계/작업 문서만 변경한다. 서버 키 설정·SQL·코드·원격 권한 전환은 구현 단계에서 수행한다.
