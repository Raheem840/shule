#!/bin/bash
# Shule — Deploy Schema to a New School
# Usage: ./scripts/deploy-school.sh [PROJECT-REF] [SCHOOL-NAME]
# Example: ./scripts/deploy-school.sh abcdefghijk "St Marys Kisubi"

set -e

SCHOOL_REF=$1
SCHOOL_NAME=$2

if [ -z "$SCHOOL_REF" ] || [ -z "$SCHOOL_NAME" ]; then
  echo "Usage: ./scripts/deploy-school.sh [PROJECT-REF] [SCHOOL-NAME]"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploying Shule schema to: $SCHOOL_NAME"
echo "  Supabase project: $SCHOOL_REF"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "→ Linking to school Supabase..."
supabase link --project-ref "$SCHOOL_REF"

echo "→ Running migrations..."
supabase db push

echo ""
echo "✅ Schema deployed to $SCHOOL_NAME"
echo ""
echo "NEXT STEPS (manual — do in school's Supabase Dashboard):"
echo "  1. Authentication → Hooks → Add: Custom Access Token → custom_access_token_hook"
echo "  2. Run supabase/seed/school_template.sql in their SQL Editor"
echo "  3. Invite IT Admin: Authentication → Users → Invite user"
echo ""

DEMO_REF=$(cat .supabase-demo-ref 2>/dev/null || echo "")
if [ -n "$DEMO_REF" ]; then
  echo "→ Switching back to demo project..."
  supabase link --project-ref "$DEMO_REF"
  echo "✅ Switched back to demo"
else
  echo "⚠  No .supabase-demo-ref file found. Run: echo 'YOUR-DEMO-REF' > .supabase-demo-ref"
fi
