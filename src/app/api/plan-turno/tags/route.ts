import { connectDB } from "@/lib/db";
import { Equipo } from "@/lib/models/Equipo";

export async function GET() {
  try {
    await connectDB();

    // Todos los TAGs del catálogo de equipos registrados en el sistema
    const equipos = await Equipo.find({ activo: { $ne: false } })
      .select("tag descripcion")
      .sort({ tag: 1 })
      .lean();

    const tags = equipos
      .map((e: { tag?: string }) => e.tag?.trim().toUpperCase())
      .filter(Boolean) as string[];

    return Response.json(tags);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
