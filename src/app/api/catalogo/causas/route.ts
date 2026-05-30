import { connectDB } from "@/lib/db";
import { CatalogoCausa } from "@/lib/models/ArbolFallas";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const tipoEquipo = searchParams.get("tipoEquipo");
  const codigoModo = searchParams.get("codigoModo");

  if (tipoEquipo && codigoModo) {
    // Devuelve solo las causas que aplican a ese tipo+modo en el árbol
    const { ArbolFallas } = await import("@/lib/models/ArbolFallas");
    const entradas = await ArbolFallas.find(
      { tipoEquipo, codigoModo, activo: true },
      { codigoCausa: 1, causaProbable: 1, resolucionSugerida: 1, tiempoEstimadoHrs: 1 }
    ).lean();
    return Response.json(entradas);
  }

  const causas = await CatalogoCausa.find({}).sort({ codigo: 1 }).lean();
  return Response.json(causas);
}
