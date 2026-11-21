// Публикация пробного рилса (trial reel) через Instagram API.
// Запускается workflow publish-trial.yml при пуше ветки reel/<название>.
// В ветке лежат queue/video.mp4 и queue/caption.txt (подпись, можно пустую).
// Пробный рилс видят сначала только неподписчики; перевод в обычный - вручную в приложении (MANUAL).
// Режим CHECK=true: только проверяет, что у токена есть право на публикацию.

import { createHash, createDecipheriv } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const API = 'https://graph.instagram.com/v23.0';
const SECRET = (process.env.IG_TOKEN || '').trim();
const VIDEO = process.env.VIDEO || 'queue/video.mp4';
const CAPTION = process.env.CAPTION_FILE || 'queue/caption.txt';
const STATE = process.env.STATE_FILE || 'data/state.json';
const GRADUATION = process.env.GRADUATION || 'MANUAL';
const CHECK = process.env.CHECK === 'true';

if (!SECRET) { console.error('Нет секрета IG_TOKEN'); process.exit(1); }

const scrub = (s) => String(s)
  .replace(/access_token=[^&\s"]+/gi, 'access_token=***')
  .replace(/\b(IG|EA)[A-Za-z0-9_-]{30,}\b/g, '***');
const mask = (t) => { if (process.env.GITHUB_ACTIONS === 'true' && t) console.log(`::add-mask::${t}`); };

// Тот же токен, что у сборщика статистики: продлённый (зашифрованный в ветке data) или исходный из секрета
let token = SECRET;
if (existsSync(STATE)) {
  try {
    const st = JSON.parse(await readFile(STATE, 'utf8'));
    if (st.tokenEnc) {
      const key = createHash('sha256').update(SECRET).digest();
      const [iv, tag, body] = st.tokenEnc.split('.').map((x) => Buffer.from(x, 'base64'));
      const d = createDecipheriv('aes-256-gcm', key, iv);
      d.setAuthTag(tag);
      token = Buffer.concat([d.update(body), d.final()]).toString('utf8');
      mask(token);
    }
  } catch { token = SECRET; }
}

const ALLOWED = new Set(['graph.instagram.com', 'rupload.facebook.com']);
async function call(method, pathname, params = {}, opts = {}) {
  const url = new URL(pathname.startsWith('http') ? pathname : API + pathname);
  if (url.protocol !== 'https:' || !ALLOWED.has(url.hostname)) throw new Error(`Недоверенный адрес: ${url.hostname}`);
  let body;
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    url.searchParams.set('access_token', token);
  } else if (!opts.body) {
    body = new URLSearchParams({ ...params, access_token: token });
  }
  const res = await fetch(url, { method, body: opts.body ?? body, headers: opts.headers, redirect: 'error' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = new Error(scrub(json.error?.error_user_msg || json.error?.message || json.debug_info?.message || `HTTP ${res.status}`));
    e.code = json.error?.code;
    throw e;
  }
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const summary = async (text) => {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_STEP_SUMMARY, text + '\n');
  }
};

async function main() {
  const me = await call('GET', '/me', { fields: 'user_id,username' });
  const uid = me.user_id || me.id;

  // Право на публикацию: без instagram_business_content_publish этот запрос падает
  try {
    const lim = await call('GET', `/${uid}/content_publishing_limit`, { fields: 'quota_usage,config' });
    const used = lim.data?.[0]?.quota_usage ?? '?';
    const total = lim.data?.[0]?.config?.quota_total ?? '?';
    await summary(`Аккаунт @${me.username}: право на публикацию есть. Лимит за 24 ч: ${used}/${total}.`);
  } catch (e) {
    await summary(`Аккаунт @${me.username}: НЕТ права на публикацию (${e.message}). Нужен новый токен с instagram_business_content_publish.`);
    process.exit(1);
  }
  if (CHECK) return;

  const size = (await stat(VIDEO)).size;
  const caption = existsSync(CAPTION) ? (await readFile(CAPTION, 'utf8')).trim() : '';
  console.log(`Видео ${VIDEO}: ${(size / 1048576).toFixed(1)} МБ`);

  // 1. Контейнер пробного рилса
  const c = await call('POST', `/${uid}/media`, {
    media_type: 'REELS',
    upload_type: 'resumable',
    caption,
    trial_params: JSON.stringify({ graduation_strategy: GRADUATION }),
  });
  console.log(`Контейнер ${c.id}`);

  // 2. Загрузка файла
  const video = await readFile(VIDEO);
  await call('POST', c.uri || `https://rupload.facebook.com/ig-api-upload/v23.0/${c.id}`, {}, {
    body: video,
    headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String(size) },
  });
  console.log('Файл загружен, Instagram обрабатывает видео');

  // 3. Ждём обработку (до 15 минут)
  let status;
  for (let i = 0; i < 90; i++) {
    await sleep(10000);
    status = await call('GET', `/${c.id}`, { fields: 'status_code,status' });
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error(`Обработка видео: ${status.status_code} ${status.status || ''}`);
    }
  }
  if (status?.status_code !== 'FINISHED') throw new Error('Instagram не обработал видео за 15 минут');

  // 4. Публикация
  const pub = await call('POST', `/${uid}/media_publish`, { creation_id: c.id });
  const info = await call('GET', `/${pub.id}`, { fields: 'permalink,media_product_type' }).catch(() => ({}));
  await summary(`Пробный рилс опубликован: ${info.permalink || pub.id}. Перевод в обычный - вручную в приложении.`);
}

main().catch(async (e) => { await summary(`Ошибка: ${scrub(e.message)}`); process.exit(1); });
