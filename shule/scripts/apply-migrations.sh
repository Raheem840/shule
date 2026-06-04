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
if [ "$MODE" != "--update-only" ]; then
  echo ""
  if [ "$MODE" = "--with-demo" ]; then
    echo "→ [2/4] Applying demo seed data..."
    supabase db execute --file supabase/seeds/demo.sql --project-ref "$PROJECT_REF"
    echo "  ✓ Demo school + data loaded"
  else
    echo "→ [2/4] Applying base seed data..."
    if [ -f "supabase/seeds/base.sql" ]; then
      supabase db execute --file supabase/seeds/base.sql --project-ref "$PROJECT_REF"
      echo "  ✓ Base data loaded"
    else
      echo "  ! No base.sql found — skipping seed"
    fi
  fi
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
  "upload-staff-photo"
  "send-sms"
  "send-whatsapp"
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
echo "  2. Create IT Admin auth user:"
echo "     Dashboard → Authentication → Users → Add user"
echo "     Email: admin@${PROJECT_REF}.shule.ug  (or any email)"
echo "     Then run in SQL Editor:"
echo "     INSERT INTO public.staff (school_id, auth_user_id, first_name,"
echo "       last_name, role, email, is_active)"
echo "     VALUES ('<SCHOOL_ID>', '<AUTH_USER_ID>', 'IT', 'Admin',"
echo "       'it_admin', '<EMAIL>', true);"
echo ""
echo "  3. Create school_profile row if not seeded:"
echo "     INSERT INTO public.school_profile (id, school_name, short_name,"
echo "       curriculum, deployment_mode)"
echo "     VALUES (gen_random_uuid(), 'School Name', 'shortname', 'CBC', 'cloud');"
echo ""
echo "  4. Log in as IT Admin and set up staff + students."
echo ""
echo "  Project Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
