// «Из 10 000 - в 1 час»: счётчик подписчиков превращается в «1 час», отсчёт до закрытия набора,
// день потока и полоса из 30 дней. Время - Алматы (UTC+5).
(() => {
  const START = Date.parse('2026-11-30T00:00:00+05:00');
  const CLOSE = Date.parse('2026-11-29T21:00:00+05:00'); // конец вступления
  const DAYS = 30;
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const nf = new Intl.NumberFormat('ru-RU');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Счётчик: подписчики -> 1 час. Число берём из #followers, которое заполняет app.js.
  const mN = $('morphN'), mCap = $('morphCap'), src = $('followers');
  let morphed = false;
  function morph(from) {
    if (morphed || !mN) return; morphed = true;
    mN.textContent = nf.format(from);
    const finish = () => {
      mN.textContent = '1'; mN.parentElement.classList.add('done');
      mCap.classList.add('fade');
      setTimeout(() => { mCap.innerHTML = 'час в день -<br>прошу у каждого из вас'; mCap.classList.remove('fade'); }, 300);
    };
    if (reduce) { setTimeout(finish, 1200); return; }
    setTimeout(() => {
      const t0 = performance.now(), dur = 2200;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        const v = Math.max(1, Math.round(from - (from - 1) * e));
        mN.textContent = nf.format(v);
        if (k < 1) requestAnimationFrame(step); else finish();
      };
      requestAnimationFrame(step);
    }, 1800);
  }
  const readSrc = () => { const v = parseInt((src && src.textContent || '').replace(/\D/g, ''), 10); return v > 0 ? v : 0; };
  if (src) {
    const go = () => { const v = readSrc(); if (v) { morph(v); return true; } return false; };
    if (!go()) {
      const mo = new MutationObserver(() => { if (go()) mo.disconnect(); });
      mo.observe(src, { childList: true, characterData: true, subtree: true });
      setTimeout(() => { mo.disconnect(); morph(10000); }, 6000); // данные не пришли - анимируем от 10 000
    }
  }

  // 2. Отсчёт, полоса дней, кнопки
  const box = $('chalDays'), st = $('chalStatus'), heroCd = $('heroCd'), heroClose = $('heroClose'), lastSub = $('lastSub');
  const btns = document.querySelectorAll('.js-chal-btn');
  const later = () => {
    btns.forEach((b) => { b.firstChild.textContent = 'Хочу в следующий поток '; });
    const n = $('chalNote'); if (n) n.textContent = 'Оставь контакт - напишем, когда откроем набор.';
  };
  const big = (cap, val, unit) => { if (!st) return; st.hidden = false; st.innerHTML = ''; const c = document.createElement('span'); c.className = 'cap'; c.textContent = cap;
    const u = document.createElement('div'); u.className = 'u'; const b = document.createElement('b'); b.className = 'num'; b.textContent = val;
    const s = document.createElement('span'); s.textContent = unit; u.append(b, s); st.append(c, u); };
  function tick() {
    const now = Date.now();
    const day = Math.floor((now - START) / 864e5) + 1;
    if (box) box.innerHTML = Array.from({ length: DAYS }, (_, i) => `<i class="${day > DAYS || i + 1 < day ? 'on' : i + 1 === day ? 'now' : ''}"></i>`).join('');
    if (now < CLOSE) {
      const left = CLOSE - now;
      if (heroCd) heroCd.textContent = `${pad(Math.floor(left / 864e5))} д : ${pad(Math.floor(left % 864e5 / 36e5))} ч : ${pad(Math.floor(left % 36e5 / 6e4))} м`;
      return true;
    }
    later();
    if (day < 1) { big('Набор закрыт · старт 30 ноября', '00', 'до старта считанные часы'); if (heroClose) heroClose.innerHTML = 'Набор закрыт. <b>Старт 30 ноября</b>'; }
    else if (day <= DAYS) { big('Поток 1 идёт · итоги 30 декабря', pad(day) + ' / ' + DAYS, 'день потока'); if (heroClose) heroClose.innerHTML = 'Поток 1 идёт: <b>день ' + day + ' из ' + DAYS + '</b>'; }
    else { big('Поток 1 завершён', '30 / 30', 'итоги подведены 30 декабря'); if (heroClose) heroClose.innerHTML = '<b>Поток 1 завершён</b>'; }
    if (lastSub) lastSub.textContent = 'Набор в поток 1 закрыт. Оставь контакт - напишем, когда откроем следующий.';
    return false;
  }
  if (tick()) { const t = setInterval(() => { if (!tick()) clearInterval(t); }, 30000); }
})();

// Ролик «Путь к 10 000 подписчиков»: вставь код рилса в data-reel у #storyReel (instagram.com/reel/КОД/).
(() => {
  const box = document.getElementById('storyReel');
  if (!box) return;
  const code = (box.dataset.reel || '').replace(/[^\w-]/g, '');
  if (code) {
    const f = document.createElement('iframe');
    f.src = `https://www.instagram.com/reel/${code}/embed`; f.loading = 'lazy'; f.title = 'Путь к 10 000 подписчиков'; f.allow = 'encrypted-media';
    box.append(f); return;
  }
  const ph = document.createElement('div'); ph.className = 'reel-ph';
  const b = document.createElement('b'); b.textContent = 'Путь к 10 000 подписчиков';
  const a = document.createElement('a'); a.textContent = 'Смотреть в Instagram'; a.target = '_blank'; a.rel = 'noopener';
  a.href = (document.getElementById('who') || {}).href || 'https://www.instagram.com/';
  ph.append(b, a); box.append(ph);
  // ссылка на профиль приходит из данных чуть позже
  setTimeout(() => { const w = document.getElementById('who'); if (w) a.href = w.href; }, 4000);
})();

// Живая трансляция потока (с 30 ноября): цифры из chas-live.json. Пустые значения - блок скрыт.
(() => {
  const box = document.getElementById('liveStrip');
  if (!box) return;
  const START = Date.parse('2026-11-30T00:00:00+05:00'), DAYS = 30;
  const day = Math.floor((Date.now() - START) / 864e5) + 1;
  if (day < 1 || day > DAYS + 1) return;
  const nf = new Intl.NumberFormat('ru-RU');
  const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
  const q = new URLSearchParams(location.search).get('live');
  const url = LOCAL && /^[\w.-]+\.json$/.test(q || '') ? q : 'chas-live.json';
  fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d) return;
    const items = [
      [d.participants, 'участников в потоке'],
      [d.hours, 'часов отдали себе'],
      [d.tasks, 'заданий выполнено'],
      [d.sleep, 'часов сна в среднем'],
    ].filter(([v]) => typeof v === 'number' && v >= 0).slice(0, 3);
    if (!items.length) return;
    box.innerHTML = '';
    const h = document.createElement('div'); h.className = 'lv-h'; h.textContent = 'Прямо сейчас · день ' + Math.min(day, DAYS) + ' из ' + DAYS; box.append(h);
    for (const [v, l] of items) {
      const c = document.createElement('div'); const b = document.createElement('b'); b.textContent = nf.format(v);
      const s = document.createElement('span'); s.textContent = l; c.append(b, s); box.append(c);
    }
    box.hidden = false;
    const hc = document.getElementById('heroClose'); if (hc) hc.hidden = true;
  }).catch(() => {});
})();
