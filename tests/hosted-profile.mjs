// Opt-in integration test: creates and cleans up isolated hosted test members.
// Run only against the authorized development project with a compatible app.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';
if (!process.argv.includes('--apply')) throw new Error('Hosted mutations require --apply');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname, 'zgemiwhsqixgqfknjhnv.supabase.co');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const base = process.env.PROFILE_TEST_APP_URL || 'http://127.0.0.1:3004';
const run = randomUUID().slice(0, 8);
const members = [], objects = [], entries = [], checks = [];
let browser, completed = false;
function ok(result) { if (result.error) throw new Error(`Hosted operation failed (${result.error.code || result.error.statusCode || 'unknown'})`); return result.data; }
function pass(name) { checks.push(name); console.log(`PASS: ${name}`); }
async function profile(id) { return ok(await admin.from('profiles').select('*').eq('id', id).single()); }
async function login(page, member) {
  await page.goto(`${base}/login?next=/profile`);
  await page.locator('input[name=email]').fill(member.email);
  await page.locator('input[name=password]').fill(member.password);
  await page.locator('button[type=submit],form button').click();
  await expect(page).toHaveURL(`${base}/profile`, { timeout: 20000 });
  await expect(page.locator('#profile-name')).toBeVisible();
}
try {
  for (const label of ['a', 'b', 'unconfirmed']) {
    const email = `profile-${run}-${label}@example.com`, password = `T3st!${randomUUID()}`;
    const { user } = ok(await admin.auth.admin.createUser({ email, password, email_confirm: label !== 'unconfirmed' }));
    members.push({ id: user.id, email, password, client: createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options) });
    if (label !== 'unconfirmed') ok(await members.at(-1).client.auth.signInWithPassword({ email, password }));
  }
  const [a, b, unconfirmed] = members;
  const initial = await profile(a.id);
  assert.match(initial.revision, /^[0-9a-f-]{36}$/);
  for (const client of [anon, a.client, b.client]) {
    assert.ok((await client.rpc('save_own_profile', { p_member_id: a.id, p_expected_revision: initial.revision, p_nickname: 'forged' })).error);
    assert.ok((await client.from('profiles').update({ nickname: 'forged' }).eq('id', a.id)).error);
    assert.ok((await client.from('profiles').update({ revision: randomUUID() }).eq('id', a.id)).error);
  }
  assert.equal((await profile(a.id)).nickname, initial.nickname);
  pass('anon/member A/member B direct RPC and profile column writes denied');
  assert.ok((await admin.rpc('save_own_profile', { p_member_id: unconfirmed.id, p_expected_revision: randomUUID(), p_nickname: 'blocked' })).error);
  pass('unconfirmed member rejected by trusted RPC');
  const args = { p_member_id: a.id, p_expected_revision: initial.revision, p_nickname: `race-${run}` };
  const race = await Promise.all([admin.rpc('save_own_profile', args), admin.rpc('save_own_profile', args)]);
  assert.deepEqual(race.map(r => ok(r)[0].status).sort(), ['conflict', 'saved']);
  pass('concurrent trusted saves produce exactly one saved and one conflict');
  const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#315c48' } }).png().toBuffer();
  const object = `${a.id}/${randomUUID()}.png`;
  for (const client of [anon, a.client, b.client]) assert.ok((await client.storage.from('profile-avatars').upload(object, png, { contentType: 'image/png' })).error);
  ok(await admin.storage.from('profile-avatars').upload(object, png, { contentType: 'image/png' })); objects.push(object);
  for (const client of [anon, a.client, b.client]) {
    assert.ok((await client.storage.from('profile-avatars').update(object, png, { contentType: 'image/png' })).error);
    await client.storage.from('profile-avatars').remove([object]);
    ok(await admin.storage.from('profile-avatars').download(object));
  }
  pass('hosted Storage denies member/anon insert, update and delete');
  const current = await profile(a.id);
  assert.equal(ok(await admin.rpc('save_own_profile', { p_member_id: a.id, p_expected_revision: current.revision, p_nickname: current.nickname, p_avatar_path: object }))[0].status, 'saved');
  const signed = ok(await b.client.storage.from('profile-avatars').createSignedUrl(object, 300));
  assert.equal((await fetch(signed.signedUrl)).status, 200);
  assert.ok((await anon.storage.from('profile-avatars').createSignedUrl(object, 300)).error);
  pass('service-uploaded avatar accepted; member signed URL works and anonymous signing denied');
  const short = ok(await b.client.storage.from('profile-avatars').createSignedUrl(object, 1));
  await new Promise(resolve => setTimeout(resolve, 3000));
  assert.notEqual((await fetch(short.signedUrl)).status, 200);
  pass('expired hosted signed URL is rejected');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage(); await login(page, a);
  const second = await context.newPage(); await second.goto(`${base}/profile`);
  await page.locator('#profile-name').fill(`ui-${run}`);
  await page.locator('#profile-file').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png });
  await page.locator('button[type=submit]').click();
  await expect(page.locator('form [role=status]')).toBeVisible({ timeout: 20000 });
  const saved = await profile(a.id); objects.push(saved.avatar_path);
  assert.equal(saved.nickname, `ui-${run}`); assert.notEqual(saved.avatar_path, object);
  await second.locator('#profile-name').fill(`draft-${run}`);
  await second.locator('#profile-file').setInputFiles({ name: 'draft.png', mimeType: 'image/png', buffer: png });
  await second.locator('button[type=submit]').click();
  await expect(second.locator('.profile-conflict')).toBeVisible({ timeout: 20000 });
  await expect(second.locator('button[type=submit]')).toBeDisabled();
  await expect(second.locator('#profile-name')).toHaveValue(`draft-${run}`);
  assert.equal(await second.locator('#profile-file').evaluate(el => el.files.length), 1);
  await second.locator('.profile-conflict > button').click();
  await expect(second.locator('.latest-profile')).toContainText(`ui-${run}`);
  await second.locator('.latest-profile button').click();
  await expect(second.locator('#profile-name')).toHaveValue(`draft-${run}`);
  await second.locator('button[type=submit]').click();
  await expect(second.locator('form [role=status]')).toBeVisible({ timeout: 20000 });
  objects.push((await profile(a.id)).avatar_path);
  pass('real login and Server Actions save avatar/name; stale tab preserves File/draft and requires explicit confirmation');
  // Use isolated authored records to verify current author names on list/detail/comments.
  const entryId = randomUUID(), imagePath = `${a.id}/${entryId}.png`;
  ok(await a.client.storage.from('guestbook-images-private').upload(imagePath, png, { contentType: 'image/png' }));
  objects.push({ bucket: 'guestbook-images-private', path: imagePath });
  ok(await a.client.from('guestbooks').insert({ id: entryId, image_object_path: imagePath })); entries.push(entryId);
  ok(await a.client.from('comments').insert({ guestbook_id: entryId, content: `hosted-${run}` }));
  const watcher = await browser.newContext(); const view = await watcher.newPage(); await login(view, b);
  await view.goto(`${base}/guestbooks/${entryId}`);
  await expect(view.locator('.detail-meta')).toContainText(`draft-${run}`);
  await expect(view.locator('.comments')).toContainText(`draft-${run}`);
  await second.locator('#profile-name').fill(`live-${run}`); await second.locator('button[type=submit]').click();
  await expect(second.locator('form [role=status]')).toBeVisible({ timeout: 20000 });
  const savedAt = Date.now();
  await expect(view.locator('.detail-meta')).toContainText(`live-${run}`, { timeout: 30000 });
  await expect(view.locator('.comments')).toContainText(`live-${run}`, { timeout: Math.max(1000, 30000 - (Date.now() - savedAt)) });
  assert.ok(Date.now() - savedAt < 30000);
  await expect(view.locator('.detail-meta .avatar img')).toBeVisible();
  await view.goto(`${base}/`);
  await expect(view.locator('.entry-card').filter({ hasText: `live-${run}` })).toHaveCount(1);
  pass('real account B sees author/avatar updates on detail/comments within 30 seconds and on list');
  for (const width of [390, 1440]) {
    await second.setViewportSize({ width, height: 900 });
    assert.ok(await second.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  pass('hosted profile has no horizontal overflow at 390 and 1440 pixels');
  // Real Server Actions dispatched together from the same baseline.
  await page.goto(`${base}/profile`); await second.reload();
  await page.locator('#profile-name').fill(`raceA-${run}`);
  await second.locator('#profile-name').fill(`raceB-${run}`);
  await Promise.all([page.locator('button[type=submit]').click(), second.locator('button[type=submit]').click()]);
  await expect.poll(async () => await page.locator('form [role=status]').count() + await second.locator('form [role=status]').count()).toBe(1);
  await expect.poll(async () => await page.locator('.profile-conflict').count() + await second.locator('.profile-conflict').count()).toBe(1);
  pass('simultaneous real Server Actions produce one success and one conflict');
  let signedRequests = 0;
  view.on('request', request => { if (request.url().includes('/storage/v1/object/sign/profile-avatars/')) signedRequests++; });
  await view.clock.install();
  // Mount timers after clock installation; existing native timers cannot be advanced.
  await view.reload();
  await expect(view.locator('.entry-card').filter({ hasText: `race` }).locator('.avatar img')).toBeVisible();
  const before = signedRequests;
  await view.clock.fastForward(240001);
  await expect.poll(() => signedRequests, { timeout: 10000 }).toBeGreaterThan(before);
  if (await view.locator('.detail-modal').count()) await view.locator('.detail-modal .back-link').click();
  await view.locator('.account-logout').click();
  await expect(view).toHaveURL(`${base}/login`);
  const stopped = signedRequests;
  await view.clock.fastForward(300001);
  assert.equal(signedRequests, stopped);
  pass('real browser renews signed URLs at four minutes and stops signing after logout (browser clock advanced)');
  completed = true;
} finally {
  await browser?.close();
  // Remove only records owned by this run; never delete existing members or assets.
  const failures = [];
  for (const id of entries) {
    for (const table of ['comments', 'guestbooks']) {
      const r = await admin.from(table).delete().eq(table === 'comments' ? 'guestbook_id' : 'id', id);
      if (r.error) failures.push('record cleanup');
    }
  }
  // Also collect artifacts from failed/unknown UI commits before deleting the users.
  for (const member of members) {
    const listed = await admin.storage.from('profile-avatars').list(member.id);
    if (listed.error) failures.push('avatar listing');
    for (const item of listed.data || []) objects.push(`${member.id}/${item.name}`);
    const removed = await admin.auth.admin.deleteUser(member.id);
    if (removed.error) failures.push('member cleanup');
  }
  for (const item of objects) {
    const bucket = typeof item === 'string' ? 'profile-avatars' : item.bucket;
    const path = typeof item === 'string' ? item : item.path;
    const result = await admin.storage.from(bucket).remove([path]);
    if (result.error) failures.push('object cleanup');
  }
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/hosted-profile-results.json', JSON.stringify({ date: new Date().toISOString(), passed: completed && failures.length === 0, checks, cleanupFailures: failures }, null, 2));
  assert.equal(failures.length, 0, 'Hosted test cleanup incomplete');
  console.log('Cleanup complete: isolated test users, records and objects removed.');
}
