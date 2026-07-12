# FPGA Lab — Cloud FPGA Remote Access Platform

A full-stack web application that lets students remotely program and interact with FPGA development boards over the internet. Built for college labs with `.org` email authentication.

## Features

- **Remote FPGA Programming** — Upload bitstreams and program any supported FPGA board via openFPGALoader
- **Live UART Terminal** — Real-time serial console over WebSocket with keyboard input
- **Camera Feed** — MJPEG video stream of the physical board (LEDs, switches, displays)
- **Session Management** — Time-limited exclusive access per board with auto-cleanup
- **Board Agnostic** — Supports 200+ boards via openFPGALoader (Xilinx, Intel/Altera, Lattice, Gowin, etc.)
- **College Auth** — Custom signup restricted to `.org` email domains with email verification
- **Admin Panel** — Register boards, manage users, monitor system status
- **Job Queue** — Queued programming jobs with per-board mutex and real-time log streaming

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌───────────┐
│   Browser       │◄───►│  Next.js + WS    │◄───►│  FPGA Services   │◄───►│  Hardware │
│   (React SPA)   │     │  (server.js)     │     │  (programmer,    │     │  (JTAG,   │
│                 │     │  Port 3000       │     │   UART, camera)  │     │   USB,    │
│  - Dashboard    │     │  - API routes    │     │  - openFPGALoader│     │   serial) │
│  - Upload       │     │  - WebSocket     │     │  - serialport    │     │           │
│  - Termina      │     │  - Auth/JWT      │     │  - ffmpeg        │     │           │
│  - Camera       │     │  - SQLite/Drizzle│     │  - Job queue     │     │           │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └───────────┘
```

## Tech Stack

| Layer      | Technology                                       |
|------------|--------------------------------------------------|
| Frontend   | Next.js 16 (App Router), React 19, Tailwind v4   |
| Backend    | Next.js API Routes, custom `server.js` for WS    |
| Database   | SQLite (better-sqlite3) + Drizzle ORM            |
| Auth       | JWT (httpOnly cookies), bcryptjs, nodemailer     |
| FPGA       | openFPGALoader (+ xsct, quartus_pgm overrides)   |
| Serial     | serialport (Node.js native)                      |
| Camera     | ffmpeg → MJPEG over HTTP                         |
| WebSocket  | ws library (UART console, job logs)              |

## Prerequisites

- **Node.js 22+**
- **openFPGALoader** — `apt install openfpgaloader` or build from source
- **ffmpeg** — `apt install ffmpeg` (for camera streaming)
- **SMTP server** — For email verification (Office365, Gmail, etc.)
- FPGA boards connected via USB/JTAG to the server

## Quick Start

```bash
# 1. Clone and install
git clone <your-repo-url> fpga-lab
cd fpga-lab
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — set JWT_SECRET, SMTP credentials, allowed domains

# 3. Build
npm run build

# 4. Create admin user
npx tsx scripts/seed-admin.ts --email admin@college.org --password yourpass --name "Lab Admin"

