/**
 * Migración MongoDB → PostgreSQL
 *
 * Qué hace:
 *  1. Vacía las tablas de PostgreSQL (TRUNCATE en orden correcto)
 *  2. Migra: Áreas, Usuarios, UsuarioArea, Equipos, Órdenes,
 *            Programaciones, Calibraciones, Patrones, Árbol de Fallas,
 *            Reportes de Turno, Catálogos
 *  3. SOLO los usuarios del área de Instrumentación (3320) reciben
 *     contraseña para poder acceder al sistema.
 *  4. Al final imprime en texto plano usuario + contraseña de cada uno.
 *
 * Uso:
 *   npx ts-node --transpile-only scripts/migrate-mongo-to-pg.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sync-msc";

const PASSWORD_INSTRUMENTACION = "inst2024";

function hashPassword(p: string) {
  return crypto.createHash("sha256").update(p + "syncmsc-salt-v1").digest("hex");
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

// Áreas permitidas: solo las 17 áreas de mantenimiento de MongoDB
const AREAS_MANTENIMIENTO = new Set([
  "3310", "3311", "3312", "3313", "3315", "3316", "3318",
  "3319", "3320", "3321", "3332", "3338", "3339", "3343",
  "3348", "3351", "3368",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function esInstrumentacion(areaTrabajo: string): boolean {
  const n = normalize(areaTrabajo);
  return n.includes("instrument") || areaTrabajo.trim() === "3320";
}

/**
 * Genera email con primer nombre + primer apellido.
 * Ej: "Juan Carlos García Pérez" → "juan.garcia@minera.com"
 */
function generarEmail(nombre: string, apellido: string | null): string {
  // Tomar primera palabra del nombre y primera palabra del apellido
  const primerNombre = nombre.split(/\s+/)[0] ?? nombre;
  const primerApellido = apellido ? apellido.split(/\s+/)[0] : null;

  const clean = (s: string) =>
    normalize(s).replace(/[^a-z0-9]/g, "");

  const local = primerApellido
    ? `${clean(primerNombre)}.${clean(primerApellido)}`
    : clean(primerNombre);

  return `${local}@minera.com`;
}

// ============================================================
// 0. VACIAR TABLAS (respeta FK con CASCADE)
// ============================================================
async function limpiarBaseDatos() {
  console.log("\n🧹 Vaciando tablas de PostgreSQL...");

  // Orden: hijos antes que padres
  const tablas = [
    "OtProgramada",
    "PersonalSemanal",
    "ResumenDia",
    "OtLinea",
    "OtTecnico",
    "OtRegistroDiario",
    "OtHistorial",
    "OrdenTrabajo",
    "RegistroCalibracion",
    "ReporteTurno",
    "Equipo",
    "ArbolFallas",
    "Patron",
    "ProgramacionSemanal",
    "CatalogoCausa",
    "CatalogoModo",
    "Contador",
    "UsuarioArea",
    "Usuario",
    "Area",
  ];

  for (const tabla of tablas) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tabla}" CASCADE;`);
    process.stdout.write(`   ✓ ${tabla}\n`);
  }

  console.log("   ✅ Tablas vaciadas");
}

// ============================================================
// 1. ÁREAS
// ============================================================
async function migrarAreas(db: mongoose.mongo.Db) {
  console.log("\n📂 Migrando Áreas...");
  const docs = await db.collection("areas").find({}).toArray();
  console.log(`   Encontrados: ${docs.length} documentos`);

  let ok = 0;
  for (const d of docs) {
    const codigo = String(d.codigo ?? "").trim();
    if (!codigo || codigo === "0") continue;

    const nombre = String(d.nombre ?? codigo).trim();
    let superintendencia = String(d.superintendencia ?? "MANTENIMIENTO").trim();
    if (superintendencia.length > 100) superintendencia = superintendencia.substring(0, 100);

    try {
      await prisma.area.create({
        data: {
          codigo,
          nombre,
          superintendencia,
          tieneCalibracion: Boolean(d.tieneCalibracion ?? false),
          activo: d.activo !== false,
        },
      });
      ok++;
    } catch {
      // duplicado o error puntual
    }
  }
  console.log(`   ✅ ${ok} áreas migradas`);
}

