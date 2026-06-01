#!/bin/sh
# Sincronizar schema (no falla si hay error de red — el servidor arranca igual)
echo "[start] Sincronizando schema..."
node_modules/.bin/prisma db push --skip-generate 2>&1 || echo "[warn] db push no disponible, continuando..."
echo "[start] Iniciando servidor Next.js..."
exec node server.js
