#!/bin/bash
# Shule On-Site Installation Script
# Run as: sudo bash install.sh

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SHULE — School Management System"
echo "  Installation by Sinqura"
echo "  $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── STEP 1: Install dependencies ─────────────────────────────
echo "→ [1/8] Installing system dependencies..."
apt update -qq
apt install -y docker.io docker-compose nginx \
  postgresql-client curl wget qrencode -qq
systemctl enable docker
systemctl start docker
echo "  ✓ Done"

# ── STEP 2: Load Docker images ────────────────────────────────
echo "→ [2/8] Loading Docker images..."
for tar in supabase-images/*.tar; do
  docker load < "$tar"
  echo "  ✓ Loaded: $tar"
done

SHULE_TAR=$(ls shule-*.tar 2>/dev/null | head -1)
if [ -n "$SHULE_TAR" ]; then
  docker load < "$SHULE_TAR"
  ENV_FILE="${SHULE_TAR%.tar}.env"
  if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
  fi
  echo "  ✓ Shule frontend loaded"
fi

# ── STEP 3: Set static IP ─────────────────────────────────────
echo "→ [3/8] Configuring network..."
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

# ── STEP 4: Start services ────────────────────────────────────
echo "→ [4/8] Starting Shule services..."
mkdir -p /opt/shule
cp docker-compose.school.yml /opt/shule/
cp nginx.conf /opt/shule/
cd /opt/shule

export SCHOOL_IMAGE_NAME=${SCHOOL_IMAGE_NAME:-shule-frontend}
export DB_PASSWORD=${DB_PASSWORD:-ShuleDB$(date +%Y)}

docker compose -f docker-compose.school.yml up -d
echo "  ✓ Services started"
echo "  Waiting for database..."
sleep 20

# ── STEP 5: Apply migrations ──────────────────────────────────
echo "→ [5/8] Setting up database schema..."
cd -
for sql in migrations/0*.sql; do
  psql "postgresql://postgres:${DB_PASSWORD}@localhost:5432/postgres" \
    -f "$sql" -q 2>&1 | grep -v "^$" || true
  echo "  ✓ Applied: $sql"
done

# ── STEP 6: Apply base seed data ─────────────────────────────
echo "→ [6/8] Loading base data..."
psql "postgresql://postgres:${DB_PASSWORD}@localhost:5432/postgres" \
  -f migrations/base.sql -q
echo "  ✓ Base data loaded"

# ── STEP 7: Configure web server ─────────────────────────────
echo "→ [7/8] Configuring web server..."
cp nginx.conf /etc/nginx/sites-available/shule
ln -sf /etc/nginx/sites-available/shule \
  /etc/nginx/sites-enabled/shule
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx
systemctl enable nginx
echo "  ✓ Web server configured"

# ── STEP 8: Setup backups and auto-restart ────────────────────
echo "→ [8/8] Configuring backups..."
mkdir -p /opt/shule/backups
(crontab -l 2>/dev/null; echo "0 2 * * * pg_dump \
  postgresql://postgres:${DB_PASSWORD}@localhost:5432/postgres \
  > /opt/shule/backups/shule_\$(date +\%Y\%m\%d).sql \
  && find /opt/shule/backups -name '*.sql' -mtime +30 -delete") \
  | crontab -
systemctl enable docker
systemctl enable nginx
echo "  ✓ Nightly backup at 2 AM configured"
echo "  ✓ Auto-restart on power cut configured"

# ── Print QR code ─────────────────────────────────────────────
qrencode -t ANSI "http://192.168.1.100"

# ── Save credentials ──────────────────────────────────────────
cat > /opt/shule/CREDENTIALS.txt << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SHULE CREDENTIALS
  ${SCHOOL_NAME}
  Installed: $(date)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
System URL  : http://192.168.1.100
Studio URL  : http://192.168.1.100:3000
DB Password : ${DB_PASSWORD}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
chmod 600 /opt/shule/CREDENTIALS.txt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ INSTALLATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Shule is live at: http://192.168.1.100"
echo ""
echo "  REMAINING STEPS:"
echo "  1. Open http://192.168.1.100:3000"
echo "     Auth → Hooks → Enable custom_access_token_hook"
echo "  2. Auth → Users → Add IT Admin user"
echo "  3. SQL Editor → INSERT IT Admin into staff table"
echo "  4. Log in as IT Admin and create all staff"
echo ""
echo "  Credentials: /opt/shule/CREDENTIALS.txt"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
