# 한 조각 · a little trace

Next.js App Router, TypeScript, Tailwind CSS, Supabase로 만든 로그인 없는 그림 방명록입니다.

## 실행

```sh
npm install
npm run dev
```

http://localhost:3000 에서 목록을 확인합니다. `/write`는 작성 화면, `/guestbooks/[id]`는 상세 화면입니다. 목록에서는 모달로 작성·상세를 열어 화면 맥락을 유지합니다.

환경 변수가 없으면 예시 카드 6개를 제공하는 데모 모드입니다. 직접 등록한 그림과 댓글은 이 브라우저의 localStorage에 저장되며, 같은 브라우저의 다른 탭에도 반영됩니다. 다른 기기와 공유되지 않습니다. 데모 데이터는 브라우저 저장 용량의 영향을 받으며 저장 실패 시 작성 화면을 유지합니다.

## Supabase 연결

1. Supabase 프로젝트의 SQL Editor에서 `supabase/migrations/202610250001_guestbook.sql`을 실행합니다.
2. `.env.example`을 `.env.local`로 복사하고 프로젝트 URL과 publishable key를 입력합니다. 관리자 키는 사용하지 않습니다.
3. 개발 서버를 다시 시작합니다. 연결 완료 시 상단에 ‘실시간 연결됨’이 표시됩니다.
4. 서로 다른 브라우저에서 같은 사이트를 열고 그림 등록과 댓글 등록을 확인합니다. 상대 화면에 새 항목이 한 번씩 나타나는지, 상세를 닫은 후 댓글 구독이 정리되는지 확인합니다.

원본 사진은 PNG/JPEG/WebP, 5MB 이하만 받으며 캔버스에 맞게 축소하여 합성합니다. 최종 PNG는 5MB 이하로 Storage에 저장됩니다. 닉네임은 20자, 댓글은 500자로 제한하며 SQL에서도 검증합니다. 익명 사용자는 조회와 작성만 가능하며 수정·삭제 정책은 없습니다.

Storage 업로드 후 DB 저장에 실패하면 작성 내용은 유지됩니다. 공개 삭제 권한을 제공하지 않으므로 고아 파일은 관리자 권한으로 정기 정리해야 합니다. 공개 서비스 운영 시 익명 쓰기에 대한 서버 측 요청 제한과 관리 절차는 별도 구축이 필요합니다. 목록은 최신 100개를 조회합니다.

## 검증

```sh
npm run typecheck
npm run build
```

실제 실행한 결과와 외부 설정에 따른 미검증 사항은 `memory-bank/progress.md`에 기록합니다.
