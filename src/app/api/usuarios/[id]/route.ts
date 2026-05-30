import { connectDB } from "@/lib/db";
import { Usuario } from "@/lib/models/Usuario";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  try {
    const body = await req.json();
    // Never allow password change via this route
    delete body.passwordHash;
    delete body.password;
    const user = await Usuario.findByIdAndUpdate(id, body, { new: true });
    if (!user) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  await Usuario.findByIdAndUpdate(id, { activo: false });
  return Response.json({ ok: true });
}
