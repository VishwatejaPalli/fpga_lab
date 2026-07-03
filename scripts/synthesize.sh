#!/bin/bash
echo "[Yosys] Starting synthesis for $1..."
sleep 1
echo "[Yosys] Parsing Verilog input..."
sleep 1
echo "[NextPNR] Placing and routing for board $3..."
sleep 1
echo "[Bitgen] Generating bitstream at $2..."
echo "MOCK_BITSTREAM_DATA" > "$2"
echo "[Success] Bitstream generated successfully!"
