import { connectDB } from "@/lib/db";
import { ArbolFallas } from "@/lib/models/ArbolFallas";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const tipoEquipo = searchParams.get("tipoEquipo");
  const sintoma = searchParams.get("sintoma");
  const admin = searchParams.get("admin") === "true";

  // Admin/config mode: return all entries as full objects
  if (admin) {
    const entries = await ArbolFallas.find({})
      .select("_id tipoEquipo sintoma codigoModo causaProbable codigoCausa resolucionSugerida tiempoEstimadoHrs activo")
      .sort({ tipoEquipo: 1, sintoma: 1 })
      .lean();
    return Response.json(entries);
  }

  const codigoModo = searchParams.get("codigoModo");
  const filter: Record<string, unknown> = { activo: true };

  if (tipoEquipo) {
    filter.$or = [{ tipoEquipo }, { tipoEquipo: null }];
  }
  if (sintoma) filter.sintoma = sintoma;
  if (codigoModo) filter.codigoModo = codigoModo;

  const entries = await ArbolFallas.find(filter)
    .select("tipoEquipo sintoma codigoModo causaProbable codigoCausa resolucionSugerida tiempoEstimadoHrs")
    .lean();

  // Sin filtros de detalle: devuelve lista de modos únicos (código + sintoma)
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
    await connectDB();
    const body = await req.json();
    if (body.tipoEquipo === "" || body.tipoEquipo === undefined) body.tipoEquipo = null;
    const entry = new ArbolFallas({ ...body, creadoPor: body.creadoPor ?? "admin" });
    await entry.save();
    return Response.json({ ok: true, entry }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
