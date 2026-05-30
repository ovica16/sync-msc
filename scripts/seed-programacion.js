// node scripts/seed-programacion.js [archivo] [semana]
// Ejemplo: node scripts/seed-programacion.js PSInst2026.xlsx
//          node scripts/seed-programacion.js PSElt2026..xlsx 20
//          node scripts/seed-programacion.js PSCon2026.xlsx

const XLSX     = require("xlsx");
const mongoose = require("mongoose");
const path     = require("path");
const fs       = require("fs");

const MONGODB_URI = "mongodb://localhost:27017/sync-msc";

// Disciplina y área JDE por archivo
const ARCHIVO_CONFIG = {
  "PSInst2026.xlsx":  { disciplina: "INST",    areaCodigo: "3320", sheetPrefix: "I" },
  "PSElt2026.xlsx":   { disciplina: "ELEC",    areaCodigo: "3311", sheetPrefix: "E" },
  "PSCon2026.xlsx":   { disciplina: "MEC",     areaCodigo: "3312", sheetPrefix: "C" },
};

const DIAS_VALIDOS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

const GRUPO_MAP = {
  "Grupo 1": "G1", "Grupo 2": "G2", "Grupo 3": "G3", "Grupo 4": "G4",
  "Diurno": "Diurno", "Nocturno": "Nocturno",
};

const ASIST_MAP = {
  T: "T", N: "N", D: "D", V: "V", CS: "CS",
  BM: "BM", LG: "LG", FI: "FI", DO: "DO", IF: "IF",
};

function getMondayOfWeek(anio, semana) {
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const day  = jan4.getUTCDay() || 7;
  const mon  = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - day + 1 + (semana - 1) * 7);
  return mon;
}

// Normaliza nombres de contratistas en el personal string
// "Contract 1" / "Contratist 2" / "apoyo contratistas" → "Contratista N"
let contratistaCnt = 0;
const contratistaMap = new Map();
function normalizarPersonal(str) {
  if (!str || typeof str !== "string") return [];
  const partes = str.split(/[/+]/).map(s => s.trim()).filter(Boolean);
  return partes.map(nombre => {
    const lower = nombre.toLowerCase();
    if (lower.includes("contract") || lower.includes("contrat") || lower.includes("apoyo contrat") || lower.includes("practicante")) {
      if (!contratistaMap.has(lower)) {
        contratistaCnt++;
        contratistaMap.set(lower, `Contratista ${contratistaCnt}`);
      }
      return contratistaMap.get(lower);
    }
    return nombre;
  });
}

function parseSemanaSheet(data, semanaNum, anio, disciplina) {
  const ots = [];
  const personalMap = new Map(); // nombre → { nombre, grupo, asistencia: Map<dia, estado> }

  for (const row of data) {
    const noOT   = row[0];
    const tipoOT = row[1];
    const dia    = String(row[12] ?? "").trim();
    const grupo  = String(row[11] ?? "").trim();

    // ── Fila de OT real ──
    if (noOT && typeof noOT === "number" && tipoOT && DIAS_VALIDOS.includes(dia)) {
      const personas    = Number(row[7]) || 1;
      const hrsTrabajo  = Number(row[8]) || 0;
      const hhTotal     = Number(row[9]) || personas * hrsTrabajo;
      const personalArr = normalizarPersonal(String(row[10] ?? ""));
      const grupoSchema = GRUPO_MAP[grupo] ?? "Diurno";

      ots.push({
        numeroOT:          String(noOT),
        tipoOT:            String(tipoOT).trim().toUpperCase(),
        tipoTrabajo:       String(row[2] ?? "").trim(),
        prioridad:         String(row[3] ?? "").trim() || undefined,
        descripcion:       String(row[4] ?? "").trim() || `OT ${noOT}`,
        tag:               String(row[5] ?? "").trim().toUpperCase(),
        descripcionEquipo: String(row[6] ?? "").trim(),
        personas,
        hrsTrabajo,
        hhTotal,
        personalAsignado:  personalArr,
        grupo:             grupoSchema,
        dia,
        estado:            "no_iniciada",
        observaciones:     undefined,
      });
    }

    // ── Fila de asistencia (col 14 = nombre, col 15 = estado) ──
    const personaNombre = String(row[14] ?? "").trim();
    const asistEstado   = String(row[15] ?? "").trim();
    if (personaNombre && asistEstado && ASIST_MAP[asistEstado] && DIAS_VALIDOS.includes(dia)) {
      const grupoSchema = GRUPO_MAP[grupo] ?? "Diurno";
      if (!personalMap.has(personaNombre)) {
        personalMap.set(personaNombre, { nombre: personaNombre, grupo: grupoSchema, asistencia: new Map() });
      }
      const p = personalMap.get(personaNombre);
      if (!p.asistencia.has(dia)) p.asistencia.set(dia, asistEstado);
      if (grupoSchema !== "Diurno") p.grupo = grupoSchema;
    }
  }

  // Convertir a array con los 7 días
  const personal = [...personalMap.values()].map(p => ({
    nombre:        p.nombre,
    grupo:         p.grupo,
    esContratista: false,
    asistencia:    DIAS_VALIDOS.map(d => ({ dia: d, estado: p.asistencia.get(d) ?? "" })),
  }));

  const lunes   = getMondayOfWeek(anio, semanaNum);
  const domingo = new Date(lunes);
  domingo.setUTCDate(lunes.getUTCDate() + 6);

  return { semana: semanaNum, anio, disciplina, fechaInicio: lunes, fechaFin: domingo, ots, personal };
}

