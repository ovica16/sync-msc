import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Equipo } from "@/lib/models/Equipo";

export async function GET(req: NextRequest) {
  await connectDB();
  const tags = req.nextUrl.searchParams.get("tags");

  // Modo lookup: ?tags=TAG1,TAG2,TAG3
  if (tags) {
    const lista = tags.split(",").map(t => t.trim().toUpperCase());
    const docs = await Equipo.find({ tag: { $in: lista } })
      .select("tag descripcion descripcion2 descripcion3 tipoEquipo descripcionTipo nivel categoriaISO")
      .lean();
    return Response.json(docs);
  }

  const [conCat, sinCat, muestra, distribucion] = await Promise.all([
    Equipo.countDocuments({ categoriaISO: { $ne: null } }),
    Equipo.countDocuments({ $or: [{ categoriaISO: null }, { categoriaISO: { $exists: false } }] }),
    Equipo.find({ $or: [{ categoriaISO: null }, { categoriaISO: { $exists: false } }] })
      .select("tag descripcion descripcion2 tipoEquipo nivel")
      .limit(30)
      .lean(),
    Equipo.aggregate([
      { $group: { _id: "$categoriaISO", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  return Response.json({ conCat, sinCat, distribucion, muestra });
}
