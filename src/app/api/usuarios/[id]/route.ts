import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = await req.json();
    // Nunca permitir cambio de password por esta ruta
    delete body.passwordHash;
    delete body.password;

    const { areas, ...rest } = body;

    await prisma.usuario.update({
      where: { id },
      data: {
        ...rest,
        ...(areas !== undefined ? {
          areas: {
            deleteMany: {},
            create: areas.map((codigo: string) => ({ areaCodigo: codigo })),
          },
        } : {}),
      },
    });

    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await prisma.usuario.update({ where: { id }, data: { activo: false } });
  return Response.json({ ok: true });
}
