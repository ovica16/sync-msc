import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password + "syncmsc-salt-v1").digest("hex");
}

const USUARIOS_INICIALES = [
  {
    nombre: "Ovidio",
    apellido: "Capurata",
    email: "ovidio.capurata@gmail.com",
    password: "sync2024",
    rol: 1, // Admin
    disciplina: "GENERAL",
    puesto: "Administrador",
    activo: true,
  },
  {
    nombre: "Admin",
    apellido: "Sistema",
    email: "admin@syncmsc.com",
    password: "admin2024",
    rol: 1, // Admin
    disciplina: "GENERAL",
    puesto: "Administrador",
    activo: true,
  },
];

export async function POST() {
  try {
    const creados: string[] = [];
    const omitidos: string[] = [];

    for (const u of USUARIOS_INICIALES) {
      const existe = await prisma.usuario.findFirst({ where: { email: u.email } });
      if (existe) {
        omitidos.push(u.email);
        continue;
      }
      await prisma.usuario.create({
        data: {
          nombre: u.nombre,
          apellido: u.apellido,
          email: u.email,
          passwordHash: hashPassword(u.password),
          rol: u.rol,
          disciplina: u.disciplina,
          puesto: u.puesto,
          activo: u.activo,
        },
      });
      creados.push(u.email);
    }

    return Response.json({ ok: true, creados, omitidos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, email: true, nombre: true, apellido: true, rol: true, activo: true },
  });
  return Response.json({ ok: true, total: usuarios.length, usuarios });
}
