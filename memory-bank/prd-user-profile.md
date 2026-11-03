# Product Requirements Document

## 구현·검증 현황 (2026-11-02)

후속 revision 충돌 거부·명시 확인·서버 전체 이미지 검증/저장·10초 작성자 갱신을 로컬에서 구현했다. DB 정책/이미지 검사, 회원 HTTP fixture 10개·인증 회귀 3개·타입/프로덕션 빌드를 통과했다. 실제 원격 적용·계정 A/B/독립 세션 검증·사용자 5명 평가는 미완료이며 전체 제품 완료를 의미하지 않는다. 상세는 progress.md와 tasks.md를 따른다.

## 이미지 디코딩 자원 제한 (2026-11-02)

서버 전체 프레임 검증은 최대 16,777,216 입력 픽셀·처리 5초로 제한한다. 5MiB 이내라도 손상되었거나 처리 범위를 넘으면 이유를 안내하고 기존 프로필과 입력을 보존한다. 정기 고아 아바타 청소/보존 기간은 별도 미완료다.

## 승인된 접근·검증·갱신 기준 (2026-11-02)

- 비로그인 프로필 조회/수정/URL 신규 발급은 금지한다. 기발급 300초 서명 URL은 만료 전 소지자가 사용할 수 있고 로그아웃 즉시 폐기를 보장하지 않는다. 로그아웃 시 앱 URL/갱신 정리.
- 사진 등록·교체는 서버 전체 디코딩을 거쳐야 하며 직접 업로드/RPC 우회를 금지한다. 구현은 서버 전용 RPC와 버킷 쓰기 경계를 따른다.
- 활성 프로필 10초 조회·focus 즉시 갱신, 정상 전체 조회/URL/사진 로딩 10초 이내 조건에서 저장부터 30초 이내 표시 완료를 검증한다. 비활성/오프라인은 시간 보장 밖으로 두고 복귀 갱신 확인. 아래 과거 30초 주기 문구는 이 기준으로 대체한다.

## 구현 작업 추적 (2026-11-02)

[tasks.md](../specs/001-user-profile/tasks.md)에 세 사용자 스토리와 FR-001~012/SC-001~005를 연결했다. 기존 제품 범위와 Next.js·Supabase를 유지하며 실제 구현·검증은 각 작업 실행 결과로 판단한다.

## 구현 설계 연결 (2026-11-02)

[Spec Kit 계획](../specs/001-user-profile/plan.md)에 현재 Next.js·Supabase 재사용, 원자적 동시 편집 거부, 손상 이미지 전체 디코딩과 검증을 정리했다. 제품 범위 변경은 없으며 설계 작성은 구현·원격 검증 완료가 아니다.

## Spec Kit 명세 연결 (2026-11-02)

- 본 PRD의 사용자 요구와 2026-10-28 세부 기준을 [기능 명세](../specs/001-user-profile/spec.md)에 정리했다. 기존 요구사항을 대체하지 않는다.
- 추가 경계 조건 제안: 동시 닉네임 중복 저장, 손상 이미지, 세션 만료, 부분 저장 실패, 키보드·모바일 접근성. 구체적인 기대 동작은 명세의 Edge Cases 및 FR-006/007/011을 참조한다.
- 이번 작업은 명세 작성이며 구현과 실제 서비스 검증 완료를 의미하지 않는다.

## 1. 목표와 기능 정의

사용자 프로필 설정 기능을 만든다. 사용자가 자신의 정체성을 표현하기 위해 자신만의 닉네임과 사진을 가진 사용자로 활동하게 한다. 이것을 통해 누가 글을 썼는지 한눈에 알아볼 수 있다.


## 2. 사용자 스토리

### 2.1 As a (사용자로서)

타깃 사용자는 회원가입을 완료한 사용자로 한다.

### 2.2 I want to (~을 하고 싶다)

나를 표현하는 닉네임과 프로필 사진을 등록하고 싶다.

### 2.3 So that (그러면 ~을 할 수 있다)

다른 사람이 나를 알아보기 쉽고 오래 기억하게 된다.


## 3. 기능 요구 사항