// ============================================================
// 2. USUARIOS + UsuarioArea
//    - TODOS los usuarios se migran (sin exclusiones)
//    - Solo Instrumentación (areaTrabajo ~ "instrument" o "3320")
//      recibe contraseña y disciplina INST
// ============================================================
async function migrarUsuarios(db: mongoose.mongo.Db) {
  console.log("\n👤 Migrando Usuarios...");

  // Mapa nombre_normalizado -> codigo de área para asignar UsuarioArea
  const areas = await prisma.area.findMany({ select: { codigo: true, nombre: true } });
  const areaPorNombre = new Map<string, string>();
  for (const a of areas) {
    areaPorNombre.set(normalize(a.nombre), a.codigo);
  }
  // También mapear por código directo
  for (const a of areas) {
    areaPorNombre.set(a.codigo, a.codigo);
  }

  const docs = await db.collection("usuarios").find({}).toArray();
  console.log(`   Encontrados en MongoDB: ${docs.length} documentos`);

  let creados = 0;
  let errores = 0;
  const emailsUsados = new Set<string>();
  const credencialesInstrumentacion: { nombre: string; email: string; password: string }[] = [];

  for (const d of docs) {
    const nombre = String(d.nombre ?? d.usuario ?? "").trim();
    if (!nombre) continue;

    const apellido = d.apellido ? String(d.apellido).trim() : null;
    const areaTrabajo = String(d.areaTrabajo ?? d.areaCodigo ?? "").trim();

    // Email: usar el de Mongo o generar "primernombre.primerapellido@minera.com"
    // Si el email ya fue usado en esta migración, añadir sufijo _2, _3…
    let email = String(d.email ?? "").toLowerCase().trim();
    if (!email) {
      email = generarEmail(nombre, apellido);
    }
    if (emailsUsados.has(email)) {
      const [local, domain] = email.split("@");
      let n = 2;
      while (emailsUsados.has(`${local}_${n}@${domain}`)) n++;
      email = `${local}_${n}@${domain}`;
    }
    emailsUsados.add(email);

    // Contraseña solo para Instrumentación
    const esInst = esInstrumentacion(areaTrabajo);
    const passwordHash = esInst ? hashPassword(PASSWORD_INSTRUMENTACION) : null;

    // Disciplina
    const disciplina = esInst ? "INST" : String(d.disciplina ?? "GENERAL");

    // Rol: inferir del campo puesto si no viene explícito
    let rolCalculado = 4;
    const puesto = normalize(String(d.puesto ?? ""));
    if (puesto.includes("supervisor") || puesto.includes("especialista")) rolCalculado = 3;
    if (puesto.includes("jefe") || puesto.includes("coordinador")) rolCalculado = 2;
    if (puesto.includes("administrador")) rolCalculado = 1;

    const rol = Number(d.rol ?? rolCalculado);

    try {
      const usuario = await prisma.usuario.create({
        data: {
          nombre,
          apellido,
          email,
          passwordHash,
          rol,
          disciplina,
          areaTrabajo: areaTrabajo || null,
          celular: d.celular ? String(d.celular) : null,
          jde: d.jde ? String(d.jde).replace(/\.0+$/, "").trim() : null,
          puesto: d.puesto ? String(d.puesto) : null,
          superintendencia: d.superintendencia ? String(d.superintendencia) : null,
          activo: d.activo !== false,
        },
      });
      creados++;

      // Asignar UsuarioArea basándonos en areaTrabajo
      const codigoArea =
        areaPorNombre.get(normalize(areaTrabajo)) ??
        areaPorNombre.get(areaTrabajo.trim()) ??
        null;

      if (codigoArea) {
        await prisma.usuarioArea.create({
          data: { usuarioId: usuario.id, areaCodigo: codigoArea },
        }).catch(() => {}); // ignorar duplicados
      }

      // También intentar áreas del array d.areas (si viene de Mongo)
      if (Array.isArray(d.areas)) {
        for (const ac of d.areas) {
          const cod = String(ac).trim();
          if (cod && cod !== codigoArea) {
            await prisma.usuarioArea.create({
              data: { usuarioId: usuario.id, areaCodigo: cod },
            }).catch(() => {});
          }
        }
      }

      if (esInst) {
        credencialesInstrumentacion.push({ nombre: `${nombre} ${apellido ?? ""}`.trim(), email, password: PASSWORD_INSTRUMENTACION });
      }
    } catch (e) {
      errores++;
      if (errores <= 10) {
        console.error(`   ❌ ${nombre}: ${(e as Error).message}`);
      }
    }
  }

  console.log(`   ✅ ${creados} usuarios creados  |  ❌ ${errores} errores`);
  console.log(`   🔑 ${credencialesInstrumentacion.length} usuarios de Instrumentación con contraseña`);

  return credencialesInstrumentacion;
}

