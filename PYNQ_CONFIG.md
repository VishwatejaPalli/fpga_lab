# PYNQ-Z2 Board Configuration & Setup Guide

This guide details how to configure a **TUL PYNQ-Z2 (Zynq-7000)** board for integration with the FPGA Remote Lab platform.

---

## 1. Default Hardware & Service Credentials

| Parameter                    | Default Value  | Notes                                  |
| :----------------------------|:---------------| :--------------------------------------|
| **Default SSH Username**     | `xilinx`       | Factory default PYNQ Linux user        |
| **Default SSH Password**     | `xilinx`       | Encrypted at rest in database          |
| **Default SSH Port**         | `22`           | standard SSH port                      |
| **Default Jupyter Port**     | `9090`         | Accessible at `http://<board-ip>:9090` |
| **Default Jupyter Password** | `xilinx`       | Required for direct web access         |
| **Default Direct IP (USB)**  | `192.168.2.99` | When connected via Micro-USB cable     |
| **Network IP (Ethernet)**    | `DHCP assigned`| Obtain via router or `hostname -I`     |

---

## 2. Step-by-Step Setup Instructions

### Step 1: Initial Board Preparation
1. Download the latest PYNQ-Z2 SD Card image from [pynq.io](https://www.pynq.io/).
2. Flash the `.img` file to a 16GB+ MicroSD card using **BalenaEtcher** or `dd`.
3. Set the board boot jumper to **SD** mode (JP7 jumper set to SD position).
4. Insert the MicroSD card, connect Ethernet to your network router, and plug in the 5V power cable.
5. Turn ON the power switch (SW7). Wait 60 seconds for the DONE LED (LD13) to illuminate green.

---

### Step 2: Register Board in FPGA Lab Platform

You can register the board via the **CLI command** or through the **Admin Web UI**:

#### Option A: One-Command CLI Registration (Recommended)
Run the automated board registration script directly from the repository root:

```bash
npx tsx scripts/register-board.ts --ip 192.168.171.108 --name "PYNQ-Z2 Remote Lab Board"
```

#### Option B: Admin Web UI Registration
1. Log into the FPGA Remote Lab as an **Admin** user.
2. Navigate to the **Admin Dashboard** (`/admin`).
3. Click **Add New FPGA Board** and enter the following parameters:

```text
Board Name:            PYNQ-Z2 Remote Lab Board
Board Type:            pynq-z2
FPGA Family:           xc7z020clg400-1 (Zynq-7000)
IP Address:            192.168.171.108
SSH Username:          xilinx
SSH Password:          xilinx
Connection Type:       network
Session Timeout (min): 30
Capabilities:          led, switches, uart, camera, ethernet
```

4. Save the board configuration. The platform will automatically verify connectivity.

---

### Step 3: Enable Global Access From Anywhere (Public Tunnel Setup)

To access the FPGA platform and its connected boards (`192.168.171.108`) from anywhere on the internet:

#### Option A: Ngrok Tunnel (Fastest)
1. Install Ngrok or set your authtoken in `.env.local`:
   ```env
   NGROK_AUTHTOKEN="your_ngrok_authtoken"
   NGROK_DOMAIN="your-domain.ngrok-free.app" # optional static domain
   ```
2. Start the tunnel:
   ```bash
   ngrok http 3000
   ```
3. Update `NEXT_PUBLIC_APP_URL` in `.env.local` to match your public Ngrok URL:
   ```env
   NEXT_PUBLIC_APP_URL="https://your-domain.ngrok-free.app"
   ```

#### Option B: Cloudflare Tunnel (Free & Production Ready)
1. Install Cloudflared: `sudo apt install cloudflared`
2. Start a Quick Tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
3. Copy the generated `https://<subdomain>.trycloudflare.com` URL and set `NEXT_PUBLIC_APP_URL` in `.env.local`.

---

### Step 3: Seed Lab Starter Templates (Optional)

To provide starter `.ipynb` notebooks for students when they log in for the first time:

1. SSH into the board from your terminal:
   ```bash
   ssh xilinx@192.168.1.105
   # Password: xilinx
   ```

2. Create the master template directory:
   ```bash
   mkdir -p /home/xilinx/cloudlab/templates
   ```

3. Copy any starter notebooks, overlay `.bit` files, or `.hwh` files into `/home/xilinx/cloudlab/templates/`:
   ```bash
   # Example: Place lab1.ipynb or base.bit in templates
   cp /home/xilinx/jupyter_notebooks/base/base.ipynb /home/xilinx/cloudlab/templates/
   ```

---

### Step 4: Verify Student Isolated Workspaces

When a student clicks **Launch Jupyter** from the dashboard (`/pynq/<boardId>`):

1. The platform executes the automated session preparation script:
   - Validates active session reservation.
   - Verifies board SSH port 22 & Jupyter REST API port 9090.
   - Checks available disk space (`>= 500MB`).
   - Automatically provisions `/home/xilinx/cloudlab/users/usr_<sanitizedId>/`.
   - Seeds starter templates from `/home/xilinx/cloudlab/templates/` on first login.
   - Sets strict `chmod 700` user permissions.
2. The student is routed directly to their isolated Jupyter subpath:
   ```text
   http://lab.org/pynq-proxy/<boardId>/tree/cloudlab/users/usr_<sanitizedId>
   ```

---

## 3. Troubleshooting & Diagnostics

| Stage              | Issue                     | Resolution                                                        |
| :------------------| :-------------------------| :-----------------------------------------------------------------|
|`SSH_CONNECT`       | SSH Connection Timed Out  | 1. Ensure PYNQ board power switch (SW7) is ON & DONE LED (LD13) is GREEN.<br>2. Check Ethernet cable connection.<br>3. Verify IP connectivity: `ping 192.168.171.108`. If IP changed, update via `npx tsx scripts/register-board.ts --ip <new-ip>`.<br>4. For testing without physical board, set `ENABLE_MOCK_HARDWARE=true` in `.env.local`. |
|`DISK_SPACE`        | Free Space Below 500 MB   | Clear old temporary files on board: `rm -rf /tmp/*`               |
|`JUPYTER_API`       | Jupyter API Not Responding| Restart Jupyter service on board: `sudo systemctl restart jupyter`|
|`BOARD_RESERVATION` | Board Busy                | End existing active session from Dashboard or Admin Panel         |

