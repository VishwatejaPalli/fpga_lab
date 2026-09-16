# FPGA Remote Lab - Functional Roadmap & Future Improvements

This document tracks completed platform milestones and outlines high-impact upcoming functional improvements to elevate the platform to an enterprise-grade/top-tier university remote hardware laboratory.

---

## ✅ Recently Completed Features

### 1. Interactive Virtual I/O & Automated Stimulus Pattern Generator
- **Keyboard Hotkeys:** Mapped keys `0`–`9` and `A`–`F` for instant switch toggling (`SW0`–`SW15`) and `Space` for push buttons (`BTN0`).
- **Pattern Generator:** Automated test modes including **Binary Counter** (1–10 Hz), **Shift / Walking 1s**, **Clock Pulse Step**, and **Random Stimulus**.

### 2. Camera Stream Controls & Snapshot Tooling
- **WebRTC Streaming:** Low-latency WebRTC live hardware video feed.
- **Digital Zoom & Video Filters:** 100% to 250% digital zoom with brightness/contrast adjustment sliders.
- **1-Click Frame Snapshot:** Generates and downloads timestamped PNG snapshots (`fpga_snapshot_<boardId>.png`) for lab submissions.

### 3. Pre-Flight Bitstream Header Parsing & Chip Verification
- **Xilinx `.bit` Header Inspection:** Client-side binary parsing of uploaded `.bit` files to extract target chip part strings (e.g. `7a35t` for Basys 3 or `7z020` for PYNQ-Z2).
- **Architecture Validation:** Displays target board compatibility badges and alerts users to chip architecture mismatches prior to flashing.

### 4. 1-Click Lab Submission Package Exporter
- **Formatted Report Generator:** One-click export producing downloadable HTML verification reports containing session metadata, hardware state snapshots, and complete UART console log histories.

### 5. Proactive Session Expiration Alerts & Board Waitlists
- **Expiration Alerts:** Interactive floating warning modal when session time drops below 3 minutes with quick `+15m` extension.
- **Availability Waitlist:** "Notify Me When Free" toggle on busy/allocated boards with automated polling toast alerts.

---

## 🔮 Upcoming High-Impact Roadmap Items

### 1. Automated Grading & Hardware Testing (Autograder)
**Goal:** Automate lab assignment grading for instructors by testing physical FPGA hardware responses against validation scripts.
- **Implementation:** Instructors upload hidden Python test scripts.
- **Execution:** Upon submission, the platform programs the FPGA and runs the test script over UART (sending stimulus patterns and validating pin responses) to score the lab automatically.

### 2. Calendar Scheduling & Board Reservations
**Goal:** Guarantee student hardware access during high-traffic periods (such as exam weeks).
- **Implementation:** Interactive calendar UI for booking 1-hour or 2-hour reserved blocks on target boards.
- **Backend:** Reservation-enforced job queues that prioritize reserved time slots and prevent session hijacking.

### 3. Multi-File Project Uploads (ZIP / Notebooks)
**Goal:** Support complex SoC projects (like PYNQ) requiring multiple associated design files.
- **Implementation:** Accept `.zip` archive uploads containing `.bit` bitstreams, `.hwh` hardware handoff files, and `.ipynb` Jupyter notebooks.
- **Backend:** Automatically extract and deploy files to designated directories on physical PYNQ targets prior to session launch.

### 4. Web-Based Logic Analyzer (WaveDrom / VCD Export)
**Goal:** Advanced visual waveform debugging and signal export in the browser.
- **Implementation:** Integrate WaveDrom waveform rendering and support exporting captured Logic Analyzer history into standard Value Change Dump (`.vcd`) files for analysis in GTKWave.

### 5. Isolated Per-User PYNQ Workspaces
**Goal:** Ensure student project isolation and persistence on shared PYNQ Linux targets.
- **Implementation:** SSH service automatically provisions per-user directories (`/home/xilinx/cloudlab/<userId>`) and symlinks Jupyter root per session.

### 6. LTI / LMS (Canvas / Blackboard) Integration
**Goal:** Seamless integration into university Learning Management Systems.
- **Implementation:** LTI 1.3 authentication for Single Sign-On (SSO) and automatic gradebook syncing for completed FPGA lab assignments.