여기에 필수 구현 사항과 권장 사항을 명시한다.

### 3.1 P0 (필수 요구사항)
		
#### 3.1.1 프로필 페이지 진입

로그인한 사용자는 자신의 프로필 설정 페이지로 이동할 수 있다.

#### 3.1.2 닉네임 변경

기본 닉네임은 이메일 아이디이다. 사용자는 자신이 원하는 닉네임으로 변경하여 저장할 수 있다.

#### 3.1.3 프로필 사진 업로드

PC나 모바일에서 이미지를 선택해 프로필 사진으로 업로드할 수 있다.

#### 3.1.4 방명록 반영

방명록 글 목록과 상세화면에서 작성자의 닉네임과 사진을 보여준다.

#### 3.1.5 자동 생성

회원가입 시 별도 설정이 없어도 기본적인 프로필 데이터가 자동으로 생성된다.


### 3.2 P1 (권장 요구 사항)

#### 3.2.1 닉네임 중복 방지

다른 사용자와 똑같은 닉네임을 사용할 수 없다.

#### 3.2.2 이미지 용량 제한

사진 용량은 5MB 이내로 제한하여 너무 큰 사진이 업로드되지 않게 한다.

## 4. 구현 세부 기준 (2026-10-28)

- 기존 닉네임은 유지한다. 신규 기본 닉네임은 이메일 아이디에서 최대 20자로 생성하며, 충돌 시 UID 기반 접미사를 붙인다. 가입 시 별도 프로필 입력은 요구하지 않는다.
- 앞뒤 공백을 제거하고 대소문자를 구분하지 않는 닉네임 중복 제한을 DB에 적용한다.
- 사진은 PNG/JPEG/WebP, 최대 5MiB이며 private Storage에 저장한다. 사진이 없거나 읽기 실패 시 기본 아바타를 사용한다.
- 방명록 목록·상세와 댓글에는 현재 프로필을 표시한다. 기존 author_id가 없는 기록은 기본 방문자/댓글 스냅샷을 사용한다. 다른 열린 창의 변경은 포커스 복귀 또는 최대 30초 주기로 반영한다.
- 네트워크 실패 시 현재 화면의 닉네임과 선택 파일을 보존한다. 업로드와 DB 수정 사이 실패의 운영 기준은 trouble-shooting.md를 따른다.

## 동시 편집 보충 기준 (2026-11-02)

- 사용자 clarification B: 같은 회원의 다른 창에서 편집 시작 이후 프로필이 저장되었으면 나중 저장을 전체 거부한다. 최신 정보 확인을 안내하고 현재 입력과 선택 파일을 보존한다. 최신 정보 확인 전 재제출로 덮어쓰지 않는다. 명세 FR-012와 SC-003을 따른다.
## Remote verification update (2026-11-03)

Refreshed-token CLI authentication and read-only hosted inspection succeeded. The remote database still uses the previous profile write design; revision/RPC migration has not been applied. T031 backup/staging and coordinated transition, T032 real-account verification, and T033 actual participant evaluation remain pending. Local policy/image/typecheck and all 13 Playwright tests passed again. See progress.md for constraints and build status.

## Authorized development transition (2026-11-03)

The user authorized immediate cutover in the development environment. Pre-change CLI SQL dumps and a rollback-only remote rehearsal were completed, then the revision/RPC migration and history were committed atomically. Hosted permissions match the trusted-server design. Compatible local production build and all 11 real-account integration checks passed, including saves, avatars, conflict preservation, concurrent writes, authorization, author propagation and URL lifecycle. Injected failures/worst-case timing remain local fixture coverage. T033 still requires real participants. See progress.md for results and backup scope.


## Final usability acceptance (2026-11-03)

User-provided actual participant observations satisfy SC-001 (5/5 unassisted nickname changes within 120 seconds) and SC-005 (5/5 completed three profile changes without confusion). Desktop/mobile coverage: 3/2. T033 and all 34 feature tasks are complete; earlier pending participant statements are historical. No requirement or implementation changes are indicated. See specs/001-user-profile/usability-results.md for the acceptance decision and evidence limits.
