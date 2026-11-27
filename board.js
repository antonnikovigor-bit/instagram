// Табло потока (с 30 ноября): общие цифры дня и баллы десяток внутри ритма.
// Данные - chas-live.json (выгрузка из бота). Нет команд в данных - табло скрыто.
// Балл десятки за день = доля закрывших день (8 из 10 = 0,8), итог = сумма дней, максимум 30.
// При равенстве баллов выше та, у кого больше дней «все в строю»; полное равенство - общее место.
(() => {
  const box = document.getElementById('board');
  if (!box) return;
  const START = Date.parse('2026-11-30T00:00:00+05:00'), DAYS = 30;
  const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
  const q = new URLSearchParams(location.search).get('live');
  const url = LOCAL && /^[\w.-]+\.json$/.test(q || '') ? q : 'chas-live.json';
  const n1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
  const n0 = new Intl.NumberFormat('ru-RU');
  const sum = (a) => a.reduce((x, y) => x + (Number(y) || 0), 0);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d || !Array.isArray(d.teams) || !d.teams.length) return;
    const calcDay = Math.floor((Date.now() - START) / 864e5) + 1;
    const day = Math.max(1, Math.min(DAYS, Number(d.day) || calcDay));
    box.innerHTML = '';

    const h = el('div', 'bd-h', 'Табло потока · день ' + day + ' из ' + DAYS);
    box.append(h);

    // Общие цифры: участники, часы себе, кто встал в 5 и 6, средний сон
    const td = d.today || {};
    const nums = [];
    if (typeof d.participants === 'number') nums.push([n0.format(d.participants), '', 'участников в потоке']);
    if (typeof d.hours === 'number') nums.push([n0.format(d.hours), '', 'часов отдали себе']);
    if (typeof td.up5 === 'number') nums.push([n0.format(td.up5), td.of5 ? ' из ' + td.of5 : '', 'сегодня встали в 5:00']);
    if (typeof td.up6 === 'number') nums.push([n0.format(td.up6), td.of6 ? ' из ' + td.of6 : '', 'сегодня встали в 6:00']);
    if (typeof d.sleep === 'number') nums.push([n1.format(d.sleep), ' ч', 'средний сон за ночь']);
    if (nums.length) {
      const g = el('div', 'bd-n');
      for (const [v, sfx, l] of nums.slice(0, 4)) {
        const c = el('div'); const b = el('b', '', v); if (sfx) b.append(el('small', '', sfx));
        c.append(b, el('span', '', l)); g.append(c);
      }
      box.append(g);
    }

    // Десятки по ритмам
    const order = ['5AM', '6AM', 'MY AM'];
    const groups = order.map((r) => [r, d.teams.filter((t) => t.rhythm === r)]).filter(([, a]) => a.length);
    if (!groups.length) { box.hidden = false; return; }
    const tabs = el('div', 'bd-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Ритм');
    const list = el('ol', 'bd-t');
    const show = (rh) => {
      [...tabs.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.r === rh)));
      const rows = groups.find(([r]) => r === rh)[1].map((t) => {
        const daily = Array.isArray(t.daily) ? t.daily.slice(0, DAYS) : [];
        return { t, daily, score: Math.round(sum(daily) * 10) / 10, allIn: Number(t.allIn) || 0 };
      }).sort((a, b) => b.score - a.score || b.allIn - a.allIn);
      list.innerHTML = '';
      let place = 0, prev = null;
      rows.forEach((r, i) => {
        if (!prev || r.score !== prev.score || r.allIn !== prev.allIn) place = i + 1;
        prev = r;
        const li = el('li', place === 1 ? 'top' : '');
        li.append(el('span', 'pl', String(place)));
        const nm = el('span', 'nm', r.t.name || 'Десятка');
        const tdy = r.t.today || {};
        const meta = [];
        if (typeof tdy.closed === 'number') meta.push('сегодня ' + tdy.closed + ' из ' + (tdy.of || r.t.size || '?'));
        if (r.allIn) meta.push('все в строю: ' + r.allIn);
        if (meta.length) nm.append(el('small', '', meta.join(' · ')));
        li.append(nm);
        const sc = el('span', 'sc', n1.format(r.score));
        const last = r.daily[r.daily.length - 1];
        if (typeof last === 'number') sc.append(el('small', '', '+' + n1.format(last) + ' за день'));
        li.append(sc);
        const bars = el('span', 'bars'); bars.setAttribute('aria-hidden', 'true');
        for (let k = 0; k < DAYS; k++) {
          const v = r.daily[k]; const i2 = el('i', typeof v === 'number' ? 'on' : '');
          if (typeof v === 'number') i2.style.height = Math.max(3, Math.round(v * 22)) + 'px';
          bars.append(i2);
        }
        li.append(bars);
        list.append(li);
      });
    };
    for (const [r] of groups) {
      const b = el('button', '', r); b.type = 'button'; b.dataset.r = r;
      b.addEventListener('click', () => show(r)); tabs.append(b);
    }
    let upd = '';
    const t = d.updatedAt ? new Date(d.updatedAt) : null;
    if (t && !isNaN(t)) upd = ' Обновлено в ' + t.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' }) + '.';
    box.append(tabs, list, el('p', 'bd-note', 'Балл десятки за день = доля тех, кто закрыл день: 8 из 10 = 0,8. Максимум 30. Десятки соревнуются внутри своего ритма.' + upd));
    show(groups[0][0]);
    box.hidden = false;
  }).catch(() => {});
})();