// ─── Schema Mongoose ─────────────────────────────────────────────────────────
const PS = mongoose.models?.ProgramacionSemanal ?? mongoose.model("ProgramacionSemanal", new mongoose.Schema({
  semana: Number, anio: Number, disciplina: String, areaCodigo: String,
  fechaInicio: Date, fechaFin: Date,
  hhDisponiblesSemana: { type: Number, default: 0 },
  hhProgramadasSemana: { type: Number, default: 0 },
  hhReactivoSemana:    { type: Number, default: 0 },
  personal:       { type: Array, default: [] },
  otsProgramadas: { type: Array, default: [] },
  resumenDias:    { type: Array, default: [] },
  estado:         { type: String, default: "publicado" },
  subidoPor:      String,
}, { timestamps: true }));

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const archivo    = process.argv[2] ?? "PSInst2026.xlsx";
  const soloSemana = process.argv[3] ? Number(process.argv[3]) : null;
  const anio       = Number(process.argv[4] ?? "2026");

  const filePath = path.join(process.cwd(), archivo);
  if (!fs.existsSync(filePath)) { console.error("Archivo no encontrado:", filePath); process.exit(1); }

  const config     = ARCHIVO_CONFIG[archivo] ?? { disciplina: "GENERAL", areaCodigo: null, sheetPrefix: "I" };
  const { disciplina, areaCodigo, sheetPrefix } = config;
  console.log(`📂 Leyendo ${archivo} → disciplina: ${disciplina} | área: ${areaCodigo} | hojas: ${sheetPrefix}-XX`);

  const wb = XLSX.readFile(filePath);
  const re = new RegExp(`^${sheetPrefix}-\\d+$`);
  const semanaSheets = wb.SheetNames.filter(n => re.test(n));
  console.log(`📑 Hojas de semana: ${semanaSheets.length} (${semanaSheets.join(", ")})\n`);

  const buckets = [];
  for (const sheetName of semanaSheets) {
    const semNum = parseInt(sheetName.replace(`${sheetPrefix}-`, ""), 10);
    if (soloSemana !== null && semNum !== soloSemana) continue;
    const ws   = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const bucket = parseSemanaSheet(data, semNum, anio, disciplina);
    buckets.push(bucket);
    console.log(`   ${sheetName}: ${bucket.ots.length} OTs, ${bucket.personal.length} técnicos`);
  }

  if (buckets.length === 0) { console.log("No se encontraron semanas."); return; }
  const totalOTs = buckets.reduce((s, b) => s + b.ots.length, 0);
  console.log(`\n📦 Total: ${buckets.length} semanas, ${totalOTs} OTs\n`);

  await mongoose.connect(MONGODB_URI);
  console.log("🔗 Conectado a MongoDB\n");

  let creadas = 0, actualizadas = 0, errores = 0;
  for (const bucket of buckets) {
    const hhProg  = bucket.ots.reduce((s, o) => s + o.hhTotal, 0);
    const hhReact = bucket.ots.filter(o => o.tipoOT === "C" || o.tipoOT === "CMP" || o.tipoOT === "CMR").reduce((s, o) => s + o.hhTotal, 0);
    const payload = {
      otsProgramadas: bucket.ots, personal: bucket.personal,
      hhProgramadasSemana: hhProg, hhReactivoSemana: hhReact,
      estado: "publicado", subidoPor: "seed-excel",
      ...(areaCodigo ? { areaCodigo } : {}),
    };
    try {
      const existing = await PS.findOne({ semana: bucket.semana, anio: bucket.anio, disciplina });
      if (existing) {
        await PS.updateOne({ _id: existing._id }, { $set: payload });
        actualizadas++;
        console.log(`✏️  S${String(bucket.semana).padStart(2,"0")} actualizada | ${bucket.ots.length} OTs | ${bucket.personal.length} técnicos`);
      } else {
        await PS.create({ semana: bucket.semana, anio: bucket.anio, disciplina, fechaInicio: bucket.fechaInicio, fechaFin: bucket.fechaFin, resumenDias: [], hhDisponiblesSemana: 0, ...payload });
        creadas++;
        console.log(`✅ S${String(bucket.semana).padStart(2,"0")} creada    | ${bucket.ots.length} OTs | ${bucket.personal.length} técnicos`);
      }
    } catch (err) {
      errores++;
      console.error(`❌ S${bucket.semana}:`, err.message);
    }
  }

  console.log(`\n🎉 Listo: ${creadas} creadas, ${actualizadas} actualizadas, ${errores} errores`);
  if (contratistaMap.size > 0) {
    console.log("\n📋 Contratistas normalizados:");
    for (const [k, v] of contratistaMap) console.log(`   "${k}" → "${v}"`);
  }
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
