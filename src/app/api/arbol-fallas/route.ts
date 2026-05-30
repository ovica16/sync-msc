import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tipoEquipo = searchParams.get("tipoEquipo");
  const sintoma    = searchParams.get("sintoma");
  const codigoModo = searchParams.get("codigoModo");
  const admin      = searchParams.get("admin") === "true";

  if (admin) {
    const entries = await prisma.arbolFallas.findMany({
      orderBy: [{ tipoEquipo: "asc" }, { sintoma: "asc" }],
    });
    return Response.json(entries.map(e => ({ ...e, _id: e.id })));
  }

  const entries = await prisma.arbolFallas.findMany({
    where: {
      activo: true,
      ...(tipoEquipo ? { OR: [{ tipoEquipo }, { tipoEquipo: null }] } : {}),
      ...(sintoma    ? { sintoma } : {}),
      ...(codigoModo ? { codigoModo } : {}),
    },
  });

  if (!sintoma && !codigoModo) {
    const seen = new Set<string>();
    const modos = entries
      .filter((e) => { const k = e.codigoModo || e.sintoma; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((e) => ({ codigoModo: e.codigoModo, sintoma: e.sintoma }))
      .sort((a, b) => (a.sintoma || "").localeCompare(b.sintoma || ""));
    return Response.json(modos);
  }

  return Response.json(entries);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = await prisma.arbolFallas.create({
      data: {
        tipoEquipo: body.tipoEquipo || null,
        sintoma: body.sintoma,
        codigoModo: body.codigoModo || null,
        causaProbable: body.causaProbable,
        codigoCausa: body.codigoCausa || null,
        resolucionSugerida: body.resolucionSugerida ?? "",
        tiempoEstimadoHrs: body.tiempoEstimadoHrs ?? 0,
        creadoPor: body.creadoPor ?? "admin",
      },
    });
    return Response.json({ ok: true, entry }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
