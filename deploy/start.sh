#!/usr/bin/env bash
set -euo pipefail
set -a
# shellcheck disable=SC1091
source /etc/philoshelf/philoshelf.env
set +a
exec /root/.nvm/versions/node/v24.11.1/bin/node /var/www/philoshelf/current/apps/api/server.mjs
