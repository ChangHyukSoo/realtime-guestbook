import assert from 'node:assert/strict';
import { imageFixtures } from './fixtures/profile-images/generate.mjs';
import { validateProfileImage } from '../src/lib/profile-image.ts';
const images=await imageFixtures();
for(const [format,bytes] of Object.entries(images)) {
  const result=await validateProfileImage(new File([bytes],`avatar.${format}`,{type:`image/${format}`}));
  assert.equal(result.contentType,`image/${format}`);
  assert.deepEqual(result.bytes,bytes);
}
const exact=Buffer.alloc(5242880); images.png.copy(exact);
assert.equal((await validateProfileImage(new File([exact],'exact.png',{type:'image/png'}))).bytes.length,5242880);
for(const file of [new File([Buffer.alloc(5242881)],'large.png',{type:'image/png'}),new File([images.png],'fake.jpg',{type:'image/jpeg'}),new File([images.png.subarray(0,45)],'truncated.png',{type:'image/png'}),new File([],'empty.png',{type:'image/png'}),new File(['not an image'],'fake.png',{type:'image/png'})]) {
  await assert.rejects(()=>validateProfileImage(file),/이미지|PNG|5MiB/);
}
console.log('PASS: full pixel decode PNG/JPEG/WebP, exact 5MiB, over limit, MIME mismatch, truncated pixels and empty input.');
