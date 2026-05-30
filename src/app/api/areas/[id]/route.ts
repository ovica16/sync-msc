import { connectDB } from "@/lib/db";
import { Area } from "@/lib/models/Area";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  try {
    const body = await req.json();
    const area = await Area.findByIdAndUpdate(id, body, { new: true });
    if (!area) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true, area });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  await Area.findByIdAndUpdate(id, { activo: false });
  return Response.json({ ok: true });
}
