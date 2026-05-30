import { connectDB } from "@/lib/db";
import { OrdenTrabajo } from "@/lib/models/OrdenTrabajo";
import { ProgramacionSemanal } from "@/lib/models/ProgramacionSemanal";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const area       = searchParams.get("area");
  const estado     = searchParams.get("estado");
  const tag        = searchParams.get("tag");
  const turno      = searchParams.get("turno");
  const fecha      = searchParams.get("fecha");
  const limit        = Math.min(Number(searchParams.get("limit") || "50"), 200);
  const origenPlan   = searchParams.get("origenPlan"); // "true" | "false"
  const otJdeNumero  = searchParams.get("otJdeNumero");
  const fechaDesde   = searchParams.get("fechaDesde");
  const fechaHasta   = searchParams.get("fechaHasta");

  const filter: Record<string, unknown> = {};
  if (area)        filter.areaCodigo = area;
  if (estado)      filter.estado = estado;
  if (tag)         filter["lineas.tag"] = tag.toUpperCase();
  if (turno)       filter.turno = turno;
  if (otJdeNumero) filter.otJdeNumero = otJdeNumero;
  if (origenPlan !== null) filter.origenPlan = origenPlan === "true";
  if (fecha) {
    const d = new Date(fecha);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    filter.fecha = { $gte: d, $lt: next };
  } else if (fechaDesde || fechaHasta) {
    const rango: Record<string, Date> = {};
    if (fechaDesde) rango.$gte = new Date(fechaDesde);
    if (fechaHasta) { const h = new Date(fechaHasta); h.setDate(h.getDate() + 1); rango.$lt = h; }
    filter.fecha = rango;
  }

  const ordenes = await OrdenTrabajo.find(filter)
    .sort({ fecha: -1 })
    .limit(limit)
    .lean();

  return Response.json(ordenes.map((o) => ({ ...o, _id: String(o._id) })));
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    const primerTecnico = body.tecnicos?.[0];
    const esDePlan = !!body.programacionSemanalId;
    const cambioDesc = esDePlan
      ? `OT creada desde plan semanal (JDE: ${body.otJdeNumero ?? "—"} · ${body.otJdeDia ?? ""})`
      : body.estado === "pendiente_revision"
        ? "OT enviada a revisión"
        : "OT creada como borrador";

    const ot = new OrdenTrabajo({
      ...body,
      origenPlan: esDePlan,
      datosSupervision: {},
      historialCambios: [
        {
          fechaHora: new Date(),
          usuarioId: primerTecnico?.usuarioId || "system",
          nombreUsuario: primerTecnico?.nombreCompleto || "Sistema",
          cambio: cambioDesc,
        },
      ],
    });

    await ot.save();

    // ── Registrar referencia en el plan semanal ──
    if (esDePlan && body.programacionSemanalId && body.otJdeNumero) {
      const arrayFilter = body.otJdeDia
        ? [{ "ot.numeroOT": body.otJdeNumero, "ot.dia": body.otJdeDia }]
        : [{ "ot.numeroOT": body.otJdeNumero }];

      await ProgramacionSemanal.findOneAndUpdate(
        {
          _id: body.programacionSemanalId,
          "otsProgramadas.numeroOT": body.otJdeNumero,
        },
        {
          $set: {
            "otsProgramadas.$[ot].estado":          "en_proceso",
            "otsProgramadas.$[ot].ordenTrabajoId":  String(ot._id),
            "otsProgramadas.$[ot].ordenTrabajoNum": ot.numeroOT,
          },
        },
        { arrayFilters: arrayFilter }
      );
    }

    return Response.json({ ok: true, ot: { ...ot.toObject(), _id: String(ot._id) } }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
