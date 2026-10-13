# Instagram в открытую

Живая страница статистики Instagram: подписчики, охват, каждый рилс, аудитория.

- `index.html` - сама страница (GitHub Pages)
- `scripts/collect.mjs` - сборщик данных из Instagram API
- `.github/workflows/collect.yml` - запускает сборщик каждые 15 минут

Данные лежат в ветке `data` (`public.json`). Токен хранится в секрете `IG_TOKEN`, продлевается автоматически.

## Таймер сбора

Расписание GitHub Actions ненадёжно: запуски задерживаются на часы. Поэтому сбор каждые 15 минут запускает воркер Cloudflare (`cloudflare/worker.js`, Cron Trigger `*/15 * * * *`). Ему нужен секрет `GH_TOKEN` - fine-grained токен GitHub с правом Actions (read and write) только на этот репозиторий. Расписание в `collect.yml` осталось как запасное.
