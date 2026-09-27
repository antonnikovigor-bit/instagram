// Источник данных фиксирован. Подменить его через ссылку (?data=...) можно только при локальной разработке.
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const QUERY_DATA = new URLSearchParams(location.search).get('data');
const DATA_URL = LOCAL && /^[\w.-]+\.json$/.test(QUERY_DATA || '')
  ? QUERY_DATA
  : 'https://raw.githubusercontent.com/antonnikovigor-bit/instagram/data/public.json';

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat('ru-RU');
const fmt = (v) => v == null ? '-' : nf.format(Math.round(v));
const compact = (v) => {
  if (v == null) return '-';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.', ',') + ' млн';
  if (Math.abs(v) >= 1e4) return (v / 1e3).toFixed(v >= 1e5 ? 0 : 1).replace('.', ',') + ' тыс.';
  return nf.format(Math.round(v));
};
const dec1 = (v) => v == null ? '-' : (Math.round(v * 10) / 10).toString().replace('.', ',');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateRu = (iso, opts = { day: 'numeric', month: 'long' }) => new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty', ...opts });
const dayLabel = (d) => dateRu(d + 'T12:00:00+05:00', { day: 'numeric', month: 'short' }).replace('.', '');
// Ссылки и картинки пропускаем только с доменов Instagram/Facebook
const hostOk = (u, test) => { try { const x = new URL(u); return x.protocol === 'https:' && test(x.hostname); } catch { return false; } };
const safeImg = (u) => hostOk(u, (h) => h.endsWith('.cdninstagram.com') || h.endsWith('.fbcdn.net')) ? u : '';
const safeLink = (u) => hostOk(u, (h) => h === 'www.instagram.com' || h === 'instagram.com') ? u : '';
const setBg = (root) => root.querySelectorAll('[data-bg]').forEach((el) => {
  const u = safeImg(el.dataset.bg);
  if (u) el.style.backgroundImage = `url("${u.replace(/["\\\n\r]/g, encodeURIComponent)}")`;
});

const tip = $('tip');
const showTip = (x, y, html) => { tip.innerHTML = html; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.add('on'); };
const hideTip = () => tip.classList.remove('on');

let DATA = null;
let dayMetric = 'reach';
let reelSort = 'new';

function ago(iso) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  return dateRu(iso);
}

function renderHeader(d) {
  const p = d.profile;
  const url = `https://www.instagram.com/${encodeURIComponent(p.username)}/`;
  $('who').href = url; $('follow').href = url;
  $('handle').textContent = '@' + p.username;
  const pic = safeImg(p.picture);
  if (pic) {
    const img = document.createElement('img');
    img.src = pic; img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.onerror = () => img.replaceWith(Object.assign(document.createElement('span'), { className: 'ph' }));
    $('who').querySelector('.ph, img').replaceWith(img);
  }
  $('followers').textContent = fmt(p.followers);
  const g = d.totals30?.followersGain;
  $('gain').textContent = g == null ? '' : `${g >= 0 ? '+' : ''}${fmt(g)} за 30 дней`;
  const fresh = Date.now() - Date.parse(d.updatedAt) < 60 * 60 * 1000;
  $('dot').classList.toggle('off', !fresh);
  $('status').textContent = 'обновлено ' + ago(d.updatedAt);
}

function last30(d) { return (d.daily || []).slice(-30); }

