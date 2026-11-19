# QWESTEAR — Мишутка и заброшенный лес

2D квест-головоломка от третьего лица для Telegram. 25 уровней, пять механик:
предметы и комбинации, связанные выключатели, рычаги по порядку, коды на панели, лампа и тень.

Игра написана на чистом JavaScript + canvas, без сборки и зависимостей.

## Структура

- `index.html` — точка входа (экран уровней, сцена, модальные окна)
- `js/logic.js` — правила головоломок (без DOM, тестируется в Node)
- `js/levels.js` — 25 уровней с данными и проверенными решениями
- `js/game.js` — рисование, ввод, прогресс, Telegram WebApp
- `tests/levels.test.js` — проверка всех уровней (`node tests/levels.test.js`)
- `bot/bot.py` — минимальный бот с кнопкой «Играть»
- `assets/` — сюда кладётся `bear.png` (фото медвежонка)
- `docs/GAME_DESIGN.md` — геймдизайн: механики, карта уровней, правила

## Запуск локально

```bash
python3 -m http.server 8080 --bind 0.0.0.0
# открыть http://localhost:8080
node tests/levels.test.js
```

## Подключение к Telegram

1. Разместите папку на HTTPS-хостинге (GitHub Pages, Netlify, Cloudflare Pages и т.п.).
2. В @BotFather создайте бота командой `/newbot` и получите токен.
3. Запустите бота:
   ```bash
   export BOT_TOKEN="токен"
   export GAME_URL="https://ваш-домен/index.html"
   python3 bot/bot.py
   ```
4. Напишите боту `/start`: появится кнопка «Играть» внутри Telegram.

Прогресс сохраняется в localStorage на устройстве.

## Фото медвежонка

Загрузите фото в `assets/bear.png` (см. `assets/README.md`). Пока файла нет, используется заглушка.
