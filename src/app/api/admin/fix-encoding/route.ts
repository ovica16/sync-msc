import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// Convierte texto con doble-encoding Latin1→UTF8 a UTF-8 correcto
// Ejemplo: "JosÃ©" → "José"
function fixEncoding(str: string): string {
  try {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return str;
  }
}

function needsFix(str: string): boolean {
  return /[\xC0-\xC3\xC5-\xCB\xD1][\x80-\xBF]/.test(str) || str.includes("Ã") || str.includes("Â");
}

export async function POST(req: NextRequest) {
  const { secret } = await req.json();
  if (secret !== "msc-fix-enc-2026") return Response.json({ ok: false }, { status: 403 });

  const usuarios = await prisma.usuario.findMany({ select: { id: true, nombre: true, apellido: true } });
  const fixes: { id: string; nombreOld: string; nombreNew: string }[] = [];

  for (const u of usuarios) {
    const nombreFixed = needsFix(u.nombre) ? fixEncoding(u.nombre) : u.nombre;
    const apellidoFixed = u.apellido && needsFix(u.apellido) ? fixEncoding(u.apellido) : u.apellido;
    if (nombreFixed !== u.nombre || apellidoFixed !== u.apellido) {
      fixes.push({ id: u.id, nombreOld: u.nombre, nombreNew: nombreFixed });
      await prisma.usuario.update({
        where: { id: u.id },
        data: { nombre: nombreFixed, ...(apellidoFixed !== u.apellido ? { apellido: apellidoFixed } : {}) },
      });
    }
  }

  // También corregir OtProgramada.personalAsignado
  const planes = await prisma.otProgramada.findMany({ select: { id: true, personalAsignado: true } });
  let planesFixed = 0;
  for (const p of planes) {
    const arr = p.personalAsignado as string[];
    const fixed = arr.map(n => needsFix(n) ? fixEncoding(n) : n);
    if (JSON.stringify(fixed) !== JSON.stringify(arr)) {
      await prisma.otProgramada.update({ where: { id: p.id }, data: { personalAsignado: fixed } });
      planesFixed++;
    }
  }

  // También corregir OtTecnico.nombreCompleto
  const tecns = await prisma.otTecnico.findMany({ select: { id: true, nombreCompleto: true } });
  let tecnsFixed = 0;
  for (const t of tecns) {
    if (needsFix(t.nombreCompleto)) {
      await prisma.otTecnico.update({ where: { id: t.id }, data: { nombreCompleto: fixEncoding(t.nombreCompleto) } });
      tecnsFixed++;
    }
  }

  return Response.json({ ok: true, usuariosFixed: fixes.length, planesFixed, tecnsFixed, detalle: fixes });
}
