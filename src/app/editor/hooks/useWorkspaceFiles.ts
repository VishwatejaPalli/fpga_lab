"use client";

import { useState, useEffect, useCallback } from "react";

export const EXAMPLE_PROJECTS: Record<
  string,
  { name: string; targetBoard: string; topModule: string; files: Record<string, string> }
> = {
  uart_tx: {
    name: "uart_tx_project",
    targetBoard: "pynq-z2 (xc7z020clg400-1)",
    topModule: "tb_uart_tx",
    files: {
      "rtl/uart_tx.v": `module uart_tx #(
    parameter CLKS_PER_BIT = 87
)(
    input wire clk,
    input wire rst_n,
    input wire tx_start,
    input wire [7:0] tx_data,
    output reg tx_serial,
    output reg tx_ready
);
    localparam IDLE  = 3'b000;
    localparam START = 3'b001;
    localparam DATA  = 3'b010;
    localparam STOP  = 3'b011;

    reg [2:0] state;
    reg [15:0] clk_count;
    reg [2:0] bit_idx;
    reg [7:0] data_buf;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= IDLE;
            tx_serial <= 1'b1;
            tx_ready <= 1'b1;
            clk_count <= 0;
            bit_idx <= 0;
        end else begin
            case (state)
                IDLE: begin
                    tx_serial <= 1'b1;
                    tx_ready <= 1'b1;
                    if (tx_start) begin
                        state <= START;
                        data_buf <= tx_data;
                        tx_ready <= 1'b0;
                        clk_count <= 0;
                    end
                end
                START: begin
                    tx_serial <= 1'b0;
                    if (clk_count < CLKS_PER_BIT - 1)
                        clk_count <= clk_count + 1;
                    else begin
                        clk_count <= 0;
                        state <= DATA;
                        bit_idx <= 0;
                    end
                end
                DATA: begin
                    tx_serial <= data_buf[bit_idx];
                    if (clk_count < CLKS_PER_BIT - 1)
                        clk_count <= clk_count + 1;
                    else begin
                        clk_count <= 0;
                        if (bit_idx < 7)
                            bit_idx <= bit_idx + 1;
                        else
                            state <= STOP;
                    end
                end
                STOP: begin
                    tx_serial <= 1'b1;
                    if (clk_count < CLKS_PER_BIT - 1)
                        clk_count <= clk_count + 1;
                    else
                        state <= IDLE;
                end
                default: state <= IDLE;
            endcase
        end
    end
endmodule`,
      "tb/tb_uart_tx.v": `\`timescale 1ns/1ps

module tb_uart_tx;
    reg clk;
    reg rst_n;
    reg tx_start;
    reg [7:0] tx_data;
    wire tx_serial;
    wire tx_ready;

    uart_tx #(.CLKS_PER_BIT(16)) uut (
        .clk(clk), .rst_n(rst_n), .tx_start(tx_start),
        .tx_data(tx_data), .tx_serial(tx_serial), .tx_ready(tx_ready)
    );

    always #5 clk = ~clk;

    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, tb_uart_tx);
        clk = 0; rst_n = 0; tx_start = 0; tx_data = 8'hA5;
        #20 rst_n = 1;
        #20 tx_start = 1; #10 tx_start = 0;
        wait(tx_ready == 1);
        #100; $finish;
    end
endmodule`,
      "constraints/pynq_z2.xdc": `set_property -dict { PACKAGE_PIN R14 IOSTANDARD LVCMOS33 } [get_ports { tx_serial }];
set_property -dict { PACKAGE_PIN H16 IOSTANDARD LVCMOS33 } [get_ports { clk }];
create_clock -add -name sys_clk_pin -period 8.00 [get_ports { clk }];`
    }
  },
  blinky: {
    name: "blinky_demo",
    targetBoard: "pynq-z2 (xc7z020clg400-1)",
    topModule: "blinky",
    files: {
      "rtl/blinky.v": `module blinky(
    input wire clk,
    output reg [3:0] led
);
    reg [26:0] counter = 0;
    always @(posedge clk) begin
        counter <= counter + 1;
        led <= counter[26:23];
    end
endmodule`,
      "constraints/pynq_z2.xdc": `set_property -dict { PACKAGE_PIN H16 IOSTANDARD LVCMOS33 } [get_ports { clk }];
set_property -dict { PACKAGE_PIN R14 IOSTANDARD LVCMOS33 } [get_ports { led[0] }];`
    }
  },
  ripple_adder: {
    name: "ripple_carry_adder_demo",
    targetBoard: "basys3 (xc7a35tcpg236-1)",
    topModule: "tb_ripple_adder",
    files: {
      "rtl/ripple_adder.v": `module ripple_adder #(parameter N=4)(
    input wire [N-1:0] a,
    input wire [N-1:0] b,
    input wire cin,
    output wire [N-1:0] sum,
    output wire cout
);
    wire [N:0] c;
    assign c[0] = cin;
    genvar i;
    generate
        for(i=0; i<N; i=i+1) begin: adder_stage
            assign sum[i] = a[i] ^ b[i] ^ c[i];
            assign c[i+1] = (a[i] & b[i]) | (c[i] & (a[i] ^ b[i]));
        end
    endgenerate
    assign cout = c[N];
endmodule`,
      "tb/tb_ripple_adder.v": `\`timescale 1ns/1ps
module tb_ripple_adder;
    reg [3:0] a, b;
    reg cin;
    wire [3:0] sum;
    wire cout;
    ripple_adder #(4) uut (.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));
    initial begin
        a = 4'b0011; b = 4'b0101; cin = 0;
        #20;
        $finish;
    end
endmodule`
    }
  }
};

export function useWorkspaceFiles() {
  const [files, setFiles] = useState<Record<string, string>>(EXAMPLE_PROJECTS["uart_tx"].files);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [isLoading, setIsLoading] = useState(true);

  // Load workspace files on initial render
  useEffect(() => {
    let isMounted = true;
    async function loadWorkspace() {
      try {
        const res = await fetch("/api/workspace");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.files && Object.keys(data.files).length > 0) {
            setFiles(data.files);
          }
        }
      } catch {
        // Fallback to example files on failure
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadWorkspace();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = useCallback(async (filePath: string, content: string): Promise<boolean> => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: filePath, content }),
      });
      if (res.ok) {
        setFiles((prev) => ({ ...prev, [filePath]: content }));
        setSaveStatus("saved");
        return true;
      } else {
        setSaveStatus("unsaved");
        return false;
      }
    } catch {
      setSaveStatus("unsaved");
      return false;
    }
  }, []);

  const handleDeleteFile = useCallback(async (filePath: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/workspace?fileName=${encodeURIComponent(filePath)}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 404) {
        setFiles((prev) => {
          const next = { ...prev };
          delete next[filePath];
          return next;
        });
        return true;
      }
      return false;
    } catch {
      // Still update local state if network call fails
      setFiles((prev) => {
        const next = { ...prev };
        delete next[filePath];
        return next;
      });
      return false;
    }
  }, []);

  const syncAllFilesToServer = useCallback(async (fileMap: Record<string, string>): Promise<boolean> => {
    try {
      for (const [filePath, content] of Object.entries(fileMap)) {
        await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: filePath, content }),
        });
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    files,
    setFiles,
    saveStatus,
    setSaveStatus,
    isLoading,
    handleSave,
    handleDeleteFile,
    syncAllFilesToServer,
  };
}
