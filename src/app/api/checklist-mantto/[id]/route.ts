import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.checklistMantto.findUnique({ where: { id } });
  if (!doc) return Response.json({ ok: false, error: "No encontrado" }, { status: 404 });
  return Response.json(doc);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const doc = await prisma.checklistMantto.update({
      where: { id },
      data: {
        codigo:       body.codigo      ?? "",
        areaCodigo:   body.areaCodigo  ?? "*",
        nombre:       body.nombre,
        disciplina:   body.disciplina,
        nivelTag:     body.nivelTag    ?? null,
        areaProceso:  body.areaProceso ?? "general",
        categoriaISO: body.categoriaISO ?? null,
        items:        body.items       ?? [],
        activo:       body.activo      !== false,
      },
    });
    return Response.json({ ok: true, _id: doc.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.checklistMantto.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
