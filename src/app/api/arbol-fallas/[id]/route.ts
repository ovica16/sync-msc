import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = await req.json();
    if (body.tipoEquipo === "") body.tipoEquipo = null;
    const entry = await prisma.arbolFallas.update({ where: { id }, data: body });
    return Response.json({ ok: true, entry });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await prisma.arbolFallas.delete({ where: { id } });
  return Response.json({ ok: true });
}