// ============================================================
// 3. EQUIPOS — todos.
//    Las áreas de las 17 de mantenimiento están activas en el UI.
//    El resto se crean con activo=false (solo para satisfacer la FK,
//    no aparecen en selectores de la app que filtran activo=true).
// ============================================================
async function migrarEquipos(db: mongoose.mongo.Db) {
  console.log("\n🔧 Migrando Equipos (TODOS)...");
  const docs = await db.collection("equipos").find({}).toArray();
  console.log(`   Encontrados: ${docs.length} documentos`);

  // Cargar áreas existentes
  const areasSet = new Set(
    (await prisma.area.findMany({ select: { codigo: true } })).map((a) => a.codigo)
  );

  // Pre-scan: detectar áreas faltantes y crearlas con activo=false
  const faltantes = new Map<string, string>(); // codigo -> descripcionArea
  for (const d of docs) {
    const areaCodigo = String(d.areaCodigo ?? d.area ?? "").trim();
    if (areaCodigo && !areasSet.has(areaCodigo) && !faltantes.has(areaCodigo)) {
      faltantes.set(areaCodigo, String(d.descripcionArea ?? areaCodigo));
    }
  }
  if (faltantes.size > 0) {
    console.log(`   ℹ️  Creando ${faltantes.size} áreas de planta (activo=false, solo FK)...`);
    for (const [codigo, nombre] of faltantes) {
      await prisma.area.create({
        data: { codigo, nombre, superintendencia: "PLANTA", tieneCalibracion: false, activo: false },
      }).catch(() => {});
      areasSet.add(codigo);
    }
  }

  let ok = 0;
  let errores = 0;
  for (const d of docs) {
    const tag = String(d.tag ?? d.codigo ?? "").toUpperCase().trim();
    if (!tag) continue;

    const areaCodigo = String(d.areaCodigo ?? d.area ?? "").trim();
    if (!areaCodigo || !areasSet.has(areaCodigo)) { errores++; continue; }

    try {
      await prisma.equipo.create({
        data: {
          tag,
          descripcion: String(d.descripcion ?? d.nombre ?? tag),
          descripcion2: d.descripcion2 ?? null,
          descripcion3: d.descripcion3 ?? null,
          nivel: Number(d.nivel ?? 1),
          parentTag: d.parentTag ?? null,
          nivelPath: Array.isArray(d.nivelPath) ? d.nivelPath.map(String) : [],
          tipoEquipo: String(d.tipoEquipo ?? d.tipo ?? "."),
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
    } catch { errores++; }
  }
  console.log(`   ✅ ${ok} equipos migrados  |  ${errores} omitidos (sin areaCodigo)`);
}

// ============================================================
// 4. ÓRDENES DE TRABAJO
// ============================================================
async function migrarOrdenes(db: mongoose.mongo.Db) {
  console.log("\n📋 Migrando Órdenes de Trabajo...");
  const docs = await db.collection("ordentrabajos").find({}).toArray();
  console.log(`   Encontrados: ${docs.length} documentos`);

  const areasSet = new Set(
    (await prisma.area.findMany({ select: { codigo: true } })).map((a) => a.codigo)
  );
  let ok = 0;
  for (const d of docs) {
    const numeroOT = String(d.numeroOT ?? d.numero ?? "").trim();
    if (!numeroOT) continue;

    const areaCodigo = String(d.areaCodigo ?? d.area ?? "");
    if (!areasSet.has(areaCodigo)) continue;

    try {
      await prisma.ordenTrabajo.create({
        data: {
          numeroOT,
          fecha: toDate(d.fecha ?? d.fechaCreacion) ?? new Date(),
          turno: String(d.turno ?? "Diurno"),
          areaCodigo,
          estado: String(d.estado ?? "borrador"),
          otJdeNumero: d.otJdeNumero ?? null,
          otJdeDia: d.otJdeDia ?? null,
          origenPlan: Boolean(d.origenPlan ?? false),
        },
      });
      ok++;
    } catch { /* duplicado */ }
  }
  console.log(`   ✅ ${ok} órdenes migradas`);
}

// ============================================================
// 5. PROGRAMACIONES SEMANALES
// ============================================================
async function migrarProgramaciones(db: mongoose.mongo.Db) {
  console.log("\n📅 Migrando Programaciones Semanales...");
  const docs = await db.collection("programacionsemanals").find({}).toArray();
  console.log(`   Encontrados: ${docs.length} documentos`);

  const areasSet = new Set(
    (await prisma.area.findMany({ select: { codigo: true } })).map((a) => a.codigo)
  );
  let ok = 0;
  for (const d of docs) {
    const areaCodigo = String(d.areaCodigo ?? "");
    if (areaCodigo && !areasSet.has(areaCodigo)) continue;

    try {
      const prog = await prisma.programacionSemanal.create({
        data: {
          semana: Number(d.semana ?? 1),
          anio: Number(d.anio ?? new Date().getFullYear()),
          disciplina: String(d.disciplina ?? "GENERAL"),
          areaCodigo: areaCodigo || null,
          fechaInicio: toDate(d.fechaInicio) ?? new Date(),
          fechaFin: toDate(d.fechaFin) ?? new Date(),
          hhDisponiblesSemana: Number(d.hhDisponiblesSemana ?? 0),
          hhProgramadasSemana: Number(d.hhProgramadasSemana ?? 0),
          hhReactivoSemana: Number(d.hhReactivoSemana ?? 0),
          estado: String(d.estado ?? "borrador"),
          subidoPor: String(d.subidoPor ?? "migracion"),
        },
      });

      for (const o of d.otsProgramadas ?? []) {
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
            personalAsignado: Array.isArray(o.tecnicos) ? o.tecnicos.map(String) : [],
            grupo: String(o.grupo ?? "Diurno"),
            dia: String(o.dia ?? "Lu"),
            estado: String(o.estado ?? "no_iniciada"),
            esGuardia: Boolean(o.esGuardia ?? false),
          },
        }).catch(() => {});
      }
      ok++;
    } catch { /* ignorar */ }
  }
  console.log(`   ✅ ${ok} programaciones migradas`);
}

