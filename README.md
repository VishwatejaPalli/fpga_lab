# FPGA Lab — Cloud FPGA Remote Access Platform

A full-stack web application that lets students and researchers remotely program, synthesize, and interact with FPGA development boards over the internet. Built for college labs with email-domain-restricted authentication, an in-browser Verilog IDE, and a cloud synthesis pipeline.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

### Core Lab Features
- **Remote FPGA Programming** — Upload bitstreams and program any supported FPGA board via openFPGALoader
- **Live UART Terminal** — Real-time serial console over WebSocket with keyboard input
- **SSH Terminal** — Full SSH sessions to network-connected SoC boards (e.g. PYNQ-Z2)
- **Camera Feed** — Low-latency physical video stream via MediaMTX over RTSP and WebRTC
- **Virtual I/O** — Software switches, buttons, and LED indicators for board interaction
- **Session Management** — Time-limited exclusive access per board with auto-cleanup and FPGA reset
- **Board Agnostic** — Supports 200+ boards via openFPGALoader (Xilinx, Intel/Altera, Lattice, Gowin, etc.)

### Online Verilog IDE & Cloud Synthesis
- **Monaco Editor** — Full VS Code-quality Verilog/SystemVerilog/VHDL editor in the browser with syntax highlighting
- **Multi-File Projects** — Tabbed editor with RTL and testbench file management
- **Example Projects** — Built-in starter templates (UART TX, Blinky, Counters)
- **Cloud Synthesis** — Server-side RTL synthesis via **Yosys** → **NextPNR** → bitstream generation
- **VCD Waveform Viewer** — Interactive in-browser digital trace inspection with square pulses, bus envelopes, time cursor sampling, and radix switching (HEX/BIN/DEC)
- **Waveform Simulation** — Automatic testbench simulation via **Icarus Verilog** and **GHDL** with VCD output
- **Synthesis Reports** — Schematic diagrams (SVG), timing analysis, resource utilization, and power estimation
- **One-Click Deploy** — Synthesized bitstreams can be directly programmed onto connected boards

### Researcher Dashboard
- **Usage Analytics** — Charts for jobs/day, success rates, board utilization, peak hours (powered by Recharts)
- **Experiment Notebooks** — Markdown-based lab notes with tagging, pinning, and search
- **Board Reservations** — Schedule exclusive time slots for specific boards
- **Batch Programming** — Program multiple boards simultaneously with a single bitstream
- **API Keys** — Generate personal API keys for programmatic/scripted access
- **Data Export** — Export job history and session data as CSV

### Authentication & Security
- **College Auth** — Signup restricted to configurable email domains with email verification
- **Password Reset** — Forgot-password flow with secure email-based token reset
- **JWT Auth** — Stateless authentication with httpOnly cookies, refresh token rotation, and token versioning
- **Rate Limiting** — Brute-force protection with account lockout after failed attempts
- **Command Injection Protection** — Full sanitization across all API routes and hardware integration points
- **SSH Firewall** — Built-in stream parser that blocks dangerous shell commands before they reach remote hosts
- **Path Traversal Protection** — Safe handling of user uploads and bitstream files
- **Audit Logging** — All security-sensitive actions logged with IP, user-agent, and metadata

### Admin Panel
- **Board Management** — Register, edit, and remove boards; auto-detect connected hardware
- **User Management** — View all users, toggle roles, suspend accounts
- **System Monitoring** — Real-time system status and health checks

