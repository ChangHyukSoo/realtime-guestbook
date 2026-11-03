import { test, expect } from '@playwright/test';
import sharp from 'sharp';
const makePng=()=>sharp({create:{width:8,height:8,channels:3,background:'#315c48'}}).png().toBuffer();
test.beforeEach(async({request})=>{await request.post('http://127.0.0.1:55433/__control',{data:{reset:true}});});

test('현재 작성자·기존 기록 fallback과 10초 갱신·읽기 실패 복구',async({page,request})=>{
  await page.clock.install();
  await request.post('http://127.0.0.1:55433/__control',{data:{seed:true}});
  await page.goto('/auth/confirm?token_hash=valid-signup&type=signup');
  await expect(page.locator('.entry-card')).toHaveCount(2);
  await expect(page.locator('.entry-card').filter({hasText:'테스트 회원'})).toBeVisible();
  await expect(page.locator('.entry-card').filter({hasText:'이전 방문자'})).toBeVisible();
  await page.locator('.entry-card').filter({hasText:'테스트 회원'}).click();
  await expect(page.locator('.detail-meta')).toContainText('테스트 회원');
  await expect(page.locator('.comments')).toContainText('다른 회원');
  await expect(page.locator('.comments')).toContainText('이전 댓글 이름');
  await request.post('http://127.0.0.1:55433/__control',{data:{profile:{nickname:'갱신된 작성자'}}});
  await page.clock.fastForward(10001);
  await expect(page.locator('.detail-meta')).toContainText('갱신된 작성자');
  await request.post('http://127.0.0.1:55433/__control',{data:{readFail:true}});
  await page.clock.fastForward(10001);
  await expect(page.locator('.detail-meta')).toContainText('이전 방문자');
  await expect(page.locator('.comments')).toContainText('다른 회원 댓글');
  await request.post('http://127.0.0.1:55433/__control',{data:{readFail:false,profile:{nickname:'복구된 작성자'}}});
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect(page.locator('.detail-meta')).toContainText('복구된 작성자');
});

test('최악 조회 위상과 지연 응답에서도 30초 내 사진 표시·로그아웃 정리',async({page,request})=>{
  test.setTimeout(60000);
  await page.clock.install();
  await page.goto('/auth/confirm?token_hash=valid-signup&type=signup');await page.goto('/profile');
  await page.getByLabel('프로필 사진',{exact:true}).setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:await makePng()});
  await page.getByRole('button',{name:'프로필 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('저장했습니다');
  await request.post('http://127.0.0.1:55433/__control',{data:{seed:true}});
  await page.goto('/');await expect(page.locator('.entry-card .avatar img')).toBeVisible();
  // Capture an old response, then commit just after the request started.
  await request.post('http://127.0.0.1:55433/__control',{data:{readDelay:1500}});
  const response=page.waitForResponse(r=>r.url().includes('/rest/v1/profiles?')&&r.request().method()==='GET');
  const started=page.waitForRequest(r=>r.url().includes('/rest/v1/profiles?')&&r.method()==='GET');
  await page.clock.fastForward(10001);
  await started;
  await request.post('http://127.0.0.1:55433/__control',{data:{profile:{nickname:'지연 후 최신'}}});
  const savedAt=await page.evaluate(()=>Date.now());
  await response;
  await page.clock.fastForward(10001);
  await expect(page.locator('.account-name')).toHaveText('지연 후 최신',{timeout:10000});
  await expect(page.locator('.entry-card .avatar img')).toBeVisible();
  expect(await page.evaluate(()=>Date.now())-savedAt).toBeLessThanOrEqual(30000);
  await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));});
  await expect.poll(async()=> (await (await request.get('http://127.0.0.1:55433/__control')).json()).maxConcurrentReads).toBe(1);
  await request.post('http://127.0.0.1:55433/__control',{data:{readDelay:0}});
  const before=await (await request.get('http://127.0.0.1:55433/__control')).json();
  await page.clock.fastForward(240001);
  await expect.poll(async()=> (await (await request.get('http://127.0.0.1:55433/__control')).json()).signCount).toBeGreaterThan(before.signCount);
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();await expect(page).toHaveURL('/login');
  const stopped=await (await request.get('http://127.0.0.1:55433/__control')).json();
  await page.clock.fastForward(300001);
  expect((await (await request.get('http://127.0.0.1:55433/__control')).json()).signCount).toBe(stopped.signCount);
});