# 5. Start
npm start
# → http://localhost:3000
```

### Development Mode

```bash
npm run dev
# Hot-reload on http://localhost:3000
```

## Configuration

All settings are in `.env.local` (see `.env.example` for reference):

| Variable                 | Description                          | Default                    |
|--------------------------|--------------------------------------|----------------------------|
| `DB_PATH`                | SQLite database file path            | `./data/fpga_lab.db`       |
| `JWT_SECRET`             | Secret for signing JWT tokens        | *(must change)*            |
| `SMTP_HOST`              | SMTP server hostname                 | `smtp.office365.com`       |
| `SMTP_PORT`              | SMTP server port                     | `587`                      |
| `SMTP_USER`              | SMTP username                        | —                          |
| `SMTP_PASS`              | SMTP password                        | —                          |
| `SMTP_FROM`              | From address for emails              | —                          |
| `ALLOWED_EMAIL_DOMAINS`  | Comma-separated allowed domains      | `yourcollege.org`          |
| `UPLOAD_DIR`             | Directory for uploaded bitstreams    | `./uploads`                |
| `MAX_UPLOAD_SIZE_MB`     | Max upload size in MB                | `50`                       |
| `SESSION_TIMEOUT_MINUTES`| Board session timeout                | `30`                       |
| `APP_PORT`               | Server port                          | `3000`                     |

## User Flow

1. **Sign up** with a `.org` college email → receive verification email
2. **Verify** email via link → account activated
3. **Log in** → redirected to dashboard
4. **Select** an available FPGA board
5. **Upload** a bitstream file (`.bit`, `.bin`, `.svf`, `.rbf`, `.sof`, etc.)
6. **Program** → job is queued, real-time logs stream via WebSocket
7. **Monitor** → UART terminal + camera feed, exclusive session for 30 min
8. **End session** or auto-timeout → FPGA reset, board released

## Admin Guide

### Adding a Board

1. Log in as admin → navigate to `/admin`
2. Go to "Add Board" tab
3. Fill in:
   - **Name**: Display name (e.g., "Basys 3 — Bench 1")
   - **FPGA Family**: e.g., "Xilinx Artix-7"
   - **Board Type**: openFPGALoader board name (e.g., `basys3`)
   - **Device Path**: JTAG cable path (e.g., `/dev/ttyUSB0`)
   - **Serial Port**: UART serial path (e.g., `/dev/ttyUSB1`)
   - **Camera Device**: V4L2 device (e.g., `/dev/video0`)
   - **Capabilities**: Check LED, UART, Camera, Switches as applicable

### Detecting Connected Boards

```bash
# List all connected FPGA boards
openFPGALoader --detect

# List USB serial devices
ls -la /dev/ttyUSB* /dev/ttyACM*

# List video devices
v4l2-ctl --list-devices
```

### udev Rules (Persistent Device Names)

Create `/etc/udev/rules.d/99-fpga-lab.rules`:
```
# Basys3 JTAG (Digilent)
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6010", ATTRS{serial}=="XXXXX", SYMLINK+="fpga-basys3-jtag"

# Basys3 UART
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6010", ATTRS{serial}=="XXXXX", SYMLINK+="fpga-basys3-uart", MODE="0666"
```

Reload: `sudo udevadm control --reload-rules && sudo udevadm trigger`

## Production Deployment

### Using the Setup Script

```bash
sudo bash deploy/setup.sh
```

This installs Node.js 22, openFPGALoader, ffmpeg, and creates the service user.

### systemd Service

```bash
# Copy files to /opt/fpga-lab
sudo cp -r . /opt/fpga-lab/
sudo chown -R fpga-lab:fpga-lab /opt/fpga-lab/

# Install service
sudo cp deploy/fpga-lab.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fpga-lab

# Check status
sudo systemctl status fpga-lab
sudo journalctl -u fpga-lab -f
```

### Hardware Permissions

The service user needs access to USB devices:

```bash
# Add to required groups
sudo usermod -aG dialout,video,plugdev fpga-lab

# Or set udev rules for specific devices (recommended)
```

## API Reference

| Method | Endpoint                    | Auth   | Description                    |
|--------|-----------------------------|--------|--------------------------------|
| POST   | `/api/auth/signup`          | Public | Register with .org email       |
| POST   | `/api/auth/login`           | Public | Login, receive JWT cookie      |
| POST   | `/api/auth/logout`          | Auth   | Clear session                  |
| GET    | `/api/auth/verify?token=`   | Public | Verify email address           |
| GET    | `/api/auth/me`              | Auth   | Current user info              |
| GET    | `/api/boards`               | Auth   | List all boards                |
| GET    | `/api/boards/:id`           | Auth   | Single board details           |
| POST   | `/api/upload`               | Auth   | Upload bitstream (multipart)   |
| GET    | `/api/jobs`                 | Auth   | List user's jobs               |
| POST   | `/api/jobs`                 | Auth   | Submit programming job         |
| GET    | `/api/jobs/:id`             | Auth   | Job status & logs              |
| GET    | `/api/sessions`             | Auth   | Active hardware session        |
| DELETE | `/api/sessions`             | Auth   | End current session            |
| GET    | `/api/camera/:boardId`      | Auth   | MJPEG camera stream            |
| GET    | `/api/admin/boards`         | Admin  | All boards (admin view)        |
| POST   | `/api/admin/boards`         | Admin  | Register new board             |
| DELETE | `/api/admin/boards`         | Admin  | Remove board                   |
| GET    | `/api/admin/users`          | Admin  | List all users                 |

### WebSocket Endpoints

| Path                    | Description                           |
|-------------------------|---------------------------------------|
| `ws://host/ws/uart/:id` | Bidirectional UART serial console     |
| `ws://host/ws/logs/:id` | Real-time job programming logs        |

