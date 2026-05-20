#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════
# Superglazka Deployment Script for Ubuntu/Debian VPS
# Run: sudo bash install.sh
# ═══════════════════════════════════════════════════════════

PROJECT_DIR="/var/www/superglazka"
DOMAIN="${DOMAIN:-example.com}"
NODE_VERSION="20"

echo "=== Superglazka Deploy ==="
echo "Domain: $DOMAIN"
echo ""

# 1. Update system
echo "[1/9] Updating system..."
apt-get update -y
apt-get upgrade -y

# 2. Install Node.js
echo "[2/9] Installing Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" != "$NODE_VERSION" ]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

# 3. Install PM2 globally
echo "[3/9] Installing PM2..."
npm install -g pm2

# 4. Install Nginx
echo "[4/9] Installing Nginx..."
apt-get install -y nginx

# 5. Install Certbot
echo "[5/9] Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# 6. Setup project directory
echo "[6/9] Setting up project directory..."
mkdir -p "$PROJECT_DIR"

# If script is run from project root, copy files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$PARENT_DIR/server/server.js" ]; then
  echo "Copying project files..."
  rsync -av --exclude='node_modules' --exclude='.git' --exclude='data' "$PARENT_DIR/" "$PROJECT_DIR/"
else
  echo "WARNING: Project files not found. Please copy them manually to $PROJECT_DIR"
fi

# 7. Install backend dependencies
echo "[7/9] Installing backend dependencies..."
cd "$PROJECT_DIR/server"
npm install --production

# Create data directory
mkdir -p "$PROJECT_DIR/server/data"

# 8. Create .env if not exists
echo "[8/9] Creating .env file..."
if [ ! -f "$PROJECT_DIR/server/.env" ]; then
  cat > "$PROJECT_DIR/server/.env" << EOF
PORT=3000
JWT_SECRET=$(openssl rand -hex 32)
RESEND_API_KEY=your-resend-api-key-here
FROM_EMAIL=noreply@$DOMAIN
ADMIN_API_KEY=$(openssl rand -hex 16)
FRONTEND_URL=https://$DOMAIN
EOF
  echo "Created $PROJECT_DIR/server/.env"
  echo "IMPORTANT: Edit this file and set your real RESEND_API_KEY!"
else
  echo ".env already exists, skipping"
fi

# 9. Setup PM2 and Nginx
echo "[9/9] Setting up PM2 and Nginx..."

# PM2 ecosystem
cd "$PROJECT_DIR"
pm install -g pm2
pm2 start deploy/pm2.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Nginx config
rm -f /etc/nginx/sites-enabled/default
cp "$PROJECT_DIR/deploy/nginx-superglazka" /etc/nginx/sites-available/superglazka
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/superglazka
ln -sf /etc/nginx/sites-available/superglazka /etc/nginx/sites-enabled/superglazka

nginx -t
systemctl restart nginx

# SSL (Certbot) — comment out if domain not pointed yet
# certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN

echo ""
echo "=== Deploy Complete ==="
echo "Project directory: $PROJECT_DIR"
echo "API running on: http://localhost:3000"
echo ""
echo "Next steps:"
echo "1. Point your domain A-record to this server's IP"
echo "2. Edit $PROJECT_DIR/server/.env with your real keys"
echo "3. Run: certbot --nginx -d $DOMAIN"
echo "4. Check status: pm2 status"
echo "5. View logs: pm2 logs superglazka-api"
