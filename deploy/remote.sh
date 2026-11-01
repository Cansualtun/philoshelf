#!/usr/bin/env bash
# Sunucuda çalışır. Yalnız Philoshelf dizin/servislerini günceller.
set -euo pipefail

APP_ROOT=/var/www/philoshelf
RELEASE=${1:?release id required}
RELEASE_DIR="$APP_ROOT/releases/$RELEASE"
PM2=/root/.nvm/versions/node/v24.11.1/bin/pm2

test -d "$RELEASE_DIR/apps/api"
test -d "$RELEASE_DIR/apps/api/node_modules/bcrypt"
test -d "$RELEASE_DIR/public"
test -f "$RELEASE_DIR/deploy/start.sh"
test -f /etc/philoshelf/philoshelf.env
test -x "$PM2"

chmod +x "$RELEASE_DIR/deploy/start.sh"
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"
mkdir -p /var/lib/philoshelf/data /var/log/philoshelf

"$PM2" delete philoshelf-api >/dev/null 2>&1 || true
"$PM2" start "$APP_ROOT/current/deploy/start.sh" \
  --name philoshelf-api \
  --interpreter bash \
  --max-memory-restart 150M

"$PM2" save

if command -v nginx >/dev/null; then
  nginx -t
  systemctl reload nginx
fi

sleep 1
curl -fsS "http://127.0.0.1:7201/api/health" >/dev/null
echo "Philoshelf release $RELEASE aktif"
