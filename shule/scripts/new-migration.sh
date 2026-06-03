#!/bin/bash
# Usage: ./scripts/new-migration.sh "add_attendance_indexes"
# Creates a new timestamped migration file ready to edit.
# Then run: supabase db push --project-ref $PROJECT_REF

set -e

if [ -z "$1" ]; then
  echo "Error: provide a migration name."
  echo "Usage: ./scripts/new-migration.sh \"add_attendance_indexes\""
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d%H%M%S)
NAME=$(echo "$1" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
FILE="supabase/migrations/${TIMESTAMP}_${NAME}.sql"

mkdir -p supabase/migrations

cat > "$FILE" << EOF
-- Migration: ${NAME}
-- Created: $(date)
-- Description: [explain what this migration does and why]

-- ── UP ──────────────────────────────────────────────────────────────────────


-- ── VERIFY ──────────────────────────────────────────────────────────────────
-- Confirm the migration worked, e.g.:
-- SELECT COUNT(*) FROM information_schema.columns
--   WHERE table_name = 'your_table' AND column_name = 'new_column';

EOF

echo "Created: $FILE"
echo ""
echo "Next steps:"
echo "  1. Open $FILE and write your SQL"
echo "  2. Run: supabase db push"
echo "     Or:  npm run migrate:push"
