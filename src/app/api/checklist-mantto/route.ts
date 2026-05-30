import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ChecklistMantto from "@/lib/models/ChecklistMantto";

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const area       = searchParams.get("area");
  const disciplina = searchParams.get("disciplina");
  const nivelTag   = searchParams.get("nivelTag");
  const areaProceso= searchParams.get("areaProceso");
  const all        = searchParams.get("all") === "true";

  const filter: Record<string, unknown> = {};
  if (!all) filter.activo = true;

  // Filtro por disciplina + nivel + areaProceso (búsqueda automática desde registro)
  if (disciplina) {
    const catISO = searchParams.get("categoriaISO");
    if (nivelTag) filter.nivelTag = Number(nivelTag);
    if (areaProceso) filter.areaProceso = { $in: [areaProceso, "general"] };

    if (catISO) {
      // Prioridad: checklist específico para esa categoría, o el genérico de la disciplina
      filter.$or = [
        { disciplina, categoriaISO: catISO },
        { disciplina, categoriaISO: null },
      ];
    } else {
      filter.disciplina = disciplina;
      filter.categoriaISO = null;
    }
  } else if (area) {
    // Modo legado: búsqueda por código de área JDE
    filter.$or = [{ areaCodigo: area }, { areaCodigo: "*" }];
  }

  const data = await ChecklistMantto.find(filter)
    .sort({ areaProceso: 1, nombre: 1 })
    .lean();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const { codigo, areaCodigo, nombre, disciplina, nivelTag, areaProceso, categoriaISO, items } = body;

  if (!nombre || !disciplina) {
    return NextResponse.json({ ok: false, error: "nombre y disciplina son obligatorios" }, { status: 400 });
  }

  const doc = await ChecklistMantto.create({
    codigo: codigo ?? "",
    areaCodigo: areaCodigo ?? "*",
    nombre,
    disciplina,
    nivelTag: nivelTag ?? null,
    areaProceso: areaProceso ?? "general",
    categoriaISO: categoriaISO ?? null,
    items: items ?? [],
  });
  return NextResponse.json({ ok: true, doc });
}
