import { connectDB } from "@/lib/db";
import { Usuario } from "@/lib/models/Usuario";
import { Rol, Disciplina } from "@/types";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

const USUARIOS_SEED: Array<{
  nombre: string; apellido: string; email: string; password: string;
  rol: Rol; areas: string[]; puesto: string; areaTrabajo?: string;
  disciplina?: Disciplina; activo: boolean;
}> = [
  // ─── Administrador ────────────────────────────────────────────────────────
  {
    nombre: "Ovidio",
    apellido: "Capurata",
    email: "ovidio.capurata@gmail.com",
    password: "Sync2025!",
    rol: 1,
    areas: [],
    puesto: "Administrador del Sistema",
    activo: true,
  },
  // ─── Supervisores generales ───────────────────────────────────────────────
  {
    nombre: "Carlos",
    apellido: "Mendoza",
    email: "c.mendoza@minera.com",
    password: "Super2025!",
    rol: 3,
    areas: ["3310", "3311"],
    puesto: "Supervisor de Mantenimiento",
    areaTrabajo: "Molienda",
    activo: true,
  },
  {
    nombre: "Patricia",
    apellido: "Quispe",
    email: "p.quispe@minera.com",
    password: "Super2025!",
    rol: 3,
    areas: ["3320", "3321"],
    puesto: "Supervisor de Mantenimiento",
    areaTrabajo: "Flotación",
    activo: true,
  },
  // ─── Técnicos generales ───────────────────────────────────────────────────
  {
    nombre: "Jorge",
    apellido: "Flores",
    email: "j.flores@minera.com",
    password: "Tecnico2025!",
    rol: 4,
    areas: ["3310"],
    puesto: "Técnico Mecánico",
    areaTrabajo: "Molienda",
    activo: true,
  },
  {
    nombre: "Ana",
    apellido: "Torres",
    email: "a.torres@minera.com",
    password: "Tecnico2025!",
    rol: 4,
    areas: ["3320"],
    puesto: "Técnico Mecánico",
    areaTrabajo: "Flotación",
    activo: true,
  },
  // ─── Supervisor Instrumentista ────────────────────────────────────────────
  {
    nombre: "Roberto",
    apellido: "Salas",
    email: "r.salas@minera.com",
    password: "Inst2025!",
    rol: 3,
    areas: ["3310", "3311", "3320", "3321"],
    puesto: "Supervisor Instrumentista",
    areaTrabajo: "Instrumentación",
    disciplina: "INST",
    activo: true,
  },
  // ─── Técnico Instrumentista ───────────────────────────────────────────────
  {
    nombre: "Lucia",
    apellido: "Vargas",
    email: "l.vargas@minera.com",
    password: "Inst2025!",
    rol: 4,
    areas: ["3310", "3320"],
    puesto: "Técnico Instrumentista",
    areaTrabajo: "Instrumentación",
    disciplina: "INST",
    activo: true,
  },
];

export async function POST() {
  try {
    await connectDB();
    const resultados: { email: string; accion: string }[] = [];

    for (const u of USUARIOS_SEED) {
      const { password, ...rest } = u;
      const passwordHash = await bcrypt.hash(password, 10);

      const existente = await Usuario.findOne({ email: rest.email });
      if (existente) {
        await Usuario.updateOne({ email: rest.email }, { $set: { ...rest, passwordHash } });
        resultados.push({ email: rest.email, accion: "actualizado" });
      } else {
        await Usuario.create({ ...rest, passwordHash });
        resultados.push({ email: rest.email, accion: "creado" });
      }
    }

    return NextResponse.json({ ok: true, resultados });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
