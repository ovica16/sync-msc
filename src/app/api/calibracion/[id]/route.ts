import { connectDB } from "@/lib/db";
import { RegistroCalibracion } from "@/lib/models/RegistroCalibracion";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  const registro = await RegistroCalibracion.findById(id).lean();
  if (!registro) return Response.json({ error: "No encontrado" }, { status: 404 });
  return Response.json({ ...registro, _id: String(registro._id) });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await connectDB();
    const body: { stickerImpreso?: boolean; observaciones?: string } = await req.json();

    const update: Record<string, unknown> = {};
    if (typeof body.stickerImpreso === "boolean") update.stickerImpreso = body.stickerImpreso;
    if (typeof body.observaciones === "string") update.observaciones = body.observaciones;

    const registro = await RegistroCalibracion.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();

    if (!registro) return Response.json({ error: "No encontrado" }, { status: 404 });
    return Response.json({ ok: true, registro: { ...registro, _id: String(registro._id) } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
