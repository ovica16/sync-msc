"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type CalibRecord = {
  _id: string;
  numeroCertificado: string;
  tag: string;
  descripcionInstrumento: string;
  tipoVariable: string;
  unidad?: string;
  patronCodigo: string;
  tecnicoNombre: string;
  supervisorNombre?: string;
  fecha: string;
  puntos: { aprueba: boolean }[];
  resultadoGeneral: "APROBADO" | "RECHAZADO" | "AJUSTADO";
};

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STICKER_COLORS = {
  APROBADO: { bg: "#dcfce7", border: "#16a34a", text: "#15803d" },
  RECHAZADO: { bg: "#fee2e2", border: "#dc2626", text: "#b91c1c" },
  AJUSTADO: { bg: "#fef3c7", border: "#d97706", text: "#b45309" },
};

export default function StickerPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [record, setRecord] = useState<CalibRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copies, setCopies] = useState(3);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/calibracion/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject("No encontrado"))
      .then(d => setRecord(d))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ color: "#64748b", fontFamily: "Arial, sans-serif" }}>Cargando sticker...</div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 12, fontFamily: "Arial, sans-serif" }}>
        <div style={{ color: "#dc2626" }}>{error || "No encontrado"}</div>
        <Link href="/ordenes/calibracion" style={{ color: "#2563eb", fontSize: 13 }}>← Volver</Link>
      </div>
    );
  }

  const colors = STICKER_COLORS[record.resultadoGeneral];
  const stickers = Array.from({ length: copies });

  return (
    <>
      {/* Controls */}
      <div
        id="sticker-controls"
        style={{
          background: "#0f2847",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          justifyContent: "space-between",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link
            href={`/ordenes/calibracion/${id}/certificado`}
            style={{ color: "white", fontSize: 13, textDecoration: "none" }}
          >
            ← Certificado
          </Link>
          <Link
            href="/ordenes/calibracion"
            style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, textDecoration: "none" }}
          >
            Lista
          </Link>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
            Copias:
            <select
              value={copies}
              onChange={e => setCopies(Number(e.target.value))}
              style={{ padding: "3px 8px", borderRadius: 4, border: "none", fontSize: 12, background: "white", color: "#0f2847" }}
            >
              {[1, 2, 3, 4, 6, 8, 10].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => window.print()}
            style={{
              background: "white",
              color: "#0f2847",
              border: "none",
              borderRadius: 6,
              padding: "6px 18px",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Imprimir Stickers
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div
        style={{
          padding: 24,
          background: "#f1f5f9",
          minHeight: "calc(100vh - 48px)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, textAlign: "center" }}>
          Vista previa · Tamaño real: 7 × 4 cm · {copies} sticker{copies !== 1 ? "s" : ""}
        </div>

        <div
          id="stickers-area"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "center",
          }}
        >
          {stickers.map((_, i) => (
            <div
              key={i}
              className="sticker-card"
              style={{
                width: "264px",
                height: "151px",
                border: `2px solid ${colors.border}`,
                borderRadius: 6,
                background: "white",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Sticker header */}
              <div style={{
                background: "#0f2847",
                padding: "4px 8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div style={{ color: "white", fontWeight: 800, fontSize: 10, letterSpacing: "0.04em" }}>
                  MSC · LAB. INSTRUMENTACIÓN
                </div>
              </div>

              {/* Sticker body */}
              <div style={{ flex: 1, padding: "6px 10px", display: "flex", gap: 8 }}>
                {/* Left: main info */}
                <div style={{ flex: 1 }}>
                  {/* TAG */}
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0f2847", lineHeight: 1, marginBottom: 2 }}>
                    {record.tag}
                  </div>
                  <div style={{ fontSize: 9, color: "#64748b", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {record.descripcionInstrumento}
                  </div>

                  {/* Cert number */}
                  <div style={{ fontSize: 8, color: "#94a3b8" }}>Certificado</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#1e293b" }}>
                    {record.numeroCertificado}
                  </div>

                  {/* Dates */}
                  <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    <div>
                      <div style={{ fontSize: 8, color: "#94a3b8" }}>Calibrado</div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#1e293b" }}>{fmtDate(record.fecha)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 8, color: "#94a3b8" }}>Técnico</div>
                      <div style={{ fontSize: 8, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {record.tecnicoNombre.split(" ").slice(0, 2).join(" ")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: result badge + QR placeholder */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 60 }}>
                  <div style={{
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    fontWeight: 800,
                    fontSize: 10,
                    padding: "4px 8px",
                    borderRadius: 4,
                    textAlign: "center",
                    letterSpacing: "0.04em",
                  }}>
                    {record.resultadoGeneral}
                  </div>
                  {/* QR placeholder */}
                  <div style={{
                    width: 48,
                    height: 48,
                    border: "1px solid #e2e8f0",
                    borderRadius: 4,
                    background: "#f8fafc",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                  }}>
                    <div style={{ fontSize: 7, color: "#94a3b8", textAlign: "center", lineHeight: 1.3 }}>
                      QR<br />CERT
                    </div>
                    {/* Simple QR visual placeholder */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 5px)", gap: 1 }}>
                      {Array.from({ length: 16 }, (_, j) => (
                        <div key={j} style={{
                          width: 5, height: 5,
                          background: [0,1,4,5,10,11,14,15,2,7,8,13].includes(j) ? "#0f2847" : "transparent",
                        }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticker footer */}
              <div style={{
                background: colors.bg,
                padding: "2px 10px",
                borderTop: `1px solid ${colors.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div style={{ fontSize: 8, color: colors.text, fontWeight: 600 }}>
                  {record.tipoVariable} · Patrón: {record.patronCodigo}
                </div>
                <div style={{ fontSize: 8, color: colors.text }}>
                  MSC · LAB. INST.
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          #sticker-controls { display: none !important; }
          body { margin: 0; background: white; }
          #stickers-area {
            padding: 8mm;
            gap: 4mm !important;
            justify-content: flex-start !important;
          }
          .sticker-card {
            width: 70mm !important;
            height: 40mm !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @page { margin: 8mm; size: A4; }
      `}</style>
    </>
  );
}
