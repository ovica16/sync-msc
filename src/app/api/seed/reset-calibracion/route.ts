import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// Endpoint temporal para borrar todos los registros de calibración
// DELETE /api/seed/reset-calibracion?secret=msc2026reset
export async function DELETE(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "msc2026reset") {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const result = await prisma.registroCalibracion.deleteMany({});
  return Response.json({ ok: true, borrados: result.count });
}
