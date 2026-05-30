/**
 * Migración MongoDB → PostgreSQL local
 *
 * Uso:
 *   npx ts-node --project tsconfig.scripts.json scripts/migrate-mongo-to-pg.ts
 *
 * Prerequisitos:
 *   1. Docker corriendo: docker compose up -d
 *   2. Schema aplicado:  npx prisma db push
 *   3. MongoDB local corriendo con los datos originales
 *   4. .env.local con DATABASE_URL apuntando al Postgres local
 */

import "dotenv/config";
import mongoose from "mongoose";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

// ── Conexión Prisma (Postgres local) ──────────────────────────────────────────
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── Conexión MongoDB ───────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sync-msc";

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password + "syncmsc-salt-v1").digest("hex");
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

// ── Migrar Áreas ──────────────────────────────────────────────────────────────
async function migrarAreas(db: mongoose.mongo.Db) {
  console.log("\n📂 Migrando Áreas...");
  const docs = await db.collection("areas").find({}).toArray();

  const AREAS_BASE = [
    { codigo: "3311", nombre: "Eléctrico Planta",          superintendencia: "MANTENIMIENTO ELECTRICO",       tieneCalibracion: false },
    { codigo: "3319", nombre: "Eléctrico Mina",            superintendencia: "MANTENIMIENTO ELECTRICO",       tieneCalibracion: false },
    { codigo: "3320", nombre: "Instrumentación y Control", superintendencia: "MANTENIMIENTO INSTRUMENTACION", tieneCalibracion: true  },
    { codigo: "3330", nombre: "Mecánico Planta",           superintendencia: "MANTENIMIENTO MECANICO",        tieneCalibracion: false },
    { codigo: "3340", nombre: "Mecánico Mina",             superintendencia: "MANTENIMIENTO MECANICO",        tieneCalibracion: false },
  ];

  // Combina áreas de Mongo con las base
  const areasMap = new Map(AREAS_BASE.map(a => [a.codigo, a]));
  for (const d of docs) {
    const codigo = String(d.codigo ?? d.code ?? "");
    if (codigo) areasMap.set(codigo, {
      codigo,
      nombre: String(d.nombre ?? d.name ?? codigo),
      superintendencia: String(d.superintendencia ?? "MANTENIMIENTO"),
      tieneCalibracion: Boolean(d.tieneCalibracion),
    });
  }

  let ok = 0;
  for (const area of areasMap.values()) {
    await prisma.area.upsert({
      where: { codigo: area.codigo },
      update: {},
      create: { ...area, activo: true },
    });
    ok++;
  }
  console.log(`   ✓ ${ok} áreas`);
}

// ── Migrar Usuarios ───────────────────────────────────────────────────────────
async function migrarUsuarios(db: mongoose.mongo.Db) {
  console.log("\n👤 Migrando Usuarios...");
  const docs = await db.collection("usuarios").find({}).toArray();

  // Usuario admin por defecto siempre
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
          nombre: String(d.nombre ?? d.name ?? ""),
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
    } catch (e) {
      console.warn(`   ⚠ Usuario ${email}:`, (e as Error).message);
    }
  }
  console.log(`   ✓ ${ok} usuarios`);
}

