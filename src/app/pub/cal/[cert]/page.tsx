import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type React from "react";

// Página pública — accesible sin autenticación vía QR
// URL: /pub/cal/{numeroCertificado}

type Params = { params: Promise<{ cert: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { cert } = await params;
  return {
    title: `Certificado ${decodeURIComponent(cert)} — MSC`,
    viewport: "width=device-width, initial-scale=1",
  };
}

function fmt(d?: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-BO", {
    day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
  });
}

const RESULTADO_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  APROBADO:  { bg: "#dcfce7", color: "#15803d", border: "#16a34a" },
  RECHAZADO: { bg: "#fee2e2", color: "#b91c1c", border: "#dc2626" },
  AJUSTADO:  { bg: "#fef3c7", color: "#b45309", border: "#d97706" },
};

function Field({ label, value, mono, highlight }: { label: string; value: React.ReactNode; mono?: boolean; highlight?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: highlight ?? "#1e293b", fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all" }}>
        {value}
      </div>
    </div>
  );
}

type PuntoCal = { lecturaPatron: number; lecturaInstrumento: number; error: number; tolerancia: number; aprueba: boolean };

function TablaPuntos({ puntos, unidad, titulo }: { puntos: PuntoCal[]; unidad?: string | null; titulo: string }) {
  if (!puntos || puntos.length === 0) return null;
  const u = unidad ? ` (${unidad})` : "";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 11, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{titulo}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["#", `Patrón${u}`, `Instrumento${u}`, "Error", "Tolerancia", "¿Aprueba?"].map(h => (
                <th key={h} style={{ padding: "6px 8px", fontWeight: 700, color: "#475569", textAlign: "center", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {puntos.map((p, i) => {
              const errPct = p.lecturaPatron !== 0 ? ((p.error / p.lecturaPatron) * 100).toFixed(2) : "—";
              return (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "6px 8px", textAlign: "center", color: "#94a3b8", fontSize: 11 }}>{i + 1}</td>
                  <td style={{ padding: "6px 8px", textAlign: "center", fontFamily: "monospace" }}>{p.lecturaPatron}</td>
                  <td style={{ padding: "6px 8px", textAlign: "center", fontFamily: "monospace" }}>{p.lecturaInstrumento}</td>
                  <td style={{ padding: "6px 8px", textAlign: "center", fontFamily: "monospace", color: p.aprueba ? "#15803d" : "#b91c1c" }}>
                    {p.error > 0 ? `+${p.error.toFixed(2)}` : p.error.toFixed(2)}{typeof errPct === "string" && errPct !== "—" ? ` (${errPct}%)` : ""}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "center", fontFamily: "monospace", color: "#64748b" }}>±{p.tolerancia}</td>
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 11, padding: "2px 7px", borderRadius: 4, background: p.aprueba ? "#dcfce7" : "#fee2e2", color: p.aprueba ? "#15803d" : "#b91c1c" }}>
                      {p.aprueba ? "✓ SÍ" : "✗ NO"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function PublicCertPage({ params }: Params) {
  const { cert } = await params;
  const numeroCertificado = decodeURIComponent(cert);

  const registro = await prisma.registroCalibracion.findUnique({
    where: { numeroCertificado },
  });

  if (!registro) notFound();

  const rs = RESULTADO_STYLE[registro.resultadoGeneral] ?? RESULTADO_STYLE.APROBADO;

  const proxima = new Date(registro.fecha);
  proxima.setUTCFullYear(proxima.getUTCFullYear() + 1);
  const vencida = proxima < new Date();

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f1f5f9; font-family: Arial, Helvetica, sans-serif; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>

        {/* Header */}
        <div style={{ background: "#0d2f5e", padding: "14px 20px" }}>
          <div style={{ color: "white", fontWeight: 800, fontSize: 15, letterSpacing: "0.04em" }}>MINERA SAN CRISTÓBAL</div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 2 }}>Laboratorio de Instrumentación · Verificación de Certificado</div>
        </div>

        {/* Banda resultado */}
        <div style={{ background: rs.bg, borderBottom: `3px solid ${rs.border}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: rs.border, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, color: rs.color, letterSpacing: "0.08em" }}>
              {registro.resultadoGeneral}
            </div>
            <div style={{ fontSize: 12, color: rs.color, marginTop: 1 }}>Resultado de calibración</div>
          </div>
        </div>

        <div style={{ maxWidth: 520, margin: "0 auto", padding: "20px 16px 48px" }}>

          {/* TAG */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px 20px 16px", marginBottom: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: "#0d2f5e", letterSpacing: "0.04em", lineHeight: 1 }}>
              {registro.tag}
            </div>
            <div style={{ fontSize: 14, color: "#475569", marginTop: 6, marginBottom: 10 }}>{registro.descripcionInstrumento}</div>
            <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: "#64748b", background: "#f1f5f9", borderRadius: 4, padding: "3px 10px" }}>
              {registro.tipoVariable}
            </span>
          </div>

          {/* Datos del certificado — una sola columna para que no se comprima */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: "18px 20px", marginBottom: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Datos del Certificado</div>

            <Field label="Certificado N°" value={registro.numeroCertificado} mono />
            <Field label="Área" value={registro.areaCodigo} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
              <Field label="Fecha de Calibración" value={fmt(registro.fecha)} />
              <Field
                label="Próxima Calibración"
                value={<>{fmt(proxima)}{vencida && <span style={{ fontSize: 10, marginLeft: 6, background: "#dc2626", color: "white", borderRadius: 3, padding: "1px 5px", verticalAlign: "middle" }}>VENCIDA</span>}</>}
                highlight={vencida ? "#dc2626" : "#15803d"}
              />
            </div>

            <Field label="Técnico Calibrador" value={registro.tecnicoNombre} />
            {registro.supervisorNombre && (
              <Field label="Aprobado por" value={registro.supervisorNombre} />
            )}
            {registro.turno && (
              <Field label="Turno" value={registro.turno} />
            )}
          </div>

          {/* Condiciones ambientales */}
          {(registro.temperatura != null || registro.humedad != null) && (
            <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px", marginBottom: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Condiciones Ambientales</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
                {registro.temperatura != null && (
                  <Field label="Temperatura" value={`${registro.temperatura} °C`} />
                )}
                {registro.humedad != null && (
                  <Field label="Humedad Relativa" value={`${registro.humedad} %`} />
                )}
              </div>
            </div>
          )}

          {/* Puntos de calibración — Antes */}
          {Array.isArray(registro.puntosAntes) && (registro.puntosAntes as PuntoCal[]).length > 0 && (
            <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px", marginBottom: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
              <TablaPuntos puntos={registro.puntosAntes as PuntoCal[]} unidad={registro.unidad} titulo="Mediciones Antes del Ajuste" />
            </div>
          )}

          {/* Puntos de calibración — Después */}
          {Array.isArray(registro.puntos) && (registro.puntos as PuntoCal[]).length > 0 && (
            <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px", marginBottom: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
              <TablaPuntos puntos={registro.puntos as PuntoCal[]} unidad={registro.unidad} titulo="Mediciones Finales de Calibración" />
            </div>
          )}

          {/* Patrones */}
          {registro.patronCodigos.length > 0 && (
            <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px", marginBottom: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Patrones Utilizados</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {registro.patronCodigos.map((p, i) => (
                  <span key={i} style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Observaciones */}
          {registro.observaciones && (
            <div style={{ background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a", padding: "14px 20px", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Observaciones</div>
              <p style={{ fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>{registro.observaciones}</p>
            </div>
          )}

          {/* Pie */}
          <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", lineHeight: 1.7, marginTop: 8 }}>
            <p>Certificado generado por el Sistema SYNC MSC · Minera San Cristóbal</p>
            <p>Válido para gestión interna según normas ISO 17025</p>
          </div>
        </div>
      </div>
    </>
  );
}
