#!/bin/bash
# FPGA Lab — Quick setup script for Ubuntu/Debian lab servers
# Run as root or with sudo

set -euo pipefail

APP_DIR="/opt/fpga-lab"

echo "═══════════════════════════════════════════════════════════"
echo "  FPGA Lab Remote Access — Server Setup"
echo "═══════════════════════════════════════════════════════════"

# ─── System dependencies ─────────────────────────────────────────────────────
echo ""
echo "▸ Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq \
  curl \
  build-essential \
  ffmpeg \
  v4l-utils \
  usbutils \
  git \
  cmake \
  pkg-config \
  libftdi1-dev \
  libusb-1.0-0-dev \
  libudev-dev \
  sqlite3

# ─── Node.js (v22 LTS) ──────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]]; then
  echo ""
  echo "▸ Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  Node.js $(node -v)"

# ─── openFPGALoader ─────────────────────────────────────────────────────────
if ! command -v openFPGALoader &>/dev/null; then
  echo ""
  echo "▸ Installing openFPGALoader..."
  cd /tmp
  git clone --depth 1 https://github.com/trabucayre/openFPGALoader.git
  cd openFPGALoader
  mkdir build && cd build
  cmake ..
  make -j$(nproc)
  make install
  cd / && rm -rf /tmp/openFPGALoader
fi
echo "  openFPGALoader $(openFPGALoader --version 2>&1 | head -1)"

# ─── Ngrok (via snap) ───────────────────────────────────────────────────────
if ! command -v ngrok &>/dev/null; then
  echo ""
  echo "▸ Installing Ngrok..."
  if command -v snap &>/dev/null; then
    snap install ngrok
  else
    curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
    echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | tee /etc/apt/sources.list.d/ngrok.list
    apt-get update -qq
    apt-get install -y -qq ngrok
  fi
fi
echo "  Ngrok $(ngrok --version 2>&1 | awk '{print $3}')"

# ─── Application directory ───────────────────────────────────────────────────
echo ""
echo "▸ Setting up application in ${APP_DIR}..."
mkdir -p "$APP_DIR"

# ─── Copy project files if running from source ──────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_DIR/package.json" ] && [ "$PROJECT_DIR" != "$APP_DIR" ]; then
  echo "▸ Copying project files to ${APP_DIR}..."
  rsync -a --exclude='node_modules' --exclude='.next' --exclude='.git' \
    --exclude='data' --exclude='uploads' \
    "$PROJECT_DIR/" "$APP_DIR/"
fi

# ─── Create .env.local if it doesn't exist ───────────────────────────────────
if [ ! -f "$APP_DIR/.env.local" ]; then
  echo "▸ Creating .env.local with default configuration..."
  cat > "$APP_DIR/.env.local" << 'ENVEOF'
DB_PATH=./data/fpga_lab.db
JWT_SECRET=a8b3c9d2e4f5g6h7j8k9l0z1x2c3v4b5n6m7
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=fpgalab01@gmail.com
SMTP_PASS=fpga@123
SMTP_FROM=fpgalab01@gmail.com
ALLOWED_EMAIL_DOMAINS=*
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE_MB=50
SESSION_TIMEOUT_MINUTES=30
APP_PORT=3000
NEXT_PUBLIC_APP_URL=https://starfish-outwit-stipulate.ngrok-free.dev

# Ngrok Configuration
NGROK_AUTHTOKEN=3GZdGfqXTMKPXuQF6xvxX1TEqv5_5C5TzS9jvyNHDvYcMTvfb
NGROK_DOMAIN=starfish-outwit-stipulate.ngrok-free.dev
ENVEOF
  echo "  ✓ .env.local created"
else
  echo "  ✓ .env.local already exists, skipping"
fi

# ─── Create required directories ─────────────────────────────────────────────
mkdir -p "$APP_DIR/data" "$APP_DIR/uploads"

# ─── Install dependencies & build ────────────────────────────────────────────
echo ""
echo "▸ Installing Node.js dependencies..."
cd "$APP_DIR"
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

echo ""
echo "▸ Building Next.js application..."
npx next build

# ─── Seed admin user ─────────────────────────────────────────────────────────
echo ""
echo "▸ Seeding admin user..."
npx tsx scripts/seed-admin.ts

# ─── Configure Ngrok authtoken ───────────────────────────────────────────────
echo ""
echo "▸ Configuring Ngrok authtoken..."
# Source .env.local to get NGROK_AUTHTOKEN
set -a
source "$APP_DIR/.env.local"
set +a

if [ -n "${NGROK_AUTHTOKEN:-}" ] && [ "$NGROK_AUTHTOKEN" != "put_your_ngrok_authtoken_here" ]; then
  ngrok config add-authtoken "$NGROK_AUTHTOKEN" 2>/dev/null || true
  echo "  ✓ Ngrok authtoken configured"
else
  echo "  ⚠ No NGROK_AUTHTOKEN set, skipping"
fi

# ─── Detect ngrok binary path ────────────────────────────────────────────────
NGROK_BIN=$(which ngrok 2>/dev/null || echo "/snap/bin/ngrok")
NODE_BIN=$(which node 2>/dev/null || echo "/usr/bin/node")

# ─── Install systemd services ────────────────────────────────────────────────
echo ""
echo "▸ Installing systemd services..."

# Generate fpga-lab.service with correct paths
cat > /etc/systemd/system/fpga-lab.service << SERVICEEOF
[Unit]
Description=FPGA Lab Remote Access Server
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${APP_DIR}
ExecStart=${NODE_BIN} server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# Environment
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIR}/.env.local

# Security hardening
NoNewPrivileges=false
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/data ${APP_DIR}/uploads ${APP_DIR}/.next

# Hardware access — required for FPGA JTAG cables, serial ports, and cameras
SupplementaryGroups=dialout video plugdev

# Resource limits
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Generate ngrok.service with correct binary path
cat > /etc/systemd/system/ngrok.service << NGROKEOF
[Unit]
Description=Ngrok Tunnel for FPGA Lab
After=network.target fpga-lab.service

[Service]
Type=simple
User=root
Group=root
EnvironmentFile=${APP_DIR}/.env.local
ExecStart=${NGROK_BIN} http --domain=\${NGROK_DOMAIN} \${APP_PORT}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
NGROKEOF

# Reload and enable services
systemctl daemon-reload
systemctl enable fpga-lab
systemctl enable ngrok

echo "  ✓ fpga-lab.service installed and enabled"
echo "  ✓ ngrok.service installed and enabled"

# ─── Start services ──────────────────────────────────────────────────────────
echo ""
echo "▸ Starting services..."
systemctl start fpga-lab
sleep 3
systemctl start ngrok

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ FPGA Lab setup complete!"
echo ""
echo "  Local URL:    http://localhost:3000"
echo "  Public URL:   https://${NGROK_DOMAIN:-your-domain.ngrok-free.dev}"
echo ""
echo "  Admin login:  admin@college.org"
echo ""
echo "  Useful commands:"
echo "    journalctl -u fpga-lab -f    # App logs"
echo "    journalctl -u ngrok -f       # Ngrok logs"
echo "    systemctl restart fpga-lab   # Restart app"
echo "    systemctl restart ngrok      # Restart tunnel"
echo "═══════════════════════════════════════════════════════════"
