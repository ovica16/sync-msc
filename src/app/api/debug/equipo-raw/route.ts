import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Equipo } from "@/lib/models/Equipo";

const SELECT = "_id tag descripcion tipoEquipo descripcionTipo categoriaISO nivel";

export async function GET(req: NextRequest) {
  await connectDB();
  const tag = req.nextUrl.searchParams.get("tag") ?? "";
  const q   = req.nextUrl.searchParams.get("q") ?? "";

  const filter: Record<string, unknown> = {};
  if (tag) filter.tag = tag.toUpperCase();
  else if (q) filter.$or = [
    { tag: { $regex: q.toUpperCase() } },
    { descripcion: { $regex: q, $options: "i" } },
  ];

  const docs = await Equipo.find(filter).select(SELECT).limit(5).lean();
  return Response.json(docs);
}
