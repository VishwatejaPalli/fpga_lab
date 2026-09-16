"use client";

import Navbar from "@/components/navbar";
import { useState } from "react";
import {
  RocketIcon,
  SlidersIcon,
  ZapIcon,
  MonitorIcon,
  SettingsIcon,
  CompassIcon,
  RadioIcon,
  TerminalIcon,
  FlaskIcon,
  ShieldIcon,
  WrenchIcon,
} from "@/components/icons";

export default function HelpPage() {
  const [open, setOpen] = useState<string | null>("getting-started");

  function toggle(id: string) {
    setOpen(open === id ? null : id);
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background text-foreground">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-accent bg-accent/10 border border-accent/20 px-2.5 py-0.5 rounded-full shadow-sm">
              Lab Knowledge Base
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground/90 to-muted">
            Help & Documentation
          </h1>
          <p className="text-sm sm:text-base text-muted mt-1.5 max-w-2xl">
            Complete architectural reference and user guides for remote FPGA programming, Cloud IDE synthesis, live hardware telemetry, and researcher workflows.
          </p>
        </div>

        {/* 1. Getting Started */}
        <Section
          id="getting-started"
          icon={<RocketIcon className="w-5 h-5 text-primary" />}
          title="Getting Started & Core Workflow"
          open={open === "getting-started"}
          onToggle={() => toggle("getting-started")}
        >
          <div className="space-y-4 text-sm text-muted">
            <p>
              The VCE Cloud FPGA Lab provides direct, low-latency web access to physical FPGA development hardware. Follow these steps to begin:
            </p>
            <ol className="space-y-3 list-decimal list-inside text-foreground/90 pl-1">
              <li>
                <strong>Sign Up & Authenticate</strong> — Register using your authorized institution email address. Verify your account via the verification email before logging in.
              </li>
              <li>
                <strong>Select an Available Board</strong> — Navigate to the <strong className="text-foreground">Dashboard</strong>. Boards displaying a green <span className="badge badge-free text-[11px] font-mono">Free</span> badge are ready for exclusive reservation.
              </li>
              <li>
                <strong>Deploy Bitstream or Open IDE</strong> — You can either upload an existing pre-compiled bitstream (<code className="text-xs bg-muted/20 px-1 py-0.5 rounded font-mono text-accent">.bit</code>, <code className="text-xs bg-muted/20 px-1 py-0.5 rounded font-mono text-accent">.bin</code>, <code className="text-xs bg-muted/20 px-1 py-0.5 rounded font-mono text-accent">.sof</code>) on the <strong>Program</strong> page, or write Verilog/SystemVerilog in the browser-based <strong>Cloud IDE</strong>.
              </li>
              <li>
                <strong>Interactive Hardware Session</strong> — Upon successful programming, an exclusive hardware session starts. You have real-time access to the live camera stream, bidirectional UART terminal, virtual GPIO switches/buttons, and SSH shell (for SoC boards).
              </li>
              <li>
                <strong>Conclude or Extend Session</strong> — Keep track of your session countdown. Extend if you need more testing time, or click <strong className="text-red-400">End Session</strong> to automatically trigger the FPGA blanking protocol and free the board for your peers.
              </li>
            </ol>
          </div>
        </Section>

        {/* 2. Supported Boards & Toolchains */}
        <Section
          id="boards"
          icon={<SlidersIcon className="w-5 h-5 text-purple-500" />}
          title="Supported Hardware & Toolchains"
          open={open === "boards"}
          onToggle={() => toggle("boards")}
        >
          <div className="space-y-3 text-sm text-muted">
            <p>
              The platform connects to physical FPGA hardware via JTAG programmer daemons and direct serial/network buses. Supported target architectures include:
            </p>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto rounded-lg border border-border bg-card/50">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-muted/10 border-b border-border text-foreground/70 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Board Model</th>
                    <th className="py-2.5 px-3">FPGA Silicon</th>
                    <th className="py-2.5 px-3">Programming Tool</th>
                    <th className="py-2.5 px-3">Bitstream Format</th>
                    <th className="py-2.5 px-3">Capabilities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-foreground/80">
                  {boards.map((b, i) => (
                    <tr key={i} className="hover:bg-muted/5 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">{b.name}</td>
                      <td className="py-2.5 px-3 text-muted">{b.family}</td>
                      <td className="py-2.5 px-3 text-accent">{b.tool}</td>
                      <td className="py-2.5 px-3">
                        <span className="bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded text-[11px]">
                          {b.format}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted">{b.caps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-2.5">
              {boards.map((b, i) => (
                <div key={i} className="card p-3 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{b.name}</span>
                    <span className="bg-accent/10 text-accent px-1.5 py-0.5 rounded text-[10px]">{b.format}</span>
                  </div>
                  <div className="text-muted text-[11px]">Silicon: {b.family}</div>
                  <div className="text-muted text-[11px]">Tool: {b.tool}</div>
                  <div className="text-muted text-[11px]">I/O: {b.caps}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 3. Cloud IDE, Synthesis & Waveforms */}
        <Section
          id="ide"
          icon={<ZapIcon className="w-5 h-5 text-amber-500" />}
          title="Cloud IDE, RTL Synthesis & Waveform Viewer"
          open={open === "ide"}
          onToggle={() => toggle("ide")}
        >
          <div className="space-y-4 text-sm text-muted">
            <p>
              The embedded Web IDE (<code className="text-xs bg-muted/20 px-1 py-0.5 rounded font-mono text-accent">/editor</code>) lets you design, simulate, and synthesize hardware without installing multi-gigabyte EDA suites locally.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="card p-3.5 space-y-1.5 bg-card/60">
                <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                  <MonitorIcon className="w-4 h-4 text-primary" />
                  <span>Monaco RTL Editor</span>
                </h4>
                <p className="text-xs text-muted leading-relaxed">
                  Full syntax highlighting, linting, and multi-file project workspace support for Verilog (<code className="font-mono">.v</code>), SystemVerilog (<code className="font-mono">.sv</code>), and VHDL (<code className="font-mono">.vhd</code>).
                </p>
              </div>

              <div className="card p-3.5 space-y-1.5 bg-card/60">
                <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4 text-amber-500" />
                  <span>Yosys RTL Synthesis</span>
                </h4>
                <p className="text-xs text-muted leading-relaxed">
                  Server-side RTL elaboration generates synthesized gate-level netlists, SVG schematics, cell utilization counts, and timing estimates.
                </p>
              </div>

              <div className="card p-3.5 space-y-1.5 bg-card/60">
                <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                  <SlidersIcon className="w-4 h-4 text-indigo-500" />
                  <span>In-Browser VCD Waveform Viewer</span>
                </h4>
                <p className="text-xs text-muted leading-relaxed">
                  Inspect behavioral simulation traces with real digital pulses, multi-bit bus transitions, draggable time cursors, and instant <code className="font-mono text-accent">HEX / BIN / DEC</code> radix switching.
                </p>
              </div>

              <div className="card p-3.5 space-y-1.5 bg-card/60">
                <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                  <CompassIcon className="w-4 h-4 text-cyan-500" />
                  <span>Device Floorplan</span>
                </h4>
                <p className="text-xs text-muted leading-relaxed">
                  Visual slice mapping showing placement of Look-Up Tables (LUTs), Flip-Flops (FFs), and DSP blocks across target clock regions.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300">
              <div className="text-slate-500 mb-1">// Example testbench VCD dump snippet for simulation:</div>
              <div>initial begin</div>
              <div className="pl-4 text-emerald-400">$dumpfile(&quot;waves.vcd&quot;);</div>
              <div className="pl-4 text-emerald-400">$dumpvars(0, tb_counter);</div>
              <div>end</div>
            </div>
          </div>
        </Section>

        {/* 4. Real-time Peripheral Access */}
        <Section
          id="peripherals"
          icon={<RadioIcon className="w-5 h-5 text-cyan-500" />}
          title="Hardware Streaming: Camera, UART & SSH"
          open={open === "peripherals"}
          onToggle={() => toggle("peripherals")}
        >
          <div className="space-y-4 text-sm text-muted">
            <p>
              All peripheral streams connect to physical hardware nodes without emulation layers:
            </p>

            <div className="space-y-3">
              <div className="border-l-2 border-primary pl-3 space-y-1">
                <h4 className="font-semibold text-foreground text-xs">Live Low-Latency Camera Feed</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Real USB camera sensors mounted above the FPGA boards stream physical video via MediaMTX over RTSP and WebRTC. You can visually verify LED blink rates, PWM dimming, seven-segment counter states, and peripheral displays in real time.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500 pl-3 space-y-1">
                <h4 className="font-semibold text-foreground text-xs">Bidirectional Serial UART Console</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Streams serial I/O directly to and from the board&apos;s UART-USB bridge (<code className="font-mono text-xs bg-muted/20 px-1 py-0.5 rounded">/dev/ttyUSB*</code>) at standard 115200 baud over WebSocket. Type directly in the terminal to transmit characters to the FPGA logic.
                </p>
              </div>

              <div className="border-l-2 border-cyan-500 pl-3 space-y-1">
                <h4 className="font-semibold text-foreground text-xs">Interactive SSH Terminal</h4>
                <p className="text-xs text-muted leading-relaxed">
                  For SoC development platforms (such as PYNQ-Z2), an authenticated terminal emulator streams bash sessions with pty resize handling and strict security filtering.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* 5. PYNQ-Z2 & Jupyter Integration */}
        <Section
          id="pynq"
          icon={<TerminalIcon className="w-5 h-5 text-emerald-500" />}
          title="PYNQ-Z2 & Jupyter Notebooks"
          open={open === "pynq"}
          onToggle={() => toggle("pynq")}
        >
          <div className="space-y-3 text-sm text-muted">
            <p>
              The platform features native integration for Xilinx PYNQ-Z2 Linux-enabled FPGA boards:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 pl-1 text-xs sm:text-sm">
              <li>
                <strong>Embedded Jupyter Proxy</strong> — Access the on-board Jupyter server directly inside your authenticated browser session via reverse WebSocket proxying on port <code className="font-mono text-accent">9090</code>.
              </li>
              <li>
                <strong>Real-Time Hardware Telemetry</strong> — Live dashboard tracking CPU core temperature, current clock frequencies, RAM memory utilization, and system uptime read directly from Linux sysfs nodes.
              </li>
              <li>
                <strong>Python Bitstream Overlays</strong> — Load programmable logic overlays directly using Python:
                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 font-mono text-xs text-emerald-400 mt-1.5">
                  from pynq import Overlay<br />
                  ol = Overlay(&quot;/home/xilinx/lab_bitstream.bit&quot;)<br />
                  ol.download()
                </div>
              </li>
            </ul>
          </div>
        </Section>

        {/* 6. Researcher Lab & Batch Programming */}
        <Section
          id="researcher"
          icon={<FlaskIcon className="w-5 h-5 text-pink-500" />}
          title="Researcher Workspace & Batch JTAG"
          open={open === "researcher"}
          onToggle={() => toggle("researcher")}
        >
          <div className="space-y-3 text-sm text-muted">
            <p>
              Users with the <span className="font-mono text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">researcher</span> role have access to advanced batch tooling (<code className="text-xs bg-muted/20 px-1 py-0.5 rounded font-mono text-accent">/researcher</code>):
            </p>

            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div className="card p-3 space-y-1">
                <span className="font-bold text-foreground">Parallel Batch Programming</span>
                <p className="text-muted leading-relaxed">
                  Trigger coordinated bitstream programming across multiple FPGA boards simultaneously for distributed test suites.
                </p>
              </div>

              <div className="card p-3 space-y-1">
                <span className="font-bold text-foreground">Hardware Reservations</span>
                <p className="text-muted leading-relaxed">
                  Reserve dedicated time slots on specific FPGA boards up to 4 hours in advance for uninterrupted research sessions.
                </p>
              </div>

              <div className="card p-3 space-y-1">
                <span className="font-bold text-foreground">Lab Notebooks</span>
                <p className="text-muted leading-relaxed">
                  Document observations, timing measurements, and synthesis findings with markdown support, tags, and pinning.
                </p>
              </div>

              <div className="card p-3 space-y-1">
                <span className="font-bold text-foreground">REST API Keys</span>
                <p className="text-muted leading-relaxed">
                  Generate personal API access tokens to integrate FPGA synthesis and programming directly into external CI/CD pipelines.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* 7. Session Lifecycle & Safety */}
        <Section
          id="sessions"
          icon={<ShieldIcon className="w-5 h-5 text-red-500" />}
          title="Session Lifecycle & Board Protection"
          open={open === "sessions"}
          onToggle={() => toggle("sessions")}
        >
          <div className="space-y-3 text-sm text-muted">
            <p>
              To maintain fair resource distribution and protect physical boards from damage:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90 pl-1 text-xs sm:text-sm">
              <li>
                <strong>Exclusive Access Locking</strong> — Only one user can hold a session on an FPGA board at any given time. Other users see an <span className="badge badge-busy text-[10px] font-mono">In Use</span> badge and can subscribe to availability alerts.
              </li>
              <li>
                <strong>Automatic FPGA Blanking & Reset</strong> — When a session ends or expires, the system automatically runs the board reset protocol (<code className="font-mono text-xs">openFPGALoader --reset</code> or PYNQ PL reset) to prevent persistent high-current states.
              </li>
              <li>
                <strong>Re-programming within Active Session</strong> — You can program multiple bitstreams consecutively without losing your active session or waiting in the queue.
              </li>
              <li>
                <strong>Session Extensions</strong> — You can request up to 30 minutes of additional testing time before expiration if no conflicting reservations are queued.
              </li>
            </ul>
          </div>
        </Section>

        {/* 8. Troubleshooting & FAQ */}
        <Section
          id="troubleshoot"
          icon={<WrenchIcon className="w-5 h-5 text-amber-500" />}
          title="Troubleshooting & FAQs"
          open={open === "troubleshoot"}
          onToggle={() => toggle("troubleshoot")}
        >
          <div className="space-y-4 text-sm text-muted">
            <div className="card p-3.5 space-y-1 border border-border">
              <h4 className="font-semibold text-foreground text-xs">Bitstream Programming Fails or Times Out</h4>
              <p className="text-xs text-muted leading-relaxed">
                Verify that your bitstream matches the board&apos;s exact FPGA part number (e.g. <code className="font-mono">xc7a35tcpg236-1</code> for Basys 3). Ensure the board status is <span className="badge badge-free text-[10px]">Free</span> and check the real-time JTAG logs in the modal.
              </p>
            </div>

            <div className="card p-3.5 space-y-1 border border-border">
              <h4 className="font-semibold text-foreground text-xs">Serial UART Port Output is Blank</h4>
              <p className="text-xs text-muted leading-relaxed">
                Confirm your Verilog/VHDL design instantiates a UART transmitter configured for <strong className="text-foreground">115200 baud</strong> (8 data bits, 1 stop bit, no parity) matching the host system baud rate.
              </p>
            </div>

            <div className="card p-3.5 space-y-1 border border-border">
              <h4 className="font-semibold text-foreground text-xs">Camera Video Stream Unreachable</h4>
              <p className="text-xs text-muted leading-relaxed">
                Camera feeds require WebRTC/RTSP support. If behind strict institutional firewalls that block UDP ports, ensure WebRTC TCP fallback is enabled in your network settings.
              </p>
            </div>

            <div className="card p-3.5 space-y-1 border border-border">
              <h4 className="font-semibold text-foreground text-xs">Synthesis Worker Shows &quot;Yosys Not Found&quot;</h4>
              <p className="text-xs text-muted leading-relaxed">
                The compilation worker runs server-side. Contact the lab administrator to ensure <code className="font-mono">yosys</code>, <code className="font-mono">nextpnr-ice40</code>, and <code className="font-mono">iverilog</code> are installed on the server host.
              </p>
            </div>
          </div>
        </Section>

        {/* 9. Administrator Setup Commands */}
        <Section
          id="admin"
          icon={<ZapIcon className="w-5 h-5 text-amber-500" />}
          title="Administrator Reference"
          open={open === "admin"}
          onToggle={() => toggle("admin")}
        >
          <div className="space-y-3 text-sm text-muted">
            <p>
              Administrative functions are accessible via the <strong className="text-foreground">Admin</strong> panel (<code className="text-xs bg-muted/20 px-1 py-0.5 rounded font-mono text-accent">/admin</code>) for users with the <code className="font-mono text-xs">admin</code> role.
            </p>

            <h4 className="font-semibold text-foreground text-xs mt-3">CLI Management Commands</h4>
            <div className="bg-slate-900 border border-slate-800 text-emerald-400 p-3.5 rounded-lg font-mono text-xs space-y-2 overflow-x-auto">
              <div className="text-slate-500"># Create initial administrator account:</div>
              <div className="text-slate-200">npx tsx scripts/seed-admin.ts --email admin@college.edu --password SecureAdminPass123!</div>

              <div className="text-slate-500 pt-2"># Run PostgreSQL database migrations:</div>
              <div className="text-slate-200">npx tsx src/lib/db/migrate.ts</div>

              <div className="text-slate-500 pt-2"># Start background synthesis & simulation worker:</div>
              <div className="text-slate-200">node scripts/synthesis-worker.js</div>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}

/* ---- Data / Sub-components ---- */

const boards = [
  { name: "Basys 3", family: "Xilinx Artix-7 (XC7A35T)", tool: "openFPGALoader", format: ".bit", caps: "LEDs, Switches, 7-Seg, UART, Camera" },
  { name: "Nexys A7", family: "Xilinx Artix-7 (XC7A100T)", tool: "openFPGALoader", format: ".bit", caps: "LEDs, Switches, 7-Seg, RGB, UART, Camera" },
  { name: "PYNQ-Z2", family: "Xilinx Zynq-7020 (XC7Z020)", tool: "openFPGALoader / pynq_ssh", format: ".bit", caps: "Jupyter, SSH, UART, Camera, HDMI, GPIO" },
  { name: "DE10-Lite", family: "Intel MAX 10 (10M50DA)", tool: "openFPGALoader", format: ".sof", caps: "LEDs, Switches, 7-Seg, UART, Camera" },
  { name: "iCEBreaker", family: "Lattice iCE40UP5K", tool: "openFPGALoader", format: ".bin", caps: "RGB LED, Buttons, UART, Camera" },
  { name: "Spartan-3E", family: "Xilinx Spartan-3E (XC3S500E)", tool: "openFPGALoader", format: ".bit", caps: "LEDs, Switches, LCD, UART, Camera" },
];

function Section({
  id,
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon?: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="card p-0 mb-4 overflow-hidden border border-border/70 shadow-sm transition-colors">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-4 text-left hover:bg-muted/10 active:bg-muted/20 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          {icon && <div className="shrink-0">{icon}</div>}
          <h2 className="text-base sm:text-lg font-semibold text-foreground">{title}</h2>
        </div>
        <span
          className={`text-muted text-xs transition-transform duration-200 shrink-0 ml-2 ${
            open ? "rotate-180 text-accent" : ""
          }`}
        >
          ▼
        </span>
      </button>
      {open && (
        <div className="px-4 sm:px-6 pb-6 pt-1 border-t border-border/40 animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </section>
  );
}
