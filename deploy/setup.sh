#!/bin/bash
# FPGA Lab — Quick setup script for Ubuntu/Debian lab servers
# Run as root or with sudo

set -euo pipefail

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
  libudev-dev

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

# ─── Service user ────────────────────────────────────────────────────────────
echo ""
echo "▸ Setting up service user..."
if ! id fpga-lab &>/dev/null; then
  useradd --system --shell /bin/false --home-dir /opt/fpga-lab fpga-lab
fi
usermod -aG dialout,video,plugdev fpga-lab

# ─── Application directory ───────────────────────────────────────────────────
APP_DIR="/opt/fpga-lab"
echo "▸ Setting up application in ${APP_DIR}..."
mkdir -p "$APP_DIR"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ System dependencies installed"
echo ""
echo "  Next steps:"
echo "    1. Copy your project files to ${APP_DIR}/"
echo "    2. cp .env.example .env.local && edit .env.local"
echo "    3. npm install --production"
echo "    4. npx next build"
echo "    5. npx tsx scripts/seed-admin.ts"
echo "    6. cp deploy/fpga-lab.service /etc/systemd/system/"
echo "    7. systemctl daemon-reload"
echo "    8. systemctl enable --now fpga-lab"
echo ""
echo "  Check logs:  journalctl -u fpga-lab -f"
echo "═══════════════════════════════════════════════════════════"
