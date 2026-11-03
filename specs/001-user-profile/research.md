# Phase 0 Research

Date: 2026-11-02. 로컬 코드 조사이며 원격 상태 확인 결과가 아니다. 스킬에 따른 연구 에이전트의 읽기 전용 코드 검토 결과도 통합했다.

## 기존 스택과 코드 재사용

- **Decision**: Next.js/React/TypeScript/Tailwind와 기존 Supabase Auth/DB/Storage/Realtime 유지.
- **Rationale**: package.json과 profile page/Action/form, author-profile에 기반이 있다. 사용자가 현재 구성 유지를 명시했다.
- **Alternatives considered**: 새 백엔드·스택 업그레이드·프로필 전용 구독은 불필요한 범위 확대다.
- **Source**: memory-bank/architecture.md, implementation-plan.md 및 [Next.js Data Security](https://nextjs.org/docs/app/guides/data-security). Action의 자체 인증 확인을 유지한다.

## 동일 회원 동시 편집

- **Decision**: profiles에 DB 생성 UUID revision 추가. 편집 시 캡처한 expected_revision을 RPC에서 본인 행 FOR UPDATE 후 비교하고 일치할 때만 전체 저장한다. 모든 UPDATE에서 trigger가 새 revision을 생성한다.
- **Rationale**: 현재 actions.ts는 id만으로 UPDATE하여 stale input을 덮어쓴다. 사전 SELECT만 추가하면 경쟁 구간이 남는다. UUID는 JS bigint 직렬화/정밀도와 timestamp 정밀도 의존을 피한다.
- **Alternatives considered**: bigint 문자열도 가능하지만 순서가 필요 없으므로 UUID 선택. 마지막 저장 우선·항목 병합은 사용자 B 결정과 충돌한다. 조건부 UPDATE 대신 명확한 결과와 좁은 쓰기 경계를 제공하는 RPC를 선택했다.
- **Source**: [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [Supabase functions](https://supabase.com/docs/guides/database/functions). 이 조합은 프로젝트 설계 판단이다.

## 권한 경계 (분석 C1 승인안)

- **Decision**: SECURITY DEFINER/빈 search_path/고정 SQL RPC의 EXECUTE를 PUBLIC/anon/authenticated에서 철회하고 service_role만 허용한다. getUser()로 회원을 확인한 Server Action이 p_member_id를 넘기고 DB가 해당 회원의 비익명·이메일 확인 상태를 재검사한다. 테이블/열 UPDATE 권한도 철회한다.
- **Rationale**: 회원 실행 RPC는 직접 업로드 경로를 받아 전체 디코딩을 우회할 수 있었다. 이제 서버가 동일 검증 바이트를 새 경로에 업로드하고 서버 전용 RPC로만 연결한다. 버킷의 회원 INSERT/UPDATE/DELETE를 닫아 검증 후 객체 교체 경쟁도 막는다. 기존 회원 읽기 정책은 유지한다.
- **Alternatives considered**: 클라이언트 실행 RPC/Action만의 검증은 거부했다. 기존 서버 관리자 키 미사용 결정은 사용자 승인으로 변경했다. 서버 비밀 키는 server-only 모듈/서버 환경 변수에만 두고 사용자 인증 클라이언트와 분리한다.
- **Source**: [Supabase functions security](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). 세부 소유권 전환은 data-model.md와 계약을 따른다.

## 최신 정보 확인과 응답 유실

- **Decision**: conflict는 draft/File을 유지하고 제출 잠금. 별도 최신 조회 후 사용자 명시 확인에만 baseline을 교체한다. 자동 focus 갱신은 baseline을 바꾸지 않는다. commit 응답 유실은 확인 필요 상태이며 업로드 객체를 즉시 삭제하지 않는다.
- **Rationale**: 자동 revision 교체는 보지 못한 변경을 다음 클릭으로 덮어쓴다. 전체 remount는 File을 잃을 수 있다. 네트워크 오류는 DB 실패를 의미하지 않는다.
- **Alternatives considered**: 에러마다 새 객체 즉시 삭제, 자동 재제출, 강제 페이지 새로고침은 초안/참조 객체 보존을 해친다.

## 손상 이미지 검증

- **Decision**: 현재 5MiB/MIME/시그니처 검사 후 서버에서 sharp 전체 픽셀 디코딩까지 수행한다. 로컬 설치 sharp 0.35.5를 직접 의존성으로 명시하고 자원 제한을 유지한다. metadata만 읽고 성공으로 판정하지 않는다. 기존 6mb Action body 한도 유지.
- **Rationale**: 현재 헤더 검사만으로 잘린 이미지 등을 검출하지 못한다. 6mb는 파일과 multipart 여유를 제공한다. 원본 크기·형식 정책과 UI는 유지한다.
- **Alternatives considered**: 브라우저 decode만으로는 직접 Action 요청 검증이 안 된다. 자동 crop/filter/re-encode는 범위 밖이다.
- **Source**: [Next.js bodySizeLimit](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions), [sharp raw output](https://sharp.pixelplumbing.com/api-output/#raw). 실제 손상 fixture/decoder 동작은 구현 검증 대상이다.

## 검증과 운영

- **Decision**: 활성 화면 10초 프로필 조회/포커스 즉시 갱신, 서명 URL 300초/240초 갱신 재사용. PGlite·HTTP fixture와 실제 Supabase 계정 검증을 구분한다. 독립 PostgreSQL 세션 동시 요청을 별도 검증한다.
- **Rationale**: 로컬 fixture는 실제 JWT/Storage·DB 잠금을 증명하지 못한다. 사용자 평가 SC-001/005는 자동 테스트로 대체하지 않는다.
- **Alternatives considered**: 페이지네이션·새 캐시·새 구독 도입은 현재 필수가 아니다. 고아 파일 자동 청소는 기존 후속 작업으로 둔다.

## Outcome

미해결 설계 질문 없음. 실제 원격 상태·서비스 업로드 한도·메일/Auth/Storage 동작은 실행 검증 항목이다. 헌법 파일은 미작성 템플릿이며 임의로 규칙을 만들지 않았다.

## 표시 시간과 URL 접근 (분석 I1/I2 승인안)

- **Decision**: 기발급 300초 서명 URL 소지자의 만료 전 접근을 인정하되 비로그인 신규 발급/직접 조회는 차단한다. 로그아웃은 앱 URL과 갱신만 정리한다. 활성 화면 조회를 10초로 단축하고 조회·URL 발급·이미지 로딩 전체 10초 이내 조건에서 저장부터 표시까지 30초를 검증한다.
- **Rationale**: 로그아웃은 이미 발급된 URL을 즉시 폐기하지 않는다. 30초 polling은 네트워크 지연을 더하면 30초 표시 목표를 넘기므로 시간 여유가 필요하다.
- **Alternatives considered**: URL 즉시 폐기를 약속하거나 30초 polling을 유지하는 안은 명세와 불일치한다. 새 구독 방식 대신 기존 조회 흐름을 재사용한다.
