// node scripts/seed-semana23-api.js
// Sube semana 23 via API HTTP (no requiere DB local)
// Uso: APP_URL=https://tu-app.railway.app node scripts/seed-semana23-api.js

const XLSX = require("xlsx");
const path = require("path");

const APP_URL = process.env.APP_URL || "https://syncmsc-production.up.railway.app";
const ANIO    = 2026;
const SEMANA  = 23;

const ARCHIVOS = [
  { archivo: "PSTesa2026.xlsx", disciplina: "TESA",   areaCodigo: "3348", sheetPrefix: "T" },
  { archivo: "PSVE2026.xlsx",   disciplina: "TELECO", areaCodigo: "3351", sheetPrefix: "E" },
];

const DIAS_VALIDOS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
const GRUPO_MAP    = {
  "Grupo 1": "G1", "Grupo 2": "G2", "Grupo 3": "G3", "Grupo 4": "G4",
  "Diurno": "Diurno", "Nocturno": "Nocturno",
};

function getMondayOfWeek(anio, semana) {
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const day  = jan4.getUTCDay() || 7;
  const mon  = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - day + 1 + (semana - 1) * 7);
  return mon;
}

let contratistaCnt = 0;
const contratistaMap = new Map();
function normalizarPersonal(str) {
  if (!str || typeof str !== "string") return [];
  return str.split(/[/+]/).map(s => s.trim()).filter(Boolean).map(nombre => {
    const lower = nombre.toLowerCase();
    if (lower.includes("contract") || lower.includes("contrat") || lower.includes("practicante")) {
      if (!contratistaMap.has(lower)) { contratistaCnt++; contratistaMap.set(lower, `Contratista ${contratistaCnt}`); }
      return contratistaMap.get(lower);
    }
    return nombre;
  });
}

function parseSheet(data) {
  const ots = [];
  const personalMap = new Map();
  const ASIST_MAP = { T:"T", N:"N", D:"D", V:"V", CS:"CS", BM:"BM", LG:"LG", FI:"FI", DO:"DO", IF:"IF" };

  for (const row of data) {
    const noOT   = row[0];
    const tipoOT = row[1];
    const dia    = String(row[12] ?? "").trim();
    const grupo  = String(row[11] ?? "").trim();

    if (noOT && typeof noOT === "number" && tipoOT && DIAS_VALIDOS.includes(dia)) {
      const personas   = Number(row[7]) || 1;
      const hrsTrabajo = Number(row[8]) || 0;
      const hhTotal    = Number(row[9]) || personas * hrsTrabajo;
      ots.push({
        numeroOT:          String(noOT),
        tipoOT:            String(tipoOT).trim().toUpperCase(),
        tipoTrabajo:       String(row[2] ?? "").trim(),
        prioridad:         String(row[3] ?? "").trim() || null,
        descripcion:       String(row[4] ?? "").trim() || `OT ${noOT}`,
        tag:               String(row[5] ?? "").trim().toUpperCase(),
        descripcionEquipo: String(row[6] ?? "").trim(),
        personas,
        hrsTrabajo,
        hhTotal,
        personalAsignado:  normalizarPersonal(String(row[10] ?? "")),
        grupo:             GRUPO_MAP[grupo] ?? "Diurno",
        dia,
        estado:            "no_iniciada",
      });
    }

    const personaNombre = String(row[14] ?? "").trim();
    const asistEstado   = String(row[15] ?? "").trim();
    if (personaNombre && ASIST_MAP[asistEstado] && DIAS_VALIDOS.includes(dia)) {
      const grupoSchema = GRUPO_MAP[grupo] ?? "Diurno";
      if (!personalMap.has(personaNombre)) {
        personalMap.set(personaNombre, { nombre: personaNombre, grupo: grupoSchema, asistencia: new Map() });
      }
      const p = personalMap.get(personaNombre);
      if (!p.asistencia.has(dia)) p.asistencia.set(dia, asistEstado);
      if (grupoSchema !== "Diurno") p.grupo = grupoSchema;
    }
  }

  const personal = [...personalMap.values()].map(p => ({
    nombre:        p.nombre,
    grupo:         p.grupo,
    esContratista: false,
    asistencia:    DIAS_VALIDOS.map(d => ({ dia: d, estado: p.asistencia.get(d) ?? "" })),
  }));

  return { ots, personal };
}

async function upsert({ archivo, disciplina, areaCodigo, sheetPrefix }) {
  const filePath = path.join(process.cwd(), archivo);
  const wb       = XLSX.readFile(filePath);
  const sheet    = `${sheetPrefix}-${String(SEMANA).padStart(2, "0")}`;

  if (!wb.Sheets[sheet]) {
    console.log(`⚠️  ${archivo}: hoja "${sheet}" no encontrada. Hojas disponibles: ${wb.SheetNames.join(", ")}`);
    return;
  }

  const data = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "" });
  const { ots, personal } = parseSheet(data);

  const lunes   = getMondayOfWeek(ANIO, SEMANA);
  const domingo = new Date(lunes);
  domingo.setUTCDate(lunes.getUTCDate() + 6);

  const hhProgramadas  = ots.reduce((s, o) => s + o.hhTotal, 0);
  const hhReactivo     = ots.filter(o => ["C","CMP","CMR"].includes(o.tipoOT)).reduce((s, o) => s + o.hhTotal, 0);
  const hhDisponibles  = personal.reduce((sum, p) => {
    const diasT = p.asistencia.filter(a => a.estado === "T").length;
    return sum + diasT * 10;
  }, 0);

  const body = {
    semana: SEMANA, anio: ANIO, disciplina, areaCodigo,
    fechaInicio:         lunes.toISOString(),
    fechaFin:            domingo.toISOString(),
    hhDisponiblesSemana: hhDisponibles,
    hhProgramadasSemana: hhProgramadas,
    hhReactivoSemana:    hhReactivo,
    estado:              "publicado",
    subidoPor:           "seed-excel",
    otsProgramadas:      ots,
    personal,
  };

  console.log(`📤 ${disciplina} (${areaCodigo}) S${SEMANA}: ${ots.length} OTs, ${personal.length} técnicos`);

  const res  = await fetch(`${APP_URL}/api/programacion-semanal`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  const json = await res.json();

  if (json.ok) {
    console.log(`✅ OK — ${disciplina} S${SEMANA} subida`);
  } else {
    console.log(`❌ Error — ${json.error}`);
  }
}

async function main() {
  console.log(`\n📅 Semana ${SEMANA} / ${ANIO} → ${APP_URL}\n`);
  for (const cfg of ARCHIVOS) {
    await upsert(cfg);
  }
  if (contratistaMap.size > 0) {
    console.log("\n📋 Contratistas:");
    for (const [k, v] of contratistaMap) console.log(`   "${k}" → "${v}"`);
  }
  console.log("\n🎉 Listo");
}

main().catch(e => { console.error(e); process.exit(1); });
