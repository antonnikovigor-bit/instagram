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
// Ссылки вида /reel/ID/ Instagram без входа теряет и уводит в ленту. /p/ID/ открывает именно этот рилс.
const reelLink = (u) => { const l = safeLink(u); return l ? l.replace(/\/reels?\/([\w-]+)/, '/p/$1') : ''; };
const setBg = (root) => root.querySelectorAll('[data-bg]').forEach((el) => {
  const u = safeImg(el.dataset.bg);
  if (u) el.style.backgroundImage = `url("${u.replace(/["\\\n\r]/g, encodeURIComponent)}")`;
});

const tip = $('tip');
const showTip = (x, y, html) => { tip.innerHTML = html; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.add('on'); };
const hideTip = () => tip.classList.remove('on');

let DATA = null;
// Цель и эксперимент
const GOAL_FROM = 3600, GOAL_TO = 10000, GOAL_MARKS = [5000, 7500];
const EXP_START = '2026-09-27', EXP_DAYS = 90;
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
  // Прирост считаем от стартовой цифры эксперимента: API-сумма «за 30 дней» отстаёт на 1-2 дня и не совпадает с реальным ростом
  const g = p.followers - GOAL_FROM;
  $('gain').textContent = `${g >= 0 ? '+' : ''}${fmt(g)} с начала эксперимента`;
  renderGoal(p.followers, d);
  const fresh = Date.now() - Date.parse(d.updatedAt) < 60 * 60 * 1000;
  $('dot').classList.toggle('off', !fresh);
  $('status').textContent = 'обновлено ' + ago(d.updatedAt);
}


