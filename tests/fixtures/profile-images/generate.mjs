import sharp from 'sharp';
export async function imageFixtures() {
  const input={create:{width:8,height:8,channels:3,background:'#315c48'}};
  return {png:await sharp(input).png().toBuffer(),jpeg:await sharp(input).jpeg().toBuffer(),webp:await sharp(input).webp().toBuffer()};
}
