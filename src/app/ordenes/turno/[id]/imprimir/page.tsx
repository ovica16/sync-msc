import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintClient from "./PrintClient";

const GRUPOS_DIURNO  = ["G1", "G2", "G3", "G4", "Diurno"];
const GRUPOS_NOCTURNO = ["Nocturno"];

type Params = { params: Promise<{ id: string }> };

type OTDisplay = {
  id: string; numeroOT: string; tag: string; disciplina: string;
  tipoOT: string; descripcion: string; tecnicos: string[];
  hhTotal: number; estado: string; critica: boolean; pendiente: boolean;
  nota: string; heredada: boolean; pasarNocheMotivo?: string;
};

type OTPlanRaw = {
  otId?: string; numeroOT: string; tag: string; disciplina?: string;
  tipoOT: string; descripcion: string; tecnicos?: string[];
  hhTotal?: number; estado: string; grupo?: string; dia?: string;
  heredada?: boolean; pasarNocheMotivo?: string;
};

function areaToDisciplina(area: string) {
  if (area === "3320") return "INSTRUMENTACION";
  if (area === "3311" || area === "3319") return "ELECTRICO";
  return "MECANICO";
}

export default async function ImprimirReportePage({ params }: Params) {
  const { id } = await params;
  const reporte = await prisma.reporteTurno.findUnique({ where: { id } });
  if (!reporte) notFound();

  const criticas  = new Set(reporte.otsCriticas ?? []);
  const pendientes = new Set(reporte.otsPendientesSiguienteTurno ?? []);
  const notasArr  = (reporte.notasOTs ?? []) as { otId: string; nota: string }[];
  const notasMap  = new Map(notasArr.map(n => [n.otId, n.nota]));

  // Fetch OTs internas desde PostgreSQL
  const realIds = (reporte.otIds ?? []).filter((oid: string) => !oid.startsWith("plan-"));
  const ordenesDB = realIds.length
    ? await prisma.ordenTrabajo.findMany({
        where: { id: { in: realIds } },
        include: { lineas: true, tecnicos: true },
      })
    : [];

  const otsInternas: OTDisplay[] = ordenesDB.map((o) => {
    const linea = o.lineas[0];
    return {
      id: o.id,
      numeroOT: o.numeroOT,
      tag: linea?.tag ?? "",
      disciplina: areaToDisciplina(o.areaCodigo),
      tipoOT: linea?.tipoOT ?? "",
      descripcion: linea?.sintoma ?? linea?.descripcionEquipo ?? "",
      tecnicos: o.tecnicos.map(t => t.nombreCompleto),
      hhTotal: linea?.tiempoRealHrs ?? 0,
      estado: o.estado,
      critica: criticas.has(o.id),
      pendiente: pendientes.has(o.id),
      nota: notasMap.get(o.id) ?? "",
      heredada: false,
    };
  });

  // OTs del plan guardadas inline en el reporte
  const otsPlanRaw: OTPlanRaw[] = (reporte.otsPlanData ?? []) as OTPlanRaw[];
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
    critica:  criticas.has(o.otId  ?? ""),
    pendiente: pendientes.has(o.otId ?? ""),
    nota: notasMap.get(o.otId ?? "") ?? "",
    heredada: o.heredada ?? false,
    pasarNocheMotivo: o.pasarNocheMotivo,
  }));

  // Fallback: si no hay otsPlanData buscar en la programación semanal
  if (otsPlanRaw.length === 0 && reporte.fecha) {
    const planIds = (reporte.otIds ?? []).filter((oid: string) => oid.startsWith("plan-"));
    if (planIds.length > 0) {
      const fechaReporte = new Date(reporte.fecha);
      const JS_DIA = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"] as const;
      const diaReporte = JS_DIA[fechaReporte.getUTCDay()];
      const grupos = reporte.turno === "Nocturno" ? GRUPOS_NOCTURNO : GRUPOS_DIURNO;
      const d = new Date(Date.UTC(fechaReporte.getFullYear(), fechaReporte.getMonth(), fechaReporte.getDate()));
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      const anio = d.getUTCFullYear();

      const programas = await prisma.programacionSemanal.findMany({
        where: { semana, anio },
        include: { otsProgramadas: true },
      });
      for (const prog of programas) {
        for (const ot of prog.otsProgramadas) {
          if (ot.dia !== diaReporte) continue;
          if (!grupos.includes(ot.grupo)) continue;
          const fakeId = `plan-${prog.disciplina}-${ot.numeroOT}`;
          if (!planIds.includes(fakeId)) continue;
          otsPlan.push({
            id: fakeId, numeroOT: ot.numeroOT, tag: ot.tag ?? "",
            disciplina: prog.disciplina, tipoOT: ot.tipoOT ?? "",
            descripcion: ot.descripcion ?? "", tecnicos: ot.personalAsignado ?? [],
            hhTotal: ot.hhTotal ?? 0, estado: ot.estado ?? "",
            critica: criticas.has(fakeId), pendiente: pendientes.has(fakeId),
            nota: notasMap.get(fakeId) ?? "", heredada: false,
          });
        }
      }
    }
  }

  const todasOTs = [...otsInternas, ...otsPlan];

  const DISC_NOMBRE: Record<string, string> = {
    MEC: "MECÁNICO", MECANICO: "MECÁNICO",
    ELEC: "ELÉCTRICO", ELECTRICO: "ELÉCTRICO",
    INST: "INSTRUMENTACIÓN", INSTRUMENTACION: "INSTRUMENTACIÓN",
  };

  const porDisciplina: Record<string, OTDisplay[]> = {};
  for (const ot of todasOTs) {
    const key = ot.disciplina.toUpperCase();
    if (!porDisciplina[key]) porDisciplina[key] = [];
    porDisciplina[key].push(ot);
  }

  const reporteData = {
    _id: reporte.id,
    turno: reporte.turno,
    fecha: reporte.fecha ? new Date(reporte.fecha).toISOString() : "",
    supervisorNombre: reporte.supervisorNombre,
    estado: reporte.estado,
    resumenEjecutivo: reporte.resumenEjecutivo as {
      totalOTs: number; concluidas: number; pendientes: number;
      inconclusas: number; hhTotales: number; hhCorrectivo: number; hhPreventivo: number;
    },
    recomendaciones: (reporte.recomendaciones ?? []) as {
      prioridad: string; area?: string; tag?: string; descripcion: string;
    }[],
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
