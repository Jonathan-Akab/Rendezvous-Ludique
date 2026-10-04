#!/bin/sh
set -e

echo "Syncing database schema…"
npx prisma db push

if [ -n "$ADMIN_PASSWORD" ]; then
  echo "Ensuring the first admin account exists…"
  npx prisma db seed
fi

exec node server.js
