#!/bin/bash
# Builds a Docker image for a specific school
# and saves it as a .tar file for USB transport
#
# Local:  ./scripts/build-for-school.sh "School Name" \
#           http://192.168.1.100:8000 LOCAL_ANON_KEY local
#
# Cloud:  ./scripts/build-for-school.sh "School Name" \
#           https://xxx.supabase.co CLOUD_ANON_KEY cloud
#
# Hybrid: ./scripts/build-for-school.sh "School Name" \
#           http://192.168.1.100:8000 LOCAL_ANON_KEY hybrid \
#           https://xxx.supabase.co CLOUD_ANON_KEY

SCHOOL_NAME=$1
SUPABASE_URL=$2
ANON_KEY=$3
MODE=${4:-local}
CLOUD_URL=${5:-""}
CLOUD_KEY=${6:-""}

if [ -z "$SCHOOL_NAME" ] || [ -z "$SUPABASE_URL" ] || \
   [ -z "$ANON_KEY" ]; then
  echo "Usage: ./scripts/build-for-school.sh \
    'School Name' SUPABASE_URL ANON_KEY [MODE] \
    [CLOUD_URL] [CLOUD_KEY]"
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
  --build-arg VITE_CLOUD_SUPABASE_URL="$CLOUD_URL" \
  --build-arg VITE_CLOUD_SUPABASE_ANON_KEY="$CLOUD_KEY" \
  -t "$IMAGE_NAME" \
  -t "$IMAGE_NAME:$DATE_TAG" \
  .

if [ $? -ne 0 ]; then
  echo "✗ Build failed. Check errors above."
  exit 1
fi

mkdir -p shule-install/migrations shule-install/supabase-images

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

# Copy core migrations — installer applies these to the local Supabase DB
cp supabase/migrations/00001_initial_schema.sql        shule-install/migrations/
cp supabase/migrations/00002_rls_policies.sql           shule-install/migrations/
cp supabase/migrations/00003_functions_triggers.sql     shule-install/migrations/
# 00004 note: edge_function_notes.sql is informational only — JWT hook is in 00003
cp supabase/seeds/base.sql                              shule-install/migrations/

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
echo "    migrations/         ← Applied by install.sh"
echo "    supabase-images/    ← Filled by prepare-usb.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next: run  bash scripts/prepare-usb.sh  then copy shule-install/ to USB."
