import { connectDB } from "@/lib/db";
import { Area } from "@/lib/models/Area";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

  const filter = all ? {} : { activo: true };
  const areas = await Area.find(filter)
    .sort({ codigo: 1 })
    .select("_id codigo nombre superintendencia tieneCalibracion activo")
    .lean();
  return Response.json(areas);
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const area = new Area({ ...body, activo: true });
    await area.save();
    return Response.json({ ok: true, area }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
