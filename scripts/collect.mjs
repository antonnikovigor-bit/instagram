// Сборщик статистики Instagram -> data/public.json
// Запускается GitHub Actions каждые 15 минут. Токен берётся из секрета IG_TOKEN.
// Обновлённый токен хранится зашифрованным (ключ = sha256 от секрета), в открытом виде нигде не лежит.

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const API = process.env.IG_API || 'https://graph.instagram.com/v23.0';
const DATA_DIR = process.env.DATA_DIR || 'data';
const REFRESH_URL = process.env.IG_REFRESH || 'https://graph.instagram.com/refresh_access_token';
const SECRET = (process.env.IG_TOKEN || '').trim();
const FORCE_FULL = process.env.FULL === 'true';
const TZ_OFFSET_H = 5; // Алматы, UTC+5
const MAX_REELS = 25;
const FULL_EVERY_H = 6;
const REFRESH_EVERY_D = 7;
const DAY = 86400;

if (!SECRET) {
  console.error('Нет секрета IG_TOKEN. Добавь его в Settings -> Secrets and variables -> Actions.');
  process.exit(1);
}

// ---------- шифрование токена ----------
const KEY = createHash('sha256').update(SECRET).digest();
const enc = (text) => {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', KEY, iv);
  const body = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString('base64')).join('.');
};
const dec = (s) => {
  const [iv, tag, body] = s.split('.').map((x) => Buffer.from(x, 'base64'));
  const d = createDecipheriv('aes-256-gcm', KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString('utf8');
};

// ---------- файлы ----------
const file = (n) => path.join(DATA_DIR, n);
const readJson = async (n, fallback) => {
  try { return JSON.parse(await readFile(file(n), 'utf8')); } catch { return fallback; }
};
const writeJson = (n, v) => writeFile(file(n), JSON.stringify(v, null, 1) + '\n');

// ---------- время ----------
const now = Math.floor(Date.now() / 1000);
const dayKey = (ts) => new Date((ts + TZ_OFFSET_H * 3600) * 1000).toISOString().slice(0, 10);
const dayStart = (ts) => {
  const local = ts + TZ_OFFSET_H * 3600;
  return local - (local % DAY) - TZ_OFFSET_H * 3600;
};

// ---------- API ----------
let token = SECRET;
const errors = [];
let calls = 0;

// Токен отправляется только на серверы Instagram (и на localhost - для локальных тестов)
const TOKEN_HOSTS = new Set(['graph.instagram.com']);
const allowedHost = (u) => (u.protocol === 'https:' && TOKEN_HOSTS.has(u.hostname)) ||
  (process.env.CI !== 'true' && u.protocol === 'http:' && u.hostname === 'localhost');

// Убираем из текста ошибок всё, что похоже на токен, чтобы он не попал в логи и в public.json
const scrub = (s) => String(s)
  .replace(/access_token=[^&\s"]+/gi, 'access_token=***')
  .replace(/\b(IG|EA)[A-Za-z0-9_-]{30,}\b/g, '***');

async function api(pathname, params = {}) {
  const url = new URL(pathname.startsWith('http') ? pathname : API + pathname);
  if (!allowedHost(url)) throw new Error(`Запрос к недоверенному адресу заблокирован: ${url.hostname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('access_token', token);
  calls++;
  const res = await fetch(url, { redirect: 'error' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = new Error(scrub(json.error?.message || `HTTP ${res.status}`));
    e.code = json.error?.code;
    throw e;
  }
  return json;
}

// Новый токен прячем в логах GitHub (секрет из настроек GitHub маскирует сам, а продлённый - нет)
const mask = (t) => { if (process.env.GITHUB_ACTIONS === 'true' && t) console.log(`::add-mask::${t}`); };

// Пытаемся взять все метрики разом; если API ругается на какую-то - берём по одной и пропускаем сломанные.
async function insights(id, metrics, params = {}) {
  const pick = (json) => {
    const out = {};
    for (const m of json.data || []) {
      out[m.name] = m.total_value?.value ?? m.values?.[0]?.value ?? null;
    }
    return out;
  };
  try {
    return pick(await api(`/${id}/insights`, { metric: metrics.join(','), ...params }));
  } catch (e) {
    if (e.code === 190) throw e;
    const out = {};
    for (const m of metrics) {
      try { Object.assign(out, pick(await api(`/${id}/insights`, { metric: m, ...params }))); }
      catch (e2) { if (e2.code === 190) throw e2; errors.push(`${m}: ${e2.message}`); }
    }
    return out;
  }
}

async function main() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  const state = await readJson('state.json', {});
  const pub = await readJson('public.json', {});

  // Токен: сначала обновлённый (зашифрованный), при проблеме - исходный из секрета
  if (state.tokenEnc) {
    try { token = dec(state.tokenEnc); mask(token); } catch { token = SECRET; delete state.tokenEnc; delete state.tokenRefreshedAt; }
  }

  let profile;
  try {
    profile = await api('/me', {
      fields: 'user_id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count',
    });
  } catch (e) {
    if (token !== SECRET) {
      console.log('Сохранённый токен не сработал, пробую исходный из секрета');
      token = SECRET;
      delete state.tokenEnc;
      profile = await api('/me', {
        fields: 'user_id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count',
      });
    } else throw e;
  }
  const uid = profile.user_id || profile.id;

  // Продление токена раз в неделю (токен живёт 60 дней)
  if (!state.tokenRefreshedAt || now - state.tokenRefreshedAt > REFRESH_EVERY_D * DAY) {
    try {
      const r = await api(REFRESH_URL, { grant_type: 'ig_refresh_token' });
      if (r.access_token) {
        token = r.access_token;
        mask(token);
        state.tokenEnc = enc(token);
        state.tokenRefreshedAt = now;
        console.log('Токен продлён');
      }
    } catch (e) {
      errors.push(`refresh: ${e.message}`);
    }
  }

  // ---------- рилсы ----------
  const media = [];
  let next = null;
  let page = await api('/me/media', {
    fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count',
    limit: 50,
  });
  media.push(...(page.data || []));
  next = page.paging?.next;
  while (next && media.length < 150) {
    page = await api(next);
    media.push(...(page.data || []));
    next = page.paging?.next;
  }
  const reelsRaw = media.filter((m) => m.media_product_type === 'REELS').slice(0, MAX_REELS);

  const REEL_METRICS = ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions',
    'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'];
  const reels = [];
  for (const m of reelsRaw) {
    const i = await insights(m.id, REEL_METRICS);
    reels.push({
      id: m.id,
      permalink: m.permalink,
      thumb: m.thumbnail_url || m.media_url || null,
      caption: (m.caption || '').slice(0, 300),
      timestamp: m.timestamp,
      views: i.views ?? null,
      reach: i.reach ?? null,
      likes: i.likes ?? m.like_count ?? null,
      comments: i.comments ?? m.comments_count ?? null,
      shares: i.shares ?? null,
      saved: i.saved ?? null,
      avgWatchSec: i.ig_reels_avg_watch_time != null ? i.ig_reels_avg_watch_time / 1000 : null,
      watchHours: i.ig_reels_video_view_total_time != null ? i.ig_reels_video_view_total_time / 3600000 : null,
    });
  }

  // ---------- оценка «подписчиков с рилса» ----------
  // Прирост подписчиков между замерами делим между рилсами пропорционально приросту их просмотров.
  state.estFollows ||= {};
  const followers = profile.followers_count ?? 0;
  if (state.last) {
    const dF = followers - state.last.followers;
    const deltas = reels.map((r) => [r.id, Math.max(0, (r.views ?? 0) - (state.last.views?.[r.id] ?? 0))]);
    const sum = deltas.reduce((a, [, d]) => a + d, 0);
    if (dF > 0 && sum > 0) {
      for (const [id, d] of deltas) state.estFollows[id] = (state.estFollows[id] || 0) + (dF * d) / sum;
    }
  }
  state.last = { t: now, followers, views: Object.fromEntries(reels.map((r) => [r.id, r.views ?? 0])) };
  for (const r of reels) r.estFollows = state.estFollows[r.id] != null ? Math.round(state.estFollows[r.id] * 10) / 10 : 0;

  // Подписчики на конец каждого дня - для графика роста
  state.followersByDay ||= {};
  state.followersByDay[dayKey(now)] = followers;

  // ---------- статистика по дням и аудитория (раз в 6 часов) ----------
  const full = FORCE_FULL || !state.lastFull || now - state.lastFull > FULL_EVERY_H * 3600 || !pub.totals30;
  let daily = pub.daily || [];
  let totals30 = pub.totals30 || {};
  let audience = pub.audience || {};

  if (full) {
    const byDate = Object.fromEntries(daily.map((d) => [d.date, d]));
    const today = dayStart(now);
    for (let k = 29; k >= 0; k--) {
      const since = today - k * DAY;
      const until = Math.min(since + DAY, now);
      if (until <= since) continue;
      const i = await insights(uid, ['reach', 'views', 'profile_views'], {
        period: 'day', metric_type: 'total_value', since, until,
      });
      const key = dayKey(since);
      byDate[key] = { ...(byDate[key] || {}), date: key, reach: i.reach ?? null, views: i.views ?? null, profile: i.profile_views ?? null };
    }
    // Новые подписки по дням (Instagram отдаёт только для аккаунтов от 100 подписчиков)
    try {
      const fc = await api(`/${uid}/insights`, { metric: 'follower_count', period: 'day', since: today - 29 * DAY, until: now });
      for (const v of fc.data?.[0]?.values || []) {
        const key = dayKey(Math.floor(new Date(v.end_time).getTime() / 1000) - 1);
        byDate[key] = { ...(byDate[key] || { date: key }), follows: v.value };
      }
    } catch (e) { errors.push(`follower_count: ${e.message}`); }

    daily = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)).slice(-365);

    const t = await insights(uid, ['reach', 'views', 'profile_views'], {
      period: 'day', metric_type: 'total_value', since: now - 30 * DAY + 60, until: now,
    });
    totals30 = { reach: t.reach ?? null, views: t.views ?? null, profile: t.profile_views ?? null };

    audience = {};
    for (const b of ['city', 'country', 'age', 'gender']) {
      try {
        let r;
        try {
          r = await api(`/${uid}/insights`, { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown: b });
        } catch {
          r = await api(`/${uid}/insights`, { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown: b, timeframe: 'this_month' });
        }
        const rows = r.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
        audience[b] = rows.map((x) => [x.dimension_values?.[0], x.value]).sort((a, c) => c[1] - a[1]);
      } catch (e) { errors.push(`demographics ${b}: ${e.message}`); }
    }
    state.lastFull = now;
  }

  // Прирост подписчиков за 30 дней: сумма новых подписок из API, иначе - по нашим замерам
  const last30 = daily.filter((d) => d.date > dayKey(now - 30 * DAY));
  const apiFollows = last30.some((d) => d.follows != null) ? last30.reduce((a, d) => a + (d.follows || 0), 0) : null;
  const days = Object.keys(state.followersByDay).sort();
  const base = days.find((d) => d >= dayKey(now - 30 * DAY)) || days[0];
  const snapGain = base ? followers - state.followersByDay[base] : null;
  for (const d of daily) if (state.followersByDay[d.date] != null) d.followers = state.followersByDay[d.date];

  const recent = reels.filter((r) => Date.parse(r.timestamp) / 1000 > now - 30 * DAY);
  const totalViews = reels.reduce((a, r) => a + (r.views || 0), 0);
  const weightedWatch = reels.reduce((a, r) => a + (r.avgWatchSec || 0) * (r.views || 0), 0);

  const out = {
    updatedAt: new Date(now * 1000).toISOString(),
    profile: {
      username: profile.username,
      name: profile.name || profile.username,
      biography: profile.biography || '',
      picture: profile.profile_picture_url || null,
      followers,
      follows: profile.follows_count ?? null,
      media: profile.media_count ?? null,
    },
    totals30: {
      ...totals30,
      followersGain: apiFollows ?? snapGain,
      followersGainSource: apiFollows != null ? 'api' : 'snapshots',
      watchHours: Math.round(recent.reduce((a, r) => a + (r.watchHours || 0), 0) * 10) / 10,
      avgWatchSec: totalViews ? Math.round((weightedWatch / totalViews) * 10) / 10 : null,
      followsFromReels: Math.round(recent.reduce((a, r) => a + (r.estFollows || 0), 0)),
      trackingSince: state.firstRun || (state.firstRun = new Date(now * 1000).toISOString()),
    },
    daily,
    reels,
    audience,
    errors: errors.slice(0, 20).map(scrub),
  };

  await writeJson('public.json', out);
  await writeJson('state.json', state);
  console.log(`Готово: ${followers} подписчиков, ${reels.length} рилсов, запросов к API: ${calls}, полный сбор: ${full}`);
  if (errors.length) console.log('Предупреждения:\n' + errors.join('\n'));
}

main().catch((e) => {
  console.error('Ошибка:', scrub(e.message));
  if (e.code === 190) console.error('Токен недействителен. Сгенерируй новый и обнови секрет IG_TOKEN.');
  process.exit(1);
});
