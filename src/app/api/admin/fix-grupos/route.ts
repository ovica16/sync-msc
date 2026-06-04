import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const DIURNO  = ["Cordova Ramos Felix", "José Quispe"];
const NOCTURNO = ["Valencia Camata Edgar", "Taquichiri Mamani Sabino"];

// GET: preview de las correcciones que se van a aplicar
export async function GET(_req: NextRequest) {
  const plan = await prisma.programacionSemanal.findFirst({
    where: { semana: 23, anio: 2026 },
    include: {
      otsProgramadas: {
        where: { numeroOT: "892867" },
        orderBy: [{ dia: "asc" }, { grupo: "asc" }],
        select: { id: true, dia: true, grupo: true, personalAsignado: true },
      },
    },
  });
  if (!plan) return Response.json({ error: "Plan semana 23/2026 no encontrado" });

  const corrections = plan.otsProgramadas
    .filter(o => ["Ju", "Sa", "Do"].includes(o.dia))
    .map(o => {
      const expected = o.grupo === "Diurno" ? DIURNO : NOCTURNO;
      const needsFix = JSON.stringify(o.personalAsignado.sort()) !== JSON.stringify([...expected].sort());
      return { id: o.id, dia: o.dia, grupo: o.grupo, actual: o.personalAsignado, correcto: expected, needsFix };
    });

  return Response.json({ planId: plan.id, corrections });
}

// POST: aplica las correcciones
export async function POST(_req: NextRequest) {
  const plan = await prisma.programacionSemanal.findFirst({
    where: { semana: 23, anio: 2026 },
    include: {
      otsProgramadas: {
        where: { numeroOT: "892867", dia: { in: ["Ju", "Sa", "Do"] } },
        select: { id: true, dia: true, grupo: true },
      },
    },
  });
  if (!plan) return Response.json({ ok: false, error: "Plan no encontrado" }, { status: 404 });

  const results = await Promise.all(
    plan.otsProgramadas.map(o =>
      prisma.otProgramada.update({
        where: { id: o.id },
        data: { personalAsignado: o.grupo === "Diurno" ? DIURNO : NOCTURNO },
        select: { id: true, dia: true, grupo: true, personalAsignado: true },
      })
    )
  );

  return Response.json({ ok: true, updated: results });
}
