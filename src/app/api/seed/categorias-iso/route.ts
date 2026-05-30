import { connectDB } from "@/lib/db";
import { Equipo } from "@/lib/models/Equipo";
import { ArbolFallas } from "@/lib/models/ArbolFallas";
import mapeo from "@/data/mapeo_tipos.json";

// Palabras clave para deducir la categoría desde la descripción cuando el
// código JDE no alcanza. Orden importa: el primer match gana.
const HINTS: Array<[RegExp, string]> = [
  [/\bcelda(s)?\b/i,              "CELDAS"],
  [/\bagitador/i,                 "AGITADORES"],
  [/\bmotobomba\b/i,              "MOTOBOMBAS"],
  [/\bhidrociclon/i,              "HIDROCICLONES"],
  [/\bliner(s)?\b/i,              "LINERS"],
  [/\bbalanza/i,                  "BALANZAS"],
  [/\bchute/i,                    "CHUTES"],
  [/\bcinta(s)?\b/i,              "CINTAS"],
  [/\btornillo/i,                 "TORNILLOS"],
  [/\bpuente.*gr[uú]a/i,          "PUENTES GRUA"],
  [/\bcaja(s)? .*engran/i,        "CAJAS ENGR"],
  [/\bmotor\b/i,                  "MOTORES"],
  [/\bbomba/i,                    "BOMBAS"],
  [/\bcompresor/i,                "COMPRESORES"],
  [/\bv[aá]lvula/i,               "VALVULAS"],
  [/\btransformador/i,            "TRANSFORMADORES"],
  [/\btuber/i,                    "TUBERIAS"],
  [/\btanque/i,                   "TANQUES"],
  [/\bvariador|vfd\b/i,           "VARIADORES DE FREC"],
  [/\bgenerador/i,                "GENERADORES"],
  [/\binterruptor|tablero|panel/i,"TABLEROS"],
  [/\btransmisor|medidor.*flujo|sensor\b/i, "SENSORES"],
];

function deducirCategoria(d1?: string, d2?: string, d3?: string): string | null {
  const texto = `${d1 ?? ""} ${d2 ?? ""} ${d3 ?? ""}`;
  for (const [re, cat] of HINTS) if (re.test(texto)) return cat;
  return null;
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "No disponible en producción" }, { status: 403 });
  }

  await connectDB();

  const tabla = mapeo as Record<string, string | null>;

  // Categorías presentes en ArbolFallas (solo informativo)
  const catsEnArbol: string[] = await ArbolFallas.distinct("tipoEquipo");

  // ── Reset: limpiar categoriaISO en todos los equipos para partir de cero ──
  await Equipo.updateMany({}, { $set: { categoriaISO: null } });

  // ── Pase 1: por código JDE ─────────────────────────────────────────────────
  let mapeados = 0;
  for (const [tipo, categoria] of Object.entries(tabla)) {
    if (!categoria) continue;
    const r = await Equipo.updateMany(
      { tipoEquipo: tipo },
      { $set: { categoriaISO: categoria } }
    );
    mapeados += r.modifiedCount;
  }

  // ── Pase 2: equipos sin categoría → intentar por descripción ───────────────
  // Después del reset + Pase 1, todos los no mapeados tienen categoriaISO: null
  const sinCat = await Equipo.find({ categoriaISO: null })
    .select("_id tag descripcion descripcion2 descripcion3")
    .lean();

  let porDescripcion = 0;
  for (const eq of sinCat) {
    const cat = deducirCategoria(eq.descripcion, eq.descripcion2, (eq as Record<string, unknown>).descripcion3 as string | undefined);
    if (!cat) continue;
    porDescripcion++;
    await Equipo.updateOne({ _id: eq._id }, { $set: { categoriaISO: cat } });
  }

  const totalConCategoria = await Equipo.countDocuments({ categoriaISO: { $ne: null } });
  const totalSinCategoria = await Equipo.countDocuments({ $or: [{ categoriaISO: null }, { categoriaISO: { $exists: false } }] });

  return Response.json({
    ok: true,
    porCodigoJDE: mapeados,
    porDescripcion,
    totalConCategoria,
    totalSinCategoria,
    categoriasValidas: catsEnArbol.length,
  });
}
