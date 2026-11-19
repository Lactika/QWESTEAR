"""
Минимальный Telegram-бот для QWESTEAR (только стандартная библиотека Python 3.9+).

Запуск:
    export BOT_TOKEN="токен_от_BotFather"
    export GAME_URL="https://ваш-домен/index.html"   # HTTPS обязателен
    python3 bot/bot.py

Бот отвечает на /start и /play кнопкой, которая открывает игру внутри Telegram.
"""
import json
import os
import time
import urllib.parse
import urllib.request

TOKEN = os.environ.get("BOT_TOKEN", "")
GAME_URL = os.environ.get("GAME_URL", "")
API = f"https://api.telegram.org/bot{TOKEN}/"


def call(method, **params):
    data = urllib.parse.urlencode(
        {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in params.items()}
    ).encode()
    with urllib.request.urlopen(API + method, data=data, timeout=60) as resp:
        return json.loads(resp.read().decode())


def welcome(chat_id):
    text = (
        "Мишутка заблудился в заброшенном лесу. Помогите ему выбраться!\n"
        "25 уровней головоломок: без пиксель-хантинга, только логика и наблюдение."
    )
    keyboard = {"inline_keyboard": [[{"text": "Играть", "web_app": {"url": GAME_URL}}]]}
    call("sendMessage", chat_id=chat_id, text=text, reply_markup=keyboard)


def main():
    if not TOKEN or not GAME_URL:
        raise SystemExit("Задайте BOT_TOKEN и GAME_URL в переменных окружения.")
    offset = 0
    while True:
        try:
            updates = call("getUpdates", offset=offset, timeout=50).get("result", [])
        except Exception as exc:  # сеть могла моргнуть — просто повторим
            print("getUpdates error:", exc)
            time.sleep(3)
            continue
        for upd in updates:
            offset = upd["update_id"] + 1
            msg = upd.get("message") or {}
            text = (msg.get("text") or "").split()[0:1]
            if text and text[0].split("@")[0] in ("/start", "/play"):
                welcome(msg["chat"]["id"])


if __name__ == "__main__":
    main()
