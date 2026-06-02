import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const BASE = 277;

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "msc2026reset") {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const todos = await prisma.registroCalibracion.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, numeroCertificado: true },
  });

  const incorrectos = todos.filter((r) => {
    const seq = parseInt(r.numeroCertificado.split("_")[0], 10);
    return !isNaN(seq) && seq <= BASE;
  });

  const maxCorrecto = todos.reduce((max, r) => {
    const n = parseInt(r.numeroCertificado.split("_")[0], 10);
    return !isNaN(n) && n > BASE && n > max ? n : max;
  }, BASE);

  let siguiente = maxCorrecto + 1;
  const resultados: { viejo: string; nuevo: string }[] = [];

  for (const r of incorrectos) {
    const partes = r.numeroCertificado.split("_");
    partes[0] = String(siguiente);
    const nuevo = partes.join("_");
    await prisma.registroCalibracion.update({ where: { id: r.id }, data: { numeroCertificado: nuevo } });
    resultados.push({ viejo: r.numeroCertificado, nuevo });
    siguiente++;
  }

  return Response.json({ ok: true, renumerados: resultados.length, detalle: resultados });
}
