# Руководство по деплою на Timeweb Cloud (VPS)

## Что понадобится
- VPS на Timeweb Cloud (Ubuntu 22.04 LTS)
- Домен (например, `superglazka.ru`)
- Доступ по SSH
- 15–20 минут времени

---

## Шаг 1. Подготовка VPS

1. Зайди в панель Timeweb Cloud → выбери свой VPS.
2. Убедись, что открыты порты: **22 (SSH), 80 (HTTP), 443 (HTTPS)**.
3. Подключись по SSH:
   ```bash
   ssh root@ТВОЙ_IP
   ```

---

## Шаг 2. Загрузка проекта на сервер

### Вариант A: Через SCP (с твоего компьютера)

Сначала заархивируй проект:
```bash
cd папка_с_проектом
zip -r superglazka.zip . -x "node_modules/*" ".git/*"
```

Загрузи на сервер:
```bash
scp superglazka.zip root@ТВОЙ_IP:/root/
```

На сервере распакуй:
```bash
ssh root@ТВОЙ_IP
apt-get update && apt-get install -y unzip
unzip /root/superglazka.zip -d /var/www/superglazka
```

### Вариант B: Через Git (если проект в репозитории)

```bash
ssh root@ТВОЙ_IP
apt-get update && apt-get install -y git
mkdir -p /var/www/superglazka
cd /var/www/superglazka
git clone https://github.com/ТВОЙ_РЕПО.git .
```

---

## Шаг 3. Запуск установки

```bash
cd /var/www/superglazka/deploy
export DOMAIN=superglazka.ru
sudo bash install.sh
```

Скрипт автоматически установит:
- Node.js 20
- PM2 (менеджер процессов)
- Nginx
- Certbot (для SSL)
- Зависимости бэкенда

---

## Шаг 4. Настройка переменных окружения

Отредактируй `.env`:
```bash
nano /var/www/superglazka/server/.env
```

Укажи реальные значения:
```env
PORT=3000
JWT_SECRET=сгенерирован_автоматически
RESEND_API_KEY=re_ТВОЙ_КЛЮЧ_ИЗ_RESEND
FROM_EMAIL=noreply@superglazka.ru
ADMIN_API_KEY=сгенерирован_автоматически
FRONTEND_URL=https://superglazka.ru
```

Сохрани: `Ctrl+O`, `Enter`, `Ctrl+X`.

---

## Шаг 5. Настройка DNS

В панели управления доменом создай **A-запись**:
- Имя: `@` (или `www`)
- Значение: IP-адрес твоего VPS
- TTL: 300–600

Подожди 5–15 минут, пока DNS обновится.

---

## Шаг 6. SSL (HTTPS)

```bash
certbot --nginx -d superglazka.ru -d www.superglazka.ru
```

Следуй инструкциям:
1. Введи email для уведомлений
2. Согласись с условиями (`Y`)
3. Выбери редирект HTTP → HTTPS (`2`)

Certbot автоматически обновит Nginx-конфиг и получит сертификат Let's Encrypt.

Проверь автообновление:
```bash
certbot renew --dry-run
```

---

## Шаг 7. Проверка работы

### API
```bash
curl https://superglazka.ru/api/health
```
Должно вернуть: `{"status":"ok"}`

### Главная страница
Открой в браузере: `https://superglazka.ru`

### Приложение
Открой: `https://superglazka.ru/app.html`

---

## Управление сервером

### Перезапуск API
```bash
pm2 restart superglazka-api
```

### Просмотр логов
```bash
pm2 logs superglazka-api
```

### Статус
```bash
pm2 status
```

### Перезагрузка Nginx
```bash
systemctl restart nginx
```

### Логи Nginx
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## Обновление проекта

1. Загрузи новые файлы на сервер (через SCP или Git pull)
2. Перезапусти:
   ```bash
   cd /var/www/superglazka
   pm2 restart superglazka-api
   ```

---

## Возможные проблемы

### Ошибка 502 Bad Gateway
- Проверь, запущен ли Node.js: `pm2 status`
- Проверь логи: `pm2 logs superglazka-api`

### SSL не работает
- Убедись, что домен уже указывает на IP (проверь через `nslookup superglazka.ru`)
- Повтори `certbot --nginx -d superglazka.ru`

### CORS ошибки в консоли браузера
- Проверь `FRONTEND_URL` в `.env` — должен совпадать с реальным доменом
- Перезапусти API: `pm2 restart superglazka-api`
