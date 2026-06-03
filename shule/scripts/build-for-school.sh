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

mkdir -p shule-install
docker save "$IMAGE_NAME" > "shule-install/$IMAGE_NAME.tar"

cat > "shule-install/$IMAGE_NAME.env" << EOF
SCHOOL_NAME=$SCHOOL_NAME
SCHOOL_IMAGE_NAME=$IMAGE_NAME
SUPABASE_URL=$SUPABASE_URL
SHULE_MODE=$MODE
BUILD_DATE=$DATE_TAG
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Build complete"
echo "  Saved to: shule-install/$IMAGE_NAME.tar"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "On school server:"
echo "  docker load < $IMAGE_NAME.tar"
echo "  docker compose -f docker-compose.school.yml up -d"
