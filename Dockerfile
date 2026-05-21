# Этап 1: Билд фронтенда (если нужно — сейчас статика уже готова)
# Для этого проекта фронтенд — чистая статика, просто копируем

# Этап 2: Backend
FROM node:20-alpine

WORKDIR /app

# Копируем зависимости бэкенда
COPY server/package*.json ./
RUN npm ci --only=production

# Копируем код бэкенда
COPY server/ .

# Создаём папку для данных SQLite
RUN mkdir -p data

# Порт, который слушает Express
EXPOSE 3000

# Запуск
CMD ["node", "server.js"]
