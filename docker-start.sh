#!/bin/sh
echo "[start] Aplicando migraciones pendientes..."
node << 'MIGRATE'
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

// Lista de ALTER TABLE idempotentes — agregar aquí cada nuevo campo
const migraciones = [
  "ALTER TABLE \"ReporteTurno\" ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'supervisor'",
  "ALTER TABLE \"OtLinea\" ADD COLUMN IF NOT EXISTS adjuntos JSONB NOT NULL DEFAULT '[]'",
  "ALTER TABLE \"RegistroCalibracion\" ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'revision'",
  "ALTER TABLE \"RegistroCalibracion\" ADD COLUMN IF NOT EXISTS \"tecnicoFirma\" TEXT",
  "ALTER TABLE \"RegistroCalibracion\" ADD COLUMN IF NOT EXISTS \"supervisorFirma\" TEXT",
];

(async () => {
  for (const sql of migraciones) {
    try {
      await pool.query(sql);
      console.log('[migrate] OK:', sql.slice(0, 70));
    } catch(e) {
      console.log('[migrate] Skip:', e.message.slice(0, 100));
    }
  }
  await pool.end();
  console.log('[start] Migraciones completadas.');
})();
MIGRATE

echo "[start] Iniciando servidor Next.js..."
exec node server.js