// ── Migrar Equipos ────────────────────────────────────────────────────────────
async function migrarEquipos(db: mongoose.mongo.Db) {
  console.log("\n🔧 Migrando Equipos...");
  const docs = await db.collection("equipos").find({}).toArray();
  let ok = 0, skip = 0;

  for (const d of docs) {
    const tag = String(d.tag ?? "").toUpperCase().trim();
    if (!tag) { skip++; continue; }

    const areaCodigo = String(d.areaCodigo ?? d.area ?? "3330");
    const areaExiste = await prisma.area.findUnique({ where: { codigo: areaCodigo } });
    if (!areaExiste) { skip++; continue; }

    try {
      await prisma.equipo.upsert({
        where: { tag },
        update: {},
        create: {
          tag,
          descripcion: String(d.descripcion ?? d.description ?? tag),
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
      console.warn(`   ⚠ Equipo ${tag}:`, (e as Error).message);
      skip++;
    }
  }
  console.log(`   ✓ ${ok} equipos (${skip} omitidos)`);
}

// ── Migrar Órdenes de Trabajo ─────────────────────────────────────────────────
async function migrarOrdenes(db: mongoose.mongo.Db) {
  console.log("\n📋 Migrando Órdenes de Trabajo...");
  const docs = await db.collection("ordentrabajoes").find({}).toArray();
  let ok = 0, skip = 0;

  for (const d of docs) {
    const numeroOT = String(d.numeroOT ?? d.numero ?? "").trim();
    if (!numeroOT) { skip++; continue; }

    const areaCodigo = String(d.areaCodigo ?? "3330");
    const areaExiste = await prisma.area.findUnique({ where: { codigo: areaCodigo } });
    if (!areaExiste) { skip++; continue; }

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

      // Líneas
      const lineas = Array.isArray(d.lineas) ? d.lineas : [];
      for (const l of lineas) {
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

      // Técnicos
      const tecnicos = Array.isArray(d.tecnicos) ? d.tecnicos : [];
      for (const t of tecnicos) {
        const nombre = typeof t === "string" ? t : String(t.nombreCompleto ?? t.nombre ?? "");
        if (!nombre) continue;
        await prisma.otTecnico.create({
          data: { ordenTrabajoId: ot.id, nombreCompleto: nombre },
        });
      }

      ok++;
    } catch (e) {
      console.warn(`   ⚠ OT ${numeroOT}:`, (e as Error).message);
      skip++;
    }
  }
  console.log(`   ✓ ${ok} órdenes (${skip} omitidas)`);
}

// ── Migrar Programaciones Semanales ──────────────────────────────────────────
async function migrarProgramaciones(db: mongoose.mongo.Db) {
  console.log("\n📅 Migrando Programaciones Semanales...");
  const docs = await db.collection("programacionsemanales").find({}).toArray();
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

      const ots = Array.isArray(d.otsProgramadas) ? d.otsProgramadas : [];
      for (const o of ots) {
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
    } catch (e) {
      console.warn(`   ⚠ Programación S${d.semana}/${d.anio}:`, (e as Error).message);
      skip++;
    }
  }
  console.log(`   ✓ ${ok} programaciones (${skip} omitidas)`);
}

// ── Migrar Calibraciones ──────────────────────────────────────────────────────
async function migrarCalibraciones(db: mongoose.mongo.Db) {
  console.log("\n🔬 Migrando Calibraciones...");
  const docs = await db.collection("registrocalibracione").find({}).toArray()
    .catch(() => db.collection("registrocalibracioners").find({}).toArray())
    .catch(() => []);
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
    } catch (e) {
      console.warn(`   ⚠ Calibración ${numeroCertificado}:`, (e as Error).message);
      skip++;
    }
  }
  console.log(`   ✓ ${ok} calibraciones (${skip} omitidas)`);
}

// ── Migrar Patrones ───────────────────────────────────────────────────────────
async function migrarPatrones(db: mongoose.mongo.Db) {
  console.log("\n📏 Migrando Patrones...");
  const docs = await db.collection("patrones").find({}).toArray().catch(() => []);
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
    } catch (e) {
      console.warn(`   ⚠ Patrón ${codigo}:`, (e as Error).message);
    }
  }
  console.log(`   ✓ ${ok} patrones`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Iniciando migración MongoDB → PostgreSQL");
  console.log(`   Mongo:    ${MONGO_URI}`);
  console.log(`   Postgres: ${process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ":***@")}`);

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  console.log("✓ Conectado a MongoDB");

  await migrarAreas(db);
  await migrarUsuarios(db);
  await migrarEquipos(db);
  await migrarOrdenes(db);
  await migrarProgramaciones(db);
  await migrarCalibraciones(db);
  await migrarPatrones(db);

  console.log("\n✅ Migración completada");
  await mongoose.disconnect();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error en migración:", e);
  process.exit(1);
});
