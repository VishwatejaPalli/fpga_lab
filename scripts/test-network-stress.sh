#!/usr/bin/env bash
# ==============================================================================
# FPGA Lab — PYNQ Network Stress & Stability Test (Phase 3)
# ==============================================================================
# Usage:
#   ./scripts/test-network-stress.sh <PYNQ_IP_OR_HOSTNAME> [INTERVAL_SEC] [TOTAL_MINUTES]
# Example:
#   ./scripts/test-network-stress.sh 192.168.171.108 5 30
# ==============================================================================

TARGET="${1:-192.168.171.108}"
INTERVAL="${2:-5}"
DURATION_MINS="${3:-30}"
USER="${4:-xilinx}"

TOTAL_CHECKS=$(( (DURATION_MINS * 60) / INTERVAL ))
PING_PASS=0
PING_FAIL=0
SSH_PASS=0
SSH_FAIL=0

echo "======================================================================"
echo "⚡ FPGA Lab — PYNQ Network Stress & Stability Test"
echo "======================================================================"
echo "Target Host  : ${TARGET}"
echo "Check Interval: ${INTERVAL}s"
echo "Test Duration : ${DURATION_MINS} minutes (~${TOTAL_CHECKS} checks)"
echo "======================================================================"
echo ""

START_TIME=$(date +%s)
CHECK_COUNT=0

while true; do
    CHECK_COUNT=$((CHECK_COUNT + 1))
    CURRENT_TIME=$(date +"%Y-%m-%d %H:%M:%S")

    # 1. Ping check
    if ping -c 1 -W 2 "${TARGET}" > /dev/null 2>&1; then
        PING_PASS=$((PING_PASS + 1))
        PING_STATUS="OK"
    else
        PING_FAIL=$((PING_FAIL + 1))
        PING_STATUS="FAIL"
    fi

    # 2. SSH check
    SSH_OUT=$(ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no "${USER}@${TARGET}" "hostname -I" 2>/dev/null)
    if [ $? -eq 0 ]; then
        SSH_PASS=$((SSH_PASS + 1))
        SSH_STATUS="OK (${SSH_OUT:-unknown})"
    else
        SSH_FAIL=$((SSH_FAIL + 1))
        SSH_STATUS="FAIL"
    fi

    echo "[${CURRENT_TIME}] Check #${CHECK_COUNT} | Ping: ${PING_STATUS} | SSH: ${SSH_STATUS}"

    NOW=$(date +%s)
    ELAPSED=$((NOW - START_TIME))
    if [ "${ELAPSED}" -ge $((DURATION_MINS * 60)) ]; then
        break
    fi

    sleep "${INTERVAL}"
done

echo ""
echo "======================================================================"
echo "📊 STRESS TEST RESULTS FOR ${TARGET}"
echo "======================================================================"
echo "Total Checks Completed : ${CHECK_COUNT}"
echo "Ping Success Rate      : ${PING_PASS}/${CHECK_COUNT} ($(( (PING_PASS * 100) / CHECK_COUNT ))%)"
echo "SSH Success Rate       : ${SSH_PASS}/${CHECK_COUNT} ($(( (SSH_PASS * 100) / CHECK_COUNT ))%)"
echo "======================================================================"

if [ "${SSH_FAIL}" -eq 0 ]; then
    echo "🎉 RESULT: Hardware & network link are 100% RELIABLE!"
    exit 0
else
    echo "⚠️ RESULT: Detected ${SSH_FAIL} SSH failures / ${PING_FAIL} network drops."
    exit 1
fi
