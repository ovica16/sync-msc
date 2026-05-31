import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

  const docs = await prisma.checklistMantto.findMany({
    where: all ? {} : { activo: true },
    orderBy: [{ disciplina: "asc" }, { areaProceso: "asc" }, { nombre: "asc" }],
  });

  return Response.json(docs);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const doc = await prisma.checklistMantto.create({
      data: {
        codigo:      body.codigo      ?? "",
        areaCodigo:  body.areaCodigo  ?? "*",
        nombre:      body.nombre,
        disciplina:  body.disciplina,
        nivelTag:    body.nivelTag    ?? null,
        areaProceso: body.areaProceso ?? "general",
        categoriaISO: body.categoriaISO ?? null,
        items:       body.items       ?? [],
        activo:      body.activo      !== false,
      },
    });
    return Response.json({ ok: true, _id: doc.id }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
