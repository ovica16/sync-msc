import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// Formato nuevo: {seq}_{TAG}_{YYYYMMDD}
// La secuencia se reinicia cada año. Para 2026 el contador arranca en 277
// (inicializado en docker-start.sh) para que el próximo sea 278.
async function siguienteCertificado(tag: string, fecha: string): Promise<string> {
  const year = new Date(fecha + "T12:00:00").getFullYear();
  const dateStr = fecha.slice(0, 10).replace(/-/g, ""); // 20260601
  // TAG limpio: mantener alfanuméricos y guiones, sin barras ni espacios
  const tagLimpio = tag.replace(/[/\\*?:"<>| ]/g, "").toUpperCase();
  const counter = await prisma.contador.upsert({
    where: { nombre: `calibracion-${year}` },
    update: { valor: { increment: 1 } },
    create: { nombre: `calibracion-${year}`, valor: 1 },
  });
  return `${counter.valor}_${tagLimpio}_${dateStr}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tag       = searchParams.get("tag");
  const resultado = searchParams.get("resultado");
  const limit     = Math.min(Number(searchParams.get("limit") || "50"), 200);

  const registros = await prisma.registroCalibracion.findMany({
    where: {
      ...(tag       ? { tag: { contains: tag, mode: "insensitive" } } : {}),
      ...(resultado ? { resultadoGeneral: resultado } : {}),
    },
    orderBy: { fecha: "desc" },
    take: limit,
  });

  return Response.json(registros.map(r => ({ ...r, _id: r.id })));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const numeroCertificado = await siguienteCertificado(
      String(body.tag).toUpperCase(),
      body.fecha ?? new Date().toISOString().slice(0, 10),
    );

    const registro = await prisma.registroCalibracion.create({
      data: {
        numeroCertificado,
        tag: String(body.tag).toUpperCase(),
        descripcionInstrumento: body.descripcionInstrumento,
        tipoVariable: body.tipoVariable,
        patronIds: body.patronIds ?? [],
        patronCodigos: body.patronCodigos ?? [],
        tecnicoId: body.tecnicoId,
        tecnicoNombre: body.tecnicoNombre,
        supervisorId: body.supervisorId ?? null,
        supervisorNombre: body.supervisorNombre ?? null,
        fecha: new Date(body.fecha),
        temperatura: body.temperatura ?? null,
        humedad: body.humedad ?? null,
        turno: body.turno ?? null,
        unidad: body.unidad ?? null,
        puntos: body.puntos,
        puntosAntes: body.puntosAntes ?? [],
        resultadoGeneral: body.resultadoGeneral,
        observaciones: body.observaciones ?? null,
        otAsociada: body.otAsociada ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ estado: body.estado ?? "revision" } as any),
        tecnicoFirma: body.tecnicoFirma ?? null,
        supervisorFirma: body.supervisorFirma ?? null,
        areaCodigo: "3320",
      },
    });

    return Response.json(
      { ok: true, registro: { ...registro, _id: registro.id } },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
