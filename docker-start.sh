#!/bin/sh
set -e
echo "[start] Sincronizando schema con la base de datos..."
node_modules/.bin/prisma db push --skip-generate
echo "[start] Iniciando servidor Next.js..."
exec node server.js