// ============================================================
// 6. CALIBRACIONES
// ============================================================
async function migrarCalibraciones(db: mongoose.mongo.Db) {
  console.log("\n🔬 Migrando Calibraciones...");
  const docs = await db.collection("registrocalibracions").find({}).toArray();
  console.log(`   Encontrados: ${docs.length} documentos`);

  let ok = 0;
  for (const d of docs) {
    const numeroCertificado = String(d.numeroCertificado ?? d.certificado ?? "").trim();
    if (!numeroCertificado) continue;

    try {
      await prisma.registroCalibracion.create({
        data: {
          numeroCertificado,
          tag: String(d.tag ?? "").toUpperCase(),
          descripcionInstrumento: String(d.descripcionInstrumento ?? ""),
          tipoVariable: String(d.tipoVariable ?? ""),
          patronIds: Array.isArray(d.patronIds) ? d.patronIds.map(String) : [],
          patronCodigos: Array.isArray(d.patronCodigos) ? d.patronCodigos.map(String) : [],
          tecnicoId: String(d.tecnicoId ?? "migracion"),
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
    } catch { /* duplicado */ }
  }
  console.log(`   ✅ ${ok} calibraciones migradas`);
}

// ============================================================
// 7. PATRONES
// ============================================================
async function migrarPatrones(db: mongoose.mongo.Db) {
  console.log("\n📏 Migrando Patrones...");
  const docs = await db.collection("patrons").find({}).toArray();
  console.log(`   Encontrados: ${docs.length} documentos`);

  let ok = 0;
  for (const d of docs) {
    const codigo = String(d.codigo ?? "").trim();
    if (!codigo) continue;

    try {
      await prisma.patron.create({
        data: {
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
    } catch { /* ignorar */ }
  }
  console.log(`   ✅ ${ok} patrones migrados`);
}

// ============================================================
// 8. ÁRBOL DE FALLAS
// ============================================================
async function migrarArbolFallas(db: mongoose.mongo.Db) {
  console.log("\n🌳 Migrando Árbol de Fallas...");
  const docs = await db.collection("arbolfallas").find({}).toArray();
  console.log(`   Encontrados: ${docs.length} documentos`);

  let ok = 0;
  for (const d of docs) {
    const sintoma = String(d.sintoma ?? "").trim();
    if (!sintoma) continue;

    try {
      await prisma.arbolFallas.create({
        data: {
          tipoEquipo: d.tipoEquipo ?? null,
          sintoma,
          codigoModo: d.codigoModo ?? null,
          causaProbable: String(d.causaProbable ?? ""),
          codigoCausa: d.codigoCausa ?? null,
          resolucionSugerida: String(d.resolucionSugerida ?? ""),
          tiempoEstimadoHrs: Number(d.tiempoEstimadoHrs ?? 0),
          activo: d.activo !== false,
          creadoPor: String(d.creadoPor ?? "migracion"),
        },
      });
      ok++;
    } catch { /* ignorar */ }
  }
  console.log(`   ✅ ${ok} entradas migradas`);
}

// ============================================================
// 9. REPORTES DE TURNO
// ============================================================
async function migrarReportesTurno(db: mongoose.mongo.Db) {
  console.log("\n📝 Migrando Reportes de Turno...");
  const docs = await db.collection("reporteturnos").find({}).toArray();
  console.log(`   Encontrados: ${docs.length} documentos`);

  let ok = 0;
  for (const d of docs) {
    try {
      await prisma.reporteTurno.create({
        data: {
          turno: String(d.turno ?? "Diurno"),
          fecha: toDate(d.fecha ?? d.createdAt) ?? new Date(),
          supervisorId: String(d.supervisorId ?? "migracion"),
          supervisorNombre: String(d.supervisorNombre ?? ""),
          otIds: Array.isArray(d.otIds) ? d.otIds.map(String) : [],
          otsCriticas: Array.isArray(d.otsCriticas) ? d.otsCriticas.map(String) : [],
          otsPendientesSiguienteTurno: Array.isArray(d.otsPendientesSiguienteTurno)
            ? d.otsPendientesSiguienteTurno.map(String)
            : [],
          notasOTs: d.notasOTs ?? [],
          otsPlanData: d.otsPlanData ?? [],
          resumenEjecutivo: d.resumenEjecutivo ?? {},
          recomendaciones: d.recomendaciones ?? [],
          estado: String(d.estado ?? "borrador"),
        },
      });
      ok++;
    } catch { /* ignorar */ }
  }
  console.log(`   ✅ ${ok} reportes migrados`);
}

// ============================================================
// 10. CATÁLOGOS
// ============================================================
async function migrarCatalogos(db: mongoose.mongo.Db) {
  console.log("\n📚 Migrando Catálogos...");

  const causas = await db.collection("catalogocausas").find({}).toArray();
  let okC = 0;
  for (const d of causas) {
    await prisma.catalogoCausa.create({
      data: {
        id: String(d._id),
        codigo: String(d.codigo ?? ""),
        nombre: String(d.nombre ?? ""),
        descripcion: String(d.descripcion ?? ""),
      },
    }).catch(() => {});
    okC++;
  }
  console.log(`   ✅ ${okC} causas migradas`);

  const modos = await db.collection("catalogomodos").find({}).toArray();
  let okM = 0;
  for (const d of modos) {
    await prisma.catalogoModo.create({
      data: {
        id: String(d._id),
        codigo: String(d.codigo ?? ""),
        nombre: String(d.nombre ?? ""),
        nombreEs: String(d.nombreEs ?? ""),
        descripcion: String(d.descripcion ?? ""),
      },
    }).catch(() => {});
    okM++;
  }
  console.log(`   ✅ ${okM} modos migrados`);

  const contadores = await db.collection("contadors").find({}).toArray();
  for (const d of contadores) {
    await prisma.contador.create({
      data: { nombre: String(d.nombre ?? ""), valor: Number(d.valor ?? 0) },
    }).catch(() => {});
  }
  console.log(`   ✅ ${contadores.length} contadores migrados`);

  const checklists = await db.collection("checklistmanttos").find({}).toArray();
  console.log(`   ℹ️  checklistmanttos: ${checklists.length} documentos (no migrados, se regeneran en la app)`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const sep = "=".repeat(70);
  console.log(sep);
  console.log("🚀  MIGRACIÓN COMPLETA  MongoDB → PostgreSQL");
  console.log(sep);
  console.log(`   MongoDB:      ${MONGO_URI}`);
  console.log(`   PostgreSQL:   ${process.env.DATABASE_URL}`);
  console.log(`   Contraseña Instrumentación: ${PASSWORD_INSTRUMENTACION}`);
  console.log(sep);

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  console.log("✓ Conectado a MongoDB");

  await limpiarBaseDatos();
  await migrarAreas(db);
  const credenciales = await migrarUsuarios(db);
  await migrarEquipos(db);
  await migrarOrdenes(db);
  await migrarProgramaciones(db);
  await migrarCalibraciones(db);
  await migrarPatrones(db);
  await migrarArbolFallas(db);
  await migrarReportesTurno(db);
  await migrarCatalogos(db);

  // ── Resumen final ──────────────────────────────────────────
  console.log("\n" + sep);
  console.log("✅  MIGRACIÓN COMPLETADA");
  console.log(sep);

  if (credenciales.length > 0) {
    console.log(`\n🔑  CREDENCIALES DE INSTRUMENTACIÓN (${credenciales.length} usuarios)\n`);
    console.log(
      "  " +
        "NOMBRE".padEnd(40) +
        "EMAIL".padEnd(35) +
        "CONTRASEÑA"
    );
    console.log("  " + "-".repeat(90));
    for (const c of credenciales) {
      console.log(
        "  " +
          c.nombre.padEnd(40) +
          c.email.padEnd(35) +
          c.password
      );
    }
    console.log("  " + "-".repeat(90));
    console.log(`\n  ⚠️  Contraseña común para todos: ${PASSWORD_INSTRUMENTACION}`);
    console.log("  ⚠️  Se recomienda cambiar la contraseña al primer acceso.\n");
  } else {
    console.log("\n  ℹ️  No se encontraron usuarios de Instrumentación.\n");
  }

  await mongoose.disconnect();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});
