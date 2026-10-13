// Таймер для сборщика статистики. Живёт в Cloudflare Workers, запускается по расписанию (Cron Trigger, каждые 15 минут)
// и просит GitHub запустить workflow collect.yml. Расписание GitHub ненадёжно: запуски задерживаются на часы.
// Токен GH_TOKEN хранится в секретах воркера. Права: только Actions (read and write) на репозиторий instagram.

const REPO = 'antonnikovigor-bit/instagram';
const WORKFLOW = 'collect.yml';

async function trigger(env) {
  if (!env.GH_TOKEN) throw new Error('Нет секрета GH_TOKEN');
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'insta-stats-trigger',
      'Content-Type': 'application/json',
    },
    // full: 'false' - обычный быстрый сбор. Полный (дни + аудитория) сборщик сам делает раз в 6 часов.
    body: JSON.stringify({ ref: 'main', inputs: { full: 'false' } }),
  });
  if (res.status !== 204) throw new Error(`GitHub ответил ${res.status}: ${(await res.text()).slice(0, 200)}`);
  console.log('Сбор запущен');
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(trigger(env));
  },
  // Снаружи воркер ничего не делает: по ссылке запустить сбор нельзя
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
};