### Infrastructure
- **PostgreSQL** — Production-grade database with Drizzle ORM and auto-migration
- **Docker Compose** — One-command deployment with app, database, and synthesis worker containers
- **Ngrok Tunnel** — Built-in support for secure public access with static domains
- **Systemd Services** — Production service files for both the app and ngrok tunnel
- **Graceful Shutdown** — Clean teardown of camera feeds, serial ports, and WebSocket connections

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌───────────┐
│   Browser        │◄───►│  Next.js + WS    │◄───►│  FPGA Services   │◄───►│  Hardware  │
│   (React SPA)    │     │  (server.js)     │     │  (programmer,    │     │  (JTAG,    │
│                  │     │  Port 3000       │     │   UART, camera)  │     │   USB,     │
│  - Dashboard     │     │  - API routes    │     │  - openFPGALoader│     │   serial)  │
│  - Verilog IDE   │     │  - WebSocket     │     │  - serialport    │     │            │
│  - Terminal      │     │  - Auth/JWT      │     │  - ffmpeg        │     │            │
│  - Camera        │     │  - PostgreSQL    │     │  - Job queue     │     │            │
│  - Researcher    │     │  - Drizzle ORM   │     │  - SSH sessions  │     │            │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └───────────┘
                                                         │
                                                         ▼
                                                 ┌──────────────────┐
                                                 │ Synthesis Worker │
                                                 │  - Yosys         │
                                                 │  - NextPNR       │
                                                 │  - Icarus Verilog│
                                                 │  - Bitstream gen │
                                                 └──────────────────┘
```

---

## Tech Stack

| Layer       | Technology                                               |
|-------------|----------------------------------------------------------|
| Frontend    | Next.js 16 (App Router), React 19, Tailwind CSS v4      |
| Code Editor | Monaco Editor (@monaco-editor/react)                     |
| Charts      | Recharts                                                 |
| Backend     | Next.js API Routes, custom `server.js` for WebSocket     |
| Database    | PostgreSQL 15 + Drizzle ORM (auto-migration)             |
| Auth        | JWT (httpOnly cookies), bcryptjs, nodemailer              |
| FPGA        | openFPGALoader (+ xsct, quartus_pgm overrides)          |
| Synthesis   | Yosys (RTL), NextPNR (P&R), Icarus Verilog (simulation) |
| Serial      | serialport (Node.js native)                              |
| SSH         | ssh2 (Node.js)                                           |
| Camera      | ffmpeg → MJPEG over HTTP                                 |
| WebSocket   | ws library (UART, SSH, job logs, camera)                 |
| Validation  | Zod schema validation                                    |
| Container   | Docker + Docker Compose                                  |

---

## Prerequisites

- **Node.js 22+**
- **PostgreSQL 15+** — `apt install postgresql` or use Docker Compose
- **openFPGALoader** — `apt install openfpgaloader` or build from source
- **ffmpeg** — `apt install ffmpeg` (for camera streaming)
- **SMTP server** — For email verification (Gmail, Office365, etc.)
- FPGA boards connected via USB/JTAG to the server

### Optional (for Cloud Synthesis)
- **Yosys** — `apt install yosys` (RTL synthesis)
- **NextPNR** — `apt install nextpnr-ice40` or `nextpnr-ecp5` (place & route)
- **Icarus Verilog** — `apt install iverilog` (simulation)

---

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone
git clone https://github.com/VishwatejaPalli/fpga_lab.git
cd fpga_lab

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — set JWT_SECRET, SMTP credentials, DATABASE_URL, etc.

# 3. Launch everything (PostgreSQL + App + Synthesis Worker)
docker compose up -d

# 4. Create admin user
docker exec fpga_lab_app npx tsx scripts/seed-admin.ts --email admin@college.org --password yourpass --name "Lab Admin"

# → http://localhost:3000
```

### Option 2: Manual Setup

```bash
# 1. Clone and install
git clone https://github.com/VishwatejaPalli/fpga_lab.git
cd fpga_lab
npm install

# 2. Start PostgreSQL (if not using Docker)
sudo systemctl start postgresql
createdb fpga_lab

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL, JWT_SECRET, SMTP credentials

# 4. Build
npm run build

# 5. Create admin user
npx tsx scripts/seed-admin.ts --email admin@college.org --password yourpass --name "Lab Admin"

# 6. Start
npm start
# → http://localhost:3000
```

### Development Mode

```bash
npm run dev
# Hot-reload on http://localhost:3000
```

### Local Network Access

