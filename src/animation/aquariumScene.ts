// Shared by the live canvas and the offline video exporter. Time is deterministic.
export const AQUARIUM_DURATION = 30;

export interface AquariumAssets {
  water: CanvasImageSource;
  side: CanvasImageSource;
  front: CanvasImageSource;
}

const TAU = Math.PI * 2;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { const v = clamp(x); return v * v * (3 - 2 * v); };
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;

function dimensions(image: CanvasImageSource): [number, number] {
  const source = image as HTMLImageElement;
  return [source.naturalWidth || source.width, source.naturalHeight || source.height];
}

function drawCover(ctx: CanvasRenderingContext2D, source: CanvasImageSource, w: number, h: number) {
  const [iw, ih] = dimensions(source);
  const scale = Math.max(w / iw, h / ih);
  ctx.drawImage(source, (w - iw * scale) / 2, (h - ih * scale) / 2, iw * scale, ih * scale);
}

function drawShark(
  ctx: CanvasRenderingContext2D, source: CanvasImageSource,
  x: number, y: number, width: number, direction: number, time: number,
  alpha: number, rotation: number, bend: boolean,
) {
  if (alpha <= 0) return;
  const [iw, ih] = dimensions(source);
  const height = width * ih / iw;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(direction, 1);
  ctx.globalAlpha = alpha;
  // A traveling wave increases toward the tail; the eyes and muzzle remain stable.
  const strips = bend ? 48 : 1;
  for (let i = 0; i < strips; i++) {
    const u = i / strips;
    const sway = bend ? Math.sin(time * TAU / 1.2 + u * 3) * Math.pow(1 - u, 2.5) * width * .035 : 0;
    const sw = Math.min(iw - i * iw / strips, iw / strips + 1);
    ctx.drawImage(source, i * iw / strips, 0, sw, ih,
      -width / 2 + i * width / strips, -height / 2 + sway, sw / iw * width + .3, height);
  }
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const color = ctx.createRadialGradient(-r * .4, -r * .45, r * .05, 0, 0, r);
  color.addColorStop(0, '#fff59a');
  color.addColorStop(.45, '#ffdc49');
  color.addColorStop(.8, '#e9ad20');
  color.addColorStop(1, '#9b670c');
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#fff4a388'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#09202d';
  ctx.beginPath();
  for (let n = 0; n < 10; n++) {
    const a = -Math.PI / 2 + n * Math.PI / 5;
    const radius = r * (n % 2 ? .34 : .72);
    const px = Math.cos(a) * radius, py = Math.sin(a) * radius;
    if (n === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff80';
  ctx.beginPath(); ctx.ellipse(-r * .35, -r * .48, r * .18, r * .08, -.5, 0, TAU); ctx.fill();
  ctx.restore();
}

function bubbles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, foreground: boolean) {
  const count = foreground ? 13 : 36;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 79.337 + (foreground ? 31 : 9);
    const fraction = (Math.sin(seed) * 43758.5453) % 1;
    const bx = (Math.abs(fraction) * w + Math.sin(t * TAU / 10 + seed) * 15);
    const progress = ((i * .137 + t * (foreground ? 2 : 1) / AQUARIUM_DURATION) % 1 + 1) % 1;
    const by = h + 70 - progress * (h + 140);
    const r = foreground ? 5 + (i % 4) * 3 : 1.4 + (i % 4) * 1.1;
    ctx.globalAlpha = foreground ? .32 : .22;
    const glow = ctx.createRadialGradient(bx - r * .3, by - r * .35, 0, bx, by, r);
    glow.addColorStop(0, '#d5ffff99'); glow.addColorStop(.6, '#6ce7ff08'); glow.addColorStop(1, '#b7ffffa0');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e2ffff';
    ctx.beginPath(); ctx.arc(bx - r * .32, by - r * .4, Math.max(.7, r * .12), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** Renders a 2.5D animation, rather than a newly generated 3D film. */
export function renderAquarium(
  ctx: CanvasRenderingContext2D, assets: AquariumAssets,
  pixelWidth: number, pixelHeight: number, seconds: number,
) {
  const t = ((seconds % AQUARIUM_DURATION) + AQUARIUM_DURATION) % AQUARIUM_DURATION;
  const h = 1080, w = h * pixelWidth / pixelHeight;
  ctx.save();
  ctx.setTransform(pixelWidth / w, 0, 0, pixelHeight / h, 0, 0);
  ctx.clearRect(0, 0, w, h);
  drawCover(ctx, assets.water, w, h);

  // Volumetric light, behind the character; camera and court stay fixed.
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 7; i++) {
    const origin = w * (.38 + i * .045), sway = Math.sin(t * TAU / 10 + i * .8) * 28;
    const light = ctx.createLinearGradient(origin, 0, origin + sway, h * .88);
    light.addColorStop(0, '#c4fbff00'); light.addColorStop(.2, '#b8faff13'); light.addColorStop(1, '#a4ffff00');
    ctx.fillStyle = light; ctx.beginPath();
    ctx.moveTo(origin - 12, 0); ctx.lineTo(origin + 12, 0);
    ctx.lineTo(origin + 160 + sway, h * .94); ctx.lineTo(origin - 95 + sway, h * .94);
    ctx.closePath(); ctx.fill();
  }
  // Gentle shifting caustics across the sand, without panning the illustration.
  ctx.globalAlpha = .08;
  ctx.strokeStyle = '#ccffff'; ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    ctx.beginPath();
    for (let x = -30; x < w + 30; x += 12) {
      const y = h * .82 + row * 49 + Math.sin(x / 69 + t * TAU / 10 + row) * 9;
      if (x === -30) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  bubbles(ctx, w, h, t, false);

  const cycle = t * TAU / 10;
  const swimX = w * (.25 + .15 * Math.sin(cycle));
  const swimY = h * (.29 + .045 * Math.sin(cycle * 2));
  let action = ease((t - 20) / 1.5) * (1 - ease((t - 27) / 3));
  if (t < 20) action = 0;
  const x = mix(swimX, w * .5, action);
  const y = mix(swimY, h * .33, action);
  const size = Math.min(570, w * .48);
  const facing = Math.cos(cycle);
  const swimDirection = (facing >= 0 ? 1 : -1) * (.65 + .35 * Math.abs(facing));
  const swimFront = 1 - ease((Math.abs(facing) - .08) / .42);
  const actionFront = ease((t - 21) / .7) * (1 - ease((t - 24.8) / .4));
  const front = mix(swimFront, actionFront, action);
  const spin = ease((t - 24.8) / .8);
  const rotation = t >= 24.8 && t < 26 ? -TAU * spin : Math.sin(t * TAU / 5) * .018;
  const actionDirection = t > 24.8 && t < 27 ? -1 : 1;
  const direction = mix(swimDirection, actionDirection, action);
  drawShark(ctx, assets.side, x, y, size, direction, t, 1 - front, rotation, true);
  const chuckle = t > 21.7 && t < 22.4 ? Math.sin((t - 21.7) * 28) * .025 : 0;
  drawShark(ctx, assets.front, x, y, size * .65, 1, t, front, chuckle, false);

  if (t >= 22.4 && t < 27) {
    const noseY = y - size * .025;
    let bx = x + size * .06, by = noseY;
    if (t < 23.2) by = mix(-110, noseY, Math.pow(clamp((t - 22.4) / .8), 2));
    else if (t < 24) by -= Math.sin((t - 23.2) / .8 * Math.PI) * 155;
    else if (t < 24.8) by -= Math.sin((t - 24) / .8 * Math.PI) * 105;
    else if (t < 25.6) {
      const u = ease((t - 24.8) / .8);
      bx += u * size * .39;
      by = mix(noseY, y + size * .04, u) - Math.sin(u * Math.PI) * 85;
    } else {
      const u = t - 25.6;
      bx += size * .39 + u * w * 1.25;
      by = y + size * .04 - u * h * .64 + 120 * u * u;
    }
    drawBall(ctx, bx, by - 44, Math.min(48, size * .09), t * 1.7 + Math.max(0, t - 25.6) * 12);
  }
  bubbles(ctx, w, h, t, true);
  const vignette = ctx.createRadialGradient(w * .48, h * .4, h * .2, w * .5, h * .5, Math.max(w, h) * .7);
  vignette.addColorStop(0, '#001b3500'); vignette.addColorStop(1, '#00192c38');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export async function loadAquariumAssets(baseUrl: string): Promise<AquariumAssets> {
  const load = (filename: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load aquarium asset: ' + filename));
    img.src = baseUrl + 'media/aquarium/' + filename;
  });
  const [water, side, front] = await Promise.all([
    load('water.webp'), load('shark-side.webp'), load('shark-front.webp'),
  ]);
  return {water, side, front};
}
