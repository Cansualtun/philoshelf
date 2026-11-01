#!/usr/bin/env bash
# DNS A kaydı 91.99.53.241 olduktan sonra bir kez çalıştır.
set -euo pipefail
APP_ROOT=/var/www/philoshelf
test -f "$APP_ROOT/current/deploy/nginx.conf"

certbot certonly --webroot \
  -w /var/lib/philoshelf/acme \
  -d links.philoshelf.com \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email

cp "$APP_ROOT/current/deploy/nginx.conf" /etc/nginx/sites-available/philoshelf
nginx -t
systemctl reload nginx
curl -fsSI "https://links.philoshelf.com/api/health" | head -n 5
echo "TLS aktif"
