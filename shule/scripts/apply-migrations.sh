#!/bin/bash
# Applies all migrations + seeds to a target project, then deploys Edge Functions.
# Usage:
#   ./scripts/apply-migrations.sh PROJECT_REF           ← base seed only
#   ./scripts/apply-migrations.sh PROJECT_REF --with-demo ← include demo school data

set -e

PROJECT_REF=$1
WITH_DEMO=$2

if [ -z "$PROJECT_REF" ]; then
  echo "Error: PROJECT_REF is required."
  echo "Usage: ./scripts/apply-migrations.sh <project-ref> [--with-demo]"
  echo ""
  echo "Find your project ref in:"
  echo "  https://supabase.com/dashboard/project/<project-ref>"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Shule — School Installation Script"
echo " Project: $PROJECT_REF"
if [ "$WITH_DEMO" = "--with-demo" ]; then
  echo " Mode:    DEMO (NYCS demo data will be loaded)"
else
  echo " Mode:    PRODUCTION (base seed only)"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "[1/4] Linking to project..."
supabase link --project-ref "$PROJECT_REF"

echo ""
echo "[2/4] Pushing all migrations..."
supabase db push

echo ""
if [ "$WITH_DEMO" = "--with-demo" ]; then
  echo "[3/4] Applying DEMO seed data (NYCS school)..."
  echo "      ⚠️  This loads fictional data — only for demos/pitches."
  supabase db execute --file supabase/seeds/demo.sql --project-ref "$PROJECT_REF"
else
  echo "[3/4] Applying base seed data (Uganda NCDC subjects)..."
  supabase db execute --file supabase/seeds/base.sql --project-ref "$PROJECT_REF"
fi

echo ""
echo "[4/4] Deploying Edge Functions..."
supabase functions deploy create-staff-auth-user   --project-ref "$PROJECT_REF"
supabase functions deploy create-student-auth-user --project-ref "$PROJECT_REF"
supabase functions deploy create-parent-auth-user  --project-ref "$PROJECT_REF"
supabase functions deploy reset-staff-password     --project-ref "$PROJECT_REF"
supabase functions deploy reset-student-password   --project-ref "$PROJECT_REF"
supabase functions deploy send-sms                 --project-ref "$PROJECT_REF"
supabase functions deploy send-whatsapp            --project-ref "$PROJECT_REF"
supabase functions deploy broadcast-announcement   --project-ref "$PROJECT_REF"
supabase functions deploy upload-staff-photo       --project-ref "$PROJECT_REF"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Done. Two manual steps remaining:"
echo ""
echo " Step A — Wire the JWT Hook:"
echo "   Dashboard → Authentication → Hooks"
echo "   → Add: custom_access_token_hook"
echo "   → Type: PostgreSQL Function"
echo "   → Schema: public, Function: custom_access_token_hook"
echo ""
echo " Step B — Create the first IT Admin:"
echo "   Dashboard → Authentication → Users → Invite user"
echo "   → Then insert their staff row with role='it_admin'"
echo "   → IT Admin logs in and creates the Principal + Secretary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
