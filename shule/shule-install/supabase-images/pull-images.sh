#!/bin/bash
# Run this at home (with internet) before going to the school.
# Pulls all Supabase self-hosted images and saves them to this folder.
# Only needed for fully offline (no internet) school installations.

set -e

echo "Pulling Supabase self-hosted images..."
echo "This may take 10-20 minutes on first run."
echo ""

IMAGES=(
  "supabase/postgres:15.1.1.61"
  "supabase/gotrue:v2.99.0"
  "supabase/postgrest:v11.2.2"
  "supabase/realtime:v2.25.50"
  "supabase/storage-api:v0.43.11"
  "supabase/edge-runtime:v1.33.1"
  "supabase/studio:20231123-64a766a"
  "kong:2.8.1"
)

for IMAGE in "${IMAGES[@]}"; do
  echo "Pulling $IMAGE..."
  docker pull "$IMAGE"
  SAFE_NAME=$(echo "$IMAGE" | tr '/:' '__')
  docker save "$IMAGE" > "${SAFE_NAME}.tar"
  echo "Saved: ${SAFE_NAME}.tar"
  echo ""
done

echo "All images saved. Copy this folder to your USB drive."
