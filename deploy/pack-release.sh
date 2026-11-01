#!/usr/bin/env bash
# Yerel veya CI: build çıktısından sunucu release paketi üretir.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?output dir required}"

rm -rf "$OUT"
mkdir -p "$OUT/apps/api" "$OUT/public/admin" "$OUT/deploy"

cp "$ROOT/apps/api/server.mjs" "$OUT/apps/api/server.mjs"
cp "$ROOT/apps/api/package.json" "$OUT/apps/api/package.json"
# API üretim bağımlılıkları (bcrypt)
npm install --omit=dev --prefix "$OUT/apps/api"
cp -R "$ROOT/apps/client/dist/." "$OUT/public/"
cp -R "$ROOT/apps/admin/dist/." "$OUT/public/admin/"
cp "$ROOT/deploy/ecosystem.config.cjs" "$OUT/deploy/ecosystem.config.cjs"
cp "$ROOT/deploy/remote.sh" "$OUT/deploy/remote.sh"
cp "$ROOT/deploy/start.sh" "$OUT/deploy/start.sh"
cp "$ROOT/deploy/nginx.conf" "$OUT/deploy/nginx.conf"
chmod +x "$OUT/deploy/remote.sh" "$OUT/deploy/start.sh"

echo "Release packed at $OUT"
