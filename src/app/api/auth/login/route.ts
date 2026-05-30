import { connectDB } from "@/lib/db";
import { Usuario } from "@/lib/models/Usuario";
import { signToken, COOKIE_NAME, MAX_AGE, SessionPayload } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password)
      return NextResponse.json({ ok: false, error: "Credenciales requeridas" }, { status: 400 });

    await connectDB();
    const user = await Usuario.findOne({ email: email.toLowerCase().trim(), activo: true }).lean();

    if (!user || !user.passwordHash)
      return NextResponse.json({ ok: false, error: "Usuario o contraseña incorrectos" }, { status: 401 });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return NextResponse.json({ ok: false, error: "Usuario o contraseña incorrectos" }, { status: 401 });

    const payload: SessionPayload = {
      id: String(user._id),
      nombre: `${user.nombre}${user.apellido ? " " + user.apellido : ""}`,
      email: user.email!,
      rol: user.rol,
      areas: user.areas ?? [],
      disciplina: (user.disciplina as import("@/types").Disciplina) ?? "GENERAL",
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
