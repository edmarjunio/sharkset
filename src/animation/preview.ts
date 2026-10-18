import { loadAquariumAssets, renderAquarium, AQUARIUM_DURATION } from './aquariumScene';

const canvas = document.querySelector<HTMLCanvasElement>('#aquarium')!;
const ctx = canvas.getContext('2d', {alpha: false})!;
const clock = document.querySelector<HTMLOutputElement>('#time')!;
const button = document.querySelector<HTMLButtonElement>('#pause')!;
const assets = await loadAquariumAssets(import.meta.env.BASE_URL);
let elapsed = 0, last = 0, paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const resize = () => {
  const ratio = Math.min(devicePixelRatio || 1, 2, 3840 / innerWidth, 2160 / innerHeight);
  canvas.width = Math.round(innerWidth * ratio); canvas.height = Math.round(innerHeight * ratio);
  renderAquarium(ctx, assets, canvas.width, canvas.height, elapsed);
};
button.textContent = paused ? 'Reproduzir' : 'Pausar';
button.addEventListener('click', () => { paused = !paused; button.textContent = paused ? 'Reproduzir' : 'Pausar'; });
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { last = 0; });
resize();
function tick(now: number) {
  if (last && !paused && !document.hidden) elapsed += Math.min((now - last) / 1000, .1);
  last = now;
  renderAquarium(ctx, assets, canvas.width, canvas.height, elapsed);
  clock.textContent = `00:${String(Math.floor(elapsed % AQUARIUM_DURATION)).padStart(2, '0')}`;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