function renderRidge(d) {
  const rows = last30(d).filter((r) => r.reach != null);
  const box = $('ridge');
  if (rows.length < 2) { box.innerHTML = '<p class="empty">График появится, когда наберутся данные.</p>'; return; }
  const W = 1000, H = 120, max = Math.max(...rows.map((r) => r.reach), 1);
  const x = (i) => (i / (rows.length - 1)) * W;
  const y = (v) => H - 6 - (v / max) * (H - 16);
  const pts = rows.map((r, i) => [x(i), y(r.reach)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const peak = rows.reduce((a, r, i) => r.reach > rows[a].reach ? i : a, 0);
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Охват по дням">
    <path d="${line} L${W} ${H} L0 ${H} Z" fill="var(--accent-wash)"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
    <line id="rg" x1="0" x2="0" y1="0" y2="${H}" stroke="var(--muted)" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0"/>
  </svg>`;
  const svg = box.querySelector('svg');
  const onMove = (e) => {
    const r = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(rows.length - 1, Math.round(((e.clientX - r.left) / r.width) * (rows.length - 1))));
    const gx = x(i);
    const g = svg.querySelector('#rg'); g.setAttribute('x1', gx); g.setAttribute('x2', gx); g.setAttribute('opacity', 1);
    showTip(r.left + (gx / W) * r.width, r.top + (pts[i][1] / H) * r.height, `${dayLabel(rows[i].date)} · охват <b>${fmt(rows[i].reach)}</b>`);
  };
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerleave', () => { hideTip(); svg.querySelector('#rg').setAttribute('opacity', 0); });
  void peak;
}

function renderTiles(d) {
  const t = d.totals30 || {};
  const tiles = [
    ['Охват', compact(t.reach), 'уникальных аккаунтов увидели контент'],
    ['Просмотры', compact(t.views), 'всего показов профиля и рилсов'],
    ['Часы просмотра', t.watchHours == null ? '-' : dec1(t.watchHours), 'суммарно по рилсам за 30 дней'],
    ['Средний досмотр', t.avgWatchSec == null ? '-' : dec1(t.avgWatchSec) + ' с', 'столько в среднем смотрят один рилс'],
    ['Визиты профиля', compact(t.profile), 'зашли посмотреть профиль'],
    ['Подписчики с рилсов', t.followsFromReels == null ? '-' : '≈ ' + fmt(t.followsFromReels), 'оценка по рилсам за 30 дней'],
  ];
  $('tiles').innerHTML = tiles.map(([k, v, dsc]) => `<div class="card tile"><div class="k">${k}</div><div class="v num">${v}</div><div class="d">${dsc}</div></div>`).join('');
}

const DAY_METRICS = [['reach', 'Охват'], ['views', 'Просмотры'], ['profile', 'Профиль'], ['follows', 'Подписки']];

function renderDayTabs() {
  $('dayTabs').innerHTML = DAY_METRICS.map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${k === dayMetric}">${l}</button>`).join('');
  $('dayTabs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; dayMetric = b.dataset.k; renderDayTabs(); renderDayChart(DATA); };
}

function renderDayChart(d) {
  const rows = last30(d);
  const label = DAY_METRICS.find(([k]) => k === dayMetric)[1];
  const vals = rows.map((r) => r[dayMetric]);
  const box = $('dayChart');
  if (!vals.some((v) => v != null)) {
    box.innerHTML = `<p class="empty" style="padding:24px 6px">${dayMetric === 'follows' ? 'Instagram отдаёт подписки по дням только аккаунтам от 100 подписчиков.' : 'Данные появятся после первого полного сбора.'}</p>`;
    return;
  }
  const total = vals.reduce((a, v) => a + (v || 0), 0);
  const W = Math.max(320, Math.round(box.clientWidth - 28) || 1000), H = 240, padL = 44, padB = 26, padT = 10;
  const max = Math.max(...vals.map((v) => v || 0), 1);
  const step = niceStep(max / 4); const top = Math.ceil(max / step) * step;
  const bw = (W - padL) / rows.length;
  const barW = Math.min(24, bw - 2);
  const y = (v) => padT + (H - padT - padB) * (1 - v / top);
  let grid = '';
  for (let v = 0; v <= top + 1e-9; v += step) {
    grid += `<line x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/>
      <text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="var(--muted)">${compact(v)}</text>`;
  }
  let bars = '';
  rows.forEach((r, i) => {
    const v = r[dayMetric] || 0;
    const cx = padL + bw * i + bw / 2;
    const h = Math.max(0, y(0) - y(v));
    const rad = Math.min(4, h, barW / 2);
    const x0 = cx - barW / 2, y0 = y(v);
    const path = h > 0 ? `M${x0} ${y(0)} V${y0 + rad} Q${x0} ${y0} ${x0 + rad} ${y0} H${x0 + barW - rad} Q${x0 + barW} ${y0} ${x0 + barW} ${y0 + rad} V${y(0)} Z` : '';
    bars += `<g data-i="${i}"><rect x="${padL + bw * i}" y="${padT}" width="${bw}" height="${H - padT - padB}" fill="transparent"/>${path ? `<path d="${path}" fill="var(--accent)"/>` : ''}</g>`;
    if (i % (W < 600 ? 7 : 5) === 0) bars += `<text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="12" fill="var(--muted)">${dayLabel(r.date)}</text>`;
  });
  box.innerHTML = `<div class="sum">${label} за ${rows.length} дн.: <b class="num">${fmt(total)}</b></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} по дням">${grid}${bars}</svg>`;
  const svg = box.querySelector('svg');
  svg.addEventListener('pointermove', (e) => {
    const g = e.target.closest('g[data-i]'); if (!g) return hideTip();
    const i = +g.dataset.i; const r = svg.getBoundingClientRect();
    const cx = padL + bw * i + bw / 2; const v = rows[i][dayMetric];
    showTip(r.left + (cx / W) * r.width, r.top + (y(v || 0) / H) * r.height, `${dayLabel(rows[i].date)} · ${label.toLowerCase()} <b>${fmt(v)}</b>`);
  });
  svg.addEventListener('pointerleave', hideTip);
}

function niceStep(x) {
  if (x <= 1) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const REEL_SORTS = [['new', 'Новые'], ['views', 'Просмотры'], ['follows', 'Подписчики']];

function renderReelTabs() {
  $('reelTabs').innerHTML = REEL_SORTS.map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${k === reelSort}">${l}</button>`).join('');
  $('reelTabs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; reelSort = b.dataset.k; renderReelTabs(); renderReels(DATA); };
}

function renderReels(d) {
  const reels = [...(d.reels || [])];
  if (!reels.length) { $('reels').innerHTML = '<p class="empty">Рилсов пока нет.</p>'; return; }
  if (reelSort === 'views') reels.sort((a, b) => (b.views || 0) - (a.views || 0));
  if (reelSort === 'follows') reels.sort((a, b) => (b.estFollows || 0) - (a.estFollows || 0));
  $('reels').innerHTML = reels.map((r) => {
    const cap = (r.caption || '').split('\n')[0] || 'Без подписи';
    return `<button type="button" class="card reel" data-id="${esc(r.id)}">
      <div class="th" data-bg="${esc(r.thumb || '')}"><span class="badge num">${compact(r.views)} просм.</span></div>
      <div class="meta"><div class="cap">${esc(cap)}</div>${dateRu(r.timestamp)} · ≈ ${fmt(r.estFollows)} подп.</div>
    </button>`;
  }).join('');
  setBg($('reels'));
  $('reels').onclick = (e) => { const b = e.target.closest('.reel'); if (b) openReel(b.dataset.id); };
}

function per1000(a, views) { return views ? dec1((a || 0) / views * 1000) : '-'; }

function openReel(id) {
  const r = DATA.reels.find((x) => x.id === id); if (!r) return;
  const link = safeLink(r.permalink);
  $('dlg').innerHTML = `<div class="dlg">
    <div class="th" data-bg="${esc(r.thumb || '')}"></div>
    <div class="body">
      <h3 class="num">${fmt(r.views)}</h3>
      <div class="date">просмотров · ${dateRu(r.timestamp, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div class="kv num">
        <span>Лайки</span><span>${fmt(r.likes)}</span>
        <span>Комментарии</span><span>${fmt(r.comments)}</span>
        <span>Репосты</span><span>${fmt(r.shares)}</span>
        <span>Сохранения</span><span>${fmt(r.saved)}</span>
        <span>Охват</span><span>${fmt(r.reach)}</span>
        <div class="sep"></div>
        <span>Средний досмотр</span><span>${r.avgWatchSec == null ? '-' : dec1(r.avgWatchSec) + ' с'}</span>
        <span>Часы просмотра</span><span>${r.watchHours == null ? '-' : dec1(r.watchHours)}</span>
        <div class="sep"></div>
        <span>Подписались ≈</span><span>${fmt(r.estFollows)}</span>
        <span>Подписок на 1000 просмотров</span><span>${per1000(r.estFollows, r.views)}</span>
        <span>Репостов на 1000</span><span>${per1000(r.shares, r.views)}</span>
        <span>Сохранений на 1000</span><span>${per1000(r.saved, r.views)}</span>
      </div>
      <div class="actions">
        ${link ? `<a class="btn primary" href="${esc(link)}" target="_blank" rel="noopener">Смотреть в Instagram</a>` : ''}
        <button class="btn" type="button" id="dlgClose">Закрыть</button>
      </div>
    </div></div>`;
  setBg($('dlg'));
  $('dlgClose').onclick = () => $('dlg').close();
  $('dlg').showModal();
}
$('dlg').addEventListener('click', (e) => { if (e.target === $('dlg')) $('dlg').close(); });

const regionNames = (() => { try { return new Intl.DisplayNames(['ru'], { type: 'region' }); } catch { return null; } })();
const GENDER = { F: 'Женщины', M: 'Мужчины', U: 'Не указан' };

function renderAudience(d) {
  const a = d.audience || {};
  const blocks = [
    ['city', 'Города', (k) => (k || '').split(',')[0]],
    ['age', 'Возраст', (k) => k],
    ['country', 'Страны', (k) => (regionNames && k ? regionNames.of(k) : k)],
    ['gender', 'Пол', (k) => GENDER[k] || k],
  ];
  $('aud').innerHTML = blocks.map(([key, title, name]) => {
    const rows = a[key] || [];
    if (!rows.length) return `<div class="card"><h3>${title}</h3><p class="empty">Instagram показывает аудиторию, когда подписчиков больше 100.</p></div>`;
    const sum = rows.reduce((s, r) => s + r[1], 0) || 1;
    let list = rows;
    if (key === 'age') list = [...rows].sort((x, y) => String(x[0]).localeCompare(String(y[0])));
    else list = rows.slice(0, 6);
    const max = Math.max(...list.map((r) => r[1]));
    return `<div class="card"><h3>${title}</h3>${list.map(([k, v]) => {
      const pct = Math.round((v / sum) * 100);
      return `<div class="bar"><span class="l">${esc(name(k))}</span><span class="p num">${pct}%</span><div class="track"><div class="fill" style="width:${(v / max) * 100}%"></div></div></div>`;
    }).join('')}</div>`;
  }).join('');
}

function render(d) {
  DATA = d;
  renderHeader(d); renderRidge(d); renderTiles(d);
  renderDayTabs(); renderDayChart(d);
  renderReelTabs(); renderReels(d);
  renderAudience(d);
  $('foot').dataset.base ||= $('foot').textContent;
  $('foot').textContent = $('foot').dataset.base;
  if (d.totals30?.trackingSince) {
    $('foot').textContent += ` Слежу с ${dateRu(d.totals30.trackingSince, { day: 'numeric', month: 'long', year: 'numeric' })}. Последнее обновление - ${ago(d.updatedAt)}.`;
  }
}

async function load(first) {
  try {
    const bust = DATA_URL.startsWith('http') ? (DATA_URL.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now() / 60000) : '';
    const res = await fetch(DATA_URL + bust, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const d = await res.json();
    if (!DATA || d.updatedAt !== DATA.updatedAt) render(d);
    else $('status').textContent = 'обновлено ' + ago(d.updatedAt);
  } catch (e) {
    if (first) { $('status').textContent = 'данные ещё не собраны'; $('reels').innerHTML = '<p class="empty">Как только сборщик отработает первый раз, здесь появится статистика.</p>'; renderAudience({}); }
  }
}
load(true);
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => DATA && renderDayChart(DATA), 150); });
setInterval(() => load(false), 2 * 60 * 1000);