test('동일 회원 충돌은 입력을 보존하고 명시 확인 후에만 다시 저장한다',async({page,context,request})=>{
  await page.goto('/auth/confirm?token_hash=valid-signup&type=signup');
  await page.goto('/profile');
  const second=await context.newPage(); await second.goto('/profile');
  await page.getByLabel('닉네임',{exact:true}).fill('먼저 저장');
  await second.getByLabel('닉네임',{exact:true}).fill('보존할 초안');
  await page.getByRole('button',{name:'프로필 저장',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('저장했습니다');
  await second.getByRole('button',{name:'프로필 저장',exact:true}).click();
  await expect(second.locator('.profile-page form [role=alert]')).toContainText('다른 창');
  for(const width of [390,1440]) {await second.setViewportSize({width,height:900});expect(await second.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await second.screenshot({path:'artifacts/profile-conflict-desktop.png',fullPage:true});
  await second.setViewportSize({width:390,height:844});await second.screenshot({path:'artifacts/profile-conflict-mobile.png',fullPage:true});
  await expect(second.getByLabel('닉네임',{exact:true})).toHaveValue('보존할 초안');
  await expect(second.getByRole('button',{name:'프로필 저장',exact:true})).toBeDisabled();
  await request.post('http://127.0.0.1:55433/__control',{data:{readFail:true}});
  await second.getByRole('button',{name:'최신 정보 불러오기'}).click();
  await expect(second.locator('.profile-page form [role=alert]')).toContainText('불러오지');
  await expect(second.getByRole('button',{name:'프로필 저장',exact:true})).toBeDisabled();
  await request.post('http://127.0.0.1:55433/__control',{data:{readFail:false}});
  await second.getByRole('button',{name:'최신 정보 불러오기'}).click();
  await expect(second.locator('.latest-profile')).toContainText('먼저 저장');
  await expect(second.getByRole('button',{name:'프로필 저장',exact:true})).toBeDisabled();
  await second.getByRole('button',{name:'확인 후 계속 편집'}).click();
  await expect(second.getByLabel('닉네임',{exact:true})).toHaveValue('보존할 초안');
  await request.post('http://127.0.0.1:55433/__control',{data:{profile:{nickname:'다시 변경'}}});
  await second.getByRole('button',{name:'프로필 저장',exact:true}).click();
  await expect(second.locator('.profile-page form [role=alert]')).toContainText('다른 창');
  await second.getByRole('button',{name:'최신 정보 불러오기'}).click();
  await second.getByRole('button',{name:'확인 후 계속 편집'}).click();
  await second.getByRole('button',{name:'프로필 저장',exact:true}).click();
  await expect(second.getByRole('status')).toContainText('저장했습니다');
  await second.reload(); await expect(second.getByLabel('닉네임',{exact:true})).toHaveValue('보존할 초안');
});

test('이름 경계와 세션 교체를 검증하고 키보드로 저장한다',async({page,request})=>{
  await page.goto('/auth/confirm?token_hash=valid-signup&type=signup'); await page.goto('/profile');
  const name=page.getByLabel('닉네임',{exact:true});
  for(const invalid of ['   ','가'.repeat(21),'다른 회원']) {
    await name.fill(invalid); await page.getByRole('button',{name:'프로필 저장',exact:true}).click();
    await expect(page.locator('.profile-page form [role=alert]')).toBeVisible(); await expect(name).toHaveValue(invalid);
  }
  for(const valid of [' 가 ','😀'.repeat(20),'테스트 회원','테스트 회원']) {
    await name.fill(valid); await page.getByRole('button',{name:'프로필 저장',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('저장했습니다');
  }
  await name.fill('다른 계정 금지');
  await request.post('http://127.0.0.1:55433/__control',{data:{otherAccount:true}});
  await page.getByRole('button',{name:'프로필 저장',exact:true}).click();
  await expect(page.locator('.profile-page form [role=alert]')).toContainText('로그인'); await expect(name).toHaveValue('다른 계정 금지');
  await request.post('http://127.0.0.1:55433/__control',{data:{otherAccount:false}});
  await page.getByRole('button',{name:'프로필 저장',exact:true}).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('저장했습니다');
  for(const width of [390,1440]) {await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});
test('프로필 편집, 중복 실패 보존, 사진 업로드와 모바일 화면 (HTTP fixture)', async ({page,request}) => {
  await page.goto('/auth/confirm?token_hash=valid-signup&type=signup');
  await page.locator('a[href="/profile"]').click();
  await expect(page).toHaveURL('/profile');
  await page.getByLabel('닉네임',{exact:true}).fill('새 프로필');
  await request.post('http://127.0.0.1:55433/__control',{data:{failProfile:true}});
  await page.getByRole('button',{name:'프로필 저장'}).click();
  await expect(page.locator('.profile-page form [role="alert"]')).toContainText('이미 사용 중');
  await expect(page.getByLabel('닉네임',{exact:true})).toHaveValue('새 프로필');
  await request.post('http://127.0.0.1:55433/__control',{data:{failProfile:false}});
  const png=await makePng();
  await page.getByLabel('프로필 사진',{exact:true}).setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:png});
  await page.getByRole('button',{name:'프로필 저장'}).click();
  await expect(page.getByRole('status')).toContainText('저장했습니다');
  await page.reload();
  await expect(page.getByLabel('닉네임',{exact:true})).toHaveValue('새 프로필');
  await expect(page.locator('.profile-preview img')).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/profile-mobile.png',fullPage:true});
  await page.getByLabel('프로필 사진',{exact:true}).setInputFiles({name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1)});
  await expect(page.locator('.profile-page form [role="alert"]')).toContainText('5MB');
  await page.goto('/'); await expect(page.locator('.account-name')).toHaveText('새 프로필');
  await page.goto('/profile'); await page.getByLabel('닉네임',{exact:true}).fill('테스트 회원');
  await page.getByRole('button',{name:'프로필 저장'}).click();
  await expect(page.getByRole('status')).toContainText('저장했습니다');
});
test('사진 저장 장애·응답 유실·충돌에서 파일을 보존하고 부분 오류를 구분한다',async({page,request,context})=>{
  await page.goto('/auth/confirm?token_hash=valid-signup&type=signup');await page.goto('/profile');
  const input=page.getByLabel('프로필 사진',{exact:true});
  const name=page.getByLabel('닉네임',{exact:true});
  const save=page.getByRole('button',{name:'프로필 저장',exact:true});
  const png=await makePng();
  await input.setInputFiles({name:'broken.png',mimeType:'image/png',buffer:png.subarray(0,45)});
  await save.click();await expect(page.locator('.profile-page form [role=alert]')).toContainText('이미지');
  expect((await (await request.get('http://127.0.0.1:55433/__control')).json()).saveCount).toBe(0);
  await input.setInputFiles({name:'valid.png',mimeType:'image/png',buffer:png});await name.fill('사진 초안');
  for(const fault of ['uploadFail','dbReject','expired']) {
    await request.post('http://127.0.0.1:55433/__control',{data:{[fault]:true}});
    await save.click();await expect(page.locator('.profile-page form [role=alert]')).toBeVisible();await expect(save).toBeEnabled();
    await expect(name).toHaveValue('사진 초안');expect(await input.evaluate((e:HTMLInputElement)=>e.files?.[0]?.name)).toBe('valid.png');
    await request.post('http://127.0.0.1:55433/__control',{data:{[fault]:false}});
  }
  await request.post('http://127.0.0.1:55433/__control',{data:{profile:{nickname:'타 창 변경'}}});
  await save.click();await expect(save).toBeDisabled();expect(await input.evaluate((e:HTMLInputElement)=>e.files?.[0]?.name)).toBe('valid.png');
  await page.getByRole('button',{name:'최신 정보 불러오기'}).click();await page.getByRole('button',{name:'확인 후 계속 편집'}).click();
  await request.post('http://127.0.0.1:55433/__control',{data:{outcomeUnknown:true}});
  await save.click();await expect(page.locator('.profile-page form [role=alert]')).toContainText('저장 결과');await expect(save).toBeDisabled();
  const unknown=await (await request.get('http://127.0.0.1:55433/__control')).json();expect(unknown.images).toContain('profile-avatars/'+unknown.profile.avatar_path);
  expect(await input.evaluate((e:HTMLInputElement)=>e.files?.[0]?.name)).toBe('valid.png');
  await request.post('http://127.0.0.1:55433/__control',{data:{outcomeUnknown:false}});
  await page.getByRole('button',{name:'최신 정보 불러오기'}).click();await page.getByRole('button',{name:'확인 후 계속 편집'}).click();
  await request.post('http://127.0.0.1:55433/__control',{data:{signFail:true,deleteFail:true,saveDelay:400}});
  const before=await (await request.get('http://127.0.0.1:55433/__control')).json();
  await save.dblclick();await expect(page.getByRole('status')).toContainText('저장은 완료');
  const after=await (await request.get('http://127.0.0.1:55433/__control')).json();expect(after.saveCount-before.saveCount).toBe(1);
  expect(await input.evaluate((e:HTMLInputElement)=>e.files?.length)).toBe(0);expect(after.images).toContain('profile-avatars/'+after.profile.avatar_path);
  await request.post('http://127.0.0.1:55433/__control',{data:{signFail:false,deleteFail:false,saveDelay:0}});
  await page.reload();await expect(name).toHaveValue('사진 초안');await expect(page.locator('.profile-preview img')).toBeVisible();
  // A new page may load the latest revision without changing the existing draft.
  const other=await context.newPage();await other.goto('/profile');await expect(other.getByLabel('닉네임',{exact:true})).toHaveValue('사진 초안');
});
test('쿠키 로그인·회원 글/댓글 저장·실패 보존·로그아웃 (로컬 계약 fixture)', async ({page,request})=>{
  await page.goto('/login?next=/write');
  await page.getByLabel('이메일',{exact:true}).fill('member@example.invalid');
  await page.getByLabel('비밀번호',{exact:true}).fill('test-password');
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  await expect(page).toHaveURL('/write');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.header')).toContainText('테스트 회원');
  await page.getByRole('button',{name:'마음 등록하기'}).click();
  await expect(page.getByRole('status')).toContainText('먼저 남겨');
  const box=await page.locator('canvas').boundingBox();if(!box) throw new Error('Canvas missing');
  await page.mouse.move(box.x+40,box.y+40);await page.mouse.down();await page.mouse.move(box.x+150,box.y+100,{steps:10});await page.mouse.up();
  await page.getByRole('button',{name:'마음 등록하기'}).click();
  await expect(page.locator('.entry-card')).toHaveCount(1);
  await page.locator('.entry-card').click();
  await expect(page.locator('.detail-art img')).toBeVisible();
  await expect(page.getByRole('textbox',{name:'닉네임'})).toHaveCount(0);
  await page.getByLabel('댓글',{exact:true}).fill('회원으로 남긴 인사');
  await request.post('http://127.0.0.1:55433/__control',{data:{failComment:true}});
  await page.getByRole('button',{name:'댓글 등록',exact:true}).click();
  await expect(page.locator('.detail-modal [role=alert]')).toContainText('댓글을 등록하지 못했어요');
  await expect(page.getByLabel('댓글',{exact:true})).toHaveValue('회원으로 남긴 인사');
  await request.post('http://127.0.0.1:55433/__control',{data:{failComment:false}});
  await page.getByRole('button',{name:'댓글 등록',exact:true}).click();
  await expect(page.locator('.comment')).toContainText('회원으로 남긴 인사');
  await page.getByRole('button',{name:'목록으로 돌아가기'}).click();
  await page.reload();
  await expect(page.locator('.entry-card')).toHaveCount(1);
  await expect(page.locator('.header')).toContainText('테스트 회원');
  await page.getByRole('button',{name:'작성 닫기'}).click();
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();
  await expect(page).toHaveURL('/login');
  await page.goto('/');await expect(page).toHaveURL(/\/login\?/);
});

test('가입 확인과 복구 링크로만 비밀번호 재설정 (로컬 계약 fixture)', async ({page})=>{
  await page.goto('/signup');
  await page.getByLabel('이메일',{exact:true}).fill('member@example.invalid');
  await page.getByLabel('비밀번호',{exact:true}).fill('test-password');
  await page.getByLabel('비밀번호 확인',{exact:true}).fill('test-password');
  await page.getByRole('button',{name:'회원가입',exact:true}).click();
  await expect(page).toHaveURL('/signup/check-email');
  await page.goto('/auth/confirm?token_hash=valid-signup&type=signup');
  await expect(page).toHaveURL('/');
  await page.goto('/reset-password');
  await expect(page).toHaveURL('/forgot-password');
  await page.getByLabel('이메일',{exact:true}).fill('member@example.invalid');
  await page.getByRole('button',{name:'재설정 메일 보내기'}).click();
  await expect(page.getByRole('status')).toContainText('계정이 있다면');
  await page.goto('/auth/confirm?token_hash=valid-recovery&type=recovery');
  await expect(page).toHaveURL('/reset-password');
  await page.getByLabel('비밀번호',{exact:true}).fill('replacement-password');
  await page.getByLabel('비밀번호 확인',{exact:true}).fill('replacement-password');
  await page.getByRole('button',{name:'비밀번호 변경'}).click();
  await expect(page).toHaveURL('/login?changed=1');
  await expect(page.getByRole('status')).toContainText('비밀번호가 변경되었습니다');
});

test('재로그인 후 같은 계정의 캔버스 초안 복원 (로컬 계약 fixture)', async ({page,context})=>{
  async function login() {
    await page.getByLabel('이메일',{exact:true}).fill('member@example.invalid');
    await page.getByLabel('비밀번호',{exact:true}).fill('test-password');
    await page.getByRole('button',{name:'로그인',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }
  await page.goto('/login?next=/write');await login();
  const canvas=page.locator('canvas');const box=await canvas.boundingBox();if(!box)throw new Error('Canvas missing');
  await page.mouse.move(box.x+40,box.y+40);await page.mouse.down();await page.mouse.move(box.x+150,box.y+100,{steps:10});await page.mouse.up();
  const original=await canvas.evaluate((element:HTMLCanvasElement)=>element.toDataURL());
  await context.clearCookies();
  await page.goto('/login?next=/write');await login();
  await expect.poll(()=>page.locator('canvas').evaluate((element:HTMLCanvasElement)=>element.toDataURL())).toBe(original);
  page.on('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'작성 닫기'}).click();
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();
  await expect(page).toHaveURL('/login');
});

test('초안 저장소가 가득 차도 만료 시 캔버스를 지우거나 이동하지 않는다 (로컬 fixture)', async ({page,context})=>{
  await page.goto('/login?next=/write');
  await page.getByLabel('이메일',{exact:true}).fill('member@example.invalid');
  await page.getByLabel('비밀번호',{exact:true}).fill('test-password');
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const canvas=page.locator('canvas'); const box=await canvas.boundingBox(); if(!box)throw new Error('Canvas missing');
  await page.mouse.move(box.x+40,box.y+40); await page.mouse.down(); await page.mouse.move(box.x+150,box.y+100,{steps:10}); await page.mouse.up();
  const original=await canvas.evaluate((element:HTMLCanvasElement)=>element.toDataURL());
  await page.evaluate(()=>{ const originalSet=Storage.prototype.setItem; Storage.prototype.setItem=function(key,value){ if(key.startsWith('trace-draft-'))throw new DOMException('Full','QuotaExceededError'); return originalSet.call(this,key,value); }; });
  await context.clearCookies();
  await page.getByRole('button',{name:'마음 등록하기'}).click();
  await expect(page.getByRole('link',{name:'새 탭에서 같은 계정으로 로그인'})).toBeVisible();
  await expect(page).toHaveURL('/write');
  expect(await canvas.evaluate((element:HTMLCanvasElement)=>element.toDataURL())).toBe(original);
  const loginPage=await context.newPage();
  await loginPage.goto('/login');
  await loginPage.getByLabel('이메일',{exact:true}).fill('member@example.invalid');
  await loginPage.getByLabel('비밀번호',{exact:true}).fill('test-password');
  await loginPage.getByRole('button',{name:'로그인',exact:true}).click();
  await expect(loginPage).toHaveURL('/');
  await page.bringToFront();
  await page.getByRole('button',{name:'마음 등록하기'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'새 탭에서 같은 계정으로 로그인'})).toHaveCount(0);
});
