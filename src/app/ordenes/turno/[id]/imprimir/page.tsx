import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { ReporteTurno } from "@/lib/models/ReporteTurno";
import { OrdenTrabajo } from "@/lib/models/OrdenTrabajo";
import { ProgramacionSemanal } from "@/lib/models/ProgramacionSemanal";
import PrintClient from "./PrintClient";

const JS_DIA = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"] as const;
const GRUPOS_DIURNO = ["G1", "G2", "G3", "G4", "Diurno"];
const GRUPOS_NOCTURNO = ["Nocturno"];

function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { semana: Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7), anio: d.getUTCFullYear() };
}

type Params = { params: Promise<{ id: string }> };

export default async function ImprimirReportePage({ params }: Params) {
  const { id } = await params;
  await connectDB();

  const reporte = await ReporteTurno.findById(id).lean();
  if (!reporte) notFound();

  // Fetch OTs internas
  const realIds = (reporte.otIds ?? []).filter((oid: string) => !oid.startsWith("plan-"));
  const ordenesDB = realIds.length
    ? await OrdenTrabajo.find({ _id: { $in: realIds } })
        .select("numeroOT lineas tecnicos estado turno")
        .lean()
    : [];

  // Unificar OTs para el PDF
  type OTDisplay = {
    id: string; numeroOT: string; tag: string; disciplina: string;
    tipoOT: string; descripcion: string; tecnicos: string[];
    hhTotal: number; estado: string; critica: boolean; pendiente: boolean;
    nota: string; heredada: boolean; pasarNocheMotivo?: string;
  };

  const criticas = new Set(reporte.otsCriticas ?? []);
  const pendientes = new Set(reporte.otsPendientesSiguienteTurno ?? []);
  const notasMap = new Map((reporte.notasOTs ?? []).map((n: { otId: string; nota: string }) => [n.otId, n.nota]));

  function areaToDisciplina(area: string) {
    if (area === "3320") return "INSTRUMENTACION";
    if (area === "3311" || area === "3319") return "ELECTRICO";
    return "MECANICO";
  }

  const otsInternas: OTDisplay[] = ordenesDB.map((o) => {
    const linea = (o.lineas as { tag: string; tipoOT: string; tiempoRealHrs?: number; sintoma?: string; descripcionEquipo?: string }[])[0] ?? {};
    return {
      id: String(o._id),
      numeroOT: String(o.numeroOT ?? ""),
      tag: linea.tag ?? "",
      disciplina: areaToDisciplina(String((o as { areaCodigo?: string }).areaCodigo ?? "")),
      tipoOT: linea.tipoOT ?? "",
      descripcion: linea.sintoma ?? linea.descripcionEquipo ?? "",
      tecnicos: ((o.tecnicos ?? []) as { nombreCompleto: string }[]).map(t => t.nombreCompleto),
      hhTotal: linea.tiempoRealHrs ?? 0,
      estado: String(o.estado ?? ""),
      critica: criticas.has(String(o._id)),
      pendiente: pendientes.has(String(o._id)),
      nota: String(notasMap.get(String(o._id)) ?? ""),
      heredada: false,
    };
  });

  type OTPlanRaw = {
    otId?: string; numeroOT: string; tag: string; disciplina?: string;
    tipoOT: string; descripcion: string; tecnicos?: string[];
    personalAsignado?: string[]; hhTotal?: number; hrsTrabajo?: number;
    estado: string; grupo?: string; dia?: string; pasarNoche?: boolean;
    heredada?: boolean; pasarNocheMotivo?: string;
  };

  // Datos del plan guardados en el reporte
  let otsPlanRaw: OTPlanRaw[] = (reporte.otsPlanData ?? []) as OTPlanRaw[];

  // Fallback para reportes antiguos: solo OTs del DÍA y TURNO del reporte que estén en otIds
  const planIds = (reporte.otIds ?? []).filter((id: string) => id.startsWith("plan-"));
  if (otsPlanRaw.length === 0 && planIds.length > 0 && reporte.fecha) {
    const fechaReporte = new Date(reporte.fecha as Date);
    const diaReporte = JS_DIA[fechaReporte.getUTCDay()]; // "Lu","Ma",...,"Do"
    const grupos = String(reporte.turno) === "Nocturno" ? GRUPOS_NOCTURNO : GRUPOS_DIURNO;
    const { semana, anio } = isoWeek(fechaReporte);
    const programas = await ProgramacionSemanal.find({ semana, anio }).lean();
    for (const prog of programas) {
      const disc = (prog as { disciplina?: string }).disciplina ?? "";
      for (const ot of (prog.otsProgramadas ?? []) as OTPlanRaw[]) {
        if (ot.dia !== diaReporte) continue;                    // solo el día del reporte
        if (!grupos.includes(ot.grupo ?? "")) continue;         // solo el turno correcto
        const fakeId = `plan-${disc}-${ot.numeroOT}`;
        if (!planIds.includes(fakeId)) continue;                // solo las seleccionadas
        otsPlanRaw.push({
          otId: fakeId, numeroOT: ot.numeroOT, tag: ot.tag ?? "",
          disciplina: disc, tipoOT: ot.tipoOT ?? "", descripcion: ot.descripcion ?? "",
          tecnicos: ot.personalAsignado ?? [], hhTotal: ot.hhTotal ?? 0,
          estado: ot.estado ?? "", heredada: false,
        });
      }
    }
  }

  const otsPlan: OTDisplay[] = otsPlanRaw.map((o) => ({
    id: o.otId ?? `plan-${o.numeroOT}`,
    numeroOT: o.numeroOT,
    tag: o.tag ?? "",
    disciplina: o.disciplina ?? "",
    tipoOT: o.tipoOT ?? "",
    descripcion: o.descripcion ?? "",
    tecnicos: o.tecnicos ?? [],
    hhTotal: o.hhTotal ?? 0,
    estado: o.estado ?? "",
    critica: criticas.has(o.otId ?? ""),
    pendiente: pendientes.has(o.otId ?? ""),
    nota: String(notasMap.get(o.otId ?? "") ?? ""),
    heredada: o.heredada ?? false,
    pasarNocheMotivo: o.pasarNocheMotivo,
  }));

  const todasOTs = [...otsInternas, ...otsPlan];

  // Mapeo disciplina código → nombre para mostrar
  const DISC_NOMBRE: Record<string, string> = {
    MEC: "MECÁNICO", MECANICO: "MECÁNICO",
    ELEC: "ELÉCTRICO", ELECTRICO: "ELÉCTRICO",
    INST: "INSTRUMENTACIÓN", INSTRUMENTACION: "INSTRUMENTACIÓN",
  };

  // Agrupar por código de disciplina normalizado
  const porDisciplina: Record<string, OTDisplay[]> = {};
  for (const ot of todasOTs) {
    const key = ot.disciplina.toUpperCase();
    if (!porDisciplina[key]) porDisciplina[key] = [];
    porDisciplina[key].push(ot);
  }

  const reporteData = {
    _id: String(reporte._id),
    turno: String(reporte.turno),
    fecha: reporte.fecha ? new Date(reporte.fecha as Date).toISOString() : "",
    supervisorNombre: String(reporte.supervisorNombre),
    estado: String(reporte.estado),
    resumenEjecutivo: reporte.resumenEjecutivo as {
      totalOTs: number; concluidas: number; pendientes: number;
      inconclusas: number; hhTotales: number; hhCorrectivo: number; hhPreventivo: number;
    },
    recomendaciones: (reporte.recomendaciones ?? []) as { prioridad: string; area?: string; tag?: string; descripcion: string }[],
  };

  return (
    <PrintClient
      reporte={reporteData}
      porDisciplina={porDisciplina}
      discNombre={DISC_NOMBRE}
      todasOTs={todasOTs}
    />
  );
}
