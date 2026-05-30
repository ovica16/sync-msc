import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ChecklistMantto, { SentidoInspeccion } from "@/lib/models/ChecklistMantto";

type Disciplina = "Mecanico" | "Electrico" | "Instrumentacion" | "Universal";

const VALID_SENTIDOS = new Set(["Visual", "Auditivo", "Tactil", "Olfativo", "Instrumental"]);
const VALID_DISCS = new Set(["Mecanico", "Electrico", "Instrumentacion", "Universal"]);

// Espera un CSV con columna por fila de ítem:
// codigo,nombre,disciplina,nivelTag,areaProceso,categoriaISO,areaCodigo,item_orden,item_sentido,item_descripcion
export async function POST(req: NextRequest) {
  await connectDB();
  const text = await req.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return NextResponse.json({ ok: false, error: "CSV vacío o sin filas" }, { status: 400 });

  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const idx = (name: string) => headers.indexOf(name);

  type RowData = {
    codigo: string; nombre: string; disciplina: Disciplina; nivelTag: number | null;
    areaProceso: string; categoriaISO: string | null; areaCodigo: string;
    items: { descripcion: string; orden: number; sentido: SentidoInspeccion }[];
  };

  const map = new Map<string, RowData>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const codigo      = (cols[idx("codigo")] ?? "").trim().toUpperCase();
    const nombre      = (cols[idx("nombre")] ?? "").trim();
    const discRaw     = (cols[idx("disciplina")] ?? "Mecanico").trim();
    const disciplina  = (VALID_DISCS.has(discRaw) ? discRaw : "Mecanico") as Disciplina;
    const nivelTagRaw = (cols[idx("nivelTag")] ?? "").trim();
    const areaProceso = (cols[idx("areaProceso")] ?? "general").trim();
    const catISO      = (cols[idx("categoriaISO")] ?? "").trim() || null;
    const areaCodigo  = (cols[idx("areaCodigo")] ?? "*").trim();
    const itemOrden   = parseInt(cols[idx("item_orden")] ?? "0", 10);
    const sentidoRaw  = (cols[idx("item_sentido")] ?? "Visual").trim() || "Visual";
    const itemSentido = (VALID_SENTIDOS.has(sentidoRaw) ? sentidoRaw : "Visual") as SentidoInspeccion;
    const itemDesc    = (cols[idx("item_descripcion")] ?? "").trim();

    if (!codigo || !nombre) continue;

    if (!map.has(codigo)) {
      map.set(codigo, {
        codigo, nombre, disciplina,
        nivelTag: nivelTagRaw ? Number(nivelTagRaw) : null,
        areaProceso, categoriaISO: catISO, areaCodigo, items: [],
      });
    }
    if (itemDesc) {
      map.get(codigo)!.items.push({ descripcion: itemDesc, orden: itemOrden, sentido: itemSentido });
    }
  }

  const ops = [...map.values()].map(cl => ({
    updateOne: {
      filter: { codigo: cl.codigo },
      update: { $set: cl },
      upsert: true,
    },
  }));

  if (ops.length === 0) return NextResponse.json({ ok: false, error: "Sin registros válidos en el CSV" }, { status: 400 });

  const result = await ChecklistMantto.bulkWrite(ops, { ordered: false });
  return NextResponse.json({
    ok: true,
    checklists: map.size,
    inserted: result.upsertedCount,
    modified: result.modifiedCount,
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}
