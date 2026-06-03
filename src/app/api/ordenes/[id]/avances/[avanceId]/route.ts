import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string; avanceId: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, avanceId } = await params;
  try {
    const avance = await prisma.otRegistroDiario.findUnique({ where: { id: avanceId } });
    if (!avance || avance.ordenTrabajoId !== id)
      return Response.json({ ok: false, error: "No encontrado" }, { status: 404 });
    await prisma.otRegistroDiario.delete({ where: { id: avanceId } });
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
