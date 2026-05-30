import { connectDB } from "@/lib/db";
import { Patron } from "@/lib/models/Patron";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  const p = await Patron.findById(id).lean();
  if (!p) return Response.json({ error: "No encontrado" }, { status: 404 });
  return Response.json({ ...p, _id: String(p._id) });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await connectDB();
    const body = await req.json();
    const patron = await Patron.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: true });
    if (!patron) return Response.json({ error: "No encontrado" }, { status: 404 });
    const saved = patron.toObject();
    return Response.json({ ok: true, patron: { ...saved, _id: String(saved._id) } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
