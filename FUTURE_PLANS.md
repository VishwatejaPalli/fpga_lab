# FPGA Remote Lab - Future Functional Improvements

This document outlines potential high-impact functional improvements that could be implemented to elevate the platform to an enterprise-grade/top-tier university remote lab.

## 1. In-Browser Code Editor & Cloud Synthesis
**Goal:** Allow students to write, compile, and deploy hardware descriptions entirely in the browser without installing local CAD tools.
- **Implementation:** Integrate Monaco Editor (VS Code core) into the web interface.
- **Backend:** Setup a Dockerized synthesis pipeline (using open-source tools like Yosys/NextPNR or Xilinx Vivado in headless mode). When a user clicks "Compile", the backend runs synthesis, generates the `.bit` file, and seamlessly queues it for programming.

## 2. Automated Grading & Hardware Testing (Autograder)
**Goal:** Automate the grading process for instructors by testing the physical hardware responses against a script.
- **Implementation:** Instructors upload hidden Python validation scripts.
- **Backend:** When a student submits an assignment, the system programs the board and executes the Python script. The script interacts with the student's hardware via the UART interface (sending stimuli and reading responses) and automatically scores the lab based on correctness.

## 3. Calendar Scheduling & Reservations
**Goal:** Ensure students have guaranteed, uninterrupted access to hardware during busy periods (like finals week).
- **Implementation:** Build a calendar UI where users can reserve 1-hour or 2-hour blocks for specific boards.
- **Backend:** The job queue automatically rejects or pauses jobs from non-reserved users if a reservation block is currently active for a specific board.

## 4. Multi-File Project Uploads (ZIP / Notebooks)
**Goal:** Support complex SoC projects (like PYNQ) that require multiple files to function correctly.
- **Implementation:** Update the upload API to accept `.zip` files.
- **Backend:** The server extracts the zip, deploying the `.bit` file, the `.hwh` (hardware handoff) file, and any custom Jupyter Notebooks (`.ipynb`) directly into the correct directories on the PYNQ board before starting the session.

## 5. Web-Based Logic Analyzer (Waveform Viewer)
**Goal:** Provide deep, visual hardware debugging capabilities in the browser.
- **Implementation:** Integrate a waveform viewer library (such as WaveDrom or Surfer).
- **Backend:** Interface with the Integrated Logic Analyzer (ILA) on the FPGA via XVC (Xilinx Virtual Cable). Capture signal states during execution and stream them to the browser for visual analysis.

## 6. WebRTC Camera Streaming
**Goal:** Drastically reduce bandwidth and latency for the live hardware camera feeds.
- **Implementation:** Replace the current MJPEG-over-WebSockets approach with WebRTC (Real-Time Communication).
- **Backend:** Use a lightweight WebRTC server (like Pion or GStreamer) to capture the USB webcam and peer-to-peer stream 60fps video directly to the student's browser with sub-100ms latency.
