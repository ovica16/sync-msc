import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// Endpoint temporal de limpieza — ELIMINAR DESPUÉS DE USAR
export async function POST(req: NextRequest) {
  const { secret } = await req.json();
  if (secret !== "msc-reset-2026") {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }
  const historial = await prisma.otHistorial.deleteMany({});
  const tecnicos  = await prisma.otTecnico.deleteMany({});
  const lineas    = await prisma.otLinea.deleteMany({});
  const diarios   = await prisma.otRegistroDiario.deleteMany({});
  const ots       = await prisma.ordenTrabajo.deleteMany({});
  return Response.json({ ok: true, eliminados: { ots: ots.count, lineas: lineas.count, tecnicos: tecnicos.count, historial: historial.count, diarios: diarios.count } });
}
