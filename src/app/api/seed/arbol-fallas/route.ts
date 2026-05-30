import { connectDB } from "@/lib/db";
import { ArbolFallas, CatalogoModo, CatalogoCausa } from "@/lib/models/ArbolFallas";
import modos from "@/data/catalogo_modos.json";
import causas from "@/data/catalogo_causas.json";
import relaciones from "@/data/arbol_fallas.json";

type RelacionRaw = {
  tipoEquipo: string;
  codigoModo: string;
  modoFalla: string;
  codigoCausa: string;
  causa: string;
  descripcionCausa: string;
};

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "No disponible en producción" }, { status: 403 });
  }

  await connectDB();

  // ── Limpiar colecciones antes de resembrar ─────────────────────────────────
  await ArbolFallas.deleteMany({});
  await CatalogoModo.deleteMany({});
  await CatalogoCausa.deleteMany({});

  // ── Catálogo modos ─────────────────────────────────────────────────────────
  const modosOps = (modos as { codigo: string; nombre: string; nombreEs: string; descripcion: string }[])
    .map((m) => ({
      updateOne: {
        filter: { codigo: m.codigo },
        update: { $set: m },
        upsert: true,
      },
    }));
  const resModos = await CatalogoModo.bulkWrite(modosOps, { ordered: false });

  // ── Catálogo causas ────────────────────────────────────────────────────────
  const causasOps = (causas as { codigo: string; nombre: string; descripcion: string }[])
    .map((c) => ({
      updateOne: {
        filter: { codigo: c.codigo },
        update: { $set: c },
        upsert: true,
      },
    }));
  const resCausas = await CatalogoCausa.bulkWrite(causasOps, { ordered: false });

  // ── Árbol de fallas ────────────────────────────────────────────────────────
  const arbolOps = (relaciones as RelacionRaw[])
    .filter((r) => r.tipoEquipo && r.codigoModo && (r.codigoCausa || r.causa))
    .map((r) => ({
      updateOne: {
        filter: {
          tipoEquipo: r.tipoEquipo,
          codigoModo: r.codigoModo,
          codigoCausa: r.codigoCausa || r.causa.slice(0, 20),
        },
        update: {
          $set: {
            tipoEquipo: r.tipoEquipo,
            sintoma: r.modoFalla || r.codigoModo,
            codigoModo: r.codigoModo,
            causaProbable: r.causa || r.codigoCausa,
            codigoCausa: r.codigoCausa,
            resolucionSugerida: "",
            tiempoEstimadoHrs: 0,
            activo: true,
            creadoPor: "sistema",
          },
        },
        upsert: true,
      },
    }));
  const resArbol = await ArbolFallas.bulkWrite(arbolOps, { ordered: false });

  return Response.json({
    ok: true,
    modos:  { insertados: resModos.upsertedCount },
    causas: { insertados: resCausas.upsertedCount },
    arbol:  { insertados: resArbol.upsertedCount },
  });
}
