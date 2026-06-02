#!/bin/bash
set -e

PROJECT_DIR="/opt/superglazka"
DOMAIN="${DOMAIN:-}"

echo "=========================================="
echo " Superglazka Docker Installer"
echo "=========================================="

if [ -z "$DOMAIN" ]; then
  echo "ОШИБКА: Укажи домен через переменную окружения:"
  echo "  export DOMAIN=superglazka.ru"
  echo "  sudo bash docker-install.sh"
  exit 1
fi

# 1. Обновление системы
echo "[1/6] Обновление пакетов..."
apt-get update > /dev/null 2>&1

# 2. Установка Docker, если нет
if ! command -v docker &> /dev/null; then
  echo "[2/6] Установка Docker..."
  apt-get install -y ca-certificates curl gnupg > /dev/null 2>&1
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update > /dev/null 2>&1
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null 2>&1
else
  echo "[2/6] Docker уже установлен"
fi

# 3. Проверка папки проекта
if [ ! -f "$PROJECT_DIR/docker-compose.yml" ]; then
  echo "ОШИБКА: Не найден $PROJECT_DIR/docker-compose.yml"
  echo "Загрузи проект в $PROJECT_DIR перед запуском скрипта."
  exit 1
fi

cd "$PROJECT_DIR"

# 4. Проверка .env
if [ ! -f "server/.env" ]; then
  echo "[3/6] Копирование .env.example → server/.env"
  cp server/.env.example server/.env
  echo "⚠️  ОБЯЗАТЕЛЬНО отредактируй server/.env и укажи свои ключи!"
else
  echo "[3/6] .env уже существует"
fi

# 5. Остановка системного nginx, если есть
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "[4/6] Остановка системного Nginx..."
  systemctl stop nginx
  systemctl disable nginx
else
  echo "[4/6] Системный Nginx не запущен"
fi

# 6. Запуск контейнеров
echo "[5/6] Сборка и запуск Docker Compose..."
docker compose down 2>/dev/null || true
docker compose up -d --build

# 7. Проверка health check
echo "[6/6] Проверка API..."
sleep 3
if curl -sf http://localhost/api/health > /dev/null; then
  echo "✅ API работает!"
else
  echo "⚠️  API пока не отвечает. Проверь логи: docker compose logs -f backend"
fi

echo ""
echo "=========================================="
echo " Готово!"
echo "=========================================="
echo "Сайт:      http://$DOMAIN"
echo "API:       http://$DOMAIN/api/health"
echo ""
echo "Далее:"
echo "1. Настрой DNS (A-запись → $(curl -s ifconfig.me || echo 'IP сервера'))"
echo "2. Отредактируй server/.env при необходимости и перезапусти:"
echo "   docker compose restart backend"
echo "3. Настрой SSL по гайду deploy/docker-guide.md (Шаг 5)"
echo ""
