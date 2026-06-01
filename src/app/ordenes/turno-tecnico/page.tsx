"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { useUser } from "@/context/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

type TurnoTipo = "Diurno" | "Nocturno";
type Novedad = { prioridad: "URGENTE" | "ATENCION" | "INFORMACION"; tag?: string; descripcion: string };

type ReporteDoc = {
  _id: string; tipo: string; turno: string; fecha: string;
  supervisorId: string; supervisorNombre: string;
  otIds: string[]; otsCriticas: string[]; otsPendientesSiguienteTurno: string[];
  notasOTs: { otId: string; nota: string }[];
  recomendaciones: Novedad[];
  resumenEjecutivo: { totalOTs: number; concluidas: number; pendientes: number; inconclusas: number; hhTotales: number; hhCorrectivo: number; hhPreventivo: number };
  estado: string;
};

type OTItem = {
  _id: string; numeroOT: string; fecha: string; turno: string; areaCodigo: string;
  estado: string; otJdeNumero?: string | null;
  tecnicos: { nombreCompleto: string }[];
  lineas: { tag: string; tipoOT: string; tiempoRealHrs?: number; descripcionEquipo?: string; sintoma?: string; resolucionAplicada?: string; descripcionTrabajo?: string }[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFechaTurno() {
  const ahora = new Date();
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  if (min >= 18 * 60 + 30) return { fecha: ahora.toISOString().split("T")[0], turno: "Nocturno" as const };
  if (min < 6 * 60 + 30) {
    const ayer = new Date(ahora); ayer.setDate(ayer.getDate() - 1);
    return { fecha: ayer.toISOString().split("T")[0], turno: "Nocturno" as const };
  }
  return { fecha: ahora.toISOString().split("T")[0], turno: "Diurno" as const };
}

const TIPO_COLOR: Record<string, string> = { CMP: "#dc2626", CMR: "#d97706", PMP: "#2563eb", PMT: "#0891b2", PTJ: "#7c3aed" };
const PRIOR_COLOR: Record<string, string> = { URGENTE: "#dc2626", ATENCION: "#d97706", INFORMACION: "#2563eb" };
const ESTADO_COLOR: Record<string, string> = { borrador: "#64748b", enviado: "#16a34a" };

const S = {
  page:  { minHeight: "100vh", background: "#f1f5f9" },
  wrap:  { maxWidth: 760, margin: "0 auto", padding: "20px 16px 56px" },
  card:  { background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: "18px 16px", marginBottom: 12 },
  label: { display: "block" as const, fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: 5 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 11px", fontSize: 14, color: "#1e293b", outline: "none", boxSizing: "border-box" as const, background: "white" },
  textarea: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#1e293b", outline: "none", boxSizing: "border-box" as const, resize: "vertical" as const, minHeight: 52, background: "white" },
  badge: (color: string) => ({ display: "inline-block" as const, background: color + "18", color, border: `1px solid ${color}40`, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }),
  btnPrimary: { background: "#2563eb", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" as const },
  btnGreen:   { background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" as const },
  btnGhost:   { background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" as const },
};

function Steps({ step }: { step: number }) {
  const labels = ["Encabezado", "OTs Turno", "Novedades", "Generar PDF"];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "12px 0 20px" }}>
      {labels.map((l, i) => {
        const n = i + 1;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: step > n ? "#2563eb" : step === n ? "#1d4ed8" : "#e2e8f0", color: step >= n ? "white" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, boxShadow: step === n ? "0 0 0 4px #2563eb25" : "none" }}>
                {step > n ? "✓" : n}
              </div>
              <span style={{ fontSize: 10, color: step >= n ? "#2563eb" : "#94a3b8", fontWeight: 600 }}>{l}</span>
            </div>
            {i < labels.length - 1 && <div style={{ width: 44, height: 2, background: step > n ? "#2563eb" : "#e2e8f0", margin: "0 3px 14px" }} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReporteTurnoTecnicoPage() {
  const router = useRouter();
  const { user } = useUser();
  const { fecha: shiftFecha, turno: shiftTurno } = getFechaTurno();

  const [view, setView]     = useState<"lista" | "nuevo" | "detalle">("lista");
  const [step, setStep]     = useState(1);
  const [detalle, setDetalle] = useState<ReporteDoc | null>(null);

  const [reportes, setReportes]     = useState<ReporteDoc[]>([]);
  const [otsDisponibles, setOts]    = useState<OTItem[]>([]);
  const [loadingReportes, setLoadingRep] = useState(true);
  const [loadingOTs, setLoadingOTs] = useState(false);

  const [form, setForm] = useState({
    fecha: shiftFecha,
    turno: shiftTurno as TurnoTipo,
    otIds: [] as string[],
    otsCriticas: [] as string[],
    otsPendientes: [] as string[],
    notasOTs: {} as Record<string, string>,
    novedades: [] as Novedad[],
  });

  const [novInput, setNovInput] = useState<{ prioridad: "URGENTE" | "ATENCION" | "INFORMACION"; tag: string; descripcion: string }>({ prioridad: "INFORMACION", tag: "", descripcion: "" });
  const [filtroTexto, setFiltroTexto] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [submitErr, setSubmitErr]     = useState("");

  // ─── Load reportes ──────────────────────────────────────────────────────────

  const loadReportes = useCallback(async () => {
    setLoadingRep(true);
    const params = new URLSearchParams({ tipo: "tecnico", limit: "60" });
    // técnicos solo ven sus propios reportes
    if (user?.rol === 4) params.set("supervisorId", user.id);
    const data = await fetch(`/api/reportes-turno?${params}`).then(r => r.json()).catch(() => []);
    setReportes(Array.isArray(data) ? data : []);
    setLoadingRep(false);
  }, [user]);

  useEffect(() => { if (user) loadReportes(); }, [user, loadReportes]);

  // ─── Load OTs del turno seleccionado ────────────────────────────────────────

  const loadOTs = useCallback(async () => {
    if (!form.fecha || !user) return;
    setLoadingOTs(true);
    // OTs del día/turno filtradas por área del usuario
    const userAreas: string[] = user.areas ?? [];
    const params = new URLSearchParams({ fecha: form.fecha, turno: form.turno, limit: "100" });
    if (userAreas.length === 1) params.set("area", userAreas[0]);
    const data = await fetch(`/api/ordenes?${params}`).then(r => r.json()).catch(() => []);
    // Filtrar por nombre del técnico si es rol=4
    const ots: OTItem[] = Array.isArray(data) ? data : [];
    const filtradas = user.rol === 4
      ? ots.filter(o => o.tecnicos.some(t => t.nombreCompleto.toLowerCase().includes(user.nombre.toLowerCase())))
      : ots;
    setOts(filtradas);
    setLoadingOTs(false);
  }, [form.fecha, form.turno, user]);

  useEffect(() => {
    if (view === "nuevo" && step === 2) loadOTs();
  }, [view, step, loadOTs]);

  function patchForm(p: Partial<typeof form>) { setForm(f => ({ ...f, ...p })); }

  function toggleOT(id: string) {
    patchForm({ otIds: form.otIds.includes(id) ? form.otIds.filter(x => x !== id) : [...form.otIds, id] });
  }
  function toggleCritica(id: string) {
    patchForm({ otsCriticas: form.otsCriticas.includes(id) ? form.otsCriticas.filter(x => x !== id) : [...form.otsCriticas, id] });
  }
  function togglePendiente(id: string) {
    patchForm({ otsPendientes: form.otsPendientes.includes(id) ? form.otsPendientes.filter(x => x !== id) : [...form.otsPendientes, id] });
  }

  function agregarNovedad() {
    if (!novInput.descripcion.trim()) return;
    patchForm({ novedades: [...form.novedades, { ...novInput }] });
    setNovInput({ prioridad: "INFORMACION", tag: "", descripcion: "" });
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function submit() {
    if (!user) return;
    setSubmitting(true); setSubmitErr("");
    try {
      const notasArr = Object.entries(form.notasOTs).filter(([, v]) => v.trim()).map(([otId, nota]) => ({ otId, nota }));
      const payload = {
        tipo: "tecnico",
        turno: form.turno,
        fecha: form.fecha,
        supervisorId: user.id,
        supervisorNombre: user.nombre,
        otIds: form.otIds,
        otsCriticas: form.otsCriticas,
        otsPendientesSiguienteTurno: form.otsPendientes,
        notasOTs: notasArr,
        recomendaciones: form.novedades,
        otsPlanData: [],
      };
      const res = await fetch("/api/reportes-turno", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      // Ir directamente a imprimir
      router.push(`/ordenes/turno-tecnico/${data.reporte._id}/imprimir`);
    } catch (e: unknown) {
      setSubmitErr(e instanceof Error ? e.message : "Error desconocido");
      setSubmitting(false);
    }
  }

  // ─── OTs filtradas ──────────────────────────────────────────────────────────

  const otsFiltradas = otsDisponibles.filter(o => {
    if (!filtroTexto) return true;
    const q = filtroTexto.toLowerCase();
    return o.numeroOT.toLowerCase().includes(q)
      || o.lineas.some(l => l.tag.toLowerCase().includes(q) || (l.descripcionEquipo ?? "").toLowerCase().includes(q));
  });

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      <AppHeader backHref="/ordenes" />
      <div style={S.wrap}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: "#0f2847", marginBottom: 2 }}>Reporte de Turno — Técnico</h1>
          <p style={{ fontSize: 12, color: "#64748b" }}>Registro del turno por el técnico / supervisor de guardia</p>
        </div>

        {/* ══ VISTA LISTA ══════════════════════════════════════════════════════ */}
        {view === "lista" && (
          <>
            <button onClick={() => { setView("nuevo"); setStep(1); patchForm({ fecha: shiftFecha, turno: shiftTurno, otIds: [], otsCriticas: [], otsPendientes: [], notasOTs: {}, novedades: [] }); }}
              style={{ ...S.btnPrimary, marginBottom: 16, display: "block" }}>
              + Nuevo reporte de turno
            </button>

            {loadingReportes ? (
              <div style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>Cargando reportes…</div>
            ) : reportes.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", color: "#94a3b8", padding: 32 }}>Sin reportes de turno registrados.</div>
            ) : (
              reportes.map(r => {
                const fecha = new Date(r.fecha).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
                return (
                  <div key={r._id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={S.badge(r.turno === "Diurno" ? "#d97706" : "#7c3aed")}>{r.turno}</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#0f2847" }}>{fecha}</span>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{r.supervisorNombre}</span>
                        <span style={S.badge(ESTADO_COLOR[r.estado] ?? "#64748b")}>{r.estado}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {r.otIds.length} OTs · {r.recomendaciones.length} novedades
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => setDetalle(r)} style={S.btnGhost}>Ver</button>
                      <button onClick={() => router.push(`/ordenes/turno-tecnico/${r._id}/imprimir`)}
                        style={{ ...S.btnGreen, padding: "8px 14px", fontSize: 13 }}>🖨 PDF</button>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ══ VISTA DETALLE ════════════════════════════════════════════════════ */}
        {view === "lista" && detalle && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={() => setDetalle(null)}>
            <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 540, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f2847" }}>Detalle del reporte</h2>
                <button onClick={() => setDetalle(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 14 }}>
                <div><span style={S.label}>Técnico</span><p style={{ fontSize: 13 }}>{detalle.supervisorNombre}</p></div>
                <div><span style={S.label}>Turno</span><p style={{ fontSize: 13 }}>{detalle.turno}</p></div>
                <div><span style={S.label}>Fecha</span><p style={{ fontSize: 13 }}>{new Date(detalle.fecha).toLocaleDateString("es-BO", { timeZone: "UTC" })}</p></div>
                <div><span style={S.label}>OTs incluidas</span><p style={{ fontSize: 13 }}>{detalle.otIds.length}</p></div>
              </div>
              {detalle.recomendaciones.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <span style={S.label}>Novedades del turno</span>
                  {detalle.recomendaciones.map((n, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ ...S.badge(PRIOR_COLOR[n.prioridad] ?? "#64748b"), flexShrink: 0 }}>{n.prioridad}</span>
                      <span style={{ fontSize: 12, color: "#334155" }}>{n.tag && <b>{n.tag} · </b>}{n.descripcion}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setDetalle(null)} style={S.btnGhost}>Cerrar</button>
                <button onClick={() => router.push(`/ordenes/turno-tecnico/${detalle._id}/imprimir`)} style={S.btnGreen}>🖨 Generar PDF</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ VISTA NUEVO ══════════════════════════════════════════════════════ */}
        {view === "nuevo" && (
          <>
            <button onClick={() => setView("lista")} style={{ ...S.btnGhost, marginBottom: 12, fontSize: 13 }}>← Volver a lista</button>
            <Steps step={step} />

            {/* ── Step 1: Encabezado ── */}
            {step === 1 && (
              <div style={S.card}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f2847", marginBottom: 16 }}>Encabezado del reporte</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px", marginBottom: 14 }}>
                  <div>
                    <label style={S.label}>Fecha</label>
                    <input type="date" value={form.fecha} onChange={e => patchForm({ fecha: e.target.value })} style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Turno</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["Diurno", "Nocturno"] as TurnoTipo[]).map(t => (
                        <button key={t} type="button" onClick={() => patchForm({ turno: t })}
                          style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: form.turno === t ? 700 : 400, border: form.turno === t ? "2px solid #2563eb" : "1px solid #e2e8f0", background: form.turno === t ? "#eff6ff" : "white", color: form.turno === t ? "#1d4ed8" : "#64748b" }}>
                          {t === "Diurno" ? "☀️ Diurno" : "🌙 Nocturno"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Técnico responsable</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f2847" }}>{user?.nombre}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Sesión activa · {(user?.areas ?? []).join(", ")}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <button onClick={() => setStep(2)} style={S.btnPrimary}>Continuar → OTs</button>
                </div>
              </div>
            )}

            {/* ── Step 2: OTs del turno ── */}
            {step === 2 && (
              <div style={S.card}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f2847", marginBottom: 6 }}>OTs realizadas en el turno</div>
                <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
                  Selecciona las OTs que ejecutaste en este turno ({form.turno} · {form.fecha}).
                </p>

                {/* Filtro */}
                <input value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)}
                  placeholder="Filtrar por OT, TAG o equipo…" style={{ ...S.input, marginBottom: 12, fontSize: 13 }} />

                {loadingOTs ? (
                  <div style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>Cargando OTs…</div>
                ) : otsFiltradas.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 13 }}>
                    Sin OTs registradas para este turno.<br />
                    <span style={{ fontSize: 12 }}>Las OTs del turno se cargan desde el Registro de OT.</span>
                  </div>
                ) : (
                  otsFiltradas.map(o => {
                    const sel = form.otIds.includes(o._id);
                    const linea = o.lineas[0];
                    const tipoColor = TIPO_COLOR[linea?.tipoOT ?? ""] ?? "#64748b";
                    return (
                      <div key={o._id} style={{ border: sel ? "2px solid #2563eb" : "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 8, background: sel ? "#f0f7ff" : "white", cursor: "pointer" }}
                        onClick={() => toggleOT(o._id)}>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <input type="checkbox" checked={sel} onChange={() => toggleOT(o._id)} style={{ marginTop: 3, accentColor: "#2563eb", width: 16, height: 16 }} onClick={e => e.stopPropagation()} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 3 }}>
                              <span style={S.badge(tipoColor)}>{linea?.tipoOT ?? "—"}</span>
                              <span style={{ fontWeight: 700, fontSize: 13 }}>#{o.numeroOT}</span>
                              {o.otJdeNumero && <span style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>JDE: {o.otJdeNumero}</span>}
                              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#1d4ed8" }}>{linea?.tag}</span>
                            </div>
                            <p style={{ fontSize: 12, color: "#475569", marginBottom: sel ? 6 : 0 }}>
                              {linea?.descripcionEquipo ?? linea?.sintoma ?? linea?.descripcionTrabajo ?? "—"}
                            </p>
                            {/* Opciones adicionales cuando está seleccionada */}
                            {sel && (
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12 }} onClick={e => e.stopPropagation()}>
                                  <input type="checkbox" checked={form.otsCriticas.includes(o._id)} onChange={() => toggleCritica(o._id)} style={{ accentColor: "#dc2626" }} />
                                  <span style={{ color: "#dc2626", fontWeight: 600 }}>⚠ Crítica</span>
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12 }} onClick={e => e.stopPropagation()}>
                                  <input type="checkbox" checked={form.otsPendientes.includes(o._id)} onChange={() => togglePendiente(o._id)} style={{ accentColor: "#d97706" }} />
                                  <span style={{ color: "#d97706", fontWeight: 600 }}>→ Pasa al siguiente turno</span>
                                </label>
                              </div>
                            )}
                            {sel && (
                              <div style={{ marginTop: 6 }} onClick={e => e.stopPropagation()}>
                                <input
                                  value={form.notasOTs[o._id] ?? ""}
                                  onChange={e => patchForm({ notasOTs: { ...form.notasOTs, [o._id]: e.target.value } })}
                                  placeholder="Nota sobre esta OT (opcional)…"
                                  style={{ ...S.input, fontSize: 12 }} />
                              </div>
                            )}
                          </div>
                          {linea?.tiempoRealHrs && (
                            <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, flexShrink: 0 }}>{linea.tiempoRealHrs}h</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                  <button onClick={() => setStep(1)} style={S.btnGhost}>← Encabezado</button>
                  <button onClick={() => setStep(3)} style={S.btnPrimary}>Continuar → Novedades</button>
                </div>
              </div>
            )}

            {/* ── Step 3: Novedades ── */}
            {step === 3 && (
              <div style={S.card}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f2847", marginBottom: 6 }}>Novedades del turno</div>
                <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
                  Registra alertas, observaciones o pendientes importantes para el siguiente turno.
                </p>

                {/* Novedades ya agregadas */}
                {form.novedades.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    {form.novedades.map((n, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 6 }}>
                        <span style={{ ...S.badge(PRIOR_COLOR[n.prioridad] ?? "#64748b"), flexShrink: 0 }}>{n.prioridad}</span>
                        <div style={{ flex: 1 }}>
                          {n.tag && <span style={{ fontSize: 11, fontFamily: "monospace", color: "#1d4ed8", marginRight: 6 }}>{n.tag}</span>}
                          <span style={{ fontSize: 13, color: "#1e293b" }}>{n.descripcion}</span>
                        </div>
                        <button type="button" onClick={() => patchForm({ novedades: form.novedades.filter((_, j) => j !== i) })}
                          style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 15, flexShrink: 0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulario nueva novedad */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", marginBottom: 8 }}>
                    <div>
                      <label style={S.label}>Nivel</label>
                      <select value={novInput.prioridad} onChange={e => setNovInput(n => ({ ...n, prioridad: e.target.value as "URGENTE" | "ATENCION" | "INFORMACION" }))}
                        style={{ ...S.input, cursor: "pointer" }}>
                        <option value="URGENTE">🚨 URGENTE</option>
                        <option value="ATENCION">⚠️ ATENCIÓN</option>
                        <option value="INFORMACION">ℹ️ INFORMACIÓN</option>
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>TAG <span style={{ fontWeight: 400 }}>(opcional)</span></label>
                      <input value={novInput.tag} onChange={e => setNovInput(n => ({ ...n, tag: e.target.value.toUpperCase() }))}
                        placeholder="FT-101A" style={S.input} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={S.label}>Descripción / Novedad</label>
                    <textarea value={novInput.descripcion} onChange={e => setNovInput(n => ({ ...n, descripcion: e.target.value }))}
                      placeholder="Describe la novedad, alerta o pendiente para el siguiente turno…"
                      style={S.textarea} />
                  </div>
                  <button type="button" onClick={agregarNovedad} disabled={!novInput.descripcion.trim()}
                    style={{ ...S.btnPrimary, opacity: novInput.descripcion.trim() ? 1 : 0.5, padding: "8px 16px", fontSize: 13 }}>
                    + Agregar novedad
                  </button>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setStep(2)} style={S.btnGhost}>← OTs</button>
                  <button onClick={() => setStep(4)} style={S.btnPrimary}>Revisar y generar PDF →</button>
                </div>
              </div>
            )}

            {/* ── Step 4: Revisión y PDF ── */}
            {step === 4 && (
              <div style={S.card}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f2847", marginBottom: 16 }}>Revisión del reporte</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginBottom: 16 }}>
                  <div><span style={S.label}>Técnico</span><p style={{ fontSize: 14 }}>{user?.nombre}</p></div>
                  <div><span style={S.label}>Turno</span><p style={{ fontSize: 14 }}>{form.turno}</p></div>
                  <div><span style={S.label}>Fecha</span><p style={{ fontSize: 14 }}>{form.fecha}</p></div>
                  <div><span style={S.label}>OTs seleccionadas</span><p style={{ fontSize: 14, fontWeight: 700, color: "#2563eb" }}>{form.otIds.length}</p></div>
                </div>

                {form.otIds.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <span style={S.label}>OTs incluidas</span>
                    {otsDisponibles.filter(o => form.otIds.includes(o._id)).map(o => (
                      <div key={o._id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 8px", background: "#f8fafc", borderRadius: 6, marginBottom: 4, border: "1px solid #e2e8f0" }}>
                        <span style={S.badge(TIPO_COLOR[o.lineas[0]?.tipoOT ?? ""] ?? "#64748b")}>{o.lineas[0]?.tipoOT}</span>
                        <span style={{ fontWeight: 700, fontSize: 12 }}>#{o.numeroOT}</span>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#1d4ed8" }}>{o.lineas[0]?.tag}</span>
                        {form.otsCriticas.includes(o._id) && <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 700 }}>⚠ CRÍTICA</span>}
                        {form.otsPendientes.includes(o._id) && <span style={{ fontSize: 10, color: "#d97706", fontWeight: 700 }}>→ SIGUIENTE</span>}
                      </div>
                    ))}
                  </div>
                )}

                {form.novedades.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <span style={S.label}>Novedades ({form.novedades.length})</span>
                    {form.novedades.map((n, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 8px", marginBottom: 4 }}>
                        <span style={{ ...S.badge(PRIOR_COLOR[n.prioridad] ?? "#64748b"), fontSize: 10 }}>{n.prioridad}</span>
                        <span style={{ fontSize: 12 }}>{n.tag && <b>{n.tag} · </b>}{n.descripcion}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: "#166534" }}>
                    Al guardar se generará el PDF del reporte de turno. No se requiere aprobación del supervisor — es solo para registro y descarga.
                  </p>
                </div>

                {submitErr && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>⚠ {submitErr}</p>}

                <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                  <button onClick={() => setStep(3)} style={S.btnGhost} disabled={submitting}>← Novedades</button>
                  <button onClick={submit} style={S.btnGreen} disabled={submitting}>
                    {submitting ? "Guardando…" : "🖨 Guardar y generar PDF"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