You don't need ngrok for local/campus access. Connect via your Pi's IP:

- `http://192.168.1.44:3000` (replace with your Pi's actual local IP)
- or `http://fpga-lab.local:3000` (if mDNS resolves on your network)

---

## Configuration

All settings are in `.env.local`:

| Variable                 | Description                          | Default                    |
|--------------------------|--------------------------------------|----------------------------|
| `DATABASE_URL`           | PostgreSQL connection string         | `postgresql://postgres:postgres@localhost:5432/fpga_lab` |
| `JWT_SECRET`             | Secret for signing JWT tokens        | *(must change)*            |
| `SMTP_HOST`              | SMTP server hostname                 | `smtp.gmail.com`           |
| `SMTP_PORT`              | SMTP server port                     | `587`                      |
| `SMTP_USER`              | SMTP username (email address)        | —                          |
| `SMTP_PASS`              | SMTP password (App Password)         | —                          |
| `SMTP_FROM`              | From address for emails              | —                          |
| `ALLOWED_EMAIL_DOMAINS`  | Comma-separated allowed domains      | `*` (all domains)          |
| `UPLOAD_DIR`             | Directory for uploaded bitstreams    | `./uploads`                |
| `WORKSPACE_DIR`          | Directory for synthesis workspaces   | `./uploads/workspaces`     |
| `MAX_UPLOAD_SIZE_MB`     | Max upload size in MB                | `50`                       |
| `SESSION_TIMEOUT_MINUTES`| Board session timeout                | `30`                       |
| `APP_PORT`               | Server port                          | `3000`                     |
| `NEXT_PUBLIC_APP_URL`    | Public URL for email links           | `http://localhost:3000`    |
| `NGROK_AUTHTOKEN`        | Ngrok auth token for tunneling       | —                          |
| `NGROK_DOMAIN`           | Ngrok static domain                  | —                          |

---

## User Flow

1. **Sign up** with a college email → receive verification email
2. **Verify** email via link → account activated
3. **Log in** → redirected to dashboard
4. **Select** an available FPGA board
5. **Upload** a bitstream file or **write Verilog** in the online IDE
6. **Synthesize** (if using the editor) → Yosys compiles, generates schematic + reports
7. **Program** → job is queued, real-time logs stream via WebSocket
8. **Monitor** → UART terminal + SSH + Camera feed, exclusive session for 30 min
9. **End session** or auto-timeout → FPGA reset, board released

---

## Admin Guide

### Adding a Board

1. Log in as admin → navigate to `/admin`
2. Go to "Add Board" tab
3. Fill in:
   - **Name**: Display name (e.g., "Basys 3 — Bench 1")
   - **FPGA Family**: e.g., "Xilinx Artix-7"
   - **Board Type**: openFPGALoader board name (e.g., `basys3`)
   - **Connection Type**: `jtag`, `network`, or `usb`
   - **Device Path**: JTAG cable path (e.g., `/dev/ttyUSB0`)
   - **Serial Port**: UART serial path (e.g., `/dev/ttyUSB1`)
   - **Camera Device**: V4L2 device (e.g., `/dev/video0`)
   - **IP Address**: For network boards like PYNQ (e.g., `192.168.2.99`)
   - **SSH Credentials**: Username/password for SoC boards
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

---

## Production Deployment

### One-Command Setup

```bash
sudo bash deploy/setup.sh
```

This script automatically:
- Installs Node.js 22, PostgreSQL, openFPGALoader, ffmpeg, ngrok, and system dependencies
- Copies the project to `/opt/fpga-lab/`
- Creates `.env.local` with your configuration
- Runs `npm ci`, `next build`, and seeds the admin user
- Configures ngrok authtoken
- Installs and starts `fpga-lab` and `ngrok` systemd services

### Docker Compose Deployment

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f app
docker compose logs -f synthesis_worker

# Stop
docker compose down
```

The Docker Compose stack includes:
- **db** — PostgreSQL 15 with persistent volume
- **app** — Next.js app with hardware device passthrough (privileged mode)
- **synthesis_worker** — Background worker for Yosys/NextPNR compilation jobs

### Manual Deployment

```bash
# Copy files to /opt/fpga-lab
sudo cp -r . /opt/fpga-lab/
cd /opt/fpga-lab

# Install dependencies and build
npm ci --omit=dev
npx next build
npx tsx scripts/seed-admin.ts

# Install systemd services
sudo cp deploy/fpga-lab.service /etc/systemd/system/
sudo cp deploy/ngrok.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fpga-lab
sudo systemctl enable --now ngrok

# Check status
sudo systemctl status fpga-lab
sudo journalctl -u fpga-lab -f
```

### Ngrok Tunnel

The app can be exposed publicly via ngrok with a static domain:

```bash
# Configure authtoken (done automatically by setup.sh)
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN

# Check tunnel status
sudo systemctl status ngrok
sudo journalctl -u ngrok -f
```

### Database Migration (SQLite → PostgreSQL)

If upgrading from an older SQLite-based installation:

```bash
# Ensure PostgreSQL is running and the target database exists
createdb fpga_lab

# Run the migration script
DB_PATH=./data/fpga_lab.db DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fpga_lab node scripts/migrate-data.js
```

---

## API Reference

### REST Endpoints

| Method | Endpoint                         | Auth       | Description                       |
|--------|----------------------------------|------------|-----------------------------------|
| POST   | `/api/auth/signup`               | Public     | Register with email               |
| POST   | `/api/auth/login`                | Public     | Login, receive JWT cookie         |
| POST   | `/api/auth/logout`               | Auth       | Clear session                     |
| GET    | `/api/auth/verify?token=`        | Public     | Verify email address              |
| GET    | `/api/auth/me`                   | Auth       | Current user info                 |
| POST   | `/api/auth/refresh`              | Auth       | Refresh access token              |
| POST   | `/api/auth/forgot-password`      | Public     | Request password reset email      |
| POST   | `/api/auth/reset-password`       | Public     | Reset password with token         |
| GET    | `/api/boards`                    | Auth       | List all boards                   |
| GET    | `/api/boards/:id`                | Auth       | Single board details              |
| GET    | `/api/boards/:id/jupyter`        | Auth       | Jupyter notebook proxy            |
| POST   | `/api/upload`                    | Auth       | Upload bitstream (multipart)      |
| GET    | `/api/jobs`                      | Auth       | List user's jobs                  |
| POST   | `/api/jobs`                      | Auth       | Submit programming job            |
| GET    | `/api/jobs/:id`                  | Auth       | Job status & logs                 |
| GET    | `/api/sessions`                  | Auth       | Active hardware session           |
| DELETE | `/api/sessions`                  | Auth       | End current session               |
| GET    | `/api/camera/:boardId`           | Auth       | MJPEG camera stream               |
| GET    | `/api/status`                    | Auth       | System health status              |
| POST   | `/api/synthesis`                 | Auth       | Submit Verilog for synthesis      |
| GET    | `/api/synthesis/status?jobId=`   | Auth       | Check synthesis job status        |
| GET    | `/api/researcher/analytics`      | Researcher | Usage analytics & charts          |
| POST   | `/api/researcher/notebooks`      | Researcher | CRUD experiment notebooks         |
| POST   | `/api/researcher/reservations`   | Researcher | Board reservation management      |
| POST   | `/api/researcher/batch`          | Researcher | Batch programming jobs            |
| POST   | `/api/researcher/api-keys`       | Researcher | API key management                |
| GET    | `/api/researcher/export`         | Researcher | Export data as CSV                 |
| GET    | `/api/researcher/telemetry`      | Researcher | Board telemetry data              |
| GET    | `/api/admin/boards`              | Admin      | All boards (admin view)           |
| POST   | `/api/admin/boards`              | Admin      | Register new board                |
| POST   | `/api/admin/boards/detect`       | Admin      | Auto-detect connected boards      |
| DELETE | `/api/admin/boards`              | Admin      | Remove board                      |
| GET    | `/api/admin/users`               | Admin      | List all users                    |
| GET    | `/api/admin/audit`               | Admin      | View audit logs                   |

### WebSocket Endpoints

| Path                      | Description                           |
|---------------------------|---------------------------------------|
| `ws://host/ws/uart/:id`   | Bidirectional UART serial console     |
| `ws://host/ws/ssh/:id`    | SSH terminal session                  |
| `ws://host/ws/logs/:id`   | Real-time job programming logs        |
| `ws://host/ws/camera/:id` | MJPEG camera frame stream             |

---

## Database Schema

The application uses **16 tables** managed by Drizzle ORM with auto-migration:

| Table                  | Description                                      |
|------------------------|--------------------------------------------------|
| `users`                | User accounts with role, status, token versioning |
| `verification_tokens`  | Email verification tokens                         |
| `password_reset_tokens`| Password reset tokens with expiry                 |
| `refresh_tokens`       | JWT refresh tokens with device tracking           |
| `login_attempts`       | Rate limiting and brute-force protection          |
| `boards`               | FPGA board configuration and status               |
| `jobs`                 | Programming job queue with priority               |
| `hw_sessions`          | Active hardware sessions with timeout             |
| `synthesis_jobs`       | Cloud synthesis jobs with reports                  |
| `experiment_notes`     | Researcher lab notebooks                          |
| `board_reservations`   | Board time-slot reservations                      |
| `api_keys`             | Researcher API keys                               |
| `batch_jobs`           | Multi-board batch programming jobs                |
| `audit_logs`           | Security audit trail                              |
| `sessions`             | Auth sessions                                     |

---

## Project Structure

```
fpga_lab/
├── server.js                    # Custom Node.js server (HTTP + WebSocket)
├── next.config.ts               # Next.js configuration
├── package.json
├── Dockerfile                   # Multi-stage Docker build
├── docker-compose.yml           # Docker Compose (PostgreSQL + App + Synthesis Worker)
├── .env.local                   # Environment configuration (gitignored)
├── deploy/
│   ├── setup.sh                 # Automated server setup script
│   ├── fpga-lab.service         # systemd unit file
│   ├── ngrok.service            # Ngrok tunnel service
│   ├── nginx.conf               # Nginx reverse proxy config
│   └── backup.sh                # Database backup script
├── scripts/
│   ├── seed-admin.ts            # Create first admin user
│   ├── seed-demo.ts             # Seed demo boards and data
│   ├── migrate-data.js          # SQLite → PostgreSQL data migration
│   ├── synthesis-worker.js      # Background synthesis compilation worker
│   └── synthesize.sh            # Synthesis helper script
├── src/
│   ├── app/
│   │   ├── page.tsx             # Landing page
│   │   ├── globals.css          # Theme styles (light + dark)
│   │   ├── layout.tsx           # Root layout + server init
│   │   ├── auth/                # Login, signup, verify, forgot/reset password
│   │   ├── dashboard/page.tsx   # Board selection grid
│   │   ├── editor/page.tsx      # Online Verilog IDE (Monaco + Synthesis)
│   │   ├── monitor/[boardId]/   # UART + SSH + Camera + Virtual I/O
│   │   ├── pynq/[boardId]/      # PYNQ Jupyter SoC lab
│   │   ├── admin/               # User & board management
│   │   ├── researcher/          # Analytics, notebooks, reservations, batch, API keys
│   │   ├── history/page.tsx     # Job & session history
│   │   ├── profile/page.tsx     # User profile & stats
│   │   ├── settings/page.tsx    # User settings
│   │   ├── status/page.tsx      # System status page
│   │   ├── help/page.tsx        # Help documentation
│   │   └── api/                 # 18+ API route groups
│   ├── components/
│   │   ├── navbar.tsx           # Navigation bar (responsive)
│   │   ├── board-card.tsx       # Board status card
│   │   ├── upload-zone.tsx      # Drag-and-drop upload
│   │   ├── terminal.tsx         # WebSocket UART terminal
│   │   ├── ssh-terminal.tsx     # WebSocket SSH terminal
│   │   ├── camera-feed.tsx      # MJPEG camera viewer
│   │   ├── virtual-io.tsx       # Switches, buttons, LEDs
│   │   ├── confirm-modal.tsx    # Reusable confirmation modal
│   │   └── theme-provider.tsx   # Light/dark theme toggle
│   └── lib/
│       ├── init/index.ts        # Server initialization & service bootstrap
│       ├── api-utils.ts         # Shared API error handler wrapper
│       ├── audit.ts             # Audit logging utility
│       ├── db/
│       │   ├── schema.ts        # Drizzle ORM schema (16 tables)
│       │   ├── index.ts         # PostgreSQL connection pool + compatibility layer
│       │   └── migrate.ts       # Auto-migration (DDL)
│       ├── auth/
│       │   ├── jwt.ts           # JWT sign/verify
│       │   ├── password.ts      # bcrypt hash/verify
│       │   ├── email.ts         # Email verification (SMTP)
│       │   ├── session.ts       # Session helpers
│       │   ├── crypto.ts        # Token generation
│       │   └── rate-limiter.ts  # Login rate limiting + lockout
│       ├── fpga/
│       │   ├── programmer.ts    # FPGA programming abstraction
│       │   ├── queue.ts         # Job queue with board mutex
│       │   ├── detect.ts        # Board auto-detection
│       │   ├── reset.ts         # FPGA reset on session end
│       │   ├── bitstream-validator.ts  # File validation
│       │   └── demo-runner.ts   # Demo mode runner
│       ├── hardware/
│       │   ├── uart.ts          # Serial port service
│       │   ├── ssh.ts           # SSH connection service
│       │   ├── camera.ts        # MediaMTX camera streaming service
│       │   ├── connection-manager.ts # Pooled SSH client manager with in-flight deduplication
│       │   ├── device-registry.ts # Hardware node & serial device discovery
│       │   ├── pynq-discovery.ts # mDNS / ARP / IP detection for PYNQ boards
│       │   ├── pynq-telemetry.ts # Real PYNQ die temp, CPU & frequency monitoring
│       │   └── board-health.ts  # Multi-stage TCP and command diagnostics
│       ├── server/
│       │   ├── ws-handlers.ts   # WebSocket streaming handlers (UART, SSH, Camera, Logs)
│       │   ├── websocket-auth.ts # WebSocket session verification and auth
│       │   └── jupyter-proxy.ts # Reverse proxy for on-board PYNQ Jupyter servers
│       └── sessions/
│           └── enforcer.ts      # Session timeout enforcer + FPGA reset
└── uploads/                     # User uploads & synthesis workspaces (gitignored)
```

---

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

---

## Troubleshooting

| Issue                               | Solution                                                              |
|-------------------------------------|-----------------------------------------------------------------------|
| `openFPGALoader: not found`         | Install: `apt install openfpgaloader` or build from source            |
| `Permission denied: /dev/ttyUSB0`   | `sudo usermod -aG dialout $USER` then re-login                       |
| SMTP emails not sending             | Check SMTP credentials in `.env.local`; for dev, check console logs   |
| Camera feed not working             | Ensure `ffmpeg` installed, camera device exists: `ls /dev/video*`     |
| WebSocket connection failed         | Ensure you're using `node server.js`, not `next dev` directly         |
| Build fails with serialport         | Run `npm rebuild` to rebuild native modules                           |
| PostgreSQL connection refused       | Check `DATABASE_URL` in `.env.local`; ensure PostgreSQL is running    |
| Synthesis fails with "not found"    | Install Yosys: `apt install yosys`; NextPNR: `apt install nextpnr-ice40` |
| Migration script errors             | Ensure source SQLite DB exists and target PostgreSQL DB is created    |

---

## License

MIT
