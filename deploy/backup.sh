#!/bin/bash

# Production PostgreSQL Database Backup Script for FPGA Remote Lab
# Generates atomic pg_dump archives, compresses with gzip, verifies archive integrity, and cleans up old backups.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/fpga-lab/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/fpga_lab}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SQL_FILE="$BACKUP_DIR/fpga_lab_backup_$TIMESTAMP.sql"
ARCHIVE_FILE="${SQL_FILE}.gz"

echo "[$(date)] Starting PostgreSQL database backup..."

# Dump PostgreSQL database using connection URL or container parameters
if command -v pg_dump &>/dev/null; then
    pg_dump "$DATABASE_URL" > "$SQL_FILE"
elif command -v docker &>/dev/null && docker ps | grep -q fpga_lab_db; then
    docker exec fpga_lab_db pg_dump -U postgres fpga_lab > "$SQL_FILE"
else
    echo "Error: Neither pg_dump nor docker container fpga_lab_db found" >&2
    exit 1
fi

if [ -s "$SQL_FILE" ]; then
    gzip "$SQL_FILE"
    echo "[$(date)] Database compressed successfully: $ARCHIVE_FILE"

    # Verify archive integrity
    if gzip -t "$ARCHIVE_FILE"; then
        echo "[$(date)] Backup archive integrity verified (gzip test passed)."
    else
        echo "Error: Backup archive corruption detected during verification test!" >&2
        exit 1
    fi
else
    echo "Error: PostgreSQL dump produced empty output file." >&2
    rm -f "$SQL_FILE"
    exit 1
fi

# Retention cleanup
echo "[$(date)] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "fpga_lab_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "[$(date)] PostgreSQL backup completed successfully: $ARCHIVE_FILE"
