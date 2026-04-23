"use client";

import Navbar from "@/components/navbar";
import { useState } from "react";

export default function HelpPage() {
  const [open, setOpen] = useState<string | null>("getting-started");

  function toggle(id: string) {
    setOpen(open === id ? null : id);
  }

  return (
    <div className="min-h-screen min-h-[100dvh]">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Help & Documentation</h1>
        <p className="text-sm sm:text-base text-muted mb-6">
          Learn how to use the VCE Cloud FPGA Lab
        </p>

        {/* Getting Started */}
        <Section id="getting-started" title="Getting Started" open={open === "getting-started"} onToggle={() => toggle("getting-started")}>
          <ol className="space-y-3 text-sm text-gray-700 list-decimal list-inside">
            <li><strong>Sign up</strong> with your college email address (must end in <code className="text-primary bg-primary/5 px-1 rounded">.org</code> or <code className="text-primary bg-primary/5 px-1 rounded">.edu</code>).</li>
            <li><strong>Log in</strong> to access the Dashboard.</li>
            <li><strong>Select a free board</strong> from the Dashboard — green badges indicate available boards.</li>
            <li><strong>Upload your bitstream</strong> (.bit or .bin file) on the Program page and click &quot;Program Board.&quot;</li>
            <li><strong>Monitor output</strong> — after programming succeeds, a hardware session starts automatically. Use the terminal for UART and the camera feed to observe the board.</li>
            <li><strong>End your session</strong> when done to free the board for others.</li>
          </ol>
        </Section>

        {/* Supported Boards */}
        <Section id="boards" title="Supported Boards" open={open === "boards"} onToggle={() => toggle("boards")}>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="py-2 pr-4">Board</th>
                  <th className="py-2 pr-4">FPGA Family</th>
                  <th className="py-2 pr-4">Tool</th>
                  <th className="py-2">File Format</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {boards.map((b, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-medium">{b.name}</td>
                    <td className="py-2 pr-4">{b.family}</td>
                    <td className="py-2 pr-4">{b.tool}</td>
                    <td className="py-2"><code className="text-primary bg-primary/5 px-1 rounded">{b.format}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {boards.map((b, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-semibold text-gray-900">{b.name}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-600">
                  <span className="text-gray-400">Family</span><span>{b.family}</span>
                  <span className="text-gray-400">Tool</span><span>{b.tool}</span>
                  <span className="text-gray-400">Format</span><span>{b.format}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* UART Terminal */}
        <Section id="uart" title="UART Terminal" open={open === "uart"} onToggle={() => toggle("uart")}>
          <div className="text-sm text-gray-700 space-y-2">
            <p>The UART terminal connects via WebSocket to the board&apos;s serial port. Default baud rate is <strong>115200</strong>.</p>
            <p>You can type in the terminal to send data to the FPGA. Received data appears in real-time.</p>
            <p>In demo mode (no hardware connected), simulated UART output is shown to demonstrate the interface.</p>
          </div>
        </Section>

        {/* Camera Feed */}
        <Section id="camera" title="Camera Feed" open={open === "camera"} onToggle={() => toggle("camera")}>
          <div className="text-sm text-gray-700 space-y-2">
            <p>Each board with a connected camera streams a live MJPEG feed so you can observe LEDs, 7-segment displays, and other physical outputs.</p>
            <p>If no camera is available, a simulated board visualization is shown with animated LEDs and display.</p>
          </div>
        </Section>

        {/* Demo Mode */}
        <Section id="demo" title="Demo Mode" open={open === "demo"} onToggle={() => toggle("demo")}>
          <div className="text-sm text-gray-700 space-y-2">
            <p>When no physical FPGA hardware is connected, the system runs in demo mode:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>A sample <code className="text-primary bg-primary/5 px-1 rounded">blinky.bit</code> file is available for download on the Program page.</li>
              <li>Programming simulation shows realistic openFPGALoader output with progress logs.</li>
              <li>UART terminal shows simulated FPGA serial output.</li>
              <li>Camera feed shows an animated board visualization.</li>
            </ul>
          </div>
        </Section>

        {/* Troubleshooting */}
        <Section id="troubleshoot" title="Troubleshooting" open={open === "troubleshoot"} onToggle={() => toggle("troubleshoot")}>
          <div className="text-sm text-gray-700 space-y-4">
            <div>
              <h3 className="font-medium mb-1">&quot;No boards available&quot; on Dashboard</h3>
              <p className="text-muted">Boards need to be registered by an administrator. Contact your lab admin or run the seed script to add demo boards.</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Programming fails</h3>
              <p className="text-muted">Ensure the board is in &quot;free&quot; status and your bitstream file matches the board&apos;s FPGA family (.bit for Xilinx, .sof for Intel, .bin for Lattice).</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Session expired while working</h3>
              <p className="text-muted">Each board has a configurable session timeout (default 30 minutes). Re-program to start a new session.</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Can&apos;t sign up</h3>
              <p className="text-muted">Registration requires a valid college email address. Contact your administrator if you need a different email domain whitelisted.</p>
            </div>
          </div>
        </Section>

        {/* Admin Guide */}
        <Section id="admin" title="Administrator Guide" open={open === "admin"} onToggle={() => toggle("admin")}>
          <div className="text-sm text-gray-700 space-y-2">
            <p>Administrators can manage boards, users, and view system-wide activity from the <strong>Admin</strong> panel (visible in the navbar for admin accounts).</p>
            <h3 className="font-medium mt-3 mb-1">Setup Commands</h3>
            <div className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs overflow-x-auto">
              <p className="text-gray-500"># Create admin account</p>
              <p className="whitespace-nowrap">npx tsx scripts/seed-admin.ts --email admin@college.org --password admin123</p>
              <p className="mt-2 text-gray-500"># Seed demo boards (for testing without hardware)</p>
              <p className="whitespace-nowrap">npx tsx scripts/seed-demo.ts</p>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}

/* ---- Data / Sub-components ---- */

const boards = [
  { name: "Basys 3", family: "Xilinx Artix-7", tool: "openFPGALoader", format: ".bit" },
  { name: "Nexys A7", family: "Xilinx Artix-7", tool: "openFPGALoader", format: ".bit" },
  { name: "PYNQ-Z2", family: "Xilinx Zynq-7020", tool: "openFPGALoader", format: ".bit" },
  { name: "DE10-Lite", family: "Intel MAX 10", tool: "openFPGALoader", format: ".sof" },
  { name: "iCEBreaker", family: "Lattice iCE40", tool: "openFPGALoader", format: ".bin" },
];

function Section({ id, title, open, onToggle, children }: {
  id: string; title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-white rounded-xl border border-gray-200 mb-3 overflow-hidden shadow-sm">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 sm:px-6 py-4 text-left active:bg-gray-50 transition-colors touch-manipulation">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h2>
        <span className={`text-gray-400 text-sm transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && <div className="px-4 sm:px-6 pb-5">{children}</div>}
    </section>
  );
}
