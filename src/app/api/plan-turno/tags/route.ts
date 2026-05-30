import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const equipos = await prisma.equipo.findMany({
      where: { activo: true },
      select: { tag: true },
      orderBy: { tag: "asc" },
    });
    return Response.json(equipos.map(e => e.tag));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
