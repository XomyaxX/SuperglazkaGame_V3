# Руководство по деплою Superglazka V3 (Docker)

## Актуальная архитектура
```
┌─────────────────┐      ┌─────────────────┐
│  superglazka-   │:80/443│  superglazka-   │:3000
│  nginx          │◄────►│  backend        │
│  (nginx:alpine) │      │  (node:20-alpine)
└─────────────────┘      └─────────────────┘
```
- **Frontend**: nginx раздаёт статику из `/opt/superglazka` (volume mount).
- **Backend**: Node.js + Express + SQLite.
- **SSL**: Let's Encrypt через certbot (certbot-data volume).

## Что понадобится
- Доступ к серверу `83.217.203.41` (SSH или консоль хостинга)
- Проект склонирован в `/opt/superglazka`
- Docker и Docker Compose Plugin установлены

---

## Первоначальная установка (один раз)

```bash
cd /opt/superglazka

# 1. Создать .env из шаблона
cp server/.env.example server/.env
nano server/.env        # заполнить реальные секреты

# 2. Запустить
docker compose up -d --build

# 3. Проверить
curl http://localhost:3000/api/health
```

---

## Ежедневный workflow обновления

### 1. Локально — закоммитить и запушить
```bash
git add .
git commit -m "описание изменений"
git push origin main
```

### 2. На сервере — стянуть изменения и перезапустить
```bash
ssh root@83.217.203.41
cd /opt/superglazka
git pull origin main

# Пересобрать backend (если менялся server/)
docker compose up -d --build backend

# Или просто перезапустить контейнеры
docker restart superglazka-backend superglazka-nginx
```

> **Важно:** если изменились только статические файлы (HTML/JS/CSS), достаточно `git pull` + `docker restart superglazka-nginx` (или вообще ничего, nginx читает volume в реальном времени).

---

## Управление контейнерами

| Команда | Описание |
|---------|----------|
| `docker compose up -d --build` | Пересобрать и запустить все сервисы |
| `docker restart superglazka-backend` | Перезапустить только backend |
| `docker restart superglazka-nginx` | Перезапустить только nginx |
| `docker logs -f superglazka-backend` | Смотреть логи backend |
| `docker logs -f superglazka-nginx` | Смотреть логи nginx |
| `docker compose down` | Остановить всё |

---

## Обновление SSL-сертификата

```bash
docker run -it --rm \
  -v /opt/superglazka/certbot-data:/etc/letsencrypt \
  -v /opt/superglazka/certbot-data/www:/var/www/certbot \
  certbot/certbot renew

docker restart superglazka-nginx
```

---

## Типичные проблемы

### 502 Bad Gateway
- Проверить backend: `docker logs -f superglazka-backend`
- Проверить health: `curl http://localhost:3000/api/health`

### CORS ошибки
- Проверить `FRONTEND_URL` в `server/.env`
- Перезапустить backend: `docker restart superglazka-backend`

### Изменения не применились после git pull
- nginx кэширует статику — попробовать `docker restart superglazka-nginx`
- Service Worker в браузере может кэшировать старые JS — поднять версию в `service-worker.js`

### Permission denied (publickey) при SSH
- Проверить, что ключ `~/.ssh/id_ed25519_kimi` добавлен в `~/.ssh/authorized_keys` на сервере
- Альтернатива: заходить через пароль или другой ключ

---

## Полезные пути

| Путь | Назначение |
|------|------------|
| `/opt/superglazka` | Корень проекта на сервере |
| `/opt/superglazka/server/.env` | Переменные окружения backend |
| `/opt/superglazka/server/data` | SQLite БД (в Docker volume `sqlite_data`) |
| `/opt/superglazka/server/uploads` | Загруженные через CMS файлы |
| `/opt/superglazka/certbot-data` | SSL-сертификаты Let's Encrypt |
