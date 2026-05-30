import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const r = await prisma.reporteTurno.findUnique({ where: { id } });
  if (!r) return Response.json({ error: "No encontrado" }, { status: 404 });
  return Response.json({ ...r, _id: r.id });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await prisma.reporteTurno.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { estado, recomendaciones } = body;
    const r = await prisma.reporteTurno.update({
      where: { id },
      data: {
        ...(estado          ? { estado } : {}),
        ...(recomendaciones ? { recomendaciones } : {}),
      },
    });
    return Response.json({ ok: true, reporte: { ...r, _id: r.id } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
