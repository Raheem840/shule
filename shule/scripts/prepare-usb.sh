#!/bin/bash
# Prepares a complete USB installation package
# Run this at home before going to the school
#
# Usage: ./scripts/prepare-usb.sh "School Name" \
#          SUPABASE_URL ANON_KEY [MODE]

SCHOOL_NAME=$1
SUPABASE_URL=$2
ANON_KEY=$3
MODE=${4:-local}

if [ -z "$SCHOOL_NAME" ] || [ -z "$SUPABASE_URL" ] || \
   [ -z "$ANON_KEY" ]; then
  echo "Usage: ./scripts/prepare-usb.sh \
    'School Name' SUPABASE_URL ANON_KEY [MODE]"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Preparing USB Install Package"
echo "  School: $SCHOOL_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

mkdir -p shule-install/supabase-images
mkdir -p shule-install/migrations

# Build the school frontend image
bash scripts/build-for-school.sh \
  "$SCHOOL_NAME" "$SUPABASE_URL" "$ANON_KEY" "$MODE"

# Pull and save Docker images needed on-site
echo "→ Pulling Docker images for offline use..."
IMAGES=(
  "postgres:15-alpine"
  "nginx:alpine"
  "kong:2.8.1"
)
for img in "${IMAGES[@]}"; do
  echo "  Pulling: $img"
  docker pull $img
  SAFE_NAME=$(echo $img | tr '/:' '--')
  docker save $img > \
    "shule-install/supabase-images/$SAFE_NAME.tar"
  echo "  ✓ Saved: $SAFE_NAME.tar"
done

# Copy migration and seed files
cp supabase/migrations/*.sql shule-install/migrations/
cp supabase/seeds/base.sql shule-install/migrations/

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

AFTER INSTALL:
  Shule: http://192.168.1.100
  Supabase Studio: http://192.168.1.100:3000
  Register JWT hook: Studio → Auth → Hooks
  Create IT Admin: Studio → Auth → Users

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
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
du -sh shule-install/
