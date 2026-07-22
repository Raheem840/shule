#!/bin/bash
# Restores a Shule on-prem/hybrid install's database from a backup produced
# by install.sh's nightly cron (scripts/backup-upload.sh for the cloud copy
# on Hybrid installs). Pairs with that backup job — until this script
# existed, install.sh created nightly dumps with no documented way back in.
#
# Run this ON THE SCHOOL SERVER, as root, from /opt/shule (or wherever
# docker-compose.school.yml lives).
#
# Usage:
#   sudo bash restore.sh                    # restore the newest local backup
#   sudo bash restore.sh --file <path.sql>   # restore a specific local file
#   sudo bash restore.sh --from-cloud        # pull the newest cloud backup
#                                             # first (disaster recovery —
#                                             # use when local backups are
#                                             # gone too, e.g. disk failure).
#                                             # Needs CLOUD_URL/CLOUD_SERVICE_KEY
#                                             # in secrets.env (Hybrid installs only).
#   sudo bash restore.sh --yes               # skip the confirmation prompt

set -e

BACKUP_DIR="/opt/shule/backups"
COMPOSE_FILE="/opt/shule/docker-compose.school.yml"
FROM_CLOUD=false
SKIP_CONFIRM=false
SPECIFIC_FILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --from-cloud) FROM_CLOUD=true; shift ;;
    --yes) SKIP_CONFIRM=true; shift ;;
    --file) SPECIFIC_FILE=$2; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "✗ $COMPOSE_FILE not found — run this on the school server, from /opt/shule."
  exit 1
fi

if [ -f "/opt/shule/secrets.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source /opt/shule/secrets.env
  set +a
fi

RESTORE_FILE="$SPECIFIC_FILE"

if [ "$FROM_CLOUD" = true ]; then
  if [ -z "$CLOUD_URL" ] || [ -z "$CLOUD_SERVICE_KEY" ]; then
    echo "✗ --from-cloud needs CLOUD_URL and CLOUD_SERVICE_KEY in secrets.env"
    echo "  (only set for Hybrid installs — this school may be Local-only,"
    echo "  in which case there is no off-site cloud copy to recover from)."
    exit 1
  fi
  SAFE_SCHOOL=$(echo "$SCHOOL_NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')
  echo "→ Listing cloud backups for $SAFE_SCHOOL..."
  LATEST=$(curl -sS -X POST "${CLOUD_URL%/}/storage/v1/object/list/backups" \
    -H "Authorization: Bearer $CLOUD_SERVICE_KEY" \
    -H "apikey: $CLOUD_SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"prefix\":\"$SAFE_SCHOOL/\",\"limit\":1,\"sortBy\":{\"column\":\"name\",\"order\":\"desc\"}}" \
    | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$LATEST" ]; then
    echo "✗ No cloud backups found for $SAFE_SCHOOL — nothing to recover."
    exit 1
  fi
  mkdir -p "$BACKUP_DIR"
  RESTORE_FILE="$BACKUP_DIR/cloud-recovered-$(basename "$LATEST")"
  echo "→ Downloading $LATEST from cloud..."
  curl -sS -o "$RESTORE_FILE" \
    "${CLOUD_URL%/}/storage/v1/object/backups/$SAFE_SCHOOL/$LATEST" \
    -H "Authorization: Bearer $CLOUD_SERVICE_KEY" \
    -H "apikey: $CLOUD_SERVICE_KEY"
  echo "  ✓ Downloaded to $RESTORE_FILE"
elif [ -z "$RESTORE_FILE" ]; then
  RESTORE_FILE=$(ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | head -1)
  if [ -z "$RESTORE_FILE" ]; then
    echo "✗ No local backups found in $BACKUP_DIR."
    echo "  If the server's disk is gone too, try: sudo bash restore.sh --from-cloud"
    exit 1
  fi
fi

if [ ! -f "$RESTORE_FILE" ]; then
  echo "✗ Backup file not found: $RESTORE_FILE"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RESTORE: $RESTORE_FILE"
echo "  This REPLACES all data currently in this school's database."
echo "  Everything entered since this backup was taken will be lost."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$SKIP_CONFIRM" != true ]; then
  read -r -p "Type RESTORE to continue: " CONFIRM
  if [ "$CONFIRM" != "RESTORE" ]; then
    echo "Cancelled — nothing was changed."
    exit 0
  fi
fi

cd /opt/shule

echo "→ Stopping app + edge functions (keeping db/storage up for the restore)..."
docker compose -f docker-compose.school.yml stop shule-app kong \
  $(docker compose -f docker-compose.school.yml config --services | grep '^fn-') 2>/dev/null || true

echo "→ Restoring database from $RESTORE_FILE..."
docker compose -f docker-compose.school.yml exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" db psql -U postgres postgres < "$RESTORE_FILE"

echo "→ Restarting all services..."
docker compose -f docker-compose.school.yml up -d

echo ""
echo "  ✓ Restore complete. Give the stack ~30s to come back up, then confirm"
echo "    the app loads at your school's site URL."
