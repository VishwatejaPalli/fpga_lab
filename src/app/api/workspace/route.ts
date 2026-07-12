import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { withErrorHandler } from "@/lib/api-utils";
import fs from "fs";
import path from "path";

const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || "./uploads/workspaces";

const DEFAULT_FILES = {
  "rtl/uart_tx.v": `// UART Transmitter Module
// Parameters: CLK_FREQ = 100MHz, BAUD_RATE = 115200
module uart_tx #(
    parameter CLK_FREQ = 100_000_000,
    parameter BAUD_RATE = 115_200
) (
    input wire       clk,
    input wire       rst_n,
    input wire       tx_start,
    input wire [7:0] tx_data,
    output reg       tx_out,
    output reg       tx_busy
);

    localparam CLKS_PER_BIT = CLK_FREQ / BAUD_RATE;

    reg [15:0] clk_counter;
    reg [2:0]  bit_index;
    reg [7:0]  tx_shift_reg;
    reg [1:0]  state;

    localparam STATE_IDLE  = 2'b00;
    localparam STATE_START = 2'b01;
    localparam STATE_DATA  = 2'b10;
    localparam STATE_STOP  = 2'b11;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= STATE_IDLE;
            tx_out <= 1'b1;
            tx_busy <= 1'b0;
            clk_counter <= 0;
            bit_index <= 0;
        end else begin
            case (state)
                STATE_IDLE: begin
                    tx_out <= 1'b1;
                    tx_busy <= 1'b0;
                    clk_counter <= 0;
                    bit_index <= 0;
                    if (tx_start) begin
                        tx_shift_reg <= tx_data;
                        state <= STATE_START;
                        tx_busy <= 1'b1;
                    end
                end
                STATE_START: begin
                    tx_out <= 1'b0;
                    if (clk_counter < CLKS_PER_BIT - 1) begin
                        clk_counter <= clk_counter + 1;
                    end else begin
                        clk_counter <= 0;
                        state <= STATE_DATA;
                    end
                end
                STATE_DATA: begin
                    tx_out <= tx_shift_reg[bit_index];
                    if (clk_counter < CLKS_PER_BIT - 1) begin
                        clk_counter <= clk_counter + 1;
                    end else begin
                        clk_counter <= 0;
                        if (bit_index < 7) begin
                            bit_index <= bit_index + 1;
                        end else begin
                            state <= STATE_STOP;
                        end
                    end
                end
                STATE_STOP: begin
                    tx_out <= 1'b1;
                    if (clk_counter < CLKS_PER_BIT - 1) begin
                        clk_counter <= clk_counter + 1;
                    end else begin
                        state <= STATE_IDLE;
                    end
                end
            endcase
        end
    end
endmodule`,
  "rtl/uart_rx.v": `// UART Receiver Module
module uart_rx #(
    parameter CLK_FREQ = 100_000_000,
    parameter BAUD_RATE = 115_200
) (
    input wire       clk,
    input wire       rst_n,
    input wire       rx_in,
    output reg       rx_done,
    output reg [7:0] rx_data
);
    // UART Rx logic here
endmodule`,
  "rtl/baud_gen.v": `// Baud Rate Generator
module baud_gen (
    input wire clk,
    input wire rst_n,
    output reg baud_tick
);
    // Generator logic
endmodule`,
  "rtl/uart_top.v": `// UART Top level wrapper module
module uart_top (
    input wire clk,
    input wire rst_n,
    input wire rx,
    output wire tx
);
    // Instance of tx and rx
endmodule`,
  "tb/uart_tb.v": `\`timescale 1ns/1ps

module uart_tb;
    reg clk;
    reg rst_n;
    reg tx_start;
    reg [7:0] tx_data;
    wire tx_out;
    wire tx_busy;

    uart_tx #(
        .CLK_FREQ(100_000_000),
        .BAUD_RATE(115_200)
    ) uut (
        .clk(clk),
        .rst_n(rst_n),
        .tx_start(tx_start),
        .tx_data(tx_data),
        .tx_out(tx_out),
        .tx_busy(tx_busy)
    );

    always #5 clk = ~clk;

    initial begin
        clk = 0;
        rst_n = 0;
        tx_start = 0;
        tx_data = 8'h00;
        #20;
        rst_n = 1;
        #20;
        tx_data = 8'hA5;
        tx_start = 1;
        #10;
        tx_start = 0;
        #200000;
        $finish;
    end
endmodule`,
  "constraints/pynq_z2.xdc": `## Clock signal (125 MHz)
set_property -dict { PACKAGE_PIN H16   IOSTANDARD LVCMOS33 } [get_ports { clk }];
create_clock -add -name sys_clk_pin -period 8.00 -waveform {0 4} [get_ports { clk }];

## Reset (Push button 0)
set_property -dict { PACKAGE_PIN D19   IOSTANDARD LVCMOS33 } [get_ports { rst_n }];

## UART Tx pin
set_property -dict { PACKAGE_PIN Y11   IOSTANDARD LVCMOS33 } [get_ports { tx_out }];`,
  "scripts/run.tcl": `# Vivado build script
read_verilog [glob rtl/*.v]
read_xdc constraints/pynq_z2.xdc
synth_design -top uart_top -part xc7z020clg400-1
opt_design
place_design
route_design
write_bitstream -force build/uart_controller.bit`,
  "project.json": `{
  "name": "uart_controller",
  "board": "PYNQ-Z2",
  "fpga": "xc7z020clg400-1",
  "top_module": "uart_top"
}`,
  "README.md": `# FPGA UART Controller Project

Remote lab project for UART communication on PYNQ-Z2 board.
Includes transceiver module, baud rate generator, and simulation testbench.`
};

