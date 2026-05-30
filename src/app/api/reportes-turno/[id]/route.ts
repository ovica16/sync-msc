import { connectDB } from "@/lib/db";
import { ReporteTurno } from "@/lib/models/ReporteTurno";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  const r = await ReporteTurno.findById(id).lean();
  if (!r) return Response.json({ error: "No encontrado" }, { status: 404 });
  return Response.json({ ...r, _id: String(r._id) });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await connectDB();
    const r = await ReporteTurno.findByIdAndDelete(id);
    if (!r) return Response.json({ ok: false, error: "No encontrado" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await connectDB();
    const body = await req.json();
    const { estado, recomendaciones } = body;

    const r = await ReporteTurno.findById(id);
    if (!r) return Response.json({ error: "No encontrado" }, { status: 404 });

    if (estado) r.estado = estado;
    if (recomendaciones) { r.recomendaciones = recomendaciones; r.markModified("recomendaciones"); }

    await r.save();
    const saved = r.toObject();
    return Response.json({ ok: true, reporte: { ...saved, _id: String(saved._id) } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
