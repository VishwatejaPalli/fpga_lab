#!/bin/bash

# Database Backup Script for FPGA Remote Lab
# Backs up the SQLite database using safe WAL checkpoints

DB_FILE="/opt/fpga-lab/data/fpga_lab.db"
BACKUP_DIR="/opt/fpga-lab/backups"
RETENTION_DAYS=7

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/fpga_lab_backup_$TIMESTAMP.sqlite"

echo "[$(date)] Starting database backup..."

if [ ! -f "$DB_FILE" ]; then
    echo "Error: Database file not found at $DB_FILE"
    exit 1
fi

# Run SQLite WAL checkpoint and backup command
# This ensures all pending WAL changes are flushed and backed up atomically
sqlite3 "$DB_FILE" "PRAGMA wal_checkpoint(TRUNCATE);"
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

if [ $? -eq 0 ]; then
    # Compress backup file
    gzip "$BACKUP_FILE"
    echo "[$(date)] Backup completed and compressed: ${BACKUP_FILE}.gz"
else
    echo "Error: SQLite backup failed"
    exit 1
fi

# Retention cleanup: Delete backups older than retention period
echo "[$(date)] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "fpga_lab_backup_*.sqlite.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup process finished successfully"
