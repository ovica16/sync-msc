import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// Página pública — accesible sin autenticación vía QR
// URL: /pub/cal/{numeroCertificado}

type Params = { params: Promise<{ cert: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { cert } = await params;
  return { title: `Certificado ${decodeURIComponent(cert)} — MSC` };
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

export default async function PublicCertPage({ params }: Params) {
  const { cert } = await params;
  const numeroCertificado = decodeURIComponent(cert);

  const registro = await prisma.registroCalibracion.findUnique({
    where: { numeroCertificado },
  });

  if (!registro) notFound();

  const rs = RESULTADO_STYLE[registro.resultadoGeneral] ?? RESULTADO_STYLE.APROBADO;

  // Calcular próxima calibración (1 año desde la fecha)
  const proxima = new Date(registro.fecha);
  proxima.setUTCFullYear(proxima.getUTCFullYear() + 1);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "Arial, Helvetica, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#0d2f5e", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "white", fontWeight: 800, fontSize: 16, letterSpacing: "0.04em" }}>MINERA SAN CRISTÓBAL</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Certificado de Calibración — Verificación pública</div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textAlign: "right" }}>
          <div>Laboratorio de Instrumentación</div>
          <div>sync-msc.up.railway.app</div>
        </div>
      </div>

      {/* Banda de resultado */}
      <div style={{ background: rs.bg, borderBottom: `3px solid ${rs.border}`, padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: rs.border, flexShrink: 0 }} />
        <div>
          <span style={{ fontWeight: 800, fontSize: 18, color: rs.color, letterSpacing: "0.06em" }}>
            {registro.resultadoGeneral}
          </span>
          <span style={{ fontSize: 12, color: rs.color, marginLeft: 12 }}>
            Resultado de calibración
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "24px auto", padding: "0 16px 40px" }}>

        {/* TAG principal */}
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px 24px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#0d2f5e", letterSpacing: "0.04em", marginBottom: 4 }}>
            {registro.tag}
          </div>
          <div style={{ fontSize: 14, color: "#475569", marginBottom: 12 }}>{registro.descripcionInstrumento}</div>
          <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: "#64748b", background: "#f1f5f9", borderRadius: 4, padding: "3px 10px" }}>
            {registro.tipoVariable}
          </div>
        </div>

        {/* Info principal */}
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px 24px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#64748b", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>Datos del Certificado</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Certificado N°</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0d2f5e", fontFamily: "monospace" }}>{registro.numeroCertificado}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Área</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{registro.areaCodigo}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Fecha de Calibración</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{fmt(registro.fecha)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Próxima Calibración</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: proxima < new Date() ? "#dc2626" : "#16a34a" }}>
                {fmt(proxima)}
                {proxima < new Date() && <span style={{ fontSize: 10, marginLeft: 6, color: "#dc2626" }}>VENCIDA</span>}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Técnico Calibrador</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{registro.tecnicoNombre}</div>
            </div>
            {registro.supervisorNombre && (
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Aprobado por</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{registro.supervisorNombre}</div>
              </div>
            )}
          </div>
        </div>

        {/* Patrones */}
        {registro.patronCodigos.length > 0 && (
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 24px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#64748b", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>Patrones Utilizados</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {registro.patronCodigos.map((p, i) => (
                <span key={i} style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600, fontFamily: "monospace" }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Observaciones */}
        {registro.observaciones && (
          <div style={{ background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a", padding: "14px 24px", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: "#92400e", marginBottom: 4 }}>Observaciones</div>
            <p style={{ fontSize: 13, color: "#78350f" }}>{registro.observaciones}</p>
          </div>
        )}

        {/* Pie */}
        <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", lineHeight: 1.6, padding: "0 8px" }}>
          <p>Este certificado fue generado por el Sistema SYNC MSC de Minera San Cristóbal.</p>
          <p>Válido para gestión interna según normas ISO 17025.</p>
          <p style={{ marginTop: 8, fontWeight: 600, color: "#64748b" }}>Verificado en línea · {new Date().toLocaleDateString("es-BO")}</p>
        </div>
      </div>
    </div>
  );
}
