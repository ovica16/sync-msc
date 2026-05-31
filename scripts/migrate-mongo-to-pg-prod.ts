/**
 * Migración MongoDB → PostgreSQL PRODUCCIÓN
 * Uso: DATABASE_URL="postgresql://..." MONGODB_URI="mongodb+srv://..." npx ts-node --project tsconfig.scripts.json scripts/migrate-mongo-to-pg-prod.ts
 *
 * Las variables deben pasarse como env vars explícitas en la línea de comando
 * (NO carga .env automáticamente para evitar apuntar a local por accidente).
 */

import mongoose from "mongoose";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

// ── Validación de entorno ─────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
const MONGO_URI = process.env.MONGODB_URI;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL no definida. Pásala como variable de entorno.");
  process.exit(1);
}
if (!MONGO_URI) {
  console.error("❌ MONGODB_URI no definida. Pásala como variable de entorno.");
  process.exit(1);
}
if (DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1")) {
  console.error("❌ DATABASE_URL apunta a localhost. Usa la URL de Railway/producción.");
  process.exit(1);
}
if (MONGO_URI.includes("localhost") || MONGO_URI.includes("127.0.0.1")) {
  console.warn("⚠️  MONGODB_URI apunta a localhost (Mongo local → Railway Postgres). Continuando...");
}

import { Pool } from "pg";

const DB_URL = DATABASE_URL as string;

