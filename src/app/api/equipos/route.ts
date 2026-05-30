import { connectDB } from "@/lib/db";
import { Equipo } from "@/lib/models/Equipo";
import { NextRequest } from "next/server";

const SELECT_FIELDS = "_id tag descripcion descripcion2 nivel parentTag tipoEquipo descripcionTipo subtipo categoriaISO criticidad areaCodigo descripcionArea fabricante modelo activo";

// Fallback: calcula categoriaISO en servidor si la BD lo tiene null
const MAPEO_JDE: Record<string, string> = {
  EMT: "MOTORES", MIL: "MOTORES", AEM: "VARIADORES DE FREC",
  PTF: "TRANSFORMADORES", TRF: "TRANSFORMADORES", PGC: "GENERADORES",
  PMP: "BOMBAS", VLV: "VALVULAS", CMP: "COMPRESORES",
  TPM: "CAJAS ENGR", HDS: "SIST HIDRÁULICOS", LBS: "SIST LUBRICACIÓN",
  SLC: "CINTAS", TNS: "TANQUES", SNT: "SENSORES",
  HLE: "PUENTES GRUA", HTE: "INTERCAMBIADORES", GAH: "PULMONES AIRE",
  VTE: "PULMONES AIRE", FLH: "TUBERIAS", FLT: "TUBERIAS", PRF: "TUBERIAS",
};

type EquipoLean = Record<string, unknown>;

function enriquecerCategoria(eq: EquipoLean): EquipoLean {
  if (eq.categoriaISO) return eq;
  const cat = MAPEO_JDE[eq.tipoEquipo as string] ?? null;
  return cat ? { ...eq, categoriaISO: cat } : eq;
}

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const q       = searchParams.get("q") || "";
  const area    = searchParams.get("area");
  const all     = searchParams.get("all") === "true";
  const nivel   = searchParams.get("nivel");
  const parent  = searchParams.get("parent");
  const tipo    = searchParams.get("tipo");
  const crit    = searchParams.get("crit");
  const tag     = searchParams.get("tag");
  const limit   = Math.min(Number(searchParams.get("limit") || (all ? "5000" : "20")), 5000);
  const page    = Number(searchParams.get("page") || "0");

  const filter: Record<string, unknown> = {};
  if (!all) filter.activo = { $ne: false };

  if (tag) {
    filter.tag = tag.toUpperCase();
  } else if (q.length >= 2) {
    filter.$or = [
      { tag:        { $regex: q.toUpperCase(), $options: "" } },
      { descripcion: { $regex: q, $options: "i" } },
    ];
  }
  if (area)   filter.areaCodigo = area;
  if (nivel)  filter.nivel = Number(nivel);
  if (parent) filter.parentTag = parent.toUpperCase();
  if (tipo)   filter.tipoEquipo = tipo;
  if (crit)   filter.criticidad = crit;

  // Con búsqueda de texto: ordenar solo por tag (nivel 8 aparece igual que nivel 1)
  // Sin texto: ordenar jerárquico para listados completos
  const sortOrder: Record<string, 1 | -1> = (q.length >= 2 || tag) ? { tag: 1 } : { areaCodigo: 1, nivel: 1, tag: 1 };
  // Con texto de búsqueda, aumentar el límite para no cortar resultados de nivel alto
  const effectiveLimit = (q.length >= 2 && !all) ? Math.min(limit * 3, 60) : limit;

  const equipos = await Equipo.find(filter)
    .select(SELECT_FIELDS)
    .sort(sortOrder)
    .skip(page * effectiveLimit)
    .limit(effectiveLimit)
    .lean();

  return Response.json(equipos.map(enriquecerCategoria));
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    // Bulk upsert: array de equipos
    if (Array.isArray(body)) {
      const ops = body.map((eq: Record<string, unknown>) => ({
        updateOne: {
          filter: { tag: String(eq.tag).toUpperCase().trim() },
          update: { $set: eq },
          upsert: true,
        },
      }));
      const result = await Equipo.bulkWrite(ops, { ordered: false });
      return Response.json(
        { ok: true, inserted: result.upsertedCount, modified: result.modifiedCount },
        { status: 201 }
      );
    }

    // Single insert/upsert
    const equipo = await Equipo.findOneAndUpdate(
      { tag: String(body.tag).toUpperCase().trim() },
      { $set: body },
      { upsert: true, new: true }
    );
    return Response.json({ ok: true, equipo }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
