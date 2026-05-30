import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import ChecklistMantto from "@/lib/models/ChecklistMantto";

type Sentido = "Visual" | "Auditivo" | "Tactil" | "Olfativo" | "Instrumental";

const PREFIX_MAP: { prefix: RegExp; sentido: Sentido }[] = [
  { prefix: /^Vista[^:]*:/i,        sentido: "Visual" },
  { prefix: /^O[ií]do[^:]*:/i,      sentido: "Auditivo" },  // Oído / Oido
  { prefix: /^Tacto[^:]*:/i,        sentido: "Tactil" },
  { prefix: /^Olfato[^:]*:/i,       sentido: "Olfativo" },
  { prefix: /^Medici[oó]n[^:]*:/i,  sentido: "Instrumental" },
  { prefix: /^Funci[oó]n[^:]*:/i,   sentido: "Instrumental" },
];

const KEYWORD_MAP: { re: RegExp; sentido: Sentido }[] = [
  { re: /ruido|chirrido|golpeteo|zumbido|escape de aire|sonido/i, sentido: "Auditivo" },
  { re: /temperatura|vibraci[oó]n|calor/i,                        sentido: "Tactil" },
  { re: /olor|quemado|gas|solvente/i,                             sentido: "Olfativo" },
  { re: /amperaje|registrar valor|medici[oó]n|se[nñ]al.*proceso/i, sentido: "Instrumental" },
];

function detectSentido(desc: string): { sentido: Sentido; descripcion: string } {
  for (const { prefix, sentido } of PREFIX_MAP) {
    if (prefix.test(desc)) {
      return { sentido, descripcion: desc.replace(prefix, "").trim() };
    }
  }
  for (const { re, sentido } of KEYWORD_MAP) {
    if (re.test(desc)) return { sentido, descripcion: desc };
  }
  return { sentido: "Visual", descripcion: desc };
}

// GET: muestra diagnóstico de los primeros 3 checklists
export async function GET() {
  await connectDB();
  const docs = await ChecklistMantto.find({}).limit(3).lean();
  const diag = docs.map(d => ({
    nombre: d.nombre,
    items: d.items.slice(0, 5).map((it: { descripcion: string; sentido?: string }) => ({
      desc: it.descripcion,
      sentido_bd: it.sentido,
      sentido_detectado: detectSentido(it.descripcion).sentido,
      desc_limpia: detectSentido(it.descripcion).descripcion,
    })),
  }));
  return Response.json(diag);
}

// POST: migra todos los checklists incondicionalmente
export async function POST() {
  await connectDB();
  const docs = await ChecklistMantto.find({}).lean();

  let updated = 0;
  let itemsFixed = 0;

  for (const doc of docs) {
    const newItems = doc.items.map((it: { descripcion: string; orden: number; sentido?: string }) => {
      const { sentido, descripcion } = detectSentido(it.descripcion);
      if (sentido !== it.sentido) itemsFixed++;
      return { descripcion, orden: it.orden, sentido };
    });

    // Actualiza siempre (fuerza la reescritura del array de items)
    await ChecklistMantto.updateOne(
      { _id: doc._id },
      { $set: { items: newItems } }
    );
    updated++;
  }

  return Response.json({ ok: true, checklists: updated, itemsFixed });
}
