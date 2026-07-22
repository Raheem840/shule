#!/bin/bash
# Shule On-Site Installation Script
# Run as: sudo bash install.sh
# Run this from inside the shule-install/ folder copied off the USB drive.

set -e

INSTALL_DIR="$(pwd)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SHULE — School Management System"
echo "  Installation by Sinqura"
echo "  $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f "secrets.env" ]; then
  echo "✗ secrets.env not found in this folder."
  echo "  Run this script from inside the shule-install/ folder produced by"
  echo "  scripts/prepare-usb.sh — that step must run at home, before"
  echo "  travelling, since it needs internet to download images and"
  echo "  generate secrets."
  exit 1
fi

# ── STEP 1: Install dependencies ─────────────────────────────
echo "→ [1/9] Installing system dependencies..."
apt update -qq
apt install -y docker.io docker-compose-v2 nginx \
  postgresql-client curl wget qrencode -qq
systemctl enable docker
systemctl start docker
echo "  ✓ Done"

# ── STEP 2: Load Docker images ────────────────────────────────
echo "→ [2/9] Loading Docker images..."
for tar in supabase-images/*.tar; do
  docker load < "$tar"
  echo "  ✓ Loaded: $tar"
done

SHULE_TAR=$(ls shule-*.tar 2>/dev/null | head -1)
if [ -n "$SHULE_TAR" ]; then
  docker load < "$SHULE_TAR"
  echo "  ✓ Shule frontend loaded"
fi
ENV_FILE="${SHULE_TAR%.tar}.env"

# ── STEP 3: Assemble secrets + config ─────────────────────────
echo "→ [3/9] Configuring secrets..."
mkdir -p /opt/shule
set -a
# shellcheck disable=SC1091
source "$INSTALL_DIR/secrets.env"
if [ -f "$INSTALL_DIR/$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$INSTALL_DIR/$ENV_FILE"
fi
set +a

cat > /opt/shule/.env << EOF
SCHOOL_NAME=${SCHOOL_NAME}
SCHOOL_IMAGE_NAME=${SCHOOL_IMAGE_NAME:-shule-frontend}
SITE_URL=${SITE_URL}
API_EXTERNAL_URL=${API_EXTERNAL_URL}
SUPABASE_PUBLIC_URL=${SUPABASE_PUBLIC_URL}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DASHBOARD_USERNAME=${DASHBOARD_USERNAME}
DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}
SECRET_KEY_BASE=${SECRET_KEY_BASE}
EOF
chmod 600 /opt/shule/.env
echo "  ✓ /opt/shule/.env written (docker compose reads this automatically,"
echo "    including after a reboot)"

# ── STEP 4: Set static IP ─────────────────────────────────────
echo "→ [4/9] Configuring network..."
INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
cat > /etc/netplan/01-shule-static.yaml << EOF
network:
  version: 2
  ethernets:
    $INTERFACE:
      addresses: [192.168.1.100/24]
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
EOF
netplan apply 2>/dev/null || true
echo "  ✓ Static IP: 192.168.1.100"

# ── STEP 5: Start the database and apply migrations ──────────
echo "→ [5/9] Starting the database..."
cp "$INSTALL_DIR/docker-compose.school.yml" /opt/shule/
cp "$INSTALL_DIR/nginx.conf" /opt/shule/
cp -r "$INSTALL_DIR/supabase" /opt/shule/
cd /opt/shule

docker compose -f docker-compose.school.yml up -d db
echo "  Waiting for database..."
for i in $(seq 1 30); do
  if docker compose -f docker-compose.school.yml exec -T db pg_isready -U postgres > /dev/null 2>&1; then
    echo "  ✓ Database ready"
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then
    echo "  ✗ Database did not become ready in time — check: docker compose -f /opt/shule/docker-compose.school.yml logs db"
    exit 1
  fi
done

echo "→ [6/9] Setting up database schema..."
MIGRATION_COUNT=0
for sql in $(ls "$INSTALL_DIR"/migrations/*.sql | sort); do
  docker compose -f docker-compose.school.yml exec -T \
    -e PGPASSWORD="$POSTGRES_PASSWORD" db \
    psql -U postgres -d postgres -q < "$sql"
  MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
  echo "  ✓ Applied: $(basename "$sql")"
done
echo "  ✓ All migrations applied ($MIGRATION_COUNT files)"

# ── STEP 7: Start the rest of the stack ────────────────────────
echo "→ [7/9] Starting API gateway, auth, storage, and edge functions..."
docker compose -f docker-compose.school.yml up -d
echo "  Waiting for the API gateway..."
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "http://localhost:8000/auth/v1/health"; then
    echo "  ✓ API gateway is up"
    break
  fi
  sleep 3
  if [ "$i" -eq 30 ]; then
    echo "  ! API gateway didn't respond in time — it may still be starting."
    echo "    Check: docker compose -f /opt/shule/docker-compose.school.yml ps"
  fi
done

# ── STEP 8: Configure web server ─────────────────────────────
echo "→ [8/9] Configuring web server..."
cp "$INSTALL_DIR/nginx.conf" /etc/nginx/sites-available/shule
ln -sf /etc/nginx/sites-available/shule \
  /etc/nginx/sites-enabled/shule
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx
systemctl enable nginx
echo "  ✓ Web server configured"

# ── STEP 9: Setup backups and auto-restart ────────────────────
echo "→ [9/9] Configuring backups..."
mkdir -p /opt/shule/backups
cp "$INSTALL_DIR/restore.sh" /opt/shule/ 2>/dev/null || true
cp "$INSTALL_DIR/backup-upload.sh" /opt/shule/ 2>/dev/null || true
chmod +x /opt/shule/restore.sh /opt/shule/backup-upload.sh 2>/dev/null || true

# CLOUD_URL/CLOUD_SERVICE_KEY are blank for Local installs (generate-local-secrets.js
# only fills them for hybrid) — the cron command below is safe either way,
# since backup-upload.sh's own arg check exits early on empty values.
cat >> /opt/shule/.env << EOF
CLOUD_URL=${CLOUD_URL:-}
CLOUD_SERVICE_KEY=${CLOUD_SERVICE_KEY:-}
EOF

(crontab -l 2>/dev/null; echo "0 2 * * * cd /opt/shule && set -a && . /opt/shule/.env && set +a && docker compose -f docker-compose.school.yml exec -T \
  -e PGPASSWORD=\$POSTGRES_PASSWORD db pg_dump -U postgres postgres \
  > /opt/shule/backups/shule_\$(date +\%Y\%m\%d).sql \
  && find /opt/shule/backups -name '*.sql' -mtime +30 -delete \
  && if [ -n \"\$CLOUD_URL\" ]; then bash /opt/shule/backup-upload.sh /opt/shule/backups/shule_\$(date +\%Y\%m\%d).sql \"\$CLOUD_URL\" \"\$CLOUD_SERVICE_KEY\" \"\$SCHOOL_NAME\" \"\$SUPABASE_PUBLIC_URL\" \"\$SERVICE_ROLE_KEY\" >> /opt/shule/backup-upload.log 2>&1; fi") \
  | crontab -
systemctl enable docker
systemctl enable nginx
echo "  ✓ Nightly backup at 2 AM configured (via docker compose exec — no"
echo "    database port is exposed to the network)"
if [ -n "${CLOUD_URL:-}" ]; then
  echo "  ✓ Hybrid mode: nightly backup also uploads to the cloud project"
  echo "    (log: /opt/shule/backup-upload.log)"
fi
echo "  ✓ Auto-restart on power cut configured"
echo "  ✓ Restore script installed: /opt/shule/restore.sh (run 'sudo bash"
echo "    restore.sh --help' equivalent — see comments at the top of the file)"

# ── Print QR code ─────────────────────────────────────────────
qrencode -t ANSI "http://192.168.1.100"

# ── Save credentials ──────────────────────────────────────────
cat > /opt/shule/CREDENTIALS.txt << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SHULE CREDENTIALS
  ${SCHOOL_NAME}
  Installed: $(date)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
App URL          : http://192.168.1.100
Studio/API URL   : http://192.168.1.100:8000
Studio login     : ${DASHBOARD_USERNAME} / ${DASHBOARD_PASSWORD}
DB Password      : ${POSTGRES_PASSWORD}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Keep this file private — it is not backed up anywhere else.
EOF
chmod 600 /opt/shule/CREDENTIALS.txt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ INSTALLATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Shule is live at: http://192.168.1.100"
echo ""
echo "  REMAINING STEPS (manual — do these in order):"
echo "  1. Open http://192.168.1.100:8000 (login: see CREDENTIALS.txt above)"
echo "  2. Edit school_template.sql — replace every [REPLACE: ...] with the"
echo "     school's real name, motto, and curriculum, then run it in"
echo "     Studio's SQL Editor. Copy the school_id it returns."
echo "  3. Studio -> Authentication -> Users -> Add User: create the IT"
echo "     Admin's login. Copy their user ID."
echo "  4. Back in the SQL Editor, run the staff INSERT at the bottom of"
echo "     school_template.sql with that school_id and user ID."
echo "  5. Log in to http://192.168.1.100 as the IT Admin — they create"
echo "     every other staff member from inside the app."
echo ""
echo "  Credentials: /opt/shule/CREDENTIALS.txt"
echo "  school_template.sql: $INSTALL_DIR/school_template.sql"
echo ""
echo "  BACKUPS: nightly at 2 AM into /opt/shule/backups (30-day retention)."
echo "  To restore (e.g. after a hardware failure): sudo bash /opt/shule/restore.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
