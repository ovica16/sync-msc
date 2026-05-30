import { connectDB } from "@/lib/db";
import { Patron } from "@/lib/models/Patron";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  await connectDB();
  const all = new URL(req.url).searchParams.get("all");
  const filter = all ? {} : { activo: true };
  const patrones = await Patron.find(filter).sort({ codigo: 1 }).lean();
  return Response.json(patrones.map((p) => ({ ...p, _id: String(p._id) })));
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const patron = new Patron(body);
    await patron.save();
    const saved = patron.toObject();
    return Response.json({ ok: true, patron: { ...saved, _id: String(saved._id) } }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
