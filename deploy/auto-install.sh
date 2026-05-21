#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════
# Superglazka — One-Command Auto Installer
# Usage: sudo bash auto-install.sh https://github.com/USER/REPO.git yourdomain.com
# ═══════════════════════════════════════════════════════════

REPO_URL="${1:-https://github.com/USER/REPO.git}"
DOMAIN="${2:-example.com}"
PROJECT_DIR="/var/www/superglazka"

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use: sudo bash auto-install.sh ...)"
  exit 1
fi

echo "========================================"
echo "Superglazka Auto Installer"
echo "Repository: $REPO_URL"
echo "Domain:     $DOMAIN"
echo "========================================"

# 1. System update
echo "[1/10] Updating system..."
apt-get update -y
apt-get upgrade -y

# 2. Install Node.js 20
echo "[2/10] Installing Node.js 20..."
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" != "20" ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"

# 3. Install tools
echo "[3/10] Installing PM2, Nginx, Certbot, Git..."
npm install -g pm2
apt-get install -y nginx git certbot python3-certbot-nginx unzip

# 4. Create project directory
echo "[4/10] Creating project directory..."
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# 5. Clone or update repository
echo "[5/10] Cloning repository..."
if [ -d ".git" ]; then
  git pull
else
  rm -rf "$PROJECT_DIR"
  git clone "$REPO_URL" "$PROJECT_DIR"
  cd "$PROJECT_DIR"
fi

# 6. Install backend dependencies
echo "[6/10] Installing backend dependencies..."
cd "$PROJECT_DIR/server"
npm install --production

# Create data directory
mkdir -p "$PROJECT_DIR/server/data"

# 7. Create .env
echo "[7/10] Creating .env..."
if [ ! -f ".env" ]; then
  cat > ".env" << EOF
PORT=3000
JWT_SECRET=$(openssl rand -hex 32)
RESEND_API_KEY=your-resend-api-key-here
FROM_EMAIL=noreply@$DOMAIN
ADMIN_API_KEY=$(openssl rand -hex 16)
FRONTEND_URL=https://$DOMAIN
EOF
  echo "Created .env (please edit RESEND_API_KEY!)"
else
  echo ".env already exists, skipping"
fi

# 8. Setup PM2
echo "[8/10] Starting backend with PM2..."
cd "$PROJECT_DIR"
pm2 start deploy/pm2.config.js 2>/dev/null || pm2 restart superglazka-api
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# 9. Setup Nginx
echo "[9/10] Configuring Nginx..."
rm -f /etc/nginx/sites-enabled/default
cp "$PROJECT_DIR/deploy/nginx-superglazka" /etc/nginx/sites-available/superglazka
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/superglazka
ln -sf /etc/nginx/sites-available/superglazka /etc/nginx/sites-enabled/superglazka

nginx -t && systemctl restart nginx

# 10. SSL
echo "[10/10] Setting up SSL..."
if [ "$DOMAIN" != "example.com" ] && [ "$DOMAIN" != "" ]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN 2>/dev/null || true
fi

echo ""
echo "========================================"
echo "INSTALLATION COMPLETE!"
echo "========================================"
echo "Domain:     https://$DOMAIN"
echo "API:        https://$DOMAIN/api/health"
echo "Directory:  $PROJECT_DIR"
echo ""
echo "IMPORTANT: Edit .env and set your real keys!"
echo "  nano $PROJECT_DIR/server/.env"
echo ""
echo "Check status:"
echo "  pm2 status"
echo "  pm2 logs superglazka-api"
echo "========================================"
