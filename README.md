# Instagram в открытую

Живая страница статистики Instagram: подписчики, охват, каждый рилс, аудитория.

- `index.html` - сама страница (GitHub Pages)
- `scripts/collect.mjs` - сборщик данных из Instagram API
- `.github/workflows/collect.yml` - запускает сборщик каждые 15 минут

Данные лежат в ветке `data` (`public.json`). Токен хранится в секрете `IG_TOKEN`, продлевается автоматически.