/**
 * Get dynamic list of workspace files for user.
 */
export const GET = withErrorHandler(async () => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userWorkspaceDir = path.join(WORKSPACE_BASE_DIR, session.userId);
  
  // Initialize directory if it doesn't exist
  if (!fs.existsSync(userWorkspaceDir)) {
    fs.mkdirSync(userWorkspaceDir, { recursive: true });
    
    // Copy default files
    for (const [name, content] of Object.entries(DEFAULT_FILES)) {
      const filePath = path.join(userWorkspaceDir, name);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
    }
  }

  // Read all files recursively
  const filesList: Record<string, string> = {};
  const readDirRecursively = (dir: string, baseDir: string) => {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        readDirRecursively(fullPath, baseDir);
      } else {
        const relativePath = path.relative(baseDir, fullPath);
        filesList[relativePath] = fs.readFileSync(fullPath, "utf-8");
      }
    }
  };

  if (fs.existsSync(userWorkspaceDir)) {
    readDirRecursively(userWorkspaceDir, userWorkspaceDir);
  }

  return NextResponse.json({ files: filesList });
});

/**
 * Save or create a workspace file.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileName, content } = await req.json();
  if (!fileName || content === undefined) {
    return NextResponse.json({ error: "fileName and content are required." }, { status: 400 });
  }

  const userWorkspaceDir = path.join(WORKSPACE_BASE_DIR, session.userId);
  
  // Resolve absolute path and check for directory traversal
  const filePath = path.resolve(userWorkspaceDir, fileName);
  if (!filePath.startsWith(userWorkspaceDir)) {
    return NextResponse.json({ error: "Invalid path (directory traversal attempt)" }, { status: 400 });
  }

  if (!fs.existsSync(userWorkspaceDir)) {
    fs.mkdirSync(userWorkspaceDir, { recursive: true });
  }

  // Ensure directory exists for nested path
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");

  const relativeName = path.relative(userWorkspaceDir, filePath);
  return NextResponse.json({ success: true, fileName: relativeName });
});

/**
 * Delete a workspace file.
 */
export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fileName = searchParams.get("fileName");
  
  if (!fileName) {
    return NextResponse.json({ error: "fileName parameter is required." }, { status: 400 });
  }

  const userWorkspaceDir = path.join(WORKSPACE_BASE_DIR, session.userId);
  const filePath = path.resolve(userWorkspaceDir, fileName);
  if (!filePath.startsWith(userWorkspaceDir)) {
    return NextResponse.json({ error: "Invalid path (directory traversal attempt)" }, { status: 400 });
  }

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
});
