import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderAquarium, AQUARIUM_DURATION } from '../src/animation/aquariumScene.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.AQUARIUM_OUTPUT || path.join(root, 'output/aquarium');
const media = path.join(root, 'public/media/aquarium');
await mkdir(output, {recursive: true});
const [water, side, front] = await Promise.all(['water.webp', 'shark-side.webp', 'shark-front.webp'].map(name => loadImage(path.join(media, name))));
const assets = {water, side, front};
const width = Number(process.env.AQUARIUM_WIDTH || 1920);
const height = Math.round(width * 9 / 16);
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

if (process.argv.includes('--stills')) {
  for (const second of [0, 5, 21.8, 23.2, 23.6, 24, 24.4, 24.8, 25.3, 25.6, 26.2, 29.9, 30]) {
    renderAquarium(ctx, assets, width, height, second);
    await writeFile(path.join(output, `frame-${String(second).replace('.', '-')}.png`), canvas.toBuffer('image/png'));
  }
  renderAquarium(ctx, assets, width, height, 0);
  const start = Buffer.from(ctx.getImageData(0, 0, width, height).data);
  renderAquarium(ctx, assets, width, height, 30);
  const end = Buffer.from(ctx.getImageData(0, 0, width, height).data);
  if (!start.equals(end)) throw new Error('First and last loop frames differ');
  console.log('Loop frames at 0 s and 30 s are pixel-identical. Stills exported.');
  process.exit(0);
}

const fps = 24;
const filename = width >= 3000 ? 'sharkset-aquarium-4k.mp4' : 'sharkset-aquarium-full-hd.mp4';
const encoder = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, filename)], {stdio: ['pipe', 'inherit', 'inherit']});
let encoderError;
encoder.on('error', error => { encoderError = error; });
encoder.stdin.on('error', error => { encoderError = error; });
const finished = once(encoder, 'close');
for (let frame = 0; frame < fps * AQUARIUM_DURATION; frame++) {
  if (encoderError) throw encoderError;
  renderAquarium(ctx, assets, width, height, frame / fps);
  const rgba = Buffer.from(ctx.getImageData(0, 0, width, height).data);
  if (!encoder.stdin.write(rgba)) await once(encoder.stdin, 'drain');
  if (frame % (fps * 5) === 0) console.log(`${filename}: ${frame / fps}/${AQUARIUM_DURATION} s`);
}
encoder.stdin.end();
const [code] = await finished;
if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
console.log(path.join(output, filename));
