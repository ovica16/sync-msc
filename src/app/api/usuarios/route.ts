import { connectDB } from "@/lib/db";
import { Usuario } from "@/lib/models/Usuario";
import { Area } from "@/lib/models/Area";
import { NextRequest } from "next/server";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const rolParam = searchParams.get("rol");
  const areaParam = searchParams.get("area");
  const all = searchParams.get("all") === "true";

  const filter: Record<string, unknown> = {};
  if (!all) filter.activo = true;
  if (rolParam) filter.rol = Number(rolParam);
  if (areaParam) {
    const areaDoc = await Area.findOne({ codigo: areaParam }).select("nombre").lean() as { nombre?: string } | null;
    if (areaDoc?.nombre) {
      filter.$or = [{ areas: areaParam }, { areaTrabajo: areaDoc.nombre }];
    } else {
      filter.areas = areaParam;
    }
  }

  const users = await Usuario.find(filter)
    .collation({ locale: "es", strength: 1 })
    .sort({ nombre: 1 })
    .select("_id nombre apellido email rol areas areaTrabajo celular jde puesto superintendencia activo")
    .lean();

  return Response.json(
    users.map((u) => ({
      _id: String(u._id),
      nombre: u.nombre,
      apellido: u.apellido ?? "",
      email: u.email ?? "",
      nombreCompleto: u.apellido ? `${u.nombre} ${u.apellido}` : u.nombre,
      rol: u.rol,
      areas: u.areas,
      areaTrabajo: u.areaTrabajo ?? "",
      celular: u.celular ?? "",
      jde: u.jde ?? "",
      puesto: u.puesto ?? "",
      superintendencia: u.superintendencia ?? "",
      activo: u.activo,
    }))
  );
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { nombre, apellido, email, password, rol, areas, areaTrabajo, celular, jde, puesto, superintendencia } = body;

    const userData: Record<string, unknown> = {
      nombre: nombre?.trim(),
      rol: Number(rol),
      areas: areas ?? [],
      activo: body.activo !== undefined ? body.activo : true,
    };
    if (apellido?.trim()) userData.apellido = apellido.trim();
    if (email?.trim()) userData.email = email.trim().toLowerCase();
    if (areaTrabajo?.trim()) userData.areaTrabajo = areaTrabajo.trim();
    if (celular?.trim()) userData.celular = String(celular).trim();
    // Clean JDE: "63222.0" → "63222"
    if (jde) userData.jde = String(jde).replace(/\.0+$/, "").trim();
    if (puesto?.trim()) userData.puesto = puesto.trim();
    if (superintendencia?.trim()) userData.superintendencia = superintendencia.trim();
    if (password?.trim()) {
      // Simple SHA-256 hash for dev — upgrade to bcrypt when implementing real auth
      userData.passwordHash = crypto.createHash("sha256").update(password + "syncmsc-salt-v1").digest("hex");
    }

    const user = new Usuario(userData);
    await user.save();
    return Response.json({ ok: true, _id: String(user._id) }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
