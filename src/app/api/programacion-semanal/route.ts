import { connectDB } from "@/lib/db";
import { ProgramacionSemanal } from "@/lib/models/ProgramacionSemanal";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const semana     = searchParams.get("semana");
  const anio       = searchParams.get("anio");
  const disciplina = searchParams.get("disciplina");
  const estado     = searchParams.get("estado");
  const limit      = Math.min(Number(searchParams.get("limit") || "20"), 100);

  const areaCodigo = searchParams.get("areaCodigo");

  const filter: Record<string, unknown> = {};
  if (semana)     filter.semana = Number(semana);
  if (anio)       filter.anio = Number(anio);
  if (disciplina) filter.disciplina = disciplina;
  if (areaCodigo) filter.areaCodigo = areaCodigo;
  if (estado)     filter.estado = estado;

  const programas = await ProgramacionSemanal.find(filter)
    .sort({ anio: -1, semana: -1 })
    .limit(limit)
    .lean();

  return Response.json(programas.map((p) => ({ ...p, _id: String(p._id) })));
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const {
      semana, anio, disciplina, areaCodigo,
      fechaInicio, fechaFin,
      personal, otsProgramadas,
      subidoPor,
    } = body;

    // Calcular métricas agregadas
    let hhDisponiblesSemana = 0;
    let hhProgramadasSemana = 0;
    let hhReactivoSemana = 0;

    const diasKeys = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] as const;
    const resumenDias = diasKeys.map((dia, i) => {
      const fechaDia = new Date(fechaInicio);
      fechaDia.setDate(fechaDia.getDate() + i);

      const otsDelDia = (otsProgramadas ?? []).filter(
        (o: { dia: string; hhTotal: number; tipoOT: string }) => o.dia === dia
      );
      const hhProg = otsDelDia.reduce(
        (s: number, o: { hhTotal: number }) => s + (o.hhTotal ?? 0), 0
      );
      const hhReact = otsDelDia
        .filter((o: { tipoOT: string }) => o.tipoOT === "C")
        .reduce((s: number, o: { hhTotal: number }) => s + (o.hhTotal ?? 0), 0);

      // HH disponibles: personal activo (D o N) × 10 hrs
      const activos = (personal ?? []).filter((p: { asistencia: { dia: string; estado: string }[] }) =>
        p.asistencia?.find(
          (a: { dia: string; estado: string }) => a.dia === dia && (a.estado === "D" || a.estado === "N" || a.estado === "T")
        )
      ).length;
      const hhDisp = activos * 10;

      hhDisponiblesSemana += hhDisp;
      hhProgramadasSemana += hhProg;
      hhReactivoSemana += hhReact;

      return {
        dia,
        fecha: fechaDia,
        hhDisponibles: hhDisp,
        hhProgramadas: hhProg,
        utilizacion: hhDisp > 0 ? Math.round((hhProg / hhDisp) * 100) : 0,
      };
    });

    const programa = new ProgramacionSemanal({
      semana, anio, disciplina, areaCodigo,
      fechaInicio, fechaFin,
      personal: personal ?? [],
      otsProgramadas: otsProgramadas ?? [],
      resumenDias,
      hhDisponiblesSemana,
      hhProgramadasSemana,
      hhReactivoSemana,
      estado: "borrador",
      subidoPor,
    });

    await programa.save();
    const saved = programa.toObject();
    return Response.json(
      { ok: true, programa: { ...saved, _id: String(saved._id) } },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
