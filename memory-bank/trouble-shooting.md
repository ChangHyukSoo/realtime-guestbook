> Shared troubleshooting reference (2026-11-03): [Development environment and verification lessons](shared-engineering.md). Includes stale Windows token inheritance, LAN dev origins, generated route types, Playwright clock setup and scoped alerts.

# 프로필 구현 예외 및 운영 기록

## Playwright alert 중복 (2026-10-28)

Next.js route announcer도 role=alert를 사용하므로 전역 getByRole('alert')는 폼 오류와 충돌한다. 프로필 테스트는 `.profile-page form [role="alert"]`로 범위를 한정한다. 색상 환경 변수와 느린 파일시스템 경고는 이 실패의 원인이 아니다.

## PRD 보충 기준

이메일 아이디는 도메인이 다르면 중복될 수 있다. 신규 기본 닉네임 충돌에는 UID 기반 접미사를 사용하고 기존 이름은 유지한다. 기존 데이터 중복은 마이그레이션을 실패시키며 자동 개명하지 않는다. 회원 탈퇴/이전 데이터로 작성자 연결이 없는 글은 기본 방문자로 표시한다.

## 이미지 저장의 부분 실패

Storage 업로드와 프로필 UPDATE는 단일 트랜잭션이 아니다. 성공 후 기존 이미지를 삭제하되 참조 중인 이미지는 Storage 정책에서 삭제를 차단한다. 새 이미지 업로드 후 DB 응답 유실은 실제 커밋 성공일 수 있으므로 새 이미지를 즉시 삭제하지 않는다.

이 경우나 닉네임 충돌 뒤에는 고아 파일이 남을 수 있다. 자동 청소 도구는 아직 없다. 운영 시 관리자 권한으로 충분한 유예 기간(권장 24시간)이 지난 파일 중 profiles.avatar_path가 참조하지 않는 파일만 별도 목록 검토 후 청소하는 기능을 추가해야 한다. 기존 guestbook 청소 도구는 profile-avatars용이 아니다.
## 프로필 revision 전환과 파일 정리 (2026-11-02)

- 확정 conflict/검증 거부는 새 업로드 객체의 미참조 여부를 확인한 뒤 정리한다. 조회 오류가 있거나 참조가 있으면 삭제하지 않는다.
- RPC 응답 유실/미확인 결과는 성공할 수 있으므로 업로드 객체를 보존하고 제출을 잠근다. 최신 프로필을 별도 조회한 뒤 사용자가 명시 확인해야 재시도한다.
- commit 뒤 이전 사진 삭제/서명 URL 발급 오류는 저장 성공과 분리한다. 삭제 전 현재 참조를 확인하며 실패는 안전한 단계/추적 ID만 기록한다. 기존 경로를 새 사진으로 재연결하지 않는 서버 계약을 유지한다.
- 전체 이미지 디코딩은 전체 프레임·최대 16,777,216 입력 픽셀·처리 5초로 자원을 제한한다. 용량 안의 이미지라도 디코딩 제한을 넘으면 기존 프로필을 유지하고 다른 이미지 선택을 안내한다. 이 예외를 PRD에도 기록한다.
- 고아 아바타 보존 기간 확정과 정기 청소 도구는 여전히 별도 미완료다. 응답 유실 객체를 임의 기간 경과만으로 삭제하지 않는다.
## Development transition verification follow-up (2026-11-03)

CLI authentication succeeded after assigning the refreshed HKCU Environment token to the CLI child process; the application inherited a stale token. Do not print or persist its value. Docker Desktop was started hidden to permit CLI schema/data dumps.

Hosted lifecycle test setup needed two corrections: install Playwright's browser clock before mounting component timers (reload after installation), and close the restored detail dialog before clicking header logout. Neither failure required a product-code change. The corrected hosted run passed all 11 checks and cleaned up isolated accounts/records/objects.
