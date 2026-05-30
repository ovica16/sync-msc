import { connectDB } from "@/lib/db";
import { RegistroCalibracion } from "@/lib/models/RegistroCalibracion";
import { Contador } from "@/lib/models/Contador";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag");
  const resultado = searchParams.get("resultado");
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);

  const filter: Record<string, unknown> = {};
  if (tag) filter.tag = { $regex: tag, $options: "i" };
  if (resultado) filter.resultadoGeneral = resultado;

  const registros = await RegistroCalibracion.find(filter)
    .sort({ fecha: -1 })
    .limit(limit)
    .lean();

  return Response.json(registros.map((r) => ({ ...r, _id: String(r._id) })));
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    const yy = String(new Date().getFullYear()).slice(-2);
    const counter = await Contador.findOneAndUpdate(
      { _id: "calibracion" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const seq = String(counter.seq).padStart(4, "0");
    const numeroCertificado = `INS-CAL-${yy}-${seq}`;

    const registro = new RegistroCalibracion({
      ...body,
      numeroCertificado,
      areaCodigo: "3320",
    });

    await registro.save();
    const saved = registro.toObject();
    return Response.json(
      { ok: true, registro: { ...saved, _id: String(saved._id) } },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
