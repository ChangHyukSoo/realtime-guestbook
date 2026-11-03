import sharp from 'sharp';

export async function validateProfileImage(file: File) {
  if (!file.size || file.size > 5242880) throw new Error('이미지는 5MiB 이하로 선택해주세요.');
  const bytes=Buffer.from(await file.arrayBuffer());
  const format=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
    : bytes[0]===255 && bytes[1]===216 && bytes[2]===255 ? 'jpeg'
    : bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP' ? 'webp' : null;
  if (!format || file.type!==`image/${format}`) throw new Error('PNG, JPG, WebP 이미지 형식을 확인해주세요.');
  try {
    // Decode all frames, not just metadata. Bound decoded memory and processing time.
    await sharp(bytes,{failOn:'warning',limitInputPixels:16777216,animated:true}).timeout({seconds:5}).raw().toBuffer();
  } catch { throw new Error('이미지가 손상되었거나 처리 가능한 범위를 넘었습니다. 다른 이미지를 선택해주세요.'); }
  return { bytes, contentType:`image/${format}`, extension:format==='jpeg'?'jpg':format };
}
