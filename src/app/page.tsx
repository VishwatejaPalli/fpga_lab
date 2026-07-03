import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background text-foreground">
      {/* Background Animated Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen animate-glow pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[150px] mix-blend-screen animate-glow pointer-events-none" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-cyan-600/10 rounded-full blur-[100px] mix-blend-screen animate-glow pointer-events-none" style={{ animationDelay: '4s' }}></div>

      {/* Nav */}
      <nav className="relative z-50 bg-background/50 backdrop-blur-lg border-b border-border/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center group">
            <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-md group-hover:bg-blue-500/50 transition-all duration-300"></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/vce-logo.png" alt="VCE" className="relative w-8 h-8 object-contain drop-shadow-xl" />
          </div>
          <span className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 tracking-wide">
            FPGA Remote Lab
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/auth/login"
            className="text-muted hover:text-foreground font-medium transition-colors"
          >
            Log in
          </Link>
          <Link href="/auth/signup" className="btn-primary text-sm px-6">
            Sign up
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center relative z-10 py-20">
        <div className="max-w-4xl mx-auto animate-float">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-foreground/5 border border-border/50 mb-8 backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
            <span className="text-xs font-medium text-slate-300 uppercase tracking-widest">System Online</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold mb-8 leading-tight tracking-tight text-foreground drop-shadow-2xl">
            Program FPGAs
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">
              from anywhere
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted mb-12 max-w-2xl mx-auto leading-relaxed">
            Upload your bitstream, program real FPGA hardware, and monitor
            outputs — all through your web browser. No lab visit required.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
            <Link href="/auth/signup" className="btn-primary text-lg px-10 py-4 w-full sm:w-auto shadow-[0_0_30px_rgba(59,130,246,0.4)]">
              Sign Up
            </Link>
            <Link
              href="/auth/login"
              className="btn-secondary text-lg px-10 py-4 w-full sm:w-auto"
            >
              Log In
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-32 max-w-5xl w-full">
          <div className="card text-left group">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-2xl mb-5 shadow-[0_0_15px_rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform duration-300">⚡</div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Remote Programming</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Upload bitstreams and program Xilinx, Intel, Lattice, and other
              FPGA boards remotely through highly reliable JTAG servers.
            </p>
          </div>
          <div className="card text-left group">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-2xl mb-5 shadow-[0_0_15px_rgba(168,85,247,0.3)] group-hover:scale-110 transition-transform duration-300">📡</div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Live Monitoring</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Watch FPGA outputs in real time — streaming camera feeds for LEDs, interactive serial
              consoles for UART, and live batch logs.
            </p>
          </div>
          <div className="card text-left group">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-2xl mb-5 shadow-[0_0_15px_rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform duration-300">🔒</div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Session Management</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Automatic job queuing, exclusive board reservations, session timeouts, and
              guaranteed FPGA resetting after every use.
            </p>
          </div>
        </div>

        {/* Supported boards */}
        <div className="mt-24 mb-20 relative z-10 w-full max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px bg-gradient-to-r from-transparent to-white/20 flex-1"></div>
            <p className="text-slate-400 text-sm uppercase tracking-widest font-semibold">
              Supports 200+ Boards
            </p>
            <div className="h-px bg-gradient-to-l from-transparent to-white/20 flex-1"></div>
          </div>
          
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
                className="px-4 py-2 bg-foreground/5 border border-border/50 rounded-full text-sm text-muted hover:bg-foreground/10 hover:border-border hover:text-foreground transition-all cursor-default shadow-sm"
              >
                {board}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-50 border-t border-border/50 bg-background/80 backdrop-blur-md px-6 py-6 text-center text-muted text-sm">
        <p>FPGA Remote Lab — Cloud-based FPGA access platform</p>
      </footer>
    </div>
  );
}
