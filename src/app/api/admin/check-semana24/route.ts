import { prisma } from "@/lib/prisma";

export async function GET() {
  const planes = await prisma.programacionSemanal.findMany({
    where: { semana: 24, anio: 2026 },
    orderBy: { createdAt: "asc" },
  });

  const codigosPlanes = [...new Set(planes.map(p => p.areaCodigo).filter(Boolean))] as string[];

  const areasExistentes = await prisma.area.findMany({
    where: { codigo: { in: codigosPlanes } },
    select: { codigo: true, nombre: true, superintendencia: true },
  });

  const setExistentes = new Set(areasExistentes.map(a => a.codigo));

  const resumen = codigosPlanes.map(codigo => ({
    areaCodigo: codigo,
    existe: setExistentes.has(codigo),
    planesCount: planes.filter(p => p.areaCodigo === codigo).length,
    area: areasExistentes.find(a => a.codigo === codigo) ?? null,
  }));

  const planesSinArea = planes.filter(p => !p.areaCodigo).map(p => ({
    id: p.id,
    disciplina: p.disciplina,
    areaCodigo: p.areaCodigo,
    otsProgramadas: (p.otsProgramadas as {numeroOT?: string}[]).length,
  }));

  return Response.json({
    semana: 24,
    anio: 2026,
    totalPlanes: planes.length,
    codigosUnicos: codigosPlanes.length,
    planesSinArea,
    sinArea: resumen.filter(r => !r.existe),
    conArea: resumen.filter(r => r.existe),
  });
}

export async function POST() {
  const planes = await prisma.programacionSemanal.findMany({
    where: { semana: 24, anio: 2026 },
  });

  const codigosPlanes = [...new Set(planes.map(p => p.areaCodigo).filter(Boolean))] as string[];
  const areasExistentes = await prisma.area.findMany({
    where: { codigo: { in: codigosPlanes } },
    select: { codigo: true },
  });
  const setExistentes = new Set(areasExistentes.map(a => a.codigo));
  const faltantes = codigosPlanes.filter(c => !setExistentes.has(c));

  const creadas: string[] = [];
  for (const codigo of faltantes) {
    await prisma.area.create({
      data: { codigo, nombre: codigo, superintendencia: "" },
    });
    creadas.push(codigo);
  }

  return Response.json({ ok: true, faltantes, creadas });
}
