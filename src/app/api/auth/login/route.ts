import { prisma } from "@/lib/prisma";
import { signToken, COOKIE_NAME, MAX_AGE, SessionPayload } from "@/lib/auth";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Disciplina } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password)
      return NextResponse.json({ ok: false, error: "Credenciales requeridas" }, { status: 400 });

    const user = await prisma.usuario.findFirst({
      where: { email: email.toLowerCase().trim(), activo: true },
      include: { areas: true },
    });

    if (!user || !user.passwordHash)
      return NextResponse.json({ ok: false, error: "Usuario o contraseña incorrectos" }, { status: 401 });

    // Verificar con SHA-256 (mismo hash usado al crear)
    const hash = crypto.createHash("sha256").update(password + "syncmsc-salt-v1").digest("hex");
    if (hash !== user.passwordHash)
      return NextResponse.json({ ok: false, error: "Usuario o contraseña incorrectos" }, { status: 401 });

    const payload: SessionPayload = {
      id: user.id,
      nombre: user.apellido ? `${user.nombre} ${user.apellido}` : user.nombre,
      email: user.email!,
      rol: user.rol as import("@/types").Rol,
      areas: user.areas.map((a) => a.areaCodigo),
      disciplina: (user.disciplina as Disciplina) ?? "GENERAL",
    };

    const token = signToken(payload);
    const res = NextResponse.json({ ok: true, user: payload });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: MAX_AGE,
      path: "/",
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
