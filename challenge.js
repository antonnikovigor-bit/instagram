// Блок «30 дней. Час для себя»: статус потока и полоска из 30 дней. Время - Алматы (UTC+5).
(() => {
  const START = Date.parse('2026-11-30T00:00:00+05:00');
  const CLOSE = Date.parse('2026-11-29T21:00:00+05:00'); // конец вступления
  const DAYS = 30;
  const box = document.getElementById('chalDays');
  const st = document.getElementById('chalStatus');
  if (!box || !st) return;
  const now = Date.now();
  const day = Math.floor((now - START) / 864e5) + 1; // 1..30 во время потока
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c); };
  box.innerHTML = Array.from({ length: DAYS }, (_, i) => {
    const d = i + 1;
    const cls = day > DAYS || d < day ? 'on' : d === day ? 'now' : '';
    return `<i class="${cls}"></i>`;
  }).join('');
  const set = (b, s) => { st.innerHTML = ''; const B = document.createElement('b'); B.textContent = b; const S = document.createElement('span'); S.textContent = s; st.append(B, S); };
  const btn = document.getElementById('chalBtn'), note = document.getElementById('chalNote');
  if (now < CLOSE) {
    const left = CLOSE - now, d = Math.floor(left / 864e5), h = Math.floor(left % 864e5 / 36e5);
    set('Старт 30 ноября', 'вступление закрывается через ' + (d ? plural(d, 'день', 'дня', 'дней') + ' ' : '') + plural(h, 'час', 'часа', 'часов') + ' (29 ноября, 21:00 по Алматы)');
  } else if (day <= DAYS) {
    set(day < 1 ? 'Набор закрыт' : 'День ' + day + ' из ' + DAYS, day < 1 ? 'старт 30 ноября' : 'поток 1 идёт, итоги - 30 декабря');
    btn.textContent = 'Хочу в следующий поток'; note.textContent = 'Оставь контакт - напишем, когда откроем набор.';
  } else {
    set('Поток 1 завершён', 'итоги подведены 30 декабря');
    btn.textContent = 'Хочу в следующий поток'; note.textContent = 'Оставь контакт - напишем, когда откроем набор.';
  }
})();
