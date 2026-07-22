#!/bin/bash
# Prepares a complete USB installation package for a Local or Hybrid school.
# Run this at home, while you still have internet — everything it produces
# is meant to work with zero connectivity once it's on the school's server.
#
# Usage:
#   Local:  ./scripts/prepare-usb.sh "School Name"
#   Hybrid: ./scripts/prepare-usb.sh "School Name" hybrid \
#             https://xxx.supabase.co CLOUD_SERVICE_ROLE_KEY
#
# Unlike the old version of this script, you do NOT need to already have a
# Supabase URL/anon key for the local side — there's no existing project to
# get one from for a fresh on-prem install, so this generates a unique,
# school-specific secret set instead (see scripts/generate-local-secrets.js).
#
# Hybrid mode: the app itself still runs entirely against the LOCAL Supabase
# stack (there is no live dual-write to the cloud — that would need
# conflict-resolution machinery this system doesn't have). What "hybrid"
# actually buys the school is disaster recovery: install.sh's nightly
# pg_dump also gets uploaded to the given cloud project's Storage (see
# scripts/backup-upload.sh / scripts/restore.sh --from-cloud), so a lost or
# destroyed server doesn't mean lost data. CLOUD_SERVICE_ROLE_KEY must be
# that project's service_role key (Settings -> API -> service_role) — NOT
# the anon key, and it never reaches the frontend build or the browser.

set -e

SCHOOL_NAME=$1
MODE=${2:-local}
CLOUD_URL=${3:-""}
CLOUD_SERVICE_KEY=${4:-""}

if [ -z "$SCHOOL_NAME" ]; then
  echo "Usage: ./scripts/prepare-usb.sh 'School Name' [local|hybrid] [CLOUD_URL] [CLOUD_SERVICE_KEY]"
  exit 1
fi

if [ "$MODE" = "hybrid" ] && { [ -z "$CLOUD_URL" ] || [ -z "$CLOUD_SERVICE_KEY" ]; }; then
  echo "Hybrid mode also needs the cloud project's URL and service_role key"
  echo "(Settings -> API -> service_role, NOT anon — this key only ever runs"
  echo "server-side in the nightly backup cron, never in the browser):"
  echo "  ./scripts/prepare-usb.sh 'School Name' hybrid https://xxx.supabase.co CLOUD_SERVICE_ROLE_KEY"
  exit 1
fi

LOCAL_SITE_URL="http://192.168.1.100"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Preparing USB Install Package"
echo "  School: $SCHOOL_NAME"
echo "  Mode  : $MODE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

mkdir -p shule-install/supabase-images
mkdir -p shule-install/migrations

echo ""
echo "→ Generating secrets for this school..."
node scripts/generate-local-secrets.js "$SCHOOL_NAME" "$LOCAL_SITE_URL" "$MODE" "$CLOUD_URL" "$CLOUD_SERVICE_KEY" > shule-install/secrets.env
set -a
# shellcheck disable=SC1091
source shule-install/secrets.env
set +a
echo "  ✓ shule-install/secrets.env written — keep this safe, it is the only"
echo "    copy and is never uploaded anywhere. Do not put it on a USB you'll"
echo "    reuse for another school."

# Build the school frontend image and, for local/hybrid, every edge
# function image — all pre-cached so nothing needs internet on-site. The
# frontend only ever talks to the local Supabase stack, Local or Hybrid —
# cloud creds are NOT frontend build args, see backup-upload.sh for where
# they're actually used (server-side backup cron only).
bash scripts/build-for-school.sh \
  "$SCHOOL_NAME" "$SUPABASE_PUBLIC_URL" "$ANON_KEY" "$MODE"

# Ship the backup/restore scripts so a Hybrid school's cron and any future
# manual restore both have them on-site.
cp scripts/backup-upload.sh shule-install/
cp scripts/restore.sh shule-install/
chmod +x shule-install/backup-upload.sh shule-install/restore.sh

# Pull and save the self-hosted Supabase backend images for offline use.
echo ""
echo "→ Pulling backend images for offline use..."
IMAGES=(
  "supabase/postgres:17.6.1.136"
  "supabase/gotrue:v2.189.0"
  "postgrest/postgrest:v14.12"
  "supabase/realtime:v2.102.3"
  "supabase/storage-api:v1.60.4"
  "supabase/postgres-meta:v0.96.6"
  "supabase/studio:2026.07.07-sha-a6a04f2"
  "kong:2.8.1"
)
for img in "${IMAGES[@]}"; do
  echo "  Pulling: $img"
  docker pull "$img"
  SAFE_NAME=$(echo "$img" | tr '/:' '--')
  docker save "$img" > \
    "shule-install/supabase-images/$SAFE_NAME.tar"
  echo "  ✓ Saved: $SAFE_NAME.tar"
done

# Copy every migration (defensive backstop — build-for-school.sh already
# does this, but keeping it here too means this still works if
# build-for-school.sh is ever invoked on its own for a local install).
cp supabase/migrations/*.sql shule-install/migrations/ 2>/dev/null || true

# Copy install files
cp docker-compose.school.yml shule-install/
cp nginx.conf shule-install/
cp scripts/install.sh shule-install/
chmod +x shule-install/install.sh

# Generate README for the USB
cat > shule-install/README.txt << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SHULE — School Management System
  Installation Package
  School: $SCHOOL_NAME
  Mode: $MODE
  Built: $(date)
  By: Sinqura (sinqura.netlify.app)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REQUIREMENTS:
  A PC (min 8GB RAM, 256GB SSD, i5+)
  Ubuntu Server 22.04 LTS installed
  This USB drive

INSTALLATION:
  1. Copy this folder to the server
  2. Open terminal in this folder
  3. Run: sudo bash install.sh
  4. Follow on-screen instructions

AFTER INSTALL — manual steps (install.sh prints these too):
  1. Edit school_template.sql with the school's real name/motto, run it
     in Supabase Studio's SQL Editor: http://192.168.1.100:8000
     (Dashboard login: see /opt/shule/CREDENTIALS.txt)
  2. Studio -> Authentication -> Users -> Add the IT Admin's auth user
  3. Run the staff INSERT at the bottom of school_template.sql with that
     user's ID
  4. Log in to Shule as IT Admin and create all other staff from there

BACKUPS:
  Nightly automatic backup at 2 AM, kept 30 days: /opt/shule/backups
$([ "$MODE" = "hybrid" ] && echo "  Hybrid mode: each night's backup is also uploaded off-site to the
  cloud project you configured — recoverable even if this server is lost.")
  To restore: sudo bash /opt/shule/restore.sh
  (add --from-cloud instead of a local file if the server's disk is gone too$([ "$MODE" != "hybrid" ] && echo " — only works for Hybrid installs"))

SUPPORT:
  WhatsApp: +256XXXXXXXXX
  Email: support@sinqura.com
  Website: sinqura.netlify.app
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ USB Package Ready"
echo "  Copy shule-install/ folder to USB drive"
echo "  Don't forget secrets.env is in there — it's the only copy."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
du -sh shule-install/
