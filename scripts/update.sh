#!/bin/sh
# Updates the production site to the latest version on GitHub.
#   cd /opt/Rendezvousludique && ./scripts/update.sh
#
# 1. backs up the database (backups/, the 10 most recent are kept)
# 2. fetches the new code
# 3. rebuilds and restarts the site (database changes apply by themselves at start-up)
set -e

cd "$(dirname "$0")/.."
ENV_FILE=.env.production
COMPOSE="docker compose --env-file $ENV_FILE"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE (see .env.production.example)." >&2
  exit 1
fi

echo "==> Database backup"
mkdir -p backups
if $COMPOSE ps --status running db 2>/dev/null | grep -q db; then
  FILE="backups/rendezvous-$(date +%Y-%m-%d_%H%M%S).sql.gz"
  $COMPOSE exec -T db pg_dump -U rendezvous rendezvous | gzip > "$FILE"
  echo "    $FILE"
  # keep the 10 most recent
  ls -1t backups/rendezvous-*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
else
  echo "    database not running yet: skipped"
fi

echo "==> Fetching the new version"
git pull --ff-only

echo "==> Rebuilding and restarting"
$COMPOSE up -d --build

echo "==> Cleaning up old images"
docker image prune -f > /dev/null

echo "==> Done. Current version: $(git log -1 --format='%h %s')"
echo "    Logs: $COMPOSE logs -f web"
