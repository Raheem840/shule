#!/bin/bash
# Applies Shule to a new Supabase cloud project
# Usage: ./scripts/apply-migrations.sh PROJECT_REF [--with-demo]

PROJECT_REF=$1
WITH_DEMO=$2

if [ -z "$PROJECT_REF" ]; then
  echo "Usage: ./scripts/apply-migrations.sh \
    PROJECT_REF [--with-demo]"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Shule Cloud Installation"
echo "  Project: $PROJECT_REF"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "→ Linking to project..."
supabase link --project-ref "$PROJECT_REF"

echo "→ Applying database migrations..."
supabase db push
echo "  ✓ Schema applied"

if [ "$WITH_DEMO" = "--with-demo" ]; then
  echo "→ Applying demo seed data..."
  supabase db execute \
    --file supabase/seeds/demo.sql \
    --project-ref "$PROJECT_REF"
  echo "  ✓ Demo data applied"
else
  echo "→ Applying base seed data..."
  supabase db execute \
    --file supabase/seeds/base.sql \
    --project-ref "$PROJECT_REF"
  echo "  ✓ Base data applied"
fi

echo "→ Deploying edge functions..."
FUNCTIONS=(
  "create-staff-auth-user"
  "create-student-auth-user"
  "reset-staff-password"
  "reset-student-password"
  "send-sms"
)
for fn in "${FUNCTIONS[@]}"; do
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
  echo "  ✓ $fn"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Cloud installation complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  MANUAL STEPS REMAINING:"
echo "  1. Dashboard → Auth → Hooks"
echo "     → Enable custom_access_token_hook"
echo "  2. Dashboard → Auth → Users → Add IT Admin"
echo "  3. SQL Editor → INSERT IT Admin into staff table"
echo ""
