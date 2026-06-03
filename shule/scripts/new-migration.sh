#!/bin/bash
# Creates a new timestamped migration file
# Usage: ./scripts/new-migration.sh "description_of_change"

if [ -z "$1" ]; then
  echo "Usage: ./scripts/new-migration.sh 'description'"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d%H%M%S)
NAME=$(echo "$1" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
FILE="supabase/migrations/${TIMESTAMP}_${NAME}.sql"

cat > "$FILE" << EOF
-- Migration: ${NAME}
-- Created: $(date)
-- Author: Sinqura Dev Team
-- Description: ${1}

-- ── CHANGES ──────────────────────────────────────────────────


-- ── RLS UPDATES (if any) ─────────────────────────────────────


-- ── VERIFICATION ─────────────────────────────────────────────
-- Run after applying to confirm it worked:
--

EOF

echo "✓ Created: $FILE"
echo "Write your SQL then run: npm run migrate:push"
