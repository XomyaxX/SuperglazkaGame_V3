# Деплой на Timeweb Cloud с Docker (Docker Compose)

Этот гайд описывает развёртывание проекта **Superglazka** на VPS Timeweb Cloud через Docker Compose.

## Что понадобится
- VPS на Timeweb Cloud (Ubuntu 22.04/24.04, минимум 1 CPU / 1 GB RAM)
- Домен, направленный на IP VPS
- SSH-доступ

---

## Шаг 1. Подготовка VPS

Подключись по SSH:
```bash
ssh root@ТВОЙ_IP
```

Установи Docker и Docker Compose:
```bash
apt-get update && apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Проверь установку:
```bash
docker --version
docker compose version
```

---

## Шаг 2. Загрузка проекта на сервер

### Вариант A: Git (рекомендуется)
```bash
cd /opt
git clone https://github.com/ТВОЙ_РЕПО.git superglazka
cd superglazka
```

### Вариант B: Архив
На локальной машине:
```bash
zip -r superglazka.zip . -x "node_modules/*" ".git/*"
scp superglazka.zip root@ТВОЙ_IP:/opt/
```

На сервере:
```bash
cd /opt && unzip superglazka.zip -d superglazka && cd superglazka
```

---

## Шаг 3. Настройка окружения

Отредактируй `.env`:
```bash
nano server/.env
```

Убедись, что значения корректны:
```env
PORT=3000
JWT_SECRET=сгенерирован_ранее_или_новый
ADMIN_API_KEY=сгенерирован_ранее_или_новый
RESEND_API_KEY=re_ТВОЙ_КЛЮЧ
FROM_EMAIL=noreply@твой_домен.ru
FRONTEND_URL=https://твой_домен.ru
```

Сохрани: `Ctrl+O`, `Enter`, `Ctrl+X`.

---

## Шаг 4. Первый запуск

```bash
cd /opt/superglazka
docker compose up -d --build
```

Проверь, что контейнеры работают:
```bash
docker compose ps
docker compose logs -f backend
```

API должно быть доступно:
```bash
curl http://localhost/api/health
```

---

## Шаг 5. SSL (HTTPS) через Let's Encrypt

Установи Certbot:
```bash
apt-get install -y certbot
```

Получи сертификат (standalone-режим, временно останавливаем nginx-контейнер):
```bash
cd /opt/superglazka
docker compose stop nginx
certbot certonly --standalone -d твой_домен.ru -d www.твой_домен.ru
```

Скопируй сертификаты туда, где их найдёт nginx-контейнер:
```bash
mkdir -p /opt/superglazka/certbot-data/live/твой_домен.ru
mkdir -p /opt/superglazka/certbot-data/archive/твой_домен.ru
cp /etc/letsencrypt/live/твой_домен.ru/fullchain.pem /opt/superglazka/certbot-data/live/твой_домен.ru/
cp /etc/letsencrypt/live/твой_домен.ru/privkey.pem /opt/superglazka/certbot-data/live/твой_домен.ru/
```

Теперь обнови `nginx.conf` для HTTPS. Открой его:
```bash
nano /opt/superglazka/nginx.conf
```

Замени содержимое на:
```nginx
server {
    listen 80;
    server_name твой_домен.ru www.твой_домен.ru;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name твой_домен.ru www.твой_домен.ru;

    ssl_certificate /etc/letsencrypt/live/твой_домен.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/твой_домен.ru/privkey.pem;

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Перезапусти:
```bash
cd /opt/superglazka
docker compose up -d --force-recreate nginx
```

Проверь автообновление сертификата:
```bash
certbot renew --dry-run
```

> **Совет:** настрой cron для автообновления сертификатов и копирования их в `certbot-data`:
> ```bash
> crontab -e
> ```
> Добавь строку:
> ```
> 0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/твой_домен.ru/*.pem /opt/superglazka/certbot-data/live/твой_домен.ru/ && cd /opt/superglazka && docker compose exec -T nginx nginx -s reload
> ```

---

## Шаг 6. Проверка

- Главная: `https://твой_домен.ru`
- Приложение: `https://твой_домен.ru/app.html`
- API health: `https://твой_домен.ru/api/health`

---

## Управление

### Перезапуск
```bash
cd /opt/superglazka
docker compose restart
```

### Остановка
```bash
docker compose down
```

### Обновление кода
```bash
cd /opt/superglazka
git pull          # если через git
docker compose up -d --build
```

### Просмотр логов
```bash
docker compose logs -f backend
docker compose logs -f nginx
```

### Резервная копия базы (SQLite)
```bash
docker cp superglazka-backend:/app/data ./backup-$(date +%F)
```

---

## Возможные проблемы

### Порт 80/443 занят
Если на VPS уже установлен системный Nginx/Apache:
```bash
systemctl stop nginx
systemctl disable nginx
```
Или измени порты в `docker-compose.yml` (например, `8080:80`), но тогда HTTPS придётся настраивать иначе.

### CORS ошибки
Проверь `FRONTEND_URL` в `server/.env` — должен совпадать с реальным доменом с `https://`. После изменения:
```bash
docker compose restart backend
```

### SQLite «readonly» или нет прав
Убедись, что volume `sqlite_data` создался корректно:
```bash
docker compose exec backend ls -la /app/data
```
