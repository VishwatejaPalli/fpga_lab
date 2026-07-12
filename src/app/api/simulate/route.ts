import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { withErrorHandler } from "@/lib/api-utils";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || "./uploads/workspaces";

interface VcdSignal {
  name: string;
  code: string;
  type: string;
  size: number;
  changes: [number, string][];
}

// Simple VCD parser to map signal changes
function parseVcd(vcdText: string) {
  const lines = vcdText.split("\n");
  const signals: VcdSignal[] = [];
  const codeToSignal: Record<string, VcdSignal> = {};
  
  let inHeader = true;
  let currentTime = 0;
  let timescale = "1ns";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (inHeader) {
      if (line.startsWith("$timescale")) {
        if (line === "$timescale" && lines[i + 1]) {
          timescale = lines[i + 1].trim().replace("$end", "");
          i++;
        } else {
          timescale = line.replace("$timescale", "").replace("$end", "").trim();
        }
      }

      if (line.startsWith("$var")) {
        const parts = line.split(/\s+/);
        // e.g. $var reg 1 ! clk $end
        const type = parts[1];
        const size = parseInt(parts[2], 10);
        const code = parts[3];
        const name = parts.slice(4, parts.length - 1).join(" ");
        
        const sig: VcdSignal = {
          name,
          code,
          type,
          size,
          changes: []
        };
        signals.push(sig);
        codeToSignal[code] = sig;
      }

      if (line.startsWith("$enddefinitions")) {
        inHeader = false;
      }
      continue;
    }

    // Time changes, e.g., "#100"
    if (line.startsWith("#")) {
      currentTime = parseInt(line.substring(1), 10);
    } else if (line.startsWith("b") || line.startsWith("B")) {
      // Vector variable value changes, e.g., "b00001010 $"
      const parts = line.substring(1).split(/\s+/);
      const val = parts[0];
      const code = parts[1];
      if (codeToSignal[code]) {
        codeToSignal[code].changes.push([currentTime, val]);
      }
    } else {
      // Scalar value changes, e.g., "0!" or "1!"
      const val = line.substring(0, 1);
      const code = line.substring(1);
      if (codeToSignal[code]) {
        codeToSignal[code].changes.push([currentTime, val]);
      }
    }
  }

  return { timescale, signals };
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userWorkspaceDir = path.resolve(WORKSPACE_BASE_DIR, session.userId);
  if (!fs.existsSync(userWorkspaceDir)) {
    return NextResponse.json({ error: "Workspace empty. No files to simulate." }, { status: 400 });
  }

  // Find all HDL files in the workspace recursively
  const vFiles: string[] = [];
  const svFiles: string[] = [];
  const vhdlFiles: string[] = [];

  const collectFiles = (dir: string) => {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        collectFiles(fullPath);
      } else {
        const ext = path.extname(item).toLowerCase();
        if (ext === ".v") {
          vFiles.push(fullPath);
        } else if (ext === ".sv") {
          svFiles.push(fullPath);
        } else if (ext === ".vhd" || ext === ".vhdl") {
          vhdlFiles.push(fullPath);
        }
      }
    }
  };
  collectFiles(userWorkspaceDir);

  if (vFiles.length === 0 && svFiles.length === 0 && vhdlFiles.length === 0) {
    return NextResponse.json({ error: "No Verilog, SystemVerilog, or VHDL files found in workspace." }, { status: 400 });
  }

  // Determine simulator mode
  let mode: "ghdl" | "verilator" | "iverilog" = "iverilog";
  if (vhdlFiles.length > 0) {
    mode = "ghdl";
  } else if (svFiles.length > 0) {
    mode = "verilator";
  }

  // Create unique folder for the simulation run
  const simJobId = `sim_${Date.now()}`;
  const simTempDir = path.resolve(process.cwd(), "uploads", "simulations", simJobId);
  fs.mkdirSync(simTempDir, { recursive: true });

  try {
    let testbenchEntityName = "";
    if (mode === "ghdl") {
      // Find a VHDL file that likely contains the testbench
      const tbFile = vhdlFiles.find(f => {
        const base = path.basename(f).toLowerCase();
        return base.includes("tb") || base.includes("testbench");
      });
      
      // If none found with "tb", search all VHDL files
      const candidateFiles = tbFile ? [tbFile] : vhdlFiles;
      for (const file of candidateFiles) {
        const content = fs.readFileSync(file, "utf-8");
        const match = content.match(/entity\s+(\w+)\s+is/i);
        if (match) {
          testbenchEntityName = match[1];
          break;
        }
      }
      
      // Fallback: if still not found, search all VHDL files for any entity
      if (!testbenchEntityName) {
        for (const file of vhdlFiles) {
          const content = fs.readFileSync(file, "utf-8");
          const match = content.match(/entity\s+(\w+)\s+is/i);
          if (match) {
            testbenchEntityName = match[1];
            break;
          }
        }
      }
    }

    // Copy appropriate source files into the flat simulation folder
    const copiedPaths: string[] = [];
    const filesToCopy = mode === "ghdl" ? vhdlFiles : (mode === "verilator" ? [...vFiles, ...svFiles] : vFiles);

    for (const file of filesToCopy) {
      let content = fs.readFileSync(file, "utf-8");
      const baseName = path.basename(file);

      // Auto-inject VCD dump if it's the testbench and doesn't have it (only for Verilog/SystemVerilog)
      if (mode !== "ghdl") {
        if (baseName.toLowerCase().includes("tb") || baseName.toLowerCase().includes("testbench")) {
          if (!content.includes("$dumpfile") && content.includes("initial")) {
            const moduleName = baseName
              .replace("_tb.sv", "_tb")
              .replace("_tb.v", "_tb")
              .replace(".sv", "")
              .replace(".v", "");
            
            // Insert VCD dumping variables right after "initial begin"
            content = content.replace(
              /initial\s+begin/,
              `initial begin\n        $dumpfile("waves.vcd");\n        $dumpvars(0, ${moduleName});`
            );
          }
        }
      }

      const tempPath = path.join(simTempDir, baseName);
      fs.writeFileSync(tempPath, content, "utf-8");
      copiedPaths.push(baseName);
    }

    let stdoutLogs = "";
    let stderrLogs = "";
    const vcdFilePath = path.join(simTempDir, "waves.vcd");

    if (mode === "ghdl") {
      if (!testbenchEntityName) {
        return NextResponse.json({
          success: false,
          step: "compile",
          logs: "[GHDL Error] Could not find any VHDL entity to simulate in the workspace."
        }, { status: 422 });
      }

      try {
        // Step 1: Compile VHDL files
        const compileCmd = `ghdl -a --std=08 ${copiedPaths.join(" ")}`;
        const { stdout, stderr } = await execAsync(compileCmd, { cwd: simTempDir, timeout: 15000 });
        stdoutLogs += stdout;
        if (stderr) stderrLogs += stderr;

        // Step 2: Elaborate VHDL testbench
        const elabCmd = `ghdl -e --std=08 ${testbenchEntityName}`;
        const { stdout: elabOut, stderr: elabErr } = await execAsync(elabCmd, { cwd: simTempDir, timeout: 15000 });
        stdoutLogs += elabOut;
        if (elabErr) stderrLogs += elabErr;
      } catch (err: any) {
        stdoutLogs += err.stdout || "";
        stderrLogs += err.stderr || "";
        
        const isNotFound = err.message && (err.message.includes("not found") || err.message.includes("command not found"));
        const customErr = isNotFound 
          ? `[GHDL Compiler Error] GHDL tool is not installed on the server.\nPlease install it (e.g. 'sudo apt install ghdl') to enable VHDL simulation.`
          : `[GHDL Compiler Error]\n${stderrLogs || stdoutLogs || err.message}`;

        return NextResponse.json({
          success: false,
          step: "compile",
          logs: customErr
        }, { status: 422 });
      }

      try {
        // Step 3: Run Simulation and generate waves.vcd
        const runCmd = `ghdl -r --std=08 ${testbenchEntityName} --vcd=waves.vcd`;
        const { stdout, stderr } = await execAsync(runCmd, { cwd: simTempDir, timeout: 15000 });
        stdoutLogs += `\n[Simulation Run Logs]\n${stdout}`;
        if (stderr) stderrLogs += stderr;
      } catch (err: any) {
        stdoutLogs += err.stdout || "";
        stderrLogs += err.stderr || "";
        return NextResponse.json({
          success: false,
          step: "simulation",
          logs: `[GHDL Runtime Error]\n${stderrLogs || stdoutLogs || err.message}`
        }, { status: 422 });
      }
    } else if (mode === "verilator") {
      try {
        // Step 1: Compile SystemVerilog files using Verilator
        const compileCmd = `verilator --binary --timing --trace -o sim_run -Wno-fatal ${copiedPaths.join(" ")}`;
        const { stdout, stderr } = await execAsync(compileCmd, { cwd: simTempDir, timeout: 30000 });
        stdoutLogs += stdout;
        if (stderr) stderrLogs += stderr;
      } catch (err: any) {
        stdoutLogs += err.stdout || "";
        stderrLogs += err.stderr || "";
        
        const isNotFound = err.message && (err.message.includes("not found") || err.message.includes("command not found"));
        const customErr = isNotFound 
          ? `[Verilator Compiler Error] Verilator tool is not installed on the server.\nPlease install it (e.g. 'sudo apt install verilator') to enable SystemVerilog simulation.`
          : `[Verilator Compiler Error]\n${stderrLogs || stdoutLogs || err.message}`;

        return NextResponse.json({
          success: false,
          step: "compile",
          logs: customErr
        }, { status: 422 });
      }

      try {
        // Step 2: Run Verilator compiled binary to generate waves.vcd
        const runCmd = "./obj_dir/sim_run";
        const { stdout, stderr } = await execAsync(runCmd, { cwd: simTempDir, timeout: 15000 });
        stdoutLogs += `\n[Simulation Run Logs]\n${stdout}`;
        if (stderr) stderrLogs += stderr;
      } catch (err: any) {
        stdoutLogs += err.stdout || "";
        stderrLogs += err.stderr || "";
        return NextResponse.json({
          success: false,
          step: "simulation",
          logs: `[Verilator Runtime Error]\n${stderrLogs || stdoutLogs || err.message}`
        }, { status: 422 });
      }
    } else {
      try {
        // Step 1: Compile Verilog using iverilog
        const compileCmd = `iverilog -o sim.vvp ${copiedPaths.join(" ")}`;
        const { stdout, stderr } = await execAsync(compileCmd, { cwd: simTempDir, timeout: 15000 });
        stdoutLogs += stdout;
        if (stderr) stderrLogs += stderr;
      } catch (err: any) {
        stdoutLogs += err.stdout || "";
        stderrLogs += err.stderr || "";
        
        const isNotFound = err.message && (err.message.includes("not found") || err.message.includes("command not found"));
        const customErr = isNotFound 
          ? `[iverilog Compiler Error] Icarus Verilog is not installed on the server.\nPlease install it (e.g. 'sudo apt install iverilog') to enable Verilog simulation.`
          : `[iverilog Compiler Error]\n${stderrLogs || stdoutLogs || err.message}`;

        return NextResponse.json({
          success: false,
          step: "compile",
          logs: customErr
        }, { status: 422 });
      }

      try {
        // Step 2: Run simulation using vvp
        const runCmd = "vvp sim.vvp";
        const { stdout, stderr } = await execAsync(runCmd, { cwd: simTempDir, timeout: 15000 });
        stdoutLogs += `\n[Simulation Run Logs]\n${stdout}`;
        if (stderr) stderrLogs += stderr;
      } catch (err: any) {
        stdoutLogs += err.stdout || "";
        stderrLogs += err.stderr || "";
        return NextResponse.json({
          success: false,
          step: "simulation",
          logs: `[vvp Runtime Error]\n${stderrLogs || stdoutLogs || err.message}`
        }, { status: 422 });
      }
    }

    // Check if waves.vcd was successfully created
    if (!fs.existsSync(vcdFilePath)) {
      return NextResponse.json({
        success: false,
        step: "vcd",
        logs: `${stdoutLogs}\n\n[Warning] Simulation finished but waves.vcd was not created. Did you declare $dumpfile("waves.vcd") or check VHDL testbench configurations?`
      }, { status: 422 });
    }

    // Parse VCD file
    const vcdContent = fs.readFileSync(vcdFilePath, "utf-8");
    const parsedData = parseVcd(vcdContent);

    return NextResponse.json({
      success: true,
      logs: stdoutLogs,
      waves: parsedData,
      vcdText: vcdContent
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  } finally {
    // Clean up temporary workspace directory asynchronously
    setTimeout(() => {
      if (fs.existsSync(simTempDir)) {
        fs.rmSync(simTempDir, { recursive: true, force: true });
      }
    }, 10000);
  }
});
