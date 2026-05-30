import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

function calcResumen(lineas: { tipoOT: string; tiempoRealHrs: number | null }[], estados: string[]) {
  let hhTotales = 0, hhCorrectivo = 0, hhPreventivo = 0;
  let concluidas = 0, pendientes = 0, inconclusas = 0;
  for (const l of lineas) {
    const hrs = l.tiempoRealHrs ?? 0;
    hhTotales += hrs;
    if (["CMP","CMR"].includes(l.tipoOT)) hhCorrectivo += hrs;
    if (["PMP","PMT","PTJ"].includes(l.tipoOT)) hhPreventivo += hrs;
  }
  for (const est of estados) {
    if (est === "concluido" || est === "revisado") concluidas++;
    else if (est === "pendiente_revision") pendientes++;
    else inconclusas++;
  }
  return {
    totalOTs: estados.length,
    concluidas, pendientes, inconclusas,
    hhTotales: Math.round(hhTotales * 10) / 10,
    hhCorrectivo: Math.round(hhCorrectivo * 10) / 10,
    hhPreventivo: Math.round(hhPreventivo * 10) / 10,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const turno  = searchParams.get("turno");
  const limit  = Math.min(Number(searchParams.get("limit") || "50"), 200);

  const reportes = await prisma.reporteTurno.findMany({
    where: {
      ...(estado ? { estado } : {}),
      ...(turno  ? { turno }  : {}),
    },
    orderBy: { fecha: "desc" },
    take: limit,
  });

  return Response.json(reportes.map(r => ({ ...r, _id: r.id })));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { turno, fecha, supervisorId, supervisorNombre,
            otIds, otsCriticas, otsPendientesSiguienteTurno,
            notasOTs, recomendaciones, otsPlanData } = body;

    // Calcular resumen desde OTs reales en PostgreSQL
    const realIds = (otIds ?? []).filter((id: string) => !id.startsWith("plan-"));
    const ordenes = realIds.length
      ? await prisma.ordenTrabajo.findMany({
          where: { id: { in: realIds } },
          include: { lineas: true },
        })
      : [];

    const todasLineas = ordenes.flatMap(o => o.lineas);
    const estados = ordenes.map(o => o.estado);
    const resumenBase = calcResumen(todasLineas, estados);
    const planHH = (otsPlanData ?? []).reduce((s: number, o: Record<string, unknown>) => s + (Number(o.hhTotal) || 0), 0);
    const resumenEjecutivo = {
      ...resumenBase,
      totalOTs: resumenBase.totalOTs + (otsPlanData?.length ?? 0),
      hhTotales: Math.round((resumenBase.hhTotales + planHH) * 10) / 10,
    };

    const reporte = await prisma.reporteTurno.create({
      data: {
        turno, fecha: new Date(fecha), supervisorId, supervisorNombre,
        otIds: otIds ?? [],
        otsCriticas: otsCriticas ?? [],
        otsPendientesSiguienteTurno: otsPendientesSiguienteTurno ?? [],
        notasOTs: notasOTs ?? [],
        otsPlanData: otsPlanData ?? [],
        recomendaciones: recomendaciones ?? [],
        resumenEjecutivo,
        estado: "borrador",
      },
    });

    return Response.json({ ok: true, reporte: { ...reporte, _id: reporte.id } }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
