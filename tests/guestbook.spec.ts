import { test, expect } from '@playwright/test';

test('비로그인 방명록 접근은 로그인으로 이동한다', async ({ page }) => {
  for (const path of ['/', '/profile', '/write', '/guestbooks/33333333-3333-4333-8333-333333333333']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?/);
    await expect(page.getByRole('heading', { name: '다시 만나 반가워요' })).toBeVisible();
    await expect(page.locator('.entry-card')).toHaveCount(0);
  }
});

test('회원가입 서버 검증과 로그인 UI, 모바일 레이아웃', async ({ page }) => {
  await page.goto('/login?next=https://evil.example');
  await expect(page.locator('input[name=next]')).toHaveValue('/');
  await page.getByRole('link', { name: '회원가입', exact: true }).click();
  await expect(page.getByRole('heading', { name: '우리의 이야기를 시작해요' })).toBeVisible();
  await page.getByLabel('이메일', { exact: true }).fill('ui-test@example.invalid');
  await expect(page.getByLabel('닉네임', { exact: true })).toHaveCount(0);
  await page.getByLabel('비밀번호', { exact: true }).fill('long-password');
  await page.getByLabel('비밀번호 확인', { exact: true }).fill('different-password');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page.locator('.auth-card [role=alert]')).toContainText('확인 입력과 같아야');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/auth-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.screenshot({ path: 'artifacts/auth-desktop.png', fullPage: true });
});

test('메일 확인·복구 화면과 유효하지 않은 확인 링크', async ({ page }) => {
  await page.goto('/signup/check-email');
  await expect(page.getByRole('heading', { name: '메일함을 확인해 주세요' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인 메일 다시 보내기' })).toBeVisible();
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: '비밀번호를 잊으셨나요?' })).toBeVisible();
  await page.goto('/reset-password');
  await expect(page).toHaveURL(/\/login\?/);
  await page.goto('/auth/confirm?type=magiclink&token_hash=invalid&next=//evil.example');
  await expect(page).toHaveURL(/\/login\?error=link/);
  await expect(page.locator('.auth-card [role=alert]')).toContainText('인증 링크가 만료');
});
