import { connectDB } from "@/lib/db";
import { ArbolFallas } from "@/lib/models/ArbolFallas";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  try {
    const body = await req.json();
    if (body.tipoEquipo === "") body.tipoEquipo = null;
    const entry = await ArbolFallas.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true, entry });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  await ArbolFallas.findByIdAndDelete(id);
  return Response.json({ ok: true });
}
