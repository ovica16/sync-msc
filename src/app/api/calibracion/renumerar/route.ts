import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

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
    return !isNaN(seq) && seq < 278;
  });

  const resultados: { viejo: string; nuevo: string }[] = [];
  // El siguiente libre: máximo actual entre los correctos + 1
  const maxCorrecto = todos
    .map((r) => parseInt(r.numeroCertificado.split("_")[0], 10))
    .filter((n) => n >= 278)
    .reduce((a, b) => Math.max(a, b), 277);

  let siguiente = maxCorrecto + 1;

  for (const r of incorrectos) {
    const partes = r.numeroCertificado.split("_");
    partes[0] = String(siguiente);
    const nuevo = partes.join("_");
    await prisma.registroCalibracion.update({
      where: { id: r.id },
      data: { numeroCertificado: nuevo },
    });
    resultados.push({ viejo: r.numeroCertificado, nuevo });
    siguiente++;
  }

  // Fijar counter al último número usado
  const contadorFinal = siguiente - 1;
  await prisma.contador.upsert({
    where: { nombre: "calibracion-2026" },
    update: { valor: contadorFinal },
    create: { nombre: "calibracion-2026", valor: contadorFinal },
  });

  return Response.json({ ok: true, renumerados: resultados.length, contadorFijadoEn: contadorFinal, detalle: resultados });
}
