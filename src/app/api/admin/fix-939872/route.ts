import { prisma } from "@/lib/prisma";
export async function POST() {
  const r = await prisma.otProgramada.updateMany({
    where: { numeroOT: "939872", dia: { in: ["Ma", "Mi"] } },
    data: { estado: "en_proceso" },
  });
  return Response.json({ ok: true, updated: r.count });
}
