import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const p = await prisma.patron.findUnique({ where: { id } });
  if (!p) return Response.json({ error: "No encontrado" }, { status: 404 });
  return Response.json({ ...p, _id: p.id });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.fechaUltimaCalibracion) body.fechaUltimaCalibracion = new Date(body.fechaUltimaCalibracion);
    if (body.fechaVencimiento) body.fechaVencimiento = new Date(body.fechaVencimiento);
    const patron = await prisma.patron.update({ where: { id }, data: body });
    return Response.json({ ok: true, patron: { ...patron, _id: patron.id } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
