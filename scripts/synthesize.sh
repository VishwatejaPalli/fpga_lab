#!/bin/bash
set -e

TOP_MODULE="${1:-main}"
OUTPUT_FILE="$2"
TARGET_BOARD="${3:-pynq_z2}"

echo "================================================================================"
echo "                   FPGA SYNTHESIS & RTL COMPILATION TOOLCHAIN                  "
echo "================================================================================"

if ! command -v yosys &> /dev/null; then
    echo "[Error] Yosys open-source synthesis suite is not installed on this system."
    echo "Please install yosys (e.g., 'apt-get install yosys' or build from source)."
    exit 1
fi

echo "[Synthesis] Starting real Yosys RTL synthesis for module: ${TOP_MODULE}..."
yosys -p "prep -top ${TOP_MODULE}; write_verilog synth_out.v; write_json synth_out.json"

if [ -n "$OUTPUT_FILE" ]; then
    if [ -f "synth_out.v" ]; then
        cp "synth_out.v" "$OUTPUT_FILE"
        echo "[Synthesis] Output netlist written to $OUTPUT_FILE"
    fi
fi

echo "================================================================================"
echo "[Success] RTL Synthesis completed successfully."
echo "================================================================================"