function renderGoal(f, d) {
  const span = GOAL_TO - GOAL_FROM;
  const pos = (v) => Math.max(0, Math.min(100, ((v - GOAL_FROM) / span) * 100));
  const pct = Math.round(pos(f));
  $('goal').innerHTML = `<div class="track"><div class="fill" style="width:${pos(f)}%"></div>${GOAL_MARKS.map((m) => `<i class="tick" style="left:${pos(m)}%"></i>`).join('')}</div>
    <div class="lbl num"><span style="left:0">${fmt(GOAL_FROM)}</span>${GOAL_MARKS.map((m) => `<span style="left:${pos(m)}%">${fmt(m)}</span>`).join('')}<span style="left:100%">${fmt(GOAL_TO)}</span></div>
    <div class="sum">Пройдено <b class="num">${pct}%</b> пути · осталось <b class="num">${fmt(Math.max(0, GOAL_TO - f))}</b></div>`;
  const start = new Date(EXP_START + 'T00:00:00+05:00');
  const day = Math.max(1, Math.floor((Date.now() - start) / 86400000) + 1);
  const n = (d.reels || []).filter((r) => new Date(r.timestamp) >= start).length;
  $('exp').innerHTML = `День <b>${Math.min(day, EXP_DAYS)}</b> из ${EXP_DAYS} · рилсов с начала эксперимента: <b>${n}</b>`;
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
  const reelDays = {};
  for (const r of d.reels || []) { const k = new Date(r.timestamp).toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' }); (reelDays[k] ||= []).push(r); }
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Охват по дням">
    <path d="${line} L${W} ${H} L0 ${H} Z" fill="var(--accent-wash)"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
    <line id="rg" x1="0" x2="0" y1="0" y2="${H}" stroke="var(--muted)" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0"/>
    ${rows.map((r, i) => reelDays[r.date] ? `<line x1="${x(i)}" x2="${x(i)}" y1="${pts[i][1]}" y2="${H}" stroke="var(--good)" stroke-width="1" vector-effect="non-scaling-stroke" opacity=".6"/>` : '').join('')}
  </svg>
  <div class="rmarks">${rows.map((r, i) => reelDays[r.date] ? `<i style="left:${(x(i) / W) * 100}%;top:${(pts[i][1] / H) * 100}%"></i>` : '').join('')}</div>`;
  const svg = box.querySelector('svg');
  const onMove = (e) => {
    const r = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(rows.length - 1, Math.round(((e.clientX - r.left) / r.width) * (rows.length - 1))));
    const gx = x(i);
    const g = svg.querySelector('#rg'); g.setAttribute('x1', gx); g.setAttribute('x2', gx); g.setAttribute('opacity', 1);
    const rd = reelDays[rows[i].date];
    const cap = rd ? rd.map((x) => '<br>🎬 ' + esc(((x.caption || '').split('\n')[0] || 'Рилс').slice(0, 40))).join('') : '';
    showTip(r.left + (gx / W) * r.width, r.top + (pts[i][1] / H) * r.height, `${dayLabel(rows[i].date)} · охват <b>${fmt(rows[i].reach)}</b>${cap}`);
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
  if (reelSort === 'follows') reels.sort((a, b) => ((b.follows ?? b.estFollows) || 0) - ((a.follows ?? a.estFollows) || 0));
  $('reels').innerHTML = reels.map((r) => {
    const cap = (r.caption || '').split('\n')[0] || 'Без подписи';
    return `<button type="button" class="card reel" data-id="${esc(r.id)}">
      <div class="th" data-bg="${esc(r.thumb || '')}"><span class="badge num">${compact(r.views)} просм.</span></div>
      <div class="meta"><div class="cap">${esc(cap)}</div>${dateRu(r.timestamp)} · ${r.follows == null ? '≈ ' : ''}${fmt(r.follows ?? r.estFollows)} подп.</div>
    </button>`;
  }).join('');
  setBg($('reels'));
  $('reels').onclick = (e) => { const b = e.target.closest('.reel'); if (b) openReel(b.dataset.id); };
}

function per1000(a, views) { return views ? dec1((a || 0) / views * 1000) : '-'; }


// Сравнение рилса с обычным (медиана по всем рилсам): что именно у него выше или ниже
function median(a) { const s = a.filter((v) => v != null && isFinite(v)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function compareHtml(r) {
  const all = DATA.reels || [];
  if (all.length < 4) return '';
  const k = (x) => (x.views ? 1000 / x.views : null);
  const rows = [
    ['Просмотры', (x) => x.views],
    ['Досмотр', (x) => x.watchPct ?? x.avgWatchSec],
    ['Удержали с первых секунд', (x) => (x.skipRate != null ? 100 - x.skipRate : null)],
    ['Репосты на 1000', (x) => (k(x) && x.shares != null ? x.shares * k(x) : null)],
    ['Сохранения на 1000', (x) => (k(x) && x.saved != null ? x.saved * k(x) : null)],
    ['Подписки на 1000', (x) => (k(x) ? (x.follows ?? x.estFollows ?? 0) * k(x) : null)],
  ].map(([name, f]) => {
    const v = f(r), m = median(all.map(f));
    if (v == null || !m || m < 0.5) return '';
    if (v === 0) return `<span>${name}</span><span class="down">нет</span>`;
    const ratio = v / m;
    const cls = ratio >= 1.15 ? 'up' : ratio <= 0.85 ? 'down' : '';
    const txt = ratio >= 1.15 ? 'выше в ' + dec1(ratio) + ' раза' : ratio <= 0.85 ? 'ниже на ' + Math.round((1 - ratio) * 100) + '%' : 'как обычно';
    return `<span>${name}</span><span class="${cls}">${txt}</span>`;
  }).join('');
  return rows ? `<div class="cmp"><h4>По сравнению с обычным рилсом</h4><div class="kv num">${rows}</div></div>` : '';
}


// Эффект рилса по точным дневным цифрам аккаунта (подписки и визиты профиля по дням отдаёт API):
// сумма за день выхода и 2 следующих дня минус обычный уровень, делённая между рилсами этого окна по просмотрам.
function reelEffect(r) {
  const daily = DATA.daily || [];
  if (daily.length < 7) return null;
  const key = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
  const d0 = key(r.timestamp);
  const idx = daily.findIndex((x) => x.date === d0);
  if (idx < 0) return null;
  const win = daily.slice(idx, idx + 3);
  const base = (f) => median(daily.map(f)) || 0;
  const res = {};
  for (const [name, f] of [['follows', (x) => x.follows], ['profile', (x) => x.profile]]) {
    const vals = win.map(f).filter((v) => v != null);
    if (!vals.length) continue;
    const total = vals.reduce((s, v) => s + v, 0);
    const extra = Math.max(0, total - base(f) * vals.length);
    // рилсы, чьи окна пересекаются с этим, делят прирост по просмотрам
    const peers = (DATA.reels || []).filter((x) => { const i = daily.findIndex((y) => y.date === key(x.timestamp)); return i >= 0 && Math.abs(i - idx) <= 2; });
    const vSum = peers.reduce((s, x) => s + (x.views || 0), 0) || 1;
    res[name] = { total, days: vals.length, usual: Math.round(base(f) * vals.length), share: Math.round(extra * ((r.views || 0) / vSum)) };
  }
  return Object.keys(res).length ? res : null;
}
function effectHtml(r) {
  const e = reelEffect(r);
  if (!e) return '';
  const row = (lbl, x) => x ? `<span>${lbl}</span><span>${fmt(x.total)} <span class="down">(обычно ${fmt(x.usual)})</span></span>` : '';
  const shareRow = (lbl, x) => x && x.share > 0 ? `<span>${lbl}</span><span class="up">+${fmt(x.share)}</span>` : '';
  return `<div class="cmp"><h4>За 3 дня после выхода (весь аккаунт)</h4><div class="kv num">
    ${row('Новые подписки', e.follows)}${row('Визиты профиля', e.profile)}
    ${shareRow('Сверх обычного - от этого рилса', e.follows)}${shareRow('Визитов профиля сверх обычного', e.profile)}
  </div></div>`;
}

function openReel(id) {
  const r = DATA.reels.find((x) => x.id === id); if (!r) return;
  const link = reelLink(r.permalink);
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
        <span>Длительность</span><span>${r.durationSec == null ? '-' : dec1(r.durationSec) + ' с'}</span>
        <span>Средний досмотр</span><span>${r.avgWatchSec == null ? '-' : dec1(r.avgWatchSec) + ' с'}${r.watchPct == null ? '' : ' · ' + r.watchPct + '%'}</span>
        ${r.skipRate == null ? '' : `<span>Досмотрели дольше 3 секунд</span><span>${Math.round(100 - r.skipRate)}%</span>`}
        ${r.over3s == null ? '' : `<span>Смотрели дольше 3 секунд</span><span>${r.over3s}%</span>`}
        <span>Часы просмотра</span><span>${r.watchHours == null ? '-' : dec1(r.watchHours)}</span>
        <div class="sep"></div>
        ${r.profileVisits == null ? '' : `<span>Зашли в профиль</span><span>${fmt(r.profileVisits)}</span>`}
        <span>Подписались${r.follows == null ? ' ≈' : ''}</span><span>${fmt(r.follows ?? r.estFollows)}</span>
        <span>Подписок на 1000 просмотров</span><span>${per1000(r.follows ?? r.estFollows, r.views)}</span>
        <span>Репостов на 1000</span><span>${per1000(r.shares, r.views)}</span>
        <span>Сохранений на 1000</span><span>${per1000(r.saved, r.views)}</span>
      </div>
      ${effectHtml(r)}
      ${compareHtml(r)}
      ${r.manual ? '<p class="method" style="margin:10px 0 0">Подписки, визиты профиля и удержание - из статистики приложения Instagram.</p>' : ''}
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

// Цифры из приложения Instagram, которых нет в API (подписки и визиты профиля с рилса, удержание).
// Если рилс продвигался, API отдаёт только органику: views, likes, comments, shares, saved, reach, follows можно задать вручную.
// Хранятся в manual.json в репозитории, ключ - код рилса из ссылки (instagram.com/reel/КОД/).
let MANUAL = {};
const shortcode = (u) => ((u || '').match(/\/(?:reels?|p)\/([\w-]+)/) || [])[1] || '';
const loadManual = () => fetch('manual.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).then((m) => { MANUAL = m && typeof m === 'object' ? m : {}; }).catch(() => {});
function applyManual(d) {
  for (const r of d.reels || []) {
    const m = MANUAL[shortcode(r.permalink)];
    if (!m) continue;
    r.manual = true;
    if (Number.isFinite(m.views)) { r.apiViews = r.views; r.views = m.views; }
    for (const k of ['likes', 'comments', 'shares', 'saved', 'reach', 'follows']) if (Number.isFinite(m[k])) r[k] = m[k];
    if (Number.isFinite(m.profileVisits)) r.profileVisits = m.profileVisits;
    if (Number.isFinite(m.over3s)) r.over3s = m.over3s;
  }
}

async function load(first) {
  try {
    const bust = DATA_URL.startsWith('http') ? (DATA_URL.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now() / 60000) : '';
    const res = await fetch(DATA_URL + bust, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const d = await res.json();
    if (first) await loadManual();
    applyManual(d);
    if (!DATA || d.updatedAt !== DATA.updatedAt) render(d);
    else $('status').textContent = 'обновлено ' + ago(d.updatedAt);
  } catch (e) {
    if (first) { $('status').textContent = 'данные ещё не собраны'; $('reels').innerHTML = '<p class="empty">Как только сборщик отработает первый раз, здесь появится статистика.</p>'; renderAudience({}); }
  }
}
load(true);
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => DATA && renderDayChart(DATA), 150); });
setInterval(() => load(false), 2 * 60 * 1000);

// Медленная сеть: экономия трафика, 2G/3G или канал меньше 1,5 Мбит/с - видео не грузим, остаётся лёгкая обложка
const SLOW_NET = (() => {
  const c = navigator.connection;
  if (!c) return false;
  return !!c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType || '') || (c.downlink > 0 && c.downlink < 1.5);
})();

// Фоновые видео: файл подключается только когда блок рядом с экраном; на телефоне - облегчённая версия.
// Если ролик не начал играть за 6 с - загрузку бросаем, остаётся обложка.
(() => {
  const vids = [...document.querySelectorAll('video[data-autoplay]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!vids.length || reduce || SLOW_NET || !('IntersectionObserver' in window)) return;
  const small = matchMedia('(max-width: 760px)').matches;
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    const v = e.target;
    if (v.dataset.dead) return;
    if (e.isIntersecting) {
      if (!v.getAttribute('src')) {
        v.src = (small && v.dataset.srcSm) || v.dataset.src;
        v.preload = 'auto';
        const giveUp = setTimeout(() => { if (v.readyState >= 3) return; v.dataset.dead = '1'; v.pause(); v.removeAttribute('src'); v.load(); io.unobserve(v); }, 6000);
        v.addEventListener('playing', () => clearTimeout(giveUp), { once: true });
      }
      v.play().catch(() => {});
    } else v.pause();
  }), { rootMargin: '200px 0px' });
  vids.forEach((v) => io.observe(v));
})();

// Фрагменты официальных видео с YouTube (встраивание, не копирование). Пока YouTube не заиграл - виден свой ролик-заглушка.
(() => {
  const bands = [...document.querySelectorAll('[data-yt]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!bands.length || reduce || SLOW_NET || !('IntersectionObserver' in window)) return;
  let apiReady = null;
  const loadApi = () => apiReady || (apiReady = new Promise((res) => {
    window.onYouTubeIframeAPIReady = res;
    const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(sc);
  }));
  const start = async (band) => {
    await loadApi();
    const id = band.dataset.yt; const s = +band.dataset.ytStart; const e = +band.dataset.ytEnd;
    if (!/^[\w-]{11}$/.test(id)) return;
    const box = document.createElement('div'); box.className = 'yt'; box.setAttribute('aria-hidden', 'true');
    const holder = document.createElement('div'); box.appendChild(holder);
    band.insertBefore(box, band.firstChild);
    const player = new YT.Player(holder, {
      host: 'https://www.youtube-nocookie.com', videoId: id,
      playerVars: { autoplay: 1, mute: 1, controls: 0, start: s, end: e, playsinline: 1, rel: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, origin: location.origin },
      events: {
        onReady: (ev) => { ev.target.mute(); ev.target.playVideo(); },
        onStateChange: (ev) => {
          if (ev.data === YT.PlayerState.PLAYING) box.classList.add('on');
          if (ev.data === YT.PlayerState.ENDED) { ev.target.seekTo(s, true); ev.target.playVideo(); }
        },
        onError: () => box.remove(),
      },
    });
    setInterval(() => { try { if (player.getCurrentTime && player.getCurrentTime() >= e - 0.4) player.seekTo(s, true); } catch {} }, 250);
  };
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting && !en.target.dataset.ytOn) { en.target.dataset.ytOn = '1'; start(en.target); }
  }), { rootMargin: '300px 0px' });
  bands.forEach((b) => io.observe(b));
})();
