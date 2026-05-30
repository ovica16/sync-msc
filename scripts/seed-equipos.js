// node scripts/seed-equipos.js [archivo]
// Ejemplo: node scripts/seed-equipos.js TagNiveles.xlsx
//
// Formato del Excel:
// Col A: Nivel string (". . .3") — el número al final es el nivel jerárquico
// Col B: TAG / Nº unidad
// Col C: Descripción
// Col D: Descripción 2
// Col E: Descripción 3
// Col F: Tipo (código)
// Col G: Descripción Tipo
// Col H: SubTipo (código)
// Col I: Descripción SubTipo
// Col J: Criticidad (A/B/C)
// Col K: Centro de Costo
// Col L: Área (código JDE, e.g. 3210)
// Col M: Descripción Área

const XLSX     = require("xlsx");
const mongoose = require("mongoose");
const path     = require("path");
const fs       = require("fs");

const MONGODB_URI = "mongodb://localhost:27017/sync-msc";

const EquipoSchema = new mongoose.Schema({
  tag:               String,
  descripcion:       String,
  descripcion2:      String,
  descripcion3:      String,
  nivel:             Number,
  parentTag:         String,
  nivelPath:         [String],
  tipoEquipo:        String,
  descripcionTipo:   String,
  subtipo:           String,
  descripcionSubtipo:String,
  criticidad:        String,
  centroCosto:       String,
  areaCodigo:        String,
  descripcionArea:   String,
  activo:            { type: Boolean, default: true },
}, { timestamps: true });

function extractNivel(nivelStr) {
  const match = String(nivelStr).trim().match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function clean(val) {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  return s === "" || s === "." ? undefined : s;
}

async function main() {
  const archivo = process.argv[2] ?? "TagNiveles.xlsx";
  const filePath = path.join(process.cwd(), archivo);
  if (!fs.existsSync(filePath)) {
    console.error("❌ Archivo no encontrado:", filePath);
    process.exit(1);
  }

  console.log(`📂 Leyendo ${archivo}...`);
  const wb   = XLSX.readFile(filePath);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Saltar filas 1-2 (título y headers)
  const rows = data.slice(2).filter(row => row.some(c => String(c).trim() !== ""));

  // Stack para mantener el contexto jerárquico (parentTag por nivel)
  // parentStack[nivel] = tag del último nodo de ese nivel
  const parentStack = {};

  const equipos = [];
  let skipped = 0;

  for (const row of rows) {
    const nivel = extractNivel(row[0]);
    if (!nivel) { skipped++; continue; }

    const tag = clean(row[1]);
    if (!tag) { skipped++; continue; }

    const tagUpper = tag.toUpperCase();

    // Registrar en el stack este nivel
    parentStack[nivel] = tagUpper;
    // Limpiar niveles hijos que ya no aplican
    for (let n = nivel + 1; n <= 8; n++) delete parentStack[n];

    const parentTag = nivel > 1 ? (parentStack[nivel - 1] ?? undefined) : undefined;

    // Construir ruta completa desde nivel 1 hasta nivel-1
    const nivelPath = [];
    for (let n = 1; n < nivel; n++) {
      if (parentStack[n]) nivelPath.push(parentStack[n]);
    }

    const areaCodigo = String(row[11] ?? "").trim() || "0";
    const criticidad = String(row[9] ?? "").trim().toUpperCase();

    equipos.push({
      tag:               tagUpper,
      descripcion:       clean(row[2]) ?? tag,
      descripcion2:      clean(row[3]),
      descripcion3:      clean(row[4]),
      nivel,
      parentTag,
      nivelPath,
      tipoEquipo:        clean(row[5]) ?? ".",
      descripcionTipo:   clean(row[6]),
      subtipo:           clean(row[7]),
      descripcionSubtipo:clean(row[8]),
      criticidad:        ["A","B","C"].includes(criticidad) ? criticidad : undefined,
      centroCosto:       clean(row[10]),
      areaCodigo:        String(areaCodigo),
      descripcionArea:   clean(row[12]),
      activo:            true,
    });
  }

  console.log(`📊 Registros parseados: ${equipos.length} | Omitidos: ${skipped}`);
  console.log(`   Niveles: ${[...new Set(equipos.map(e => e.nivel))].sort().join(", ")}`);
  console.log(`   Áreas únicas: ${[...new Set(equipos.map(e => e.areaCodigo))].sort().join(", ")}`);

  await mongoose.connect(MONGODB_URI);
  console.log("🔗 Conectado a MongoDB");

  const Equipo = mongoose.models?.Equipo ?? mongoose.model("Equipo", EquipoSchema);

  const BATCH = 500;
  let total = 0;
  for (let i = 0; i < equipos.length; i += BATCH) {
    const batch = equipos.slice(i, i + BATCH);
    const ops = batch.map(eq => ({
      updateOne: {
        filter: { tag: eq.tag },
        update: { $set: eq },
        upsert: true,
      },
    }));
    const r = await Equipo.bulkWrite(ops, { ordered: false });
    total += r.upsertedCount + r.modifiedCount;
    process.stdout.write(`\r   Procesados: ${Math.min(i + BATCH, equipos.length)}/${equipos.length}`);
  }

  console.log(`\n🎉 Listo: ${total} registros insertados/actualizados`);

  // Resumen por nivel
  const resumen = await Equipo.aggregate([
    { $group: { _id: "$nivel", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log("\n📈 Resumen por nivel:");
  for (const r of resumen) {
    const labels = { 1:"Planta", 2:"Área Funcional", 3:"Sistema", 4:"Equipo", 5:"Subequipo", 6:"Componente", 7:"Parte/Sensor", 8:"Sub-elemento" };
    console.log(`   N${r._id} ${labels[r._id] ?? ""}: ${r.count}`);
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
