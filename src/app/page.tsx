import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="bg-white border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/vce-logo.png" alt="VCE" className="w-10 h-10 object-contain" />
          <span className="font-bold text-lg text-primary">FPGA Remote Lab</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/auth/login"
            className="text-gray-500 hover:text-primary font-medium transition-colors"
          >
            Log in
          </Link>
          <Link href="/auth/signup" className="btn-primary text-sm">
            Sign up
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl">
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Program FPGAs
            <br />
            <span className="text-primary">from anywhere</span>
          </h1>
          <p className="text-xl text-muted mb-10 max-w-xl mx-auto">
            Upload your bitstream, program real FPGA hardware, and monitor
            outputs — all through your web browser. No lab visit required.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/signup" className="btn-primary text-lg px-8 py-3">
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="text-lg px-8 py-3 border border-border rounded-lg hover:border-primary transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-20 max-w-4xl w-full">
          <div className="card text-left">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="text-lg font-semibold mb-2">Remote Programming</h3>
            <p className="text-muted text-sm">
              Upload bitstreams and program Xilinx, Intel, Lattice, and other
              FPGA boards remotely through JTAG.
            </p>
          </div>
          <div className="card text-left">
            <div className="text-3xl mb-3">📡</div>
            <h3 className="text-lg font-semibold mb-2">Live Monitoring</h3>
            <p className="text-muted text-sm">
              Watch FPGA outputs in real time — camera feed for LEDs, serial
              console for UART, and log messages.
            </p>
          </div>
          <div className="card text-left">
            <div className="text-3xl mb-3">🔒</div>
            <h3 className="text-lg font-semibold mb-2">Session Management</h3>
            <p className="text-muted text-sm">
              Automatic job queuing, board reservation, session timeouts, and
              FPGA reset after each use.
            </p>
          </div>
        </div>

        {/* Supported boards */}
        <div className="mt-16 mb-20">
          <p className="text-muted text-sm mb-4 uppercase tracking-wider">
            Supports any FPGA board
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              "Basys3",
              "Nexys A7",
              "PYNQ-Z2",
              "Spartan-3",
              "DE10-Lite",
              "iCE40",
              "ECP5",
              "Gowin",
            ].map((board) => (
              <span
                key={board}
                className="px-3 py-1.5 bg-card border border-border rounded-full text-sm text-muted"
              >
                {board}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 text-center text-muted text-sm">
        FPGA Remote Lab — Cloud-based FPGA access platform
      </footer>
    </div>
  );
}
