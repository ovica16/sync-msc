import { connectDB } from "@/lib/db";
import { Equipo } from "@/lib/models/Equipo";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  try {
    const body = await req.json();
    const equipo = await Equipo.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!equipo) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true, equipo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  await Equipo.findByIdAndUpdate(id, { activo: false });
  return Response.json({ ok: true });
}
