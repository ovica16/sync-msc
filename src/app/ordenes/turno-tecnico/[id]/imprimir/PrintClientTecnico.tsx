"use client";

type OTDisplay = {
  id: string; numeroOT: string; tag: string; tipoOT: string;
  descripcion: string; tecnicos: string[]; hhTotal: number;
  estado: string; critica: boolean; pendiente: boolean; nota: string;
};

type Novedad = { prioridad: string; tag?: string; descripcion: string };

type ReporteData = {
  _id: string; turno: string; fecha: string; tecnicoNombre: string;
  resumenEjecutivo: { totalOTs: number; concluidas: number; pendientes: number; hhTotales: number };
  novedades: Novedad[];
};

const PRIOR_COLOR: Record<string, string> = {
  URGENTE: "#dc2626", ATENCION: "#d97706", INFORMACION: "#2563eb",
};
const TIPO_COLOR: Record<string, string> = {
  CMP: "#dc2626", CMR: "#d97706", PMP: "#2563eb", PMT: "#0891b2", PTJ: "#7c3aed",
};

export default function PrintClientTecnico({
  reporte, ots,
}: {
  reporte: ReporteData;
  ots: OTDisplay[];
}) {
  const fecha = new Date(reporte.fecha);
  const fechaStr = fecha.toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" });
  const res = reporte.resumenEjecutivo;

  const criticas     = ots.filter(o => o.critica);
  const pendientesSig = ots.filter(o => o.pendiente);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Calibri:wght@400;600;700&display=swap');
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; }
        body { background: white; color: #000; font-size: 9pt; }
        .no-print { display: none !important; }
        @media screen {
          body { padding: 20px; background: #f0f0f0; }
          .pagina { background: white; width: 277mm; margin: 0 auto 20px; padding: 10mm; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
        }
        @media print { .pagina { page-break-after: always; } .pagina:last-child { page-break-after: avoid; } }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 3px 5px; vertical-align: middle; }
        th { background: #1f3864; color: white; font-weight: bold; text-align: center; font-size: 8pt; }
        .kpis { display: flex; gap: 6px; margin: 6px 0; }
        .kpi { flex: 1; border: 1px solid #000; padding: 4px; text-align: center; }
        .kpi-val { font-size: 14pt; font-weight: bold; }
        .kpi-lbl { font-size: 7pt; color: #555; }
        .section-title { font-weight: bold; font-size: 9pt; background: #e8edf4; padding: 3px 6px; border: 1px solid #000; margin-top: 8px; }
      `}</style>

      {/* Botones de pantalla */}
      <div className="no-print" style={{ position: "fixed", top: 12, right: 12, display: "flex", gap: 8, zIndex: 100 }}>
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#475569", maxWidth: 260 }}>
          Presiona <b>Ctrl+P</b> → destino <b>&quot;Guardar como PDF&quot;</b>
        </div>
        <button onClick={() => window.print()}
          style={{ padding: "9px 20px", background: "#1f3864", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          🖨 Ctrl+P / Guardar PDF
        </button>
        <button onClick={() => window.history.back()}
          style={{ padding: "9px 14px", background: "#64748b", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
          ← Volver
        </button>
      </div>

      <div className="pagina">
        {/* ── ENCABEZADO ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1.5px solid #000", marginBottom: 4 }}>
          <tbody>
            <tr>
              <td style={{ width: 105, borderRight: "1px solid #000", textAlign: "center", padding: "6px 8px", verticalAlign: "middle" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-msc.png" alt="MSC" style={{ height: 46, objectFit: "contain", display: "block", margin: "0 auto" }} />
              </td>
              <td style={{ borderRight: "1px solid #000", textAlign: "center", verticalAlign: "middle", padding: "8px 16px" }}>
                <div style={{ fontSize: 14, fontWeight: "bold", letterSpacing: "0.04em" }}>REPORTE DE TURNO — TÉCNICO / TURNERO</div>
              </td>
              <td style={{ width: 100, padding: 0, verticalAlign: "top" }}>
                <div style={{ textAlign: "center", padding: "6px 6px 4px", fontSize: 8.5, fontWeight: "600", lineHeight: 1.6 }}>
                  <div>2.03.P01.F36</div>
                  <div>Revisión: 1</div>
                </div>
                <div style={{ borderTop: "1px solid #000", background: "#b8b8b8", textAlign: "center", padding: "5px 6px", fontSize: 9, fontWeight: "bold", letterSpacing: "0.06em" }}>
                  INTERNA
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── SUBENCABEZADO ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginBottom: 6, fontSize: 8.5 }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 7px", borderRight: "1px solid #000", width: "26%" }}><b>Gerencia:</b> Mantenimiento Planta</td>
              <td style={{ padding: "4px 7px", borderRight: "1px solid #000", width: "30%" }}><b>Técnico / Turnero:</b> {reporte.tecnicoNombre}</td>
              <td style={{ padding: "4px 7px", borderRight: "1px solid #000", width: "18%" }}><b>Turno:</b> {reporte.turno}</td>
              <td style={{ padding: "4px 7px", width: "26%" }}><b>Fecha:</b> {fechaStr}</td>
            </tr>
          </tbody>
        </table>

        {/* ── KPIs ── */}
        <div className="kpis">
          {[
            { val: res.totalOTs,    lbl: "Total OTs",     color: "#1f3864" },
            { val: res.concluidas,  lbl: "Completadas",   color: "#16a34a" },
            { val: res.pendientes,  lbl: "Pasan a sgtte", color: "#d97706" },
            { val: res.hhTotales,   lbl: "HH Totales",    color: "#2563eb" },
            { val: ots.filter(o => o.tipoOT === "CMR" || o.tipoOT === "CMP").length, lbl: "Correctivos", color: "#dc2626" },
            { val: ots.filter(o => o.tipoOT === "PMP" || o.tipoOT === "PMT").length, lbl: "Preventivos", color: "#0891b2" },
          ].map(k => (
            <div key={k.lbl} className="kpi">
              <div className="kpi-val" style={{ color: k.color }}>{k.val}</div>
              <div className="kpi-lbl">{k.lbl}</div>
            </div>
          ))}
        </div>

        {/* ── TABLA DE OTs ── */}
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>ITEM</th>
              <th style={{ width: 55 }}>TIPO</th>
              <th style={{ width: 80 }}>EQUIPO TAG</th>
              <th style={{ width: 28 }}>HRS</th>
              <th style={{ width: 55 }}>OT #</th>
              <th>DESCRIPCIÓN DEL TRABAJO</th>
              <th style={{ width: 160 }}>NOTA DEL TÉCNICO</th>
              <th style={{ width: 55, textAlign: "center" as const }}>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {ots.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "#888", fontStyle: "italic", padding: "8px" }}>Sin OTs registradas en este turno.</td></tr>
            )}
            {ots.map((ot, idx) => {
              const concluida = ["completada","concluido","revisado"].includes(ot.estado);
              return (
                <tr key={ot.id} style={{ background: ot.critica ? "#fff1f2" : concluida ? "#f0fdf4" : "white" }}>
                  <td style={{ textAlign: "center", fontSize: 8 }}>{idx + 1}</td>
                  <td style={{ textAlign: "center", fontSize: 8, fontWeight: "bold", color: TIPO_COLOR[ot.tipoOT] ?? "#000" }}>{ot.tipoOT}</td>
                  <td style={{ fontWeight: "bold", fontFamily: "monospace", fontSize: 8 }}>{ot.tag}</td>
                  <td style={{ textAlign: "center", fontSize: 8 }}>{ot.hhTotal || "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 8 }}>{ot.numeroOT}</td>
                  <td style={{ fontSize: 8 }}>{ot.descripcion}</td>
                  <td style={{ fontSize: 8, fontStyle: ot.nota ? "normal" : "italic", color: ot.nota ? "#1e293b" : "#94a3b8" }}>
                    {ot.nota || "—"}
                    {ot.critica   && <div style={{ fontSize: 7, color: "#dc2626", fontWeight: "bold", marginTop: 1 }}>⚠ CRÍTICA</div>}
                    {ot.pendiente && <div style={{ fontSize: 7, color: "#d97706", fontWeight: "bold", marginTop: 1 }}>→ PASA AL SIGUIENTE TURNO</div>}
                  </td>
                  <td style={{ textAlign: "center", fontSize: 7.5, fontWeight: "bold" }}>
                    {concluida
                      ? <span style={{ color: "#16a34a", background: "#dcfce7", padding: "2px 5px", borderRadius: 3 }}>EJECUTADA</span>
                      : <span style={{ color: "#92400e", background: "#fef3c7", padding: "2px 5px", borderRadius: 3 }}>PENDIENTE</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── NOVEDADES DEL TURNO ── */}
        <div className="section-title">NOVEDADES / ALERTAS PARA EL SIGUIENTE TURNO</div>
        {reporte.novedades.length === 0 ? (
          <table><tbody><tr><td style={{ fontSize: 8, color: "#888", fontStyle: "italic", padding: "6px 8px" }}>Sin novedades registradas.</td></tr></tbody></table>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 80 }}>NIVEL</th>
                <th style={{ width: 80 }}>TAG</th>
                <th>DESCRIPCIÓN / NOVEDAD</th>
              </tr>
            </thead>
            <tbody>
              {reporte.novedades.map((n, i) => (
                <tr key={i}>
                  <td style={{ color: PRIOR_COLOR[n.prioridad] ?? "#000", fontWeight: "bold", textAlign: "center", fontSize: 8 }}>{n.prioridad}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 8 }}>{n.tag ?? "—"}</td>
                  <td style={{ fontSize: 8 }}>{n.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── OTs CRÍTICAS / PENDIENTES ── */}
        {(criticas.length > 0 || pendientesSig.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
            {criticas.length > 0 && (
              <div>
                <div className="section-title" style={{ color: "#dc2626" }}>⚠ OTs CRÍTICAS ({criticas.length})</div>
                {criticas.map(o => (
                  <div key={o.id} style={{ fontSize: 8, padding: "2px 6px", borderBottom: "1px solid #eee" }}>
                    <b>{o.numeroOT}</b> — {o.tag} — {o.descripcion}
                  </div>
                ))}
              </div>
            )}
            {pendientesSig.length > 0 && (
              <div>
                <div className="section-title" style={{ color: "#d97706" }}>→ PENDIENTES SIGUIENTE TURNO ({pendientesSig.length})</div>
                {pendientesSig.map(o => (
                  <div key={o.id} style={{ fontSize: 8, padding: "2px 6px", borderBottom: "1px solid #eee" }}>
                    <b>{o.numeroOT}</b> — {o.tag} — {o.descripcion}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 7, color: "#888", textAlign: "center" }}>
          Reporte generado por Sync MSC — Sistema de Gestión de Mantenimiento Planta
        </div>
      </div>
    </>
  );
}
