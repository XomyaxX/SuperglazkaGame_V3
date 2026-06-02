# Структура проекта Superglazka

## Обзор

```
SuperglazkaGame_V3/
├── src/                          # Фронтенд (Vite + TypeScript)
│   ├── core/                     # Инфраструктурные модули
│   │   ├── theme-manager.ts      # Тёмная/светлая тема
│   │   ├── device-detector.ts    # Определение устройства
│   │   ├── app-settings.ts       # Настройки (громкость, шрифт)
│   │   ├── mood-detector.ts      # Определение настроения кадра
│   │   ├── audio-controller.ts   # Web Audio API (TODO)
│   │   ├── subtitle-overlay.ts   # Субтитры (TODO)
│   │   └── bottom-sheet.ts       # Нижний sheet (TODO)
│   ├── ui/                       # UI-компоненты
│   │   ├── main-menu.ts          # Главное меню (TODO)
│   │   ├── episode-viewer.ts     # Просмотрщик глав (TODO)
│   │   ├── auth-modal.ts         # Авторизация (TODO)
│   │   ├── profile-modal.ts      # Профиль (TODO)
│   │   └── cookie-banner.ts      # Cookie баннер ✅
│   ├── games/                    # Игры (lazy-loaded)
│   │   ├── game-blink.ts         # Моргайка (TODO)
│   │   ├── game-tracker.ts       # Следи за шариком (TODO)
│   │   ├── game-runner.ts        # Погоня (TODO)
│   │   └── game-gymnastics.ts    # Ваня vs Ленивус (TODO)
│   ├── episodes/                 # Данные глав
│   │   ├── episode-01.ts         # Глава 1 (TODO)
│   │   ├── episode-02.ts         # Глава 2 (TODO)
│   │   ├── episode-registry.ts   # Реестр глав (TODO)
│   │   └── asset-utils.ts        # Утилиты для ассетов (TODO)
│   ├── services/                 # Сервисный слой ✅
│   │   ├── api-client.ts         # HTTP клиент
│   │   ├── auth.ts               # Авторизация
│   │   ├── player-profile.ts     # Профиль игрока
│   │   └── error-reporter.ts     # Отчёты об ошибках
│   ├── types/                    # TypeScript типы ✅
│   │   ├── auth.ts
│   │   ├── episode.ts
│   │   ├── game.ts
│   │   └── api.ts
│   ├── styles/                   # CSS
│   │   ├── _tokens.css           # Design tokens ✅
│   │   ├── _base.css             # Базовые стили ✅
│   │   ├── _animations.css       # Анимации ✅
│   │   └── app.css               # Entry point CSS ✅
│   ├── main.ts                   # Точка входа (app.html) ✅
│   └── landing.ts                # Точка входа (index.html) ✅
│
├── public/                       # Статика
│   ├── index.html                # Landing page
│   ├── app.html                  # Приложение
│   ├── blog.html                 # Блог
│   ├── checklist.html            # Чек-лист
│   ├── parents.html              # Родителям
│   ├── privacy.html              # Политика конфиденциальности
│   ├── assets/                   # Изображения, аудио, видео
│   ├── icons/                    # PWA иконки
│   ├── favicon.svg
│   ├── manifest.json
│   ├── robots.txt
│   └── sitemap.xml
│
├── server/                       # Backend (Node.js + Express)
│   ├── src/                      # Исходный код TypeScript ✅
│   │   ├── index.ts              # Точка входа
│   │   ├── db.ts                 # SQLite + миграции
│   │   ├── routes/               # API маршруты
│   │   ├── middleware/           # Middleware
│   │   ├── services/             # Сервисы
│   │   ├── templates/            # Email шаблоны
│   │   └── types/                # Типы (TODO)
│   ├── migrations/               # SQL миграции (TODO)
│   ├── data/                     # SQLite БД (в .gitignore)
│   ├── package.json              # Зависимости бэкенда ✅
│   ├── tsconfig.json             # TypeScript config ✅
│   └── .env.example              # Шаблон переменных окружения
│
├── deploy/                       # Деплой
│   ├── docker-compose.yml        # Docker Compose
│   ├── Dockerfile.frontend       # Frontend образ
│   ├── Dockerfile.backend        # Backend образ
│   ├── nginx.conf                # Nginx конфиг
│   ├── install.sh                # Скрипт установки VPS
│   ├── pm2.config.js             # PM2 конфиг (legacy)
│   └── docker-guide.md           # Гайд по Docker деплою
│
├── docs/                         # Документация
│   ├── STRUCTURE.md              # Этот файл ✅
│   ├── DEPLOY.md                 # Гайд деплоя (TODO)
│   └── ADD_EPISODE.md            # Добавление главы (TODO)
│
├── package.json                  # Frontend зависимости ✅
├── vite.config.ts                # Vite конфиг ✅
├── tsconfig.json                 # TypeScript конфиг ✅
├── .gitignore                    # Исключения Git ✅
└── README.md                     # Описание проекта
```

## Легенда

- ✅ — Готово
- TODO — Требует рефакторинга/переноса из legacy-кода

## Ключевые принципы

1. **Vite** собирает фронтенд: tree-shaking, code-splitting, минификация
2. **TypeScript** везде: типобезопасность, лучший DX
3. **Lazy loading** игр: каждая игра — отдельный чанк, загружается по `import()`
4. **Модульная архитектура**: каждый модуль отвечает за одну задачу
5. **PWA** через `vite-plugin-pwa`: авто-SW, авто-manifest
