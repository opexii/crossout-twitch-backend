# Пошаговое руководство — Crossout Session Overlay

## 1. ExOut Logger (на ПК стримера)

- Открыть настройки → раздел Twitch.
- **Backend URL** — URL backend (без слэша в конце). Пример: `https://crossout-twitch-backend-xxx.vercel.app`
- **Twitch Channel ID** — числовой ID канала (не логин). Как узнать: страница канала на Twitch → Ctrl+U → поиск по `channelId` или `broadcaster_id`.
- Сохранить.

## 2. Расширение на Twitch

- Страница своего канала → **Расширения** → найти **Crossout Session Overlay** → **Установить**.
- Включить в слоте **Video Overlay**.

## 3. Запуск

- Запустить **ExOut Logger**, выбрать лог и никнейм игрока.
- Запустить трансляцию. Оверлей отображается поверх видео, данные обновляются в реальном времени.

---

**Если оверлей показывает «Нет активной сессии»:** в ExOut Logger указаны верный Backend URL и числовой Twitch Channel ID; программа запущена, выбран лог и игрок.
