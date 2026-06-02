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

// Lista de migraciones idempotentes — agregar aquí cada nuevo campo
const migraciones = [
  "ALTER TABLE \"ReporteTurno\" ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'supervisor'",
  "ALTER TABLE \"OtLinea\" ADD COLUMN IF NOT EXISTS adjuntos JSONB NOT NULL DEFAULT '[]'",
  "ALTER TABLE \"RegistroCalibracion\" ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'revision'",
  "ALTER TABLE \"RegistroCalibracion\" ADD COLUMN IF NOT EXISTS \"tecnicoFirma\" TEXT",
  "ALTER TABLE \"RegistroCalibracion\" ADD COLUMN IF NOT EXISTS \"supervisorFirma\" TEXT",
  "ALTER TABLE \"Usuario\" ADD COLUMN IF NOT EXISTS \"esContratista\" BOOLEAN NOT NULL DEFAULT false",
  "ALTER TABLE \"Usuario\" ADD COLUMN IF NOT EXISTS \"fechaExpiracion\" TIMESTAMP(3)",
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
  // Resetear OtProgramada huérfanas (apuntan a OrdenTrabajo eliminadas) — cualquier estado
  try {
    const res = await pool.query(`
      UPDATE "OtProgramada" SET estado = 'pendiente', "ordenTrabajoId" = NULL, "ordenTrabajoNum" = NULL
      WHERE "ordenTrabajoId" IS NOT NULL
        AND "ordenTrabajoId" NOT IN (SELECT id FROM "OrdenTrabajo")
    `);
    console.log('[migrate] OtProgramada huérfanas reseteadas:', res.rowCount);
  } catch(e) {
    console.log('[migrate] Reset huérfanas skip:', e.message.slice(0, 80));
  }

  // Asegurar contador 2026 >= 286 (9 certs reales subidos, próximo = 287)
  try {
    await pool.query(
      `INSERT INTO "Contador" (nombre, valor) VALUES ('calibracion-2026', 286)
       ON CONFLICT (nombre) DO UPDATE SET valor = GREATEST("Contador".valor, 286)`
    );
    console.log('[migrate] Contador calibracion-2026 OK.');
  } catch(e) {
    console.log('[migrate] Contador skip:', e.message.slice(0, 80));
  }

  await pool.end();
  console.log('[start] Migraciones completadas.');
})();
MIGRATE

echo "[start] Iniciando servidor Next.js..."
exec node server.js
