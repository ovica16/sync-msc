import { connectDB } from "@/lib/db";
import { ProgramacionSemanal } from "@/lib/models/ProgramacionSemanal";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  const programa = await ProgramacionSemanal.findById(id).lean();
  if (!programa) return Response.json({ ok: false, error: "No encontrado" }, { status: 404 });
  return Response.json({ ...programa, _id: String(programa._id) });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await connectDB();
    const body = await req.json();
    const update: Record<string, unknown> = { ...body };

    const programa = await ProgramacionSemanal.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!programa) return Response.json({ ok: false, error: "No encontrado" }, { status: 404 });
    return Response.json({ ok: true, programa: { ...programa, _id: String(programa._id) } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

// Actualizar estado de una OT específica dentro de la programación
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await connectDB();
    const body = await req.json();
    const { numeroOT, dia, grupo, estado, observaciones, pasarNoche, pasarNocheMotivo, pasarNocheNota, pasarNochePor, bitacoraEntry } = body;

    if (!numeroOT || !dia) {
      return Response.json({ ok: false, error: "numeroOT y dia son requeridos" }, { status: 400 });
    }

    // Agregar entrada a la bitácora de turnero — filtra por grupo para separar Diurno/Nocturno
    if (bitacoraEntry) {
      const arrayFilter = grupo
        ? { "ot.numeroOT": numeroOT, "ot.dia": dia, "ot.grupo": grupo }
        : { "ot.numeroOT": numeroOT, "ot.dia": dia };

      const programa = await ProgramacionSemanal.findOneAndUpdate(
        { _id: id, "otsProgramadas.numeroOT": numeroOT, "otsProgramadas.dia": dia },
        {
          $push: { "otsProgramadas.$[ot].bitacora": { ...bitacoraEntry, fecha: new Date() } },
          $set:  { "otsProgramadas.$[ot].esGuardia": true, "otsProgramadas.$[ot].estado": "en_proceso" },
        },
        { arrayFilters: [arrayFilter], new: true }
      ).lean();
      if (!programa) return Response.json({ ok: false, error: "OT no encontrada" }, { status: 404 });
      return Response.json({ ok: true, programa: { ...programa, _id: String(programa._id) } });
    }

    const setFields: Record<string, unknown> = {};
    if (estado !== undefined) setFields["otsProgramadas.$[ot].estado"] = estado;
    if (observaciones !== undefined) setFields["otsProgramadas.$[ot].observaciones"] = observaciones;
    if (pasarNoche !== undefined) {
      setFields["otsProgramadas.$[ot].pasarNoche"] = pasarNoche;
      setFields["otsProgramadas.$[ot].pasarNocheMotivo"] = pasarNocheMotivo ?? "";
      setFields["otsProgramadas.$[ot].pasarNocheNota"] = pasarNocheNota ?? "";
      setFields["otsProgramadas.$[ot].pasarNochePor"] = pasarNochePor ?? "";
      setFields["otsProgramadas.$[ot].pasarNocheAt"] = pasarNoche ? new Date() : null;
    }

    const programa = await ProgramacionSemanal.findOneAndUpdate(
      { _id: id, "otsProgramadas.numeroOT": numeroOT, "otsProgramadas.dia": dia },
      { $set: setFields },
      {
        arrayFilters: [{ "ot.numeroOT": numeroOT, "ot.dia": dia }],
        new: true,
        runValidators: true,
      }
    ).lean();

    if (!programa) return Response.json({ ok: false, error: "OT no encontrada" }, { status: 404 });
    return Response.json({ ok: true, programa: { ...programa, _id: String(programa._id) } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
