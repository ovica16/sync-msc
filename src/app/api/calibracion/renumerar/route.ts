import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// POST /api/calibracion/renumerar?secret=msc2026reset
// Renumera certificados existentes en orden cronológico desde 278
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "msc2026reset") {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const registros = await prisma.registroCalibracion.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, numeroCertificado: true, tag: true, createdAt: true },
  });

  const INICIO = 278;
  const resultados: { viejo: string; nuevo: string }[] = [];

  for (let i = 0; i < registros.length; i++) {
    const r = registros[i];
    // Mantener TAG y fecha del número original, solo cambiar el secuencial
    const partes = r.numeroCertificado.split("_");
    const nuevoNum = INICIO + i;
    // Reconstruir: {nuevoSeq}_{TAG}_{FECHA}
    partes[0] = String(nuevoNum);
    const nuevo = partes.join("_");

    await prisma.registroCalibracion.update({
      where: { id: r.id },
      data: { numeroCertificado: nuevo },
    });

    resultados.push({ viejo: r.numeroCertificado, nuevo });
  }

  return Response.json({ ok: true, renumerados: resultados.length, detalle: resultados });
}
