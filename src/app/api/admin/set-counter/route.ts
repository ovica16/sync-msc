import { prisma } from "@/lib/prisma";
export async function POST() {
  const c = await prisma.contador.upsert({
    where: { nombre: "calibracion-2026" },
    update: { valor: 277 },
    create: { nombre: "calibracion-2026", valor: 277 },
  });
  return Response.json({ ok: true, valor: c.valor, proximoCert: 278 });
}