function makePool() {
  return new Pool({
    connectionString: DB_URL,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 60000,
    query_timeout: 30000,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

function makePrisma(pool: InstanceType<typeof Pool>) {
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

let pool = makePool();
let prisma = makePrisma(pool);

async function resetPrisma() {
  try { await prisma.$disconnect(); } catch {}
  try { await pool.end(); } catch {}
  pool = makePool();
  prisma = makePrisma(pool);
}

function hashPassword(p: string) {
  return crypto.createHash("sha256").update(p + "syncmsc-salt-v1").digest("hex");
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

// ── Áreas ─────────────────────────────────────────────────────────────────────
async function migrarAreas(db: mongoose.mongo.Db) {
  console.log("\n📂 Migrando Áreas...");
  const docs = await db.collection("areas").find({}).toArray();
  let ok = 0;

  for (const d of docs) {
    const codigo = String(d.codigo ?? "").trim();
    if (!codigo) continue;
    await prisma.area.upsert({
      where: { codigo },
      update: { nombre: String(d.nombre ?? codigo), superintendencia: String(d.superintendencia ?? "MANTENIMIENTO") },
      create: {
        codigo,
        nombre: String(d.nombre ?? codigo),
        superintendencia: String(d.superintendencia ?? "MANTENIMIENTO"),
        tieneCalibracion: Boolean(d.tieneCalibracion),
        activo: d.activo !== false,
      },
    });
    ok++;
  }
  console.log(`   ✓ ${ok} áreas`);
}

// ── Usuarios ──────────────────────────────────────────────────────────────────
async function migrarUsuarios(db: mongoose.mongo.Db) {
  console.log("\n👤 Migrando Usuarios...");
  const docs = await db.collection("usuarios").find({}).toArray();

  await prisma.usuario.upsert({
    where: { email: "ovidio.capurata@gmail.com" },
    update: {},
    create: {
      nombre: "Ovidio", apellido: "Capurata",
      email: "ovidio.capurata@gmail.com",
      passwordHash: hashPassword("sync2024"),
      rol: 1, disciplina: "GENERAL", activo: true,
    },
  });

  let ok = 1;
  for (const d of docs) {
    const email = String(d.email ?? "").toLowerCase().trim();
    if (!email || email === "ovidio.capurata@gmail.com") continue;
    try {
      await prisma.usuario.upsert({
        where: { email },
        update: {},
        create: {
          nombre: String(d.nombre ?? ""),
          apellido: d.apellido ?? null,
          email,
          passwordHash: d.passwordHash ?? hashPassword("sync2024"),
          rol: Number(d.rol ?? 4),
          disciplina: String(d.disciplina ?? "GENERAL"),
          areaTrabajo: d.areaTrabajo ?? null,
          celular: d.celular ?? null,
          jde: d.jde ?? null,
          puesto: d.puesto ?? null,
          superintendencia: d.superintendencia ?? null,
          activo: d.activo !== false,
        },
      });
      ok++;
    } catch (e) { console.warn(`   ⚠ Usuario ${email}:`, (e as Error).message); }
  }
  console.log(`   ✓ ${ok} usuarios`);
}

// ── Equipos ───────────────────────────────────────────────────────────────────
async function migrarEquipos(db: mongoose.mongo.Db) {
  console.log("\n🔧 Migrando Equipos...");
  const docs = await db.collection("equipos").find({}).toArray();
  let ok = 0, skip = 0;

  const areasExistentes = new Set(
    (await prisma.area.findMany({ select: { codigo: true } })).map(a => a.codigo)
  );

  for (const d of docs) {
    const tag = String(d.tag ?? "").toUpperCase().trim();
    if (!tag) { skip++; continue; }

    let areaCodigo = String(d.areaCodigo ?? "");
    if (areaCodigo && !areasExistentes.has(areaCodigo)) {
      await prisma.area.create({
        data: {
          codigo: areaCodigo,
          nombre: String(d.descripcionArea ?? areaCodigo),
          superintendencia: "MANTENIMIENTO",
          tieneCalibracion: false,
          activo: true,
        },
      }).catch(() => {});
      areasExistentes.add(areaCodigo);
    }
    if (!areaCodigo) areaCodigo = "3330";

    try {
      await prisma.equipo.upsert({
        where: { tag },
        update: {},
        create: {
          tag,
          descripcion: String(d.descripcion ?? tag),
          descripcion2: d.descripcion2 ?? null,
          descripcion3: d.descripcion3 ?? null,
          nivel: Number(d.nivel ?? 1),
          parentTag: d.parentTag ?? null,
          nivelPath: Array.isArray(d.nivelPath) ? d.nivelPath.map(String) : [],
          tipoEquipo: String(d.tipoEquipo ?? "."),
          descripcionTipo: d.descripcionTipo ?? null,
          subtipo: d.subtipo ?? null,
          descripcionSubtipo: d.descripcionSubtipo ?? null,
          categoriaISO: d.categoriaISO ?? null,
          criticidad: d.criticidad ?? null,
          centroCosto: d.centroCosto ?? null,
          areaCodigo,
          descripcionArea: d.descripcionArea ?? null,
          fabricante: d.fabricante ?? null,
          modelo: d.modelo ?? null,
          serie: d.serie ?? null,
          fechaInstalacion: toDate(d.fechaInstalacion),
          vidaUtilEstimadaAnos: d.vidaUtilEstimadaAnos ? Number(d.vidaUtilEstimadaAnos) : null,
          activo: d.activo !== false,
        },
      });
      ok++;
    } catch (e) {
      const msg = (e as Error).message ?? "";
      console.warn(`   ⚠ Equipo ${tag}:`, msg);
      skip++;
      if (msg.includes("Transaction already closed") || msg.includes("timed out") || msg.includes("SocketTimeout")) {
        console.log("   🔄 Reconectando pool...");
        await resetPrisma();
      }
    }
  }
  console.log(`   ✓ ${ok} equipos (${skip} omitidos)`);
}

// ── Órdenes de Trabajo ────────────────────────────────────────────────────────
async function migrarOrdenes(db: mongoose.mongo.Db) {
  console.log("\n📋 Migrando Órdenes de Trabajo...");
  const docs = await db.collection("ordentrabajos").find({}).toArray();
  let ok = 0, skip = 0;

  const areasExistentes = new Set(
    (await prisma.area.findMany({ select: { codigo: true } })).map(a => a.codigo)
  );

  for (const d of docs) {
    const numeroOT = String(d.numeroOT ?? d.numero ?? "").trim();
    if (!numeroOT) { skip++; continue; }

    let areaCodigo = String(d.areaCodigo ?? "3330");
    if (!areasExistentes.has(areaCodigo)) areaCodigo = "3330";

    try {
      const ot = await prisma.ordenTrabajo.upsert({
        where: { numeroOT },
        update: {},
        create: {
          numeroOT,
          fecha: toDate(d.fecha) ?? new Date(),
          turno: String(d.turno ?? "Diurno"),
          areaCodigo,
          estado: String(d.estado ?? "borrador"),
          otJdeNumero: d.otJdeNumero ?? null,
          otJdeDia: d.otJdeDia ?? null,
          origenPlan: Boolean(d.origenPlan),
        },
      });

      for (const l of (Array.isArray(d.lineas) ? d.lineas : [])) {
        await prisma.otLinea.create({
          data: {
            ordenTrabajoId: ot.id,
            tag: String(l.tag ?? "").toUpperCase(),
            descripcionEquipo: String(l.descripcionEquipo ?? ""),
            tipoOT: String(l.tipoOT ?? "CMR"),
            sintoma: l.sintoma ?? null,
            causaProbable: l.causaProbable ?? null,
            resolucionAplicada: l.resolucionAplicada ?? null,
            tiempoEstimadoHrs: l.tiempoEstimadoHrs ? Number(l.tiempoEstimadoHrs) : null,
            tiempoRealHrs: l.tiempoRealHrs ? Number(l.tiempoRealHrs) : null,
            descripcionTrabajo: l.descripcionTrabajo ?? null,
            tareasEjecutadas: Array.isArray(l.tareasEjecutadas) ? l.tareasEjecutadas.map(String) : [],
            observaciones: l.observaciones ?? null,
          },
        });
      }

      for (const t of (Array.isArray(d.tecnicos) ? d.tecnicos : [])) {
        const nombre = typeof t === "string" ? t : String(t.nombreCompleto ?? t.nombre ?? "");
        if (!nombre) continue;
        await prisma.otTecnico.create({ data: { ordenTrabajoId: ot.id, nombreCompleto: nombre } });
      }

      ok++;
    } catch (e) { console.warn(`   ⚠ OT ${numeroOT}:`, (e as Error).message); skip++; }
  }
  console.log(`   ✓ ${ok} órdenes (${skip} omitidas)`);
}

// ── Programaciones Semanales ──────────────────────────────────────────────────
async function migrarProgramaciones(db: mongoose.mongo.Db) {
  console.log("\n📅 Migrando Programaciones Semanales...");
  const docs = await db.collection("programacionsemanals").find({}).toArray();
  let ok = 0, skip = 0;

  for (const d of docs) {
    try {
      const prog = await prisma.programacionSemanal.upsert({
        where: { semana_anio_disciplina: {
          semana: Number(d.semana), anio: Number(d.anio),
          disciplina: String(d.disciplina ?? "GENERAL"),
        }},
        update: {},
        create: {
          semana: Number(d.semana), anio: Number(d.anio),
          disciplina: String(d.disciplina ?? "GENERAL"),
          areaCodigo: d.areaCodigo ?? null,
          fechaInicio: toDate(d.fechaInicio) ?? new Date(),
          fechaFin: toDate(d.fechaFin) ?? new Date(),
          hhDisponiblesSemana: Number(d.hhDisponiblesSemana ?? 0),
          hhProgramadasSemana: Number(d.hhProgramadasSemana ?? 0),
          hhReactivoSemana: Number(d.hhReactivoSemana ?? 0),
          estado: String(d.estado ?? "borrador"),
          subidoPor: String(d.subidoPor ?? "migración"),
        },
      });

      for (const o of (Array.isArray(d.otsProgramadas) ? d.otsProgramadas : [])) {
        await prisma.otProgramada.create({
          data: {
            programacionSemanalId: prog.id,
            numeroOT: String(o.numeroOT ?? ""),
            tipoOT: String(o.tipoOT ?? "C"),
            tipoTrabajo: String(o.tipoTrabajo ?? ""),
            prioridad: o.prioridad ?? null,
            descripcion: String(o.descripcion ?? ""),
            tag: String(o.tag ?? "").toUpperCase(),
            descripcionEquipo: o.descripcionEquipo ?? "",
            personas: Number(o.personas ?? 1),
            hrsTrabajo: Number(o.hrsTrabajo ?? 0),
            hhTotal: Number(o.hhTotal ?? 0),
            personalAsignado: Array.isArray(o.personalAsignado) ? o.personalAsignado.map(String) : [],
            grupo: String(o.grupo ?? "Diurno"),
            dia: String(o.dia ?? "Lu"),
            estado: String(o.estado ?? "no_iniciada"),
            esGuardia: Boolean(o.esGuardia),
          },
        });
      }
      ok++;
    } catch (e) { console.warn(`   ⚠ Prog S${d.semana}/${d.anio}:`, (e as Error).message); skip++; }
  }
  console.log(`   ✓ ${ok} programaciones (${skip} omitidas)`);
}

// ── Calibraciones ─────────────────────────────────────────────────────────────
async function migrarCalibraciones(db: mongoose.mongo.Db) {
  console.log("\n🔬 Migrando Calibraciones...");
  const docs = await db.collection("registrocalibracions").find({}).toArray();
  let ok = 0, skip = 0;

  for (const d of docs) {
    const numeroCertificado = String(d.numeroCertificado ?? d.numero ?? "").trim();
    if (!numeroCertificado) { skip++; continue; }
    try {
      await prisma.registroCalibracion.upsert({
        where: { numeroCertificado },
        update: {},
        create: {
          numeroCertificado,
          tag: String(d.tag ?? "").toUpperCase(),
          descripcionInstrumento: String(d.descripcionInstrumento ?? ""),
          tipoVariable: String(d.tipoVariable ?? ""),
          patronIds: Array.isArray(d.patronIds) ? d.patronIds.map(String) : [],
          patronCodigos: Array.isArray(d.patronCodigos) ? d.patronCodigos.map(String) : [],
          tecnicoId: String(d.tecnicoId ?? "migración"),
          tecnicoNombre: String(d.tecnicoNombre ?? ""),
          supervisorId: d.supervisorId ?? null,
          supervisorNombre: d.supervisorNombre ?? null,
          fecha: toDate(d.fecha) ?? new Date(),
          temperatura: d.temperatura ? Number(d.temperatura) : null,
          humedad: d.humedad ? Number(d.humedad) : null,
          turno: d.turno ?? null,
          unidad: d.unidad ?? null,
          puntos: d.puntos ?? [],
          puntosAntes: d.puntosAntes ?? [],
          resultadoGeneral: String(d.resultadoGeneral ?? "APROBADO"),
          observaciones: d.observaciones ?? null,
          stickerImpreso: Boolean(d.stickerImpreso),
          otAsociada: d.otAsociada ?? null,
          areaCodigo: String(d.areaCodigo ?? "3320"),
        },
      });
      ok++;
    } catch (e) { console.warn(`   ⚠ Calibración ${numeroCertificado}:`, (e as Error).message); skip++; }
  }
  console.log(`   ✓ ${ok} calibraciones (${skip} omitidas)`);
}

// ── Patrones ──────────────────────────────────────────────────────────────────
async function migrarPatrones(db: mongoose.mongo.Db) {
  console.log("\n📏 Migrando Patrones...");
  const docs = await db.collection("patrons").find({}).toArray();
  let ok = 0;

  for (const d of docs) {
    const codigo = String(d.codigo ?? "").trim();
    if (!codigo) continue;
    try {
      await prisma.patron.upsert({
        where: { codigo },
        update: {},
        create: {
          codigo,
          descripcion: String(d.descripcion ?? ""),
          tipo: String(d.tipo ?? ""),
          marca: String(d.marca ?? ""),
          modelo: String(d.modelo ?? ""),
          numeroSerie: String(d.numeroSerie ?? ""),
          fechaUltimaCalibracion: toDate(d.fechaUltimaCalibracion) ?? new Date(),
          fechaVencimiento: toDate(d.fechaVencimiento) ?? new Date(),
          frecuenciaCalibracion: String(d.frecuenciaCalibracion ?? "anual"),
          rangoMin: d.rangoMin ? Number(d.rangoMin) : null,
          rangoMax: d.rangoMax ? Number(d.rangoMax) : null,
          precision: d.precision ?? null,
          ubicacion: d.ubicacion ?? null,
          responsable: d.responsable ?? null,
          activo: d.activo !== false,
        },
      });
      ok++;
    } catch (e) { console.warn(`   ⚠ Patrón ${codigo}:`, (e as Error).message); }
  }
  console.log(`   ✓ ${ok} patrones`);
}

// ── Árbol de Fallas ───────────────────────────────────────────────────────────
async function migrarArbolFallas(db: mongoose.mongo.Db) {
  console.log("\n🌳 Migrando Árbol de Fallas...");
  const docs = await db.collection("arbolfallas").find({}).toArray();
  let ok = 0, skip = 0;

  for (const d of docs) {
    const sintoma = String(d.sintoma ?? "").trim();
    if (!sintoma) { skip++; continue; }

    const tipoEquipo  = d.tipoEquipo  ? String(d.tipoEquipo)  : null;
    const codigoModo  = d.codigoModo  ? String(d.codigoModo)  : null;
    const codigoCausa = d.codigoCausa ? String(d.codigoCausa) : null;

    try {
      await prisma.arbolFallas.upsert({
        where: { tipoEquipo_codigoModo_codigoCausa: { tipoEquipo: tipoEquipo ?? "", codigoModo: codigoModo ?? "", codigoCausa: codigoCausa ?? "" } },
        update: {},
        create: {
          tipoEquipo,
          sintoma,
          codigoModo,
          causaProbable: String(d.causaProbable ?? ""),
          codigoCausa,
          resolucionSugerida: String(d.resolucionSugerida ?? ""),
          tiempoEstimadoHrs: Number(d.tiempoEstimadoHrs ?? 0),
          activo: d.activo !== false,
          creadoPor: String(d.creadoPor ?? "migración"),
        },
      });
      ok++;
    } catch (e) { console.warn(`   ⚠ ArbolFallas ${sintoma}:`, (e as Error).message); skip++; }
  }
  console.log(`   ✓ ${ok} entradas (${skip} omitidas)`);
}

// ── Reportes de Turno ─────────────────────────────────────────────────────────
async function migrarReportesTurno(db: mongoose.mongo.Db) {
  console.log("\n📝 Migrando Reportes de Turno...");
  const docs = await db.collection("reporteturnos").find({}).toArray();
  let ok = 0, skip = 0;

  for (const d of docs) {
    try {
      await prisma.reporteTurno.create({
        data: {
          turno: String(d.turno ?? "Diurno"),
          fecha: toDate(d.fecha) ?? new Date(),
          supervisorId: String(d.supervisorId ?? "migración"),
          supervisorNombre: String(d.supervisorNombre ?? ""),
          otIds: Array.isArray(d.otIds) ? d.otIds.map(String) : [],
          otsCriticas: Array.isArray(d.otsCriticas) ? d.otsCriticas.map(String) : [],
          otsPendientesSiguienteTurno: Array.isArray(d.otsPendientesSiguienteTurno) ? d.otsPendientesSiguienteTurno.map(String) : [],
          notasOTs: d.notasOTs ?? [],
          otsPlanData: d.otsPlanData ?? [],
          resumenEjecutivo: d.resumenEjecutivo ?? {},
          recomendaciones: d.recomendaciones ?? [],
          estado: String(d.estado ?? "borrador"),
        },
      });
      ok++;
    } catch (e) { console.warn(`   ⚠ Reporte turno:`, (e as Error).message); skip++; }
  }
  console.log(`   ✓ ${ok} reportes de turno (${skip} omitidos)`);
}

// ── Catálogo de Modos ─────────────────────────────────────────────────────────
async function migrarCatalogoModos(db: mongoose.mongo.Db) {
  console.log("\n📖 Migrando Catálogo de Modos...");
  const docs = await db.collection("catalogomodos").find({}).toArray();
  let ok = 0, skip = 0;

  for (const d of docs) {
    const codigo = String(d.codigo ?? "").trim();
    if (!codigo) { skip++; continue; }
    try {
      await prisma.catalogoModo.upsert({
        where: { codigo },
        update: {},
        create: {
          codigo,
          nombre: String(d.nombre ?? ""),
          nombreEs: String(d.nombreEs ?? ""),
          descripcion: String(d.descripcion ?? ""),
        },
      });
      ok++;
    } catch (e) {
      const msg = (e as Error).message ?? "";
      console.warn(`   ⚠ CatalogoModo ${codigo}:`, msg);
      skip++;
      if (msg.includes("Transaction already closed") || msg.includes("timed out") || msg.includes("SocketTimeout")) {
        console.log("   🔄 Reconectando pool...");
        await resetPrisma();
      }
    }
  }
  console.log(`   ✓ ${ok} modos (${skip} omitidos)`);
}

// ── Catálogo de Causas ────────────────────────────────────────────────────────
async function migrarCatalogoCausas(db: mongoose.mongo.Db) {
  console.log("\n📖 Migrando Catálogo de Causas...");
  const docs = await db.collection("catalogocausas").find({}).toArray();
  let ok = 0, skip = 0;

  for (const d of docs) {
    const codigo = String(d.codigo ?? "").trim();
    if (!codigo) { skip++; continue; }
    try {
      await prisma.catalogoCausa.upsert({
        where: { codigo },
        update: {},
        create: {
          codigo,
          nombre: String(d.nombre ?? ""),
          descripcion: String(d.descripcion ?? ""),
        },
      });
      ok++;
    } catch (e) {
      const msg = (e as Error).message ?? "";
      console.warn(`   ⚠ CatalogoCausa ${codigo}:`, msg);
      skip++;
      if (msg.includes("Transaction already closed") || msg.includes("timed out") || msg.includes("SocketTimeout")) {
        console.log("   🔄 Reconectando pool...");
        await resetPrisma();
      }
    }
  }
  console.log(`   ✓ ${ok} causas (${skip} omitidas)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Iniciando migración MongoDB → PostgreSQL PRODUCCIÓN");
  console.log(`   Mongo:    ${MONGO_URI}`);
  console.log(`   Postgres: ${DB_URL.replace(/:([^:@]+)@/, ":***@")}`);
  console.log("");
  console.log("⚠️  ATENCIÓN: Esto escribirá en la base de datos de PRODUCCIÓN.");
  console.log("   Tienes 5 segundos para cancelar (Ctrl+C)...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  await mongoose.connect(MONGO_URI!);
  const db = mongoose.connection.db!;
  console.log("✓ Conectado a MongoDB");

  await migrarAreas(db);
  await migrarUsuarios(db);
  await migrarEquipos(db);
  await migrarOrdenes(db);
  await migrarProgramaciones(db);
  await migrarCalibraciones(db);
  await migrarPatrones(db);
  await migrarArbolFallas(db);
  await migrarReportesTurno(db);
  await migrarCatalogoModos(db);
  await migrarCatalogoCausas(db);

  console.log("\n✅ Migración a producción completada");
  await mongoose.disconnect();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error en migración:", e);
  process.exit(1);
});
