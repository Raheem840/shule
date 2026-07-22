#!/bin/bash
# Uploads a local Postgres backup file to a Hybrid school's cloud Supabase
# project, giving genuine disaster-recovery coverage if the school's local
# server is lost, stolen, or its disk fails — the on-site nightly pg_dump
# (scripts/install.sh step 9) is only as good as the building it sits in.
#
# This is a backup UPLOAD, not a live sync — it does not read/write the
# cloud project's application schema, and it never runs from the browser
# (the service-role key it needs has no business in a frontend bundle, see
# CLAUDE.md's "Never SUPABASE_SERVICE_ROLE_KEY in frontend" rule). It only
# talks to the cloud project's Storage API, uploading into a dedicated
# `backups` bucket, one object per night, scoped by school name.
#
# Called automatically by install.sh's cron job for Hybrid-mode schools
# (CLOUD_URL / CLOUD_SERVICE_KEY come from secrets.env, which install.sh
# copies into /opt/shule/ during install — never committed, never sent to
# the frontend build).
#
# The two trailing args are optional: this school's own LOCAL Supabase
# project (SUPABASE_PUBLIC_URL / SERVICE_ROLE_KEY, already in
# /opt/shule/.env). When given, a successful cloud upload flips that
# project's own school_registry.cloud_backup_enabled to true and stamps
# last_seen_at — this is the only writer of that column anywhere in the
# system (it's deny-all to every school JWT; it's your own support/ops
# record, unrelated to anything a school's staff can see). If omitted, the
# script still runs fine — it just skips that bookkeeping update.
#
# Usage:
#   ./backup-upload.sh <dump-file> <CLOUD_URL> <CLOUD_SERVICE_KEY> <SCHOOL_NAME> [LOCAL_URL] [LOCAL_SERVICE_KEY]

set -e

DUMP_FILE=$1
CLOUD_URL=$2
CLOUD_SERVICE_KEY=$3
SCHOOL_NAME=$4
LOCAL_URL=$5
LOCAL_SERVICE_KEY=$6

if [ -z "$DUMP_FILE" ] || [ -z "$CLOUD_URL" ] || [ -z "$CLOUD_SERVICE_KEY" ] || [ -z "$SCHOOL_NAME" ]; then
  echo "Usage: ./backup-upload.sh <dump-file> <CLOUD_URL> <CLOUD_SERVICE_KEY> <SCHOOL_NAME> [LOCAL_URL] [LOCAL_SERVICE_KEY]"
  exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "✗ Backup file not found: $DUMP_FILE"
  exit 1
fi

CLOUD_URL="${CLOUD_URL%/}"
SAFE_SCHOOL=$(echo "$SCHOOL_NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')
FILENAME=$(basename "$DUMP_FILE")
OBJECT_PATH="$SAFE_SCHOOL/$FILENAME"

# Create the backups bucket if this is the first upload for this project —
# harmless no-op (swallowed) if it already exists. Private (not public):
# database dumps contain plaintext temp_password/auth_email columns.
curl -sS -X POST "$CLOUD_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $CLOUD_SERVICE_KEY" \
  -H "apikey: $CLOUD_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"backups","name":"backups","public":false}' \
  > /dev/null 2>&1 || true

echo "→ Uploading $FILENAME to cloud backup bucket ($SAFE_SCHOOL/)..."
HTTP_CODE=$(curl -sS -o /tmp/backup-upload-response.json -w "%{http_code}" \
  -X POST "$CLOUD_URL/storage/v1/object/backups/$OBJECT_PATH" \
  -H "Authorization: Bearer $CLOUD_SERVICE_KEY" \
  -H "apikey: $CLOUD_SERVICE_KEY" \
  -H "Content-Type: application/sql" \
  -H "x-upsert: true" \
  --data-binary "@$DUMP_FILE")

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "  ✓ Uploaded to cloud: backups/$OBJECT_PATH"

  if [ -n "$LOCAL_URL" ] && [ -n "$LOCAL_SERVICE_KEY" ]; then
    curl -sS -X PATCH "${LOCAL_URL%/}/rest/v1/school_registry" \
      -H "Authorization: Bearer $LOCAL_SERVICE_KEY" \
      -H "apikey: $LOCAL_SERVICE_KEY" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d "{\"cloud_backup_enabled\":true,\"last_seen_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
      > /dev/null 2>&1 || echo "  (note: could not update school_registry bookkeeping — non-fatal, backup itself succeeded)"
  fi
else
  echo "  ✗ Cloud upload failed (HTTP $HTTP_CODE):"
  cat /tmp/backup-upload-response.json
  echo ""
  echo "  Local backup at $DUMP_FILE is still safe — this only affects the"
  echo "  off-site copy. Will retry automatically tomorrow night."
  exit 1
fi
