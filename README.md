# Instagram в открытую

Живая страница статистики Instagram: подписчики, охват, каждый рилс, аудитория.

- `index.html` - сама страница (GitHub Pages)
- `scripts/collect.mjs` - сборщик данных из Instagram API
- `.github/workflows/collect.yml` - запускает сборщик каждые 15 минут

Данные лежат в ветке `data` (`public.json`). Токен хранится в секрете `IG_TOKEN`, продлевается автоматически.

## Таймер сбора

Расписание GitHub Actions ненадёжно: запуски задерживаются на часы. Поэтому сбор каждые 15 минут запускает воркер Cloudflare (`cloudflare/worker.js`, Cron Trigger `*/15 * * * *`). Ему нужен секрет `GH_TOKEN` - fine-grained токен GitHub с правом Actions (read and write) только на этот репозиторий. Расписание в `collect.yml` осталось как запасное.

## Пробные рилсы

`scripts/publish-trial.mjs` + `.github/workflows/publish-trial.yml`. Пуш ветки `reel/<название>` с `queue/video.mp4` и `queue/caption.txt` публикует пробный рилс (trial reel, перевод в обычный - вручную в приложении). Ветка без видео (`reel/check`) только проверяет право на публикацию. После запуска ветка удаляется. Токену `IG_TOKEN` нужно право `instagram_business_content_publish`.
