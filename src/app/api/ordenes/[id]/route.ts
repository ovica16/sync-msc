import { connectDB } from "@/lib/db";
import { OrdenTrabajo } from "@/lib/models/OrdenTrabajo";
import { ProgramacionSemanal } from "@/lib/models/ProgramacionSemanal";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

function serialize(ot: Record<string, unknown>) {
  return { ...ot, _id: String(ot._id) };
}

// Mapeo de estado OT interna → estado en el plan semanal
function mapEstadoAlPlan(estado: string): string {
  switch (estado) {
    case "borrador":             return "en_proceso";
    case "pendiente_revision":   return "completada";
    case "solicitar_correccion": return "en_revision";
    case "revisado":             return "completada";
    case "concluido":            return "completada";
    default:                     return "en_proceso";
  }
}

// Propagar cambio de estado al plan semanal vinculado
async function propagarAlPlan(
  programacionSemanalId: string,
  otJdeNumero: string,
  otJdeDia: string | undefined,
  estadoOT: string
) {
  const estadoPlan = mapEstadoAlPlan(estadoOT);
  const filter: Record<string, unknown> = {
    _id: programacionSemanalId,
    "otsProgramadas.numeroOT": otJdeNumero,
  };
  if (otJdeDia) filter["otsProgramadas.dia"] = otJdeDia;

  const arrayFilter = otJdeDia
    ? [{ "ot.numeroOT": otJdeNumero, "ot.dia": otJdeDia }]
    : [{ "ot.numeroOT": otJdeNumero }];

  await ProgramacionSemanal.findOneAndUpdate(
    filter,
    { $set: { "otsProgramadas.$[ot].estado": estadoPlan } },
    { arrayFilters: arrayFilter }
  );
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  const ot = await OrdenTrabajo.findById(id).lean();
  if (!ot) return Response.json({ error: "No encontrado" }, { status: 404 });
  return Response.json(serialize(ot as Record<string, unknown>));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await connectDB();
    const body = await req.json();
    const { estado, datosSupervision, cambio, cambios, lineas, registroDiario, usuarioId, nombreUsuario } = body;

    const ot = await OrdenTrabajo.findById(id);
    if (!ot) return Response.json({ error: "No encontrado" }, { status: 404 });

    if (estado) ot.estado = estado;

    if (lineas) {
      ot.lineas = lineas;
      ot.markModified("lineas");
    }

    // ── Agregar avance diario ──
    if (registroDiario) {
      if (!ot.registrosDiarios) ot.registrosDiarios = [];
      ot.registrosDiarios.push({
        fecha:            new Date(registroDiario.fecha),
        tecnico:          registroDiario.tecnico,
        usuarioId:        registroDiario.usuarioId ?? usuarioId,
        hhTrabajadas:     registroDiario.hhTrabajadas,
        tareasEjecutadas: registroDiario.tareasEjecutadas ?? [],
        observaciones:    registroDiario.observaciones ?? "",
      });
      ot.markModified("registrosDiarios");
      // Pasar a en_proceso si estaba no iniciada
      if ((ot.estado as string) === "no_iniciada") ot.estado = "borrador";
    }

    if (datosSupervision) {
      for (const [k, v] of Object.entries(datosSupervision)) {
        (ot.datosSupervision as Record<string, unknown>)[k] = v;
      }
      if (estado === "revisado" || estado === "concluido") {
        ot.datosSupervision.revisadoPor = usuarioId || "supervisor";
        ot.datosSupervision.revisadoEn = new Date();
      }
      ot.markModified("datosSupervision");
    }

    const mensajes: string[] = Array.isArray(cambios) ? cambios : cambio ? [cambio] : [];
    const now = new Date();
    for (const msg of mensajes) {
      ot.historialCambios.push({
        fechaHora: now,
        usuarioId: usuarioId || "system",
        nombreUsuario: nombreUsuario || "Sistema",
        cambio: msg,
      });
    }

    await ot.save();

    // ── Propagar al plan semanal si esta OT viene del plan ──
    if (estado && ot.origenPlan && ot.programacionSemanalId && ot.otJdeNumero) {
      try {
        await propagarAlPlan(
          ot.programacionSemanalId,
          ot.otJdeNumero,
          ot.otJdeDia ?? undefined,
          estado
        );
      } catch {
        // Propagar es best-effort — no falla la operación principal
      }
    }

    const saved = ot.toObject();
    return Response.json({ ok: true, ot: serialize(saved as Record<string, unknown>) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
