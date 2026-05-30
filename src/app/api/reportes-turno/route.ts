import { connectDB } from "@/lib/db";
import { ReporteTurno } from "@/lib/models/ReporteTurno";
import { OrdenTrabajo } from "@/lib/models/OrdenTrabajo";
import { NextRequest } from "next/server";

function calcResumen(ordenes: Record<string, unknown>[]) {
  let hhTotales = 0, hhCorrectivo = 0, hhPreventivo = 0;
  let concluidas = 0, pendientes = 0, inconclusas = 0;
  const correctivos = ["CMP", "CMR"];
  const preventivos = ["PMP", "PMT", "PTJ"];

  for (const ot of ordenes) {
    const lineas = (ot.lineas as Record<string, unknown>[]) ?? [];
    for (const l of lineas) {
      const hrs = (l.tiempoRealHrs as number) ?? 0;
      hhTotales += hrs;
      if (correctivos.includes(l.tipoOT as string)) hhCorrectivo += hrs;
      if (preventivos.includes(l.tipoOT as string)) hhPreventivo += hrs;
    }
    const est = ot.estado as string;
    if (est === "concluido" || est === "revisado") concluidas++;
    else if (est === "pendiente_revision") pendientes++;
    else inconclusas++;
  }

  return {
    totalOTs: ordenes.length,
    concluidas, pendientes, inconclusas,
    hhTotales: Math.round(hhTotales * 10) / 10,
    hhCorrectivo: Math.round(hhCorrectivo * 10) / 10,
    hhPreventivo: Math.round(hhPreventivo * 10) / 10,
  };
}

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const turno  = searchParams.get("turno");
  const limit  = Math.min(Number(searchParams.get("limit") || "50"), 200);

  const filter: Record<string, unknown> = {};
  if (estado) filter.estado = estado;
  if (turno)  filter.turno = turno;

  const reportes = await ReporteTurno.find(filter)
    .sort({ fecha: -1 })
    .limit(limit)
    .lean();

  return Response.json(reportes.map((r) => ({ ...r, _id: String(r._id) })));
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const {
      turno, fecha, supervisorId, supervisorNombre,
      otIds, otsCriticas, otsPendientesSiguienteTurno,
      notasOTs, recomendaciones, otsPlanData,
    } = body;

    // Fetch real OTs (IDs sin prefijo "plan-")
    const realIds = (otIds ?? []).filter((id: string) => !id.startsWith("plan-"));
    const ordenes = realIds.length
      ? await OrdenTrabajo.find({ _id: { $in: realIds } }).lean() as Record<string, unknown>[]
      : [];

    // Resumen combinando OTs internas + plan
    const resumenBase = calcResumen(ordenes);
    const planHH = (otsPlanData ?? []).reduce((s: number, o: Record<string, unknown>) => s + (Number(o.hhTotal) || 0), 0);
    const resumenEjecutivo = {
      ...resumenBase,
      totalOTs: resumenBase.totalOTs + (otsPlanData?.length ?? 0),
      hhTotales: Math.round((resumenBase.hhTotales + planHH) * 10) / 10,
    };

    const reporte = new ReporteTurno({
      turno, fecha, supervisorId, supervisorNombre,
      otIds: otIds ?? [],
      otsCriticas: otsCriticas ?? [],
      otsPendientesSiguienteTurno: otsPendientesSiguienteTurno ?? [],
      notasOTs: notasOTs ?? [],
      otsPlanData: otsPlanData ?? [],
      recomendaciones: recomendaciones ?? [],
      resumenEjecutivo,
      estado: "borrador",
    });

    await reporte.save();
    const saved = reporte.toObject();
    return Response.json({ ok: true, reporte: { ...saved, _id: String(saved._id) } }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
