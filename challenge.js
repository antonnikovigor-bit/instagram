// Блок «30 дней. Час для себя»: обратный отсчёт, день потока и полоса из 30 дней. Время - Алматы (UTC+5).
(() => {
  const START = Date.parse('2026-11-30T00:00:00+05:00');
  const CLOSE = Date.parse('2026-11-29T21:00:00+05:00'); // конец вступления
  const DAYS = 30;
  const box = document.getElementById('chalDays');
  const st = document.getElementById('chalStatus');
  if (!box || !st) return;
  const pad = (n) => String(n).padStart(2, '0');
  const btn = document.getElementById('chalBtn'), note = document.getElementById('chalNote');
  const later = () => { btn.firstChild.textContent = 'Хочу в следующий поток '; note.textContent = 'Оставь контакт - напишем, когда откроем набор.'; };
  const big = (cap, val, unit) => { st.innerHTML = ''; const c = document.createElement('span'); c.className = 'cap'; c.textContent = cap;
    const u = document.createElement('div'); u.className = 'u'; const b = document.createElement('b'); b.className = 'num'; b.textContent = val;
    const s = document.createElement('span'); s.textContent = unit; u.append(b, s); st.append(c, u); };
  function tick() {
    const now = Date.now();
    const day = Math.floor((now - START) / 864e5) + 1;
    box.innerHTML = Array.from({ length: DAYS }, (_, i) => `<i class="${day > DAYS || i + 1 < day ? 'on' : i + 1 === day ? 'now' : ''}"></i>`).join('');
    if (now < CLOSE) {
      const left = CLOSE - now;
      const set = (k, v) => { const el = st.querySelector(`[data-cd="${k}"]`); if (el) el.textContent = pad(v); };
      set('d', Math.floor(left / 864e5)); set('h', Math.floor(left % 864e5 / 36e5)); set('m', Math.floor(left % 36e5 / 6e4));
      return true;
    }
    later();
    if (day < 1) big('Набор закрыт · старт 30 ноября', '00', 'до старта считанные часы');
    else if (day <= DAYS) big('Поток 1 идёт · итоги 30 декабря', pad(day) + ' / ' + DAYS, 'день потока');
    else big('Поток 1 завершён', '30 / 30', 'итоги подведены 30 декабря');
    return false;
  }
  if (tick()) { const t = setInterval(() => { if (!tick()) clearInterval(t); }, 30000); }
})();
