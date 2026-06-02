#!/bin/bash
# backup-db.sh — Create a timestamped backup of superglazka.db
#
# Works in both Docker and non-Docker (PM2) deployments.
# Configurable via BACKUP_DIR and RETENTION env vars.
#
# Usage:
#   bash misc/deploy/backup-db.sh
#   BACKUP_DIR=/custom/path RETENTION=60 bash misc/deploy/backup-db.sh

set -e

PROJECT_DIR="/opt/superglazka"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/server/data/backups}"
RETENTION="${RETENTION:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

if docker ps -q -f name=superglazka-backend &>/dev/null; then
    echo "Detected Docker deployment — copying from container..."
    docker exec superglazka-backend cp /app/data/superglazka.db "/app/data/superglazka_$TIMESTAMP.db"
    docker cp "superglazka-backend:/app/data/superglazka_$TIMESTAMP.db" "$BACKUP_DIR/"
    docker exec superglazka-backend rm "/app/data/superglazka_$TIMESTAMP.db"
elif [ -f "$PROJECT_DIR/server/data/superglazka.db" ]; then
    echo "Detected plain deployment — copying directly..."
    cp "$PROJECT_DIR/server/data/superglazka.db" "$BACKUP_DIR/superglazka_$TIMESTAMP.db"
else
    echo "ERROR: Database not found at $PROJECT_DIR/server/data/superglazka.db and no running container detected."
    exit 1
fi

echo "Backup created: $BACKUP_DIR/superglazka_$TIMESTAMP.db"

# Rotation — keep only the last $RETENTION backups
if [ "$RETENTION" -gt 0 ] 2>/dev/null; then
    COUNT=$(ls -1 "$BACKUP_DIR"/superglazka_*.db 2>/dev/null | wc -l)
    if [ "$COUNT" -gt "$RETENTION" ]; then
        ls -1tr "$BACKUP_DIR"/superglazka_*.db 2>/dev/null | head -n -"$RETENTION" | while read -r OLD; do
            rm "$OLD"
            echo "Removed old backup: $OLD"
        done
    fi
fi
