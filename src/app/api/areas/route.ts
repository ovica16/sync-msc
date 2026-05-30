import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

  const areas = await prisma.area.findMany({
    where: all ? {} : { activo: true },
    orderBy: { codigo: "asc" },
  });
  return Response.json(areas);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const area = await prisma.area.create({
      data: {
        codigo: body.codigo,
        nombre: body.nombre,
        superintendencia: body.superintendencia,
        tieneCalibracion: body.tieneCalibracion ?? false,
        activo: true,
      },
    });
    return Response.json({ ok: true, area }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
