#!/bin/bash
# Builds a school-specific Docker image and saves it as a USB-ready .tar file.
# Usage: ./scripts/build-for-school.sh "School Name" SUPABASE_URL ANON_KEY
#
# Prerequisites:
#   - Docker installed and running
#   - supabase/seeds/ and supabase/migrations/ present
#   - Run from project root

set -e

SCHOOL_NAME=$1
SUPABASE_URL=$2
ANON_KEY=$3

if [ -z "$SCHOOL_NAME" ] || [ -z "$SUPABASE_URL" ] || [ -z "$ANON_KEY" ]; then
  echo "Usage: ./scripts/build-for-school.sh \"School Name\" SUPABASE_URL ANON_KEY"
  echo ""
  echo "Example (cloud):"
  echo "  ./scripts/build-for-school.sh \"Nile Youth Community School\" \\"
  echo "    https://abcxyz.supabase.co eyJhbGc..."
  echo ""
  echo "Example (local/offline):"
  echo "  ./scripts/build-for-school.sh \"Nile Youth Community School\" \\"
  echo "    http://192.168.1.100:8000 eyJhbGc..."
  exit 1
fi

IMAGE_NAME="shule-$(echo "$SCHOOL_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')"
INSTALL_DIR="shule-install"

mkdir -p "$INSTALL_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Building Shule for: $SCHOOL_NAME"
echo " Image name:         $IMAGE_NAME"
echo " Supabase URL:       $SUPABASE_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "[1/3] Building Docker image..."
docker build \
  --build-arg VITE_SUPABASE_URL="$SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
  --build-arg SHULE_MODE=local \
  -t "$IMAGE_NAME" .

echo ""
echo "[2/3] Saving image to USB-ready tar..."
docker save "$IMAGE_NAME" > "$INSTALL_DIR/${IMAGE_NAME}.tar"

echo ""
echo "[3/3] Copying migration files..."
cp -r supabase/migrations "$INSTALL_DIR/"
cp supabase/seeds/base.sql "$INSTALL_DIR/migrations/"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Done! USB package ready in: $INSTALL_DIR/"
echo ""
echo " On the school server, run:"
echo "   docker load < ${IMAGE_NAME}.tar"
echo "   docker compose -f docker-compose.school.yml up -d"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
