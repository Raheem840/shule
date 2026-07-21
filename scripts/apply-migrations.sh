#!/bin/bash
# Shule Cloud Installation / Migration Script
# Applies schema, RLS, functions and deploys edge functions to a Supabase cloud project.
#
# Usage:
#   New school:   ./scripts/apply-migrations.sh PROJECT_REF
#   With demo:    ./scripts/apply-migrations.sh PROJECT_REF --with-demo
#   Update only:  ./scripts/apply-migrations.sh PROJECT_REF --update-only

set -e

PROJECT_REF=$1
MODE=${2:-""}

if [ -z "$PROJECT_REF" ]; then
  echo "Usage: ./scripts/apply-migrations.sh PROJECT_REF [--with-demo|--update-only]"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SHULE — Cloud Installation"
echo "  Project : $PROJECT_REF"
echo "  Mode    : ${MODE:-fresh install}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── STEP 1: Link and push schema ─────────────────────────────────────────────
echo ""
echo "→ [1/4] Linking to project..."
supabase link --project-ref "$PROJECT_REF"

echo "→ Applying database migrations..."
supabase db push
echo "  ✓ Schema applied (all migrations)"

# ── STEP 2: Seed data ────────────────────────────────────────────────────────
# supabase/seed/school_template.sql (singular "seed/" — not "seeds/", which
# doesn't exist) needs the school's real name/motto and an auth_user_id that
# doesn't exist until the IT Admin's auth account is created below, so it
# can't be applied unattended here. There is also no demo-data SQL file
# checked into this repo — `--with-demo` used to silently fail trying to
# read one. Both are manual steps now; see the printed instructions below.
if [ "$MODE" = "--with-demo" ]; then
  echo ""
  echo "→ [2/4] --with-demo: no demo seed file exists in this repo — skipping."
  echo "  (supabase/seed/README.md references one, but it was never added."
  echo "  Add supabase/seed/demo_seed.sql if you want this flag to work.)"
else
  echo ""
  echo "→ [2/4] Seed data is a manual step — see instructions at the end."
fi

# ── STEP 3: Deploy all edge functions ────────────────────────────────────────
echo ""
echo "→ [3/4] Deploying edge functions..."
FUNCTIONS=(
  "create-staff-auth-user"
  "create-student-auth-user"
  "create-parent-auth-user"
  "reset-staff-password"
  "reset-student-password"
  "reset-parent-password"
  "request-staff-password"
  "resolve-staff-password-request"
  "sync-self-password-reset"
  "set-user-disabled"
  "upload-staff-photo"
  "send-sms"
  "send-whatsapp"
  "send-push"
  "broadcast-announcement"
)
for fn in "${FUNCTIONS[@]}"; do
  if [ -d "supabase/functions/$fn" ]; then
    supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
    echo "  ✓ $fn"
  else
    echo "  ! $fn not found — skipping"
  fi
done

# ── STEP 4: Print remaining manual steps ─────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Automated installation complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  MANUAL STEPS REMAINING:"
echo ""
echo "  1. Auth Hook:"
echo "     Supabase Dashboard → Authentication → Hooks"
echo "     → Add Hook: custom_access_token_hook"
echo "     → Type: PostgreSQL Function"
echo "     → Schema: public, Function: custom_access_token_hook"
echo ""
echo "  2. School profile + IT Admin:"
echo "     Edit supabase/seed/school_template.sql — replace every"
echo "     [REPLACE: ...] with this school's real name/motto/curriculum."
echo "     Run Step 1 of it in the SQL Editor and copy the returned school_id."
echo "     Then: Dashboard → Authentication → Users → Add user (the IT"
echo "     Admin's login) and copy their user ID."
echo "     Finally run Step 2 of school_template.sql with both IDs filled in."
echo ""
echo "  3. Log in as IT Admin and set up staff + students."
echo ""
echo "  Project Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
