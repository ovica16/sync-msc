import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// POST /api/calibracion/renumerar?secret=msc2026reset
// Renumera certificados con seq < 278 y fija el contador a 287
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "msc2026reset") {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  // 1. Buscar certs con número secuencial < 278 (los incorrectos)
  const todos = await prisma.registroCalibracion.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, numeroCertificado: true },
  });

  const incorrectos = todos.filter((r) => {
    const seq = parseInt(r.numeroCertificado.split("_")[0], 10);
    return !isNaN(seq) && seq < 278;
  });

  // 2. Renumerar desde 287 en orden cronológico
  const resultados: { viejo: string; nuevo: string }[] = [];
  for (let i = 0; i < incorrectos.length; i++) {
    const r = incorrectos[i];
    const partes = r.numeroCertificado.split("_");
    partes[0] = String(287 + i);
    const nuevo = partes.join("_");
    await prisma.registroCalibracion.update({
      where: { id: r.id },
      data: { numeroCertificado: nuevo },
    });
    resultados.push({ viejo: r.numeroCertificado, nuevo });
  }

  // 3. Fijar el contador al valor correcto (287 + cantidad corregida - 1)
  const nuevoContador = 287 + incorrectos.length - 1;
  await prisma.contador.upsert({
    where: { nombre: "calibracion-2026" },
    update: { valor: nuevoContador },
    create: { nombre: "calibracion-2026", valor: nuevoContador },
  });

  return Response.json({
    ok: true,
    renumerados: resultados.length,
    contadorFijadoEn: nuevoContador,
    detalle: resultados,
  });
}
