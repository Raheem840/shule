#!/bin/bash
# Shule one-command installer for school server
# Run: bash install.sh

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Shule School Management System — Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Docker is available
if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker is not installed."
  echo "Install it from: https://docs.docker.com/get-docker/"
  exit 1
fi

# Load the app image
TAR_FILE=$(ls shule-*.tar 2>/dev/null | head -1)
if [ -z "$TAR_FILE" ]; then
  echo "ERROR: No shule-*.tar file found in this folder."
  exit 1
fi

echo "[1/3] Loading Shule app image from $TAR_FILE..."
docker load < "$TAR_FILE"

echo ""
echo "[2/3] Starting Shule..."
docker compose -f docker-compose.school.yml up -d

echo ""
echo "[3/3] Checking status..."
sleep 3
docker compose -f docker-compose.school.yml ps

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Shule is running!"
echo ""
echo " Open in browser:"
echo "   This computer:     http://localhost"
echo "   Other devices:     http://$(hostname -I | awk '{print $1}')"
echo ""
echo " Log in with the IT Admin credentials from the Shule team."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
