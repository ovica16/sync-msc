import { connectDB } from "@/lib/db";
import { ProgramacionSemanal } from "@/lib/models/ProgramacionSemanal";
import { NextRequest } from "next/server";

// Mapeo día JS (0=Dom) → abreviatura del plan
const JS_DIA = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"] as const;

// Grupos que corresponden a cada turno
const GRUPOS_DIURNO  = ["G1", "G2", "G3", "G4", "Diurno"];
const GRUPOS_NOCTURNO = ["Nocturno"];

function isoWeek(date: Date): { semana: number; anio: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { semana, anio: d.getUTCFullYear() };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fecha = searchParams.get("fecha");   // "2026-05-28"
    const turno = searchParams.get("turno");   // "Diurno" | "Nocturno"

    if (!fecha || !turno) {
      return Response.json({ error: "fecha y turno requeridos" }, { status: 400 });
    }

    await connectDB();

    const date = new Date(fecha + "T12:00:00Z"); // Noon UTC para evitar offset
    const dia  = JS_DIA[date.getUTCDay()];
    const { semana, anio } = isoWeek(date);

    const grupos = turno === "Nocturno" ? GRUPOS_NOCTURNO : GRUPOS_DIURNO;

    // Traer todas las disciplinas de esa semana
    const programas = await ProgramacionSemanal.find({ semana, anio }).lean();

    type OTProg = {
      numeroOT: string; tipoOT: string; tag: string; descripcionEquipo?: string;
      descripcion: string; personas: number; hrsTrabajo: number; hhTotal: number;
      personalAsignado: string[]; grupo: string; dia: string; estado: string;
      ordenTrabajoId?: string; ordenTrabajoNum?: string;
      pasarNoche?: boolean; pasarNocheMotivo?: string; pasarNocheNota?: string; pasarNochePor?: string;
    };

    const otsResult = [];

    function buildOTItem(prog: typeof programas[0], ot: OTProg, override?: { turno?: string; heredada?: boolean }) {
      return {
        _id: `plan-${prog.disciplina}-${ot.numeroOT}`,
        numeroOT: ot.numeroOT,
        fecha,
        turno: override?.turno ?? turno,
        areaCodigo: prog.areaCodigo ?? "",
        disciplina: prog.disciplina,
        grupo: ot.grupo,
        tecnicos: (ot.personalAsignado ?? []).map((n: string) => ({ nombreCompleto: n })),
        lineas: [{ tag: ot.tag, tipoOT: ot.tipoOT, tiempoRealHrs: ot.hrsTrabajo, descripcionEquipo: ot.descripcionEquipo ?? "", sintoma: ot.descripcion ?? "", resolucionAplicada: "" }],
        estado: ot.estado,
        fromPlan: true,
        heredada: override?.heredada ?? false,
        pasarNocheMotivo: ot.pasarNocheMotivo ?? "",
        pasarNocheNota: ot.pasarNocheNota ?? "",
        pasarNochePor: ot.pasarNochePor ?? "",
        descripcion: ot.descripcion,
        personas: ot.personas,
        hrsTrabajo: ot.hrsTrabajo,
        hhTotal: ot.hhTotal,
        tipoOT: ot.tipoOT,
        ordenTrabajoId: ot.ordenTrabajoId ?? null,
        ordenTrabajoNum: ot.ordenTrabajoNum ?? null,
      };
    }

    for (const prog of programas) {
      const otsPrograma = prog.otsProgramadas as OTProg[];

      // OTs del turno actual para el día
      const otsPropias = otsPrograma.filter(
        (ot) => ot.dia === dia && grupos.includes(ot.grupo)
      );
      for (const ot of otsPropias) {
        otsResult.push(buildOTItem(prog, ot));
      }

      // Si es turno Nocturno: incluir también OTs marcadas como "pasar a noche" del mismo día
      if (turno === "Nocturno") {
        const otsHeredadas = otsPrograma.filter(
          (ot) => ot.dia === dia && ot.pasarNoche === true && GRUPOS_DIURNO.includes(ot.grupo)
          && !otsPropias.some(p => p.numeroOT === ot.numeroOT) // no duplicar
        );
        for (const ot of otsHeredadas) {
          otsResult.push(buildOTItem(prog, ot, { turno: "Nocturno", heredada: true }));
        }
      }
    }

    // Ordenar por disciplina, luego grupo, luego numeroOT
    otsResult.sort((a, b) => {
      if (a.disciplina !== b.disciplina) return a.disciplina.localeCompare(b.disciplina);
      if (a.grupo !== b.grupo) return a.grupo.localeCompare(b.grupo);
      return a.numeroOT.localeCompare(b.numeroOT);
    });

    return Response.json(otsResult);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return Response.json({ error: msg }, { status: 500 });
  }
}
