import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tipoEquipo = searchParams.get("tipoEquipo");
  const codigoModo = searchParams.get("codigoModo");

  if (tipoEquipo && codigoModo) {
    const entradas = await prisma.arbolFallas.findMany({
      where: { tipoEquipo, codigoModo, activo: true },
      select: { codigoCausa: true, causaProbable: true, resolucionSugerida: true, tiempoEstimadoHrs: true },
    });
    return Response.json(entradas);
  }

  const causas = await prisma.catalogoCausa.findMany({ orderBy: { codigo: "asc" } });
  return Response.json(causas);
}
