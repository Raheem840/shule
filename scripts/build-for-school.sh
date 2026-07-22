#!/bin/bash
# Builds a Docker image for a specific school
# and saves it as a .tar file for USB transport
#
# Local/Hybrid: don't call this directly — run scripts/prepare-usb.sh
# instead. It generates the school's local secrets (there's no existing
# Supabase project to draw an ANON_KEY from for a fresh on-prem install)
# and calls this script with the right values automatically:
#
# Local:  ./scripts/build-for-school.sh "School Name" \
#           http://192.168.1.100:8000 LOCAL_ANON_KEY local
#
# Cloud:  ./scripts/build-for-school.sh "School Name" \
#           https://xxx.supabase.co CLOUD_ANON_KEY cloud
#
# Hybrid: ./scripts/build-for-school.sh "School Name" \
#           http://192.168.1.100:8000 LOCAL_ANON_KEY hybrid
#
# Note: Hybrid takes no separate cloud URL/key here — the frontend build
# only ever points at ONE Supabase project (the local one, for Hybrid). The
# school's separate cloud project (for off-site backup) is configured via
# prepare-usb.sh instead, and its service-role key never becomes a frontend
# build arg — see scripts/backup-upload.sh.

SCHOOL_NAME=$1
SUPABASE_URL=$2
ANON_KEY=$3
MODE=${4:-local}

if [ -z "$SCHOOL_NAME" ] || [ -z "$SUPABASE_URL" ] || \
   [ -z "$ANON_KEY" ]; then
  echo "Usage: ./scripts/build-for-school.sh 'School Name' SUPABASE_URL ANON_KEY [MODE]"
  exit 1
fi

IMAGE_NAME="shule-$(echo "$SCHOOL_NAME" | \
  tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -d "'")"
DATE_TAG=$(date +%Y%m%d)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Building Shule"
echo "  School : $SCHOOL_NAME"
echo "  Mode   : $MODE"
echo "  Image  : $IMAGE_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

docker build \
  --build-arg VITE_SUPABASE_URL="$SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
  --build-arg VITE_SHULE_MODE="$MODE" \
  -t "$IMAGE_NAME" \
  -t "$IMAGE_NAME:$DATE_TAG" \
  .

if [ $? -ne 0 ]; then
  echo "✗ Build failed. Check errors above."
  exit 1
fi

mkdir -p shule-install/migrations shule-install/supabase-images shule-install/supabase

# Save Docker image
docker save "$IMAGE_NAME" > "shule-install/$IMAGE_NAME.tar"

# Write env file
cat > "shule-install/$IMAGE_NAME.env" << EOF
SCHOOL_NAME=$SCHOOL_NAME
SCHOOL_IMAGE_NAME=$IMAGE_NAME
SUPABASE_URL=$SUPABASE_URL
SHULE_MODE=$MODE
BUILD_DATE=$DATE_TAG
EOF

# Copy infrastructure files the installer needs
cp docker-compose.school.yml shule-install/
cp nginx.conf                shule-install/
cp supabase/kong.yml         shule-install/supabase/

# Copy every migration in order — installer applies the whole set to the
# local Supabase DB. (Previously only 00001-00003 were copied here, which
# left every dated migration since 2026-06-03 — including several security
# fixes — never reaching on-prem schools. Fixed 2026-07-21.)
cp supabase/migrations/*.sql shule-install/migrations/

# Copy the real onboarding template (supabase/seed/ is singular — a stale
# "supabase/seeds/base.sql" reference here used to make this cp fail
# silently, since that file never existed). This is NOT auto-applied: it
# needs the school's real name/motto and an auth_user_id that doesn't exist
# until Step 2 of the on-site install, so it stays a manual SQL Editor step
# — see the printed instructions at the end of install.sh.
cp supabase/seed/school_template.sql shule-install/school_template.sql

if [ "$MODE" = "local" ] || [ "$MODE" = "hybrid" ]; then
  echo ""
  echo "→ Building edge function images (pre-cached for offline use)..."
  FUNCTIONS=(
    broadcast-announcement create-parent-auth-user create-staff-auth-user
    create-student-auth-user request-staff-password reset-parent-password
    reset-staff-password reset-student-password resolve-staff-password-request
    send-push send-sms send-whatsapp set-user-disabled sync-self-password-reset
    upload-staff-photo
  )
  for fn in "${FUNCTIONS[@]}"; do
    echo "  Building: shule-fn-$fn"
    docker build --build-arg FUNCTION_NAME="$fn" \
      -f supabase/functions/Dockerfile -t "shule-fn-$fn" . -q
    docker save "shule-fn-$fn" > "shule-install/supabase-images/shule-fn-$fn.tar"
    echo "  ✓ shule-fn-$fn"
  done
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Build complete"
echo "  Saved to: shule-install/$IMAGE_NAME.tar"
echo ""
echo "  shule-install/ folder contents:"
echo "    $IMAGE_NAME.tar     ← Docker image"
echo "    $IMAGE_NAME.env     ← School config"
echo "    docker-compose.school.yml"
echo "    nginx.conf"
echo "    install.sh"
echo "    README.txt"
echo "    school_template.sql ← Edit placeholders, run manually after install"
echo "    migrations/         ← All migrations, applied by install.sh"
echo "    supabase/kong.yml   ← Gateway config template"
echo "    supabase-images/    ← Backend + function images, filled by prepare-usb.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next: run  bash scripts/prepare-usb.sh  then copy shule-install/ to USB."
