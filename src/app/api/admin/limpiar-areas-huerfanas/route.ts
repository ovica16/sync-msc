import { prisma } from "@/lib/prisma";

// Áreas creadas automáticamente por la importación masiva: superintendencia vacía
// GET: lista cuáles serían eliminadas
// POST: las elimina

export async function GET() {
  const candidatas = await prisma.area.findMany({
    where: { superintendencia: "" },
    include: { _count: { select: { equipos: true, usuarios: true } } },
    orderBy: { codigo: "asc" },
  });

  return Response.json({
    total: candidatas.length,
    areas: candidatas.map(a => ({
      codigo: a.codigo,
      nombre: a.nombre,
      equipos: a._count.equipos,
      usuarios: a._count.usuarios,
    })),
  });
}

export async function POST() {
  const candidatas = await prisma.area.findMany({
    where: { superintendencia: "" },
    include: { _count: { select: { equipos: true, usuarios: true } } },
  });

  const eliminadas: string[] = [];
  const omitidas: { codigo: string; motivo: string }[] = [];

  for (const a of candidatas) {
    if (a._count.equipos > 0 || a._count.usuarios > 0) {
      omitidas.push({ codigo: a.codigo, motivo: `tiene ${a._count.equipos} equipo(s) y ${a._count.usuarios} usuario(s)` });
      continue;
    }
    await prisma.area.delete({ where: { codigo: a.codigo } });
    eliminadas.push(a.codigo);
  }

  return Response.json({ ok: true, eliminadas, omitidas });
}
