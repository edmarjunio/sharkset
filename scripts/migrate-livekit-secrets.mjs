import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SOURCE = 'sharkset';
const TARGET = 'sharkset-70de4';
const SECRETS = ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_URL'];

export function crc32c(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0x82f63b78 : 0);
  }
  return String((~crc) >>> 0);
}

function checkedPayload(result) {
  const payload = result?.payload;
  if (typeof payload?.data !== 'string' || !payload.data || !/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.data)) {
    throw new Error('Payload ausente ou invalido. Nenhum valor foi exibido.');
  }
  const bytes = Buffer.from(payload.data, 'base64');
  if (crc32c(bytes) !== String(payload.dataCrc32c)) {
    bytes.fill(0);
    throw new Error('Verificacao de integridade falhou. Origem preservada.');
  }
  return bytes;
}

export async function migrate({ request, apply = false, only, log = console.log }) {
  if (only !== undefined && !SECRETS.includes(only)) throw new Error('Secret nao permitido. Use somente um dos tres nomes LiveKit previstos.');
  for (const project of [SOURCE, TARGET]) {
    const info = await request('GET', `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`);
    if (info.projectId !== project || info.lifecycleState !== 'ACTIVE') throw new Error('Projeto incorreto ou inativo.');
    if (project === TARGET && String(info.projectNumber) !== '677873825510') throw new Error('Numero do projeto de destino divergente.');
  }
  const api = 'https://secretmanager.googleapis.com/v1';
  async function versions(parent) {
    const all = [];
    let pageToken;
    do {
      const result = await request('GET', `${api}/${parent}/versions?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
      all.push(...(result.versions ?? []));
      pageToken = result.nextPageToken;
    } while (pageToken);
    return all;
  }
  const plan = [];
  // Finish metadata checks for every secret before any value access or mutation.
  for (const id of only ? [only] : SECRETS) {
    const source = `projects/${SOURCE}/secrets/${id}`;
    const target = `projects/${TARGET}/secrets/${id}`;
    const enabled = (await versions(source)).filter(v => v.state === 'ENABLED' && new RegExp(`^projects/[^/]+/secrets/${id}/versions/[0-9]+$`).test(v.name));
    enabled.sort((a, b) => Number(b.name.split('/').at(-1)) - Number(a.name.split('/').at(-1)));
    if (!enabled.length) throw new Error(`${id}: origem sem versao habilitada.`);
    const existing = await request('GET', `${api}/${target}`, undefined, true);
    if (existing && (await versions(target)).length) throw new Error(`${id}: destino ja possui versoes. Parei para nao substituir dados; nenhum valor foi lido nesta execucao.`);
    plan.push({ id, source, target, version: enabled[0].name.split('/').at(-1), exists: !!existing });
    log(`${id}: origem habilitada; destino ${existing ? 'vazio' : 'ausente'}.`);
  }
  if (!apply) {
    log('Simulacao concluida: nenhum valor lido ou alterado. Use --apply para copiar.');
    return;
  }
  for (const item of plan) {
    const bytes = checkedPayload(await request('GET', `${api}/${item.source}/versions/${item.version}:access`));
    try {
      if (!item.exists) await request('POST', `${api}/projects/${TARGET}/secrets?secretId=${item.id}`, { replication: { automatic: {} } });
      // Recheck immediately before writing. This script never replaces an existing version.
      if ((await versions(item.target)).length) throw new Error(`${item.id}: destino mudou durante a transferencia. Operacao interrompida.`);
      const created = await request('POST', `${api}/${item.target}:addVersion`, { payload: { data: bytes.toString('base64'), dataCrc32c: crc32c(bytes) } });
      const version = created?.name?.split('/').at(-1);
      if (!/^[0-9]+$/.test(version ?? '')) throw new Error('Resposta de criacao invalida. Confira os metadados do destino.');
      const copied = checkedPayload(await request('GET', `${api}/${item.target}/versions/${version}:access`));
      try {
        if (!bytes.equals(copied)) throw new Error('Copia divergente. Preserve a origem e confira o destino.');
      } finally { copied.fill(0); }
      log(`${item.id}: copiado e verificado no destino.`);
    } finally { bytes.fill(0); }
  }
  log(`${plan.length} secret(s) copiado(s) e verificado(s) em sharkset-70de4. A origem permanece intacta.`);
}

export function parseArgs(args) {
  let apply = false, only;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply' && !apply) apply = true;
    else if (args[i] === '--only' && only === undefined && SECRETS.includes(args[i + 1])) only = args[++i];
    else throw new Error('Uso: node scripts/migrate-livekit-secrets.mjs [--only LIVEKIT_API_SECRET] [--apply]');
  }
  return { apply, only };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  // Capture stdout privately; never echo OAuth tokens or gcloud error output.
  const auth = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'gcloud auth print-access-token --project=sharkset-70de4 --quiet'], { encoding: 'utf8', windowsHide: true, timeout: 30000 })
    : spawnSync('gcloud', ['auth', 'print-access-token', '--project=sharkset-70de4', '--quiet'], { encoding: 'utf8', timeout: 30000 });
  if (auth.status !== 0 || !auth.stdout?.trim()) throw new Error('Nao foi possivel autenticar no gcloud. Execute no seu terminal autenticado.');
  const token = auth.stdout.trim();
  const request = async (method, url, body, allowMissing = false) => {
    const parsed = new URL(url);
    if (!['cloudresourcemanager.googleapis.com', 'secretmanager.googleapis.com'].includes(parsed.hostname) || parsed.protocol !== 'https:') throw new Error('Endereco de API recusado.');
    let response;
    try {
      response = await fetch(url, { method, redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch { throw new Error('Falha de conexao com a API Google. Origem preservada.'); }
    if (response.status === 404 && allowMissing) return null;
    if (!response.ok) throw new Error(`API Google retornou HTTP ${response.status}. Confira permissoes e APIs nos dois projetos. Nenhum corpo de resposta foi exibido.`);
    try { return await response.json(); } catch { throw new Error('Resposta da API invalida.'); }
  };
  await migrate({ request, ...options });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