## Project Structure

```
fpga_ssh/
├── server.js                    # Custom Node.js server (HTTP + WebSocket)
├── next.config.ts               # Next.js configuration
├── package.json
├── .env.example                 # Environment template
├── deploy/
│   ├── fpga-lab.service         # systemd unit file
│   └── setup.sh                 # Server setup script
├── scripts/
│   └── seed-admin.ts            # Create first admin user
├── src/
│   ├── middleware.ts             # Auth middleware (JWT check)
│   ├── app/
│   │   ├── page.tsx             # Landing page
│   │   ├── globals.css          # Dark theme styles
│   │   ├── layout.tsx           # Root layout
│   │   ├── auth/
│   │   │   ├── login/page.tsx   # Login form
│   │   │   ├── signup/page.tsx  # Signup form
│   │   │   └── verify/page.tsx  # Email verification
│   │   ├── dashboard/page.tsx   # Board selection grid
│   │   ├── program/page.tsx     # Upload & program flow
│   │   ├── monitor/[boardId]/page.tsx  # UART + Camera monitor
│   │   ├── admin/page.tsx       # Admin panel
│   │   └── api/                 # API routes (see table above)
│   ├── components/
│   │   ├── navbar.tsx           # Navigation bar
│   │   ├── board-card.tsx       # Board status card
│   │   ├── upload-zone.tsx      # Drag-and-drop upload
│   │   ├── terminal.tsx         # WebSocket UART terminal
│   │   └── camera-feed.tsx      # MJPEG camera viewer
│   └── lib/
│       ├── init.ts              # Server initialization
│       ├── db/
│       │   ├── schema.ts        # Drizzle ORM schema (6 tables)
│       │   ├── index.ts         # Database singleton
│       │   └── migrate.ts       # Auto-migration
│       ├── auth/
│       │   ├── jwt.ts           # JWT sign/verify
│       │   ├── password.ts      # bcrypt hash/verify
│       │   ├── email.ts         # Email verification
│       │   └── session.ts       # Session helpers
│       ├── fpga/
│       │   ├── programmer.ts    # FPGA programming abstraction
│       │   ├── queue.ts         # Job queue with board mutex
│       │   ├── detect.ts        # Board auto-detection
│       │   └── reset.ts         # FPGA reset on session end
│       ├── hardware/
│       │   ├── uart.ts          # Serial port service
│       │   └── camera.ts        # MJPEG camera service
│       └── sessions/
│           └── enforcer.ts      # Session timeout enforcer
└── data/                        # SQLite database (gitignored)
```

## Supported Bitstream Formats

| Extension | Vendor        | Description                |
|-----------|---------------|----------------------------|
| `.bit`    | Xilinx        | Standard bitstream         |
| `.bin`    | Various       | Raw binary bitstream       |
| `.svf`    | Various       | Serial Vector Format       |
| `.jed`    | Various       | JEDEC programming file     |
| `.mcs`    | Xilinx        | Intel HEX for flash        |
| `.rbf`    | Intel/Altera  | Raw Binary File            |
| `.sof`    | Intel/Altera  | SRAM Object File           |
| `.pof`    | Intel/Altera  | Programmer Object File     |
| `.cfg`    | Lattice       | Configuration file         |
| `.fs`     | Gowin         | FPGA bitstream             |
| `.gw`     | Gowin         | Gowin bitstream            |

## Troubleshooting

| Issue                               | Solution                                                              |
|-------------------------------------|-----------------------------------------------------------------------|
| `openFPGALoader: not found`         | Install: `apt install openfpgaloader` or build from source            |
| `Permission denied: /dev/ttyUSB0`   | `sudo usermod -aG dialout $USER` then re-login                        |
| SMTP emails not sending             | Check SMTP credentials in `.env.local`; for dev, check console logs   |
| Camera feed not working             | Ensure `ffmpeg` installed, camera device exists: `ls /dev/video*`     |
| WebSocket connection failed         | Ensure you're using `node server.js`, not `next dev` directly         |
| Build fails with serialport         | Run `npm rebuild` to rebuild native modules                           |

## License

MIT
