# Суперглазка v3 🌟

Интерактивный образовательный комикс о здоровье глаз для детей. Приключения Суперглазки на планете Видеаль с мини-играми, анимацией и синхронизацией прогресса.

## 🚀 Технологии

- **Frontend**: Vite + TypeScript + Vanilla JS
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite
- **Deploy**: Docker + Docker Compose + Nginx
- **PWA**: vite-plugin-pwa (Service Worker, Manifest, Offline)

## 📁 Структура

См. [docs/STRUCTURE.md](docs/STRUCTURE.md)

## 🛠 Быстрый старт

```bash
# Установка зависимостей фронтенда
npm install

# Разработка
npm run dev

# Сборка
npm run build

# Бэкенд
cd server
npm install
npm run build
npm start
```

## 🐳 Docker

```bash
# Сборка и запуск
docker compose up -d --build

# Только бэкенд
docker compose up -d backend
```

## 🌐 Деплой

См. [deploy/docker-guide.md](deploy/docker-guide.md)

## 📜 Лицензия

Все права защищены. Сделано с ❤️ для защиты зрения детей.
