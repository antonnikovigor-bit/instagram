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
      setTimeout(() => { mCap.innerHTML = 'час в день -<br>для себя'; mCap.classList.remove('fade'); }, 300);
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
  // Встраивание рилса работает только на своём домене; в превью - карточка со ссылкой на ролик.
  const own = /(^|\.)igorantonnikov\.com$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
  if (code && own) {
    const f = document.createElement('iframe');
    f.src = `https://www.instagram.com/reel/${code}/embed`; f.loading = 'lazy'; f.title = 'Путь к 10 000 подписчиков'; f.allow = 'encrypted-media';
    box.append(f); return;
  }
  const ph = document.createElement('div'); ph.className = 'reel-ph';
  const b = document.createElement('b'); b.textContent = 'Путь к 10 000 подписчиков';
  const a = document.createElement('a'); a.textContent = 'Смотреть в Instagram'; a.target = '_blank'; a.rel = 'noopener';
  ph.append(b, a); box.append(ph);
  if (code) { a.href = `https://www.instagram.com/reel/${code}/`; return; }
  a.href = (document.getElementById('who') || {}).href || 'https://www.instagram.com/';
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

// Видео-сцены: уважать «уменьшить движение».
(() => {
  if (!window.matchMedia || !matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.scene video').forEach(v => { v.removeAttribute('autoplay'); v.pause(); });
})();

// Фон первого экрана: сменяющиеся видео (рассвет, пробежка, медитация, чтение).
(() => {
  const box = document.getElementById('heroVids');
  if (!box) return;
  const vids = [...box.querySelectorAll('video')];
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { vids.forEach(v => { v.removeAttribute('autoplay'); v.pause(); }); return; }
  const load = v => { if (!v.getAttribute('src')) { v.preload = 'auto'; v.src = v.dataset.src; v.load(); } };
  let i = 0;
  const show = n => {
    const v = vids[n]; load(v);
    const go = () => { vids.forEach(x => x !== v && x.classList.remove('on')); v.classList.add('on'); v.currentTime = 0; v.play().catch(() => {}); box.parentElement.classList.add('has-vid'); load(vids[(n + 1) % vids.length]); };
    if (v.readyState >= 3) go(); else v.addEventListener('canplay', go, { once: true });
  };
  show(0);
  setInterval(() => { i = (i + 1) % vids.length; show(i); }, 6500);
})();

// Заголовок: достижения сменяют друг друга, последним - 10 000 подписчиков (число накручивается), дальше по кругу.
(() => {
  const slot = document.getElementById('heroSlot');
  if (!slot) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const IC = {fin: '<path d="M2 19c2 0 3-1.5 5-1.5s3 1.5 5 1.5 3-1.5 5-1.5 3 1.5 5 1.5"/><path d="M7 15.5C8 10 11 6 17 5c-1.5 3-1.5 7 .5 10.5"/>', bridge: '<path d="M2 13h20M6 13V5M18 13V5M6 5c2 5 10 5 12 0"/><path d="M2 19c2 0 3-1.5 5-1.5s3 1.5 5 1.5 3-1.5 5-1.5 3 1.5 5 1.5"/>', peaks: '<path d="M2 20 9 8l4 6 3-4 6 10z"/><path d="m7.2 11 1.8 1.5 1.6-1.6"/>', book: '<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>', lotus: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7.5v5M12 9l-4 4 2.5 1.2M12 9l4 4-2.5 1.2M4.5 17.5c2-1.6 4.6-2.2 7.5-2.2s5.5.6 7.5 2.2c-2 1.4-4.6 2-7.5 2s-5.5-.6-7.5-2z"/>', chute: '<path d="M3 11a9 7 0 0 1 18 0zM3 11l9 7 9-7M12 11v7"/><rect x="10.5" y="18" width="3" height="3" rx="1"/>', flip: '<path d="M4.5 9.5a8 8 0 0 1 15 0"/><path d="M20.5 5.5l-1 4-4-1"/><circle cx="12" cy="19.5" r="1.8"/><path d="M12 17.5v-5.5M12 12l-3-4.5M12 12l3-4.5M12 15.5l-3 1.8M12 15.5l3 1.8"/>', palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.2-1-1.5-1-2.6 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>', ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6" fill="currentColor"/>'};
  const MDOT = '<svg class="hh-logo hh-mdot" viewBox="150 4 428 592" aria-label="IRONMAN"><circle cx="363" cy="122" r="113"/><path d="M156 245H571V592H444V535L408 592H320L284 535V592H156z"/></svg>';
  const PIC = (n, a) => '<img class="hh-logo hh-pic" src="img/icon-' + n + '.png" alt="' + a + '">';
  const OCEAN = '<img class="hh-logo hh-ocean" src="img/logo-oceanman.png" alt="OCEANMAN">';
  const ic = k => '<svg class="hh-ic" viewBox="0 0 24 24" aria-hidden="true">' + IC[k] + '</svg>';
  const ITEMS = ['Пройти IRON<span class="im">M</span>AN ' + MDOT, 'Проплыть OCEANMAN ' + OCEAN, 'Переплыть Босфор ' + ic('bridge'), 'Полюбить горы ' + ic('peaks'), 'Читать каждый день ' + ic('book'), 'Медитировать ' + PIC('meditation', 'Медитация'), 'Прыгнуть с парашютом ' + PIC('chute', 'Парашют'), 'Научиться делать сальто ' + PIC('flip', 'Сальто'), 'Обрести хобби <img class="hh-logo hh-pic hh-hobby" src="img/hobby-guitar.png" alt="Хобби">', null];
  const HOB = ['guitar', 'easel', 'chess', 'fishing', 'cooking', 'plants'].map(n => 'img/hobby-' + n + '.png');
  HOB.concat(['img/icon-meditation.png', 'img/icon-flip.png', 'img/icon-chute.png']).forEach(u => { new Image().src = u; });
  const cycle = img => { let k = 0; const t = setInterval(() => { k++; if (k >= HOB.length) return clearInterval(t); img.src = HOB[k]; }, 400); };
  const fmt = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  let cur = slot.firstElementChild, i = 0;
  const swap = html => {
    const el = document.createElement('span'); el.className = 'hh-item pre'; el.innerHTML = html;
    slot.appendChild(el); el.getBoundingClientRect();
    el.classList.remove('pre'); cur.classList.add('out');
    const old = cur; setTimeout(() => old.remove(), 500); cur = el; return el;
  };
  const roll = n => { const T = 1400, t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / T), e = 1 - Math.pow(1 - k, 3);
      n.textContent = fmt(Math.round(10000 * e / 10) * 10); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step); };
  const next = () => {
    i = (i + 1) % ITEMS.length;
    if (ITEMS[i] === null) { const el = swap('<b class="num">0</b> подписчиков ' + ic('ig')); roll(el.querySelector('b')); setTimeout(next, 4000); return; }
    const el = swap(ITEMS[i]); const h = el.querySelector('.hh-hobby');
    if (h) { cycle(h); setTimeout(next, 400 * HOB.length + 300); return; }
    setTimeout(next, 1700);
  };
  setTimeout(next, 1700);
})();
