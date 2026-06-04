import { prisma } from "@/lib/prisma";

const NOMBRES = ["Balladares", "Torrico"];
const AREA_AGREGAR = "3351";

export async function GET() {
  const usuarios = await prisma.usuario.findMany({
    where: { OR: NOMBRES.map(n => ({ nombre: { contains: n, mode: "insensitive" as const } })) },
    include: { areas: true },
  });
  return Response.json(usuarios.map(u => ({
    id: u.id, nombre: u.nombre, rol: u.rol,
    areas: u.areas.map(a => a.areaCodigo),
    tieneArea3351: u.areas.some(a => a.areaCodigo === AREA_AGREGAR),
  })));
}

export async function POST() {
  const usuarios = await prisma.usuario.findMany({
    where: { OR: NOMBRES.map(n => ({ nombre: { contains: n, mode: "insensitive" as const } })) },
    include: { areas: true },
  });

  const results = await Promise.all(usuarios.map(async u => {
    const yasTiene = u.areas.some(a => a.areaCodigo === AREA_AGREGAR);
    if (yasTiene) return { id: u.id, nombre: u.nombre, accion: "sin_cambio" };

    const areasActuales = u.areas.map(a => a.areaCodigo);
    await prisma.usuario.update({
      where: { id: u.id },
      data: {
        areas: {
          deleteMany: {},
          create: [...areasActuales, AREA_AGREGAR].map(codigo => ({ areaCodigo: codigo })),
        },
      },
    });
    return { id: u.id, nombre: u.nombre, accion: "area_3351_agregada", areasNuevas: [...areasActuales, AREA_AGREGAR] };
  }));

  return Response.json({ ok: true, results });
}
