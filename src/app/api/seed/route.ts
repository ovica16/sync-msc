import { prisma } from "@/lib/prisma";

const AREAS = [
  { codigo: "3311", nombre: "Eléctrico Planta",          superintendencia: "MANTENIMIENTO ELECTRICO",       tieneCalibracion: false },
  { codigo: "3319", nombre: "Eléctrico Mina",            superintendencia: "MANTENIMIENTO ELECTRICO",       tieneCalibracion: false },
  { codigo: "3320", nombre: "Instrumentación y Control", superintendencia: "MANTENIMIENTO INSTRUMENTACION", tieneCalibracion: true  },
  { codigo: "3330", nombre: "Mecánico Planta",           superintendencia: "MANTENIMIENTO MECANICO",        tieneCalibracion: false },
  { codigo: "3340", nombre: "Mecánico Mina",             superintendencia: "MANTENIMIENTO MECANICO",        tieneCalibracion: false },
];

export async function POST() {
  try {
    const creadas: string[] = [];
    const omitidas: string[] = [];

    for (const a of AREAS) {
      const existe = await prisma.area.findUnique({ where: { codigo: a.codigo } });
      if (existe) { omitidas.push(a.codigo); continue; }
      await prisma.area.create({ data: { ...a, activo: true } });
      creadas.push(a.codigo);
    }

    return Response.json({ ok: true, creadas, omitidas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  const areas = await prisma.area.findMany({ orderBy: { codigo: "asc" } });
  return Response.json({ ok: true, total: areas.length, areas });
}
