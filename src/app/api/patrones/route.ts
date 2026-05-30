import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const all = new URL(req.url).searchParams.get("all");
  const patrones = await prisma.patron.findMany({
    where: all ? {} : { activo: true },
    orderBy: { codigo: "asc" },
  });
  return Response.json(patrones.map(p => ({ ...p, _id: p.id })));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patron = await prisma.patron.create({
      data: {
        codigo: String(body.codigo).toUpperCase().trim(),
        descripcion: body.descripcion,
        tipo: body.tipo,
        marca: body.marca,
        modelo: body.modelo,
        numeroSerie: body.numeroSerie,
        fechaUltimaCalibracion: new Date(body.fechaUltimaCalibracion),
        fechaVencimiento: new Date(body.fechaVencimiento),
        frecuenciaCalibracion: body.frecuenciaCalibracion,
        rangoMin: body.rangoMin ?? null,
        rangoMax: body.rangoMax ?? null,
        precision: body.precision ?? null,
        ubicacion: body.ubicacion ?? null,
        responsable: body.responsable ?? null,
        certificadoUrl: body.certificadoUrl ?? null,
      },
    });
    return Response.json({ ok: true, patron: { ...patron, _id: patron.id } }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
