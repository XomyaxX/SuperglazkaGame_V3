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

### 1. Локально — бамп версии SW, закоммитить и запушить
```bash
# Обновить версию кэша Service Worker (обязательно!)
node deploy/bump-sw.js

git add .
git commit -m "описание изменений"
git push origin main
```

### 2. На сервере — бэкап, стянуть изменения и перезапустить
```bash
ssh root@83.217.203.41
cd /opt/superglazka

# Обязательно: бэкап БД перед любыми изменениями
bash misc/deploy/backup-db.sh

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

---

## Бэкап и восстановление БД

### Автоматический бэкап (cron)

```bash
# Добавить в crontab: бэкап каждый день в 3:00
0 3 * * * /opt/superglazka/misc/deploy/backup-db.sh >> /var/log/superglazka-backup.log 2>&1
```

### Ручной бэкап

```bash
cd /opt/superglazka
bash misc/deploy/backup-db.sh

# Кастомный путь и срок хранения
BACKUP_DIR=/root/db-backups RETENTION=60 bash misc/deploy/backup-db.sh
```

Бэкапы сохраняются в `server/data/backups/superglazka_YYYYMMDD_HHMMSS.db`.
По умолчанию хранятся последние 30 копий (`RETENTION=30`).

### Восстановление из бэкапа

```bash
# 1. Остановить backend
docker stop superglazka-backend

# 2. Скопировать бэкап в контейнер
docker cp server/data/backups/superglazka_20260602_120000.db superglazka-backend:/app/data/superglazka.db

# 3. Запустить backend
docker start superglazka-backend

# 4. Проверить
curl http://localhost:3000/api/health
```

> **Для non-Docker (PM2):** `pm2 stop superglazka-api`, скопировать файл в `server/data/superglazka.db`, `pm2 start superglazka-api`.

### Бэкап перед SSL-обновлением

SSL-сертификат обновляется через certbot в отдельном контейнере и **не затрагивает** volume `sqlite_data`. Бэкап БД перед `certbot renew` не требуется — сертификаты и данные хранятся в разных volumes.
