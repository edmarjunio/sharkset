import fs from 'node:fs';
import zlib from 'node:zlib';

function eagerScripts(html) {
  return [...new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"?]+\.js)"/g)].map(match => match[1].slice('assets/'.length)))];
}
function summarize(snapshot) {
  const eager = new Set(eagerScripts(snapshot.html));
  const assets = snapshot.assets.filter(asset => eager.has(asset.name));
  if (assets.length !== eager.size) throw Error('Missing initial script size in snapshot');
  return { files: assets.length, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), gzip: assets.reduce((sum, asset) => sum + asset.gzip, 0), assets };
}
const args = process.argv.slice(2);
const baselinePath = args[args.indexOf('--baseline') + 1];
const outputPath = args[args.indexOf('--output') + 1];
if (!args.includes('--baseline') || !args.includes('--output')) throw Error('Use --baseline <snapshot.json> --output <result.json> after npm run build');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const afterSnapshot = {
  html: fs.readFileSync('dist/index.html', 'utf8'),
  assets: fs.readdirSync('dist/assets').filter(name => name.endsWith('.js')).map(name => {
    const bytes = fs.readFileSync(`dist/assets/${name}`);
    return { name, bytes: bytes.length, gzip: zlib.gzipSync(bytes).length };
  }),
};
const before = summarize(baseline), after = summarize(afterSnapshot);
const result = {
  measuredAt: new Date().toISOString(), baselineAt: baseline.at,
  method: 'Sum of JS script/modulepreload URLs in production index.html. Node gzip per file. Build artifacts, not browser network or Core Web Vitals.',
  before, after,
  reduction: { bytesPercent: (1 - after.bytes / before.bytes) * 100, gzipPercent: (1 - after.gzip / before.gzip) * 100 },
  logo: { beforeBytes: fs.statSync('public/brand/sharkset-logo-transparent.png').size, responsive256Bytes: fs.statSync('src/assets/brand/logo-256.png').size, responsive512Bytes: fs.statSync('src/assets/brand/logo-512.png').size },
};
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
