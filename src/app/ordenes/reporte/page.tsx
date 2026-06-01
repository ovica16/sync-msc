"use client";

import React, { useState, useEffect, useCallback } from "react";
import AppHeader from "@/components/AppHeader";
import { useUser } from "@/context/AuthContext";
import { generarInformeOT } from "@/lib/generarInformeOT";

// ─── Types ───────────────────────────────────────────────────────────────────

type EstadoOT = "borrador" | "pendiente_revision" | "solicitar_correccion" | "revisado" | "concluido";

type InspeccionItem = { descripcion: string; ok: boolean; obs: string };
type Inspeccion = { checklistId: string; checklistNombre: string; items: InspeccionItem[] };

type Linea = {
  tag: string;
  descripcionEquipo: string;
  tipoOT: string;
  sintoma?: string;
  causaProbable?: string;
  resolucionAplicada?: string;
  tiempoEstimadoHrs?: number;
  tiempoRealHrs?: number;
  descripcionTrabajo?: string;
  tareasEjecutadas?: string[];
  observaciones?: string;
  inspeccion?: Inspeccion | null;
};

type SupForm = {
  clasificacionRCM: string;
  codigoModoFallaISO: string;
  requierePlanificacion: boolean;
  comentariosSupervisor: string;
  generaOtHallazgo: boolean | null;
  otGenerada: string;
};

type RegistroDiario = {
  _id?: string;
  fecha: string;
  tecnico: string;
  usuarioId?: string;
  hhTrabajadas: number;
  tareasEjecutadas: string[];
  observaciones?: string;
};

type OTDoc = {
  _id: string;
  numeroOT: string;
  fecha: string;
  turno: string;
  areaCodigo: string;
  tecnicos: { usuarioId: string; nombreCompleto: string }[];
  lineas: Linea[];
  estado: EstadoOT;
  datosSupervision: Partial<SupForm> & { codigoModoFallaISO?: string; revisadoPor?: string; revisadoEn?: string };
  historialCambios: { fechaHora: string; usuarioId: string; nombreUsuario: string; cambio: string }[];
  registrosDiarios?: RegistroDiario[];
  // Enlace al plan semanal
  origenPlan?: boolean;
  programacionSemanalId?: string;
  otJdeNumero?: string;
  otJdeDia?: string;
  createdAt?: string;
};

type AreaOpt = { codigo: string; nombre: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const ESTADO_COLOR: Record<string, string> = {
  borrador: "#64748b",
  pendiente_revision: "#d97706",
  solicitar_correccion: "#dc2626",
  revisado: "#2563eb",
  concluido: "#16a34a",
};

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  pendiente_revision: "Pend. revisión",
  solicitar_correccion: "Corrección",
  revisado: "Revisado",
  concluido: "Concluido",
};

const TIPO_COLOR: Record<string, string> = {
  CMP: "#dc2626", CMR: "#d97706", PMP: "#2563eb", PMT: "#0891b2", PTJ: "#7c3aed",
};

const CLASIFICACIONES_RCM = [
  "Correctivo No Planificado",
  "Correctivo Programado",
  "Mantenimiento Menor",
  "Mantenimiento Mayor",
];

const EMPTY_SUP: SupForm = {
  clasificacionRCM: "", codigoModoFallaISO: "", requierePlanificacion: false,
  comentariosSupervisor: "", generaOtHallazgo: null, otGenerada: "",
};

const COLS_TABLERO: { key: EstadoOT; label: string; color: string }[] = [
  { key: "borrador",             label: "Borradores",       color: "#64748b" },
  { key: "pendiente_revision",   label: "Pend. Revisión",   color: "#d97706" },
  { key: "solicitar_correccion", label: "Corrección",       color: "#dc2626" },
  { key: "revisado",             label: "Revisado",         color: "#2563eb" },
  { key: "concluido",            label: "Concluido",        color: "#16a34a" },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  page: { minHeight: "100vh", background: "#f1f5f9" },
  wrap: { maxWidth: 860, margin: "0 auto", padding: "20px 16px 56px" },
  card: {
    background: "white", borderRadius: 12,
    border: "1px solid #e2e8f0", padding: "18px 16px", marginBottom: 12,
  },
  label: {
    display: "block" as const, fontSize: 11, fontWeight: 700, color: "#64748b",
    letterSpacing: "0.07em", textTransform: "uppercase" as const, marginBottom: 5,
  },
  input: {
    width: "100%", border: "1px solid #cbd5e1", borderRadius: 8,
    padding: "9px 11px", fontSize: 14, color: "#1e293b", outline: "none",
    boxSizing: "border-box" as const, background: "white",
  },
  inputSm: {
    border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 9px",
    fontSize: 13, color: "#1e293b", outline: "none",
    background: "#fffbeb", width: 90,
  },
  select: {
    width: "100%", border: "1px solid #cbd5e1", borderRadius: 8,
    padding: "9px 11px", fontSize: 14, color: "#1e293b", outline: "none",
    boxSizing: "border-box" as const, background: "white", cursor: "pointer",
  },
  textarea: {
    width: "100%", border: "1px solid #cbd5e1", borderRadius: 8,
    padding: "9px 11px", fontSize: 14, color: "#1e293b", outline: "none",
    boxSizing: "border-box" as const, resize: "vertical" as const, minHeight: 72, background: "white",
  },
  textareaSm: {
    border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 9px",
    fontSize: 13, color: "#1e293b", outline: "none", resize: "vertical" as const,
    background: "#fffbeb", width: "100%", minHeight: 52, boxSizing: "border-box" as const,
  },
  badge: (color: string) => ({
    display: "inline-block" as const, background: color + "18", color,
    border: `1px solid ${color}40`, borderRadius: 5, padding: "2px 8px",
    fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap" as const,
  }),
  btnPrimary: { background: "#2563eb", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" as const },
  btnGreen:   { background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" as const },
  btnRed:     { background: "#dc2626", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" as const },
  btnAmber:   { background: "#d97706", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" as const },
  btnGhost:   { background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" as const },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diffLineas(original: Linea[], editado: Linea[]): string[] {
  const msgs: string[] = [];
  editado.forEach((linea, i) => {
    const orig = original[i];
    if (!orig) return;
    if (linea.tiempoRealHrs !== orig.tiempoRealHrs) {
      msgs.push(`[${linea.tag}] Tiempo real: ${orig.tiempoRealHrs ?? "—"}h → ${linea.tiempoRealHrs ?? "—"}h`);
    }
    if (linea.resolucionAplicada !== orig.resolucionAplicada) {
      msgs.push(`[${linea.tag}] Resolución actualizada`);
    }
    if (linea.observaciones !== orig.observaciones) {
      msgs.push(`[${linea.tag}] Observaciones actualizadas`);
    }
  });
  return msgs.length > 0 ? ["Edición con trazabilidad:", ...msgs] : ["Sin cambios detectados"];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReporteOTPage() {
  const { user } = useUser();

  // Derivados de rol — Admin(1) y Superintendente(2) tienen acceso total
  const esTecnico   = user?.rol === 4;
  const esSup       = user ? user.rol <= 3 : false; // 1, 2, 3 pueden revisar
  const esAdmin     = user?.rol === 1;

  const [ordenes, setOrdenes] = useState<OTDoc[]>([]);
  const [areas, setAreas] = useState<AreaOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OTDoc | null>(null);
  const [viewMode, setViewMode] = useState<"lista" | "tablero">("lista");

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [filtroBuscar, setFiltroBuscar] = useState("");

  // Supervisión
  const [supForm, setSupForm] = useState<SupForm>(EMPTY_SUP);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // Modo edición con trazabilidad
  const [editMode, setEditMode] = useState(false);
  const [editLineas, setEditLineas] = useState<Linea[]>([]);
  const [editOtJdeNumero, setEditOtJdeNumero] = useState("");
  const [tareaInputs, setTareaInputs] = useState<string[]>([]);
  const [itemCheckInputs, setItemCheckInputs] = useState<string[]>([]);

  // Avance diario (OTs multi-día)
  const [showAvance, setShowAvance]   = useState(false);
  const [avanceTareaInput, setAvanceTareaInput] = useState("");
  const [avanceForm, setAvanceForm]   = useState<{
    fecha: string; hhTrabajadas: number; tareasEjecutadas: string[]; observaciones: string;
  }>({ fecha: new Date().toISOString().split("T")[0], hhTrabajadas: 0, tareasEjecutadas: [], observaciones: "" });

  const loadOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filtroEstado) params.set("estado", filtroEstado);
      if (filtroArea) params.set("area", filtroArea);
      const data = await fetch(`/api/ordenes?${params}`).then((r) => r.json());
      setOrdenes(Array.isArray(data) ? data : []);
    } catch { setOrdenes([]); }
    finally { setLoading(false); }
  }, [filtroEstado, filtroArea]);

  useEffect(() => { fetch("/api/areas").then((r) => r.json()).then(setAreas).catch(() => {}); }, []);
  useEffect(() => { loadOrdenes(); }, [loadOrdenes]);

  useEffect(() => {
    if (!selected) { setEditMode(false); return; }
    const d = selected.datosSupervision ?? {};
    setSupForm({
      clasificacionRCM: d.clasificacionRCM ?? "",
      codigoModoFallaISO: d.codigoModoFallaISO ?? "",
      requierePlanificacion: d.requierePlanificacion ?? false,
      comentariosSupervisor: d.comentariosSupervisor ?? "",
      generaOtHallazgo: (d as { generaOtHallazgo?: boolean | null }).generaOtHallazgo ?? null,
      otGenerada: (d as { otGenerada?: string }).otGenerada ?? "",
    });
    setSaveErr("");
    setEditMode(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?._id]);

  const ordenesFiltradas = ordenes.filter((o) => {
    if (!filtroBuscar) return true;
    const q = filtroBuscar.toLowerCase();
    return (
      o.numeroOT.toLowerCase().includes(q) ||
      o.tecnicos.some((t) => t.nombreCompleto.toLowerCase().includes(q)) ||
      o.lineas.some((l) => l.tag.toLowerCase().includes(q))
    );
  });

  function areaNombre(codigo: string) { return areas.find((a) => a.codigo === codigo)?.nombre ?? codigo; }
  function patchSup(p: Partial<SupForm>) { setSupForm((f) => ({ ...f, ...p })); }

  function enterEditMode() {
    if (!selected) return;
    setEditLineas(selected.lineas.map((l) => ({ ...l })));
    setTareaInputs(selected.lineas.map(() => ""));
    setItemCheckInputs(selected.lineas.map(() => ""));
    setEditOtJdeNumero(selected.otJdeNumero ?? "");
    setEditMode(true);
  }

  function addTareaLinea(i: number) {
    const val = tareaInputs[i]?.trim();
    if (!val) return;
    const prev = editLineas[i].tareasEjecutadas ?? [];
    patchLinea(i, { tareasEjecutadas: [...prev, val] });
    setTareaInputs((ts) => ts.map((t, ii) => (ii === i ? "" : t)));
  }

  function removeTareaLinea(lineaIdx: number, tareaIdx: number) {
    const prev = editLineas[lineaIdx].tareasEjecutadas ?? [];
    patchLinea(lineaIdx, { tareasEjecutadas: prev.filter((_, ii) => ii !== tareaIdx) });
  }

  function getOrCreateInspeccion(l: Linea): Inspeccion {
    return l.inspeccion ?? { checklistId: "", checklistNombre: "Checklist supervisión", items: [] };
  }

  function addItemChecklist(i: number) {
    const val = itemCheckInputs[i]?.trim();
    if (!val) return;
    const insp = getOrCreateInspeccion(editLineas[i]);
    const orden = insp.items.length;
    patchLinea(i, { inspeccion: { ...insp, items: [...insp.items, { descripcion: val, ok: false, obs: "" }] } });
    setItemCheckInputs((ts) => ts.map((t, ii) => (ii === i ? "" : t)));
    void orden;
  }

  function toggleItemChecklist(lineaIdx: number, itemIdx: number) {
    const insp = getOrCreateInspeccion(editLineas[lineaIdx]);
    const items = insp.items.map((it, ii) => ii === itemIdx ? { ...it, ok: !it.ok } : it);
    patchLinea(lineaIdx, { inspeccion: { ...insp, items } });
  }

  function editObsChecklist(lineaIdx: number, itemIdx: number, obs: string) {
    const insp = getOrCreateInspeccion(editLineas[lineaIdx]);
    const items = insp.items.map((it, ii) => ii === itemIdx ? { ...it, obs } : it);
    patchLinea(lineaIdx, { inspeccion: { ...insp, items } });
  }

  function removeItemChecklist(lineaIdx: number, itemIdx: number) {
    const insp = getOrCreateInspeccion(editLineas[lineaIdx]);
    patchLinea(lineaIdx, { inspeccion: { ...insp, items: insp.items.filter((_, ii) => ii !== itemIdx) } });
  }

  function patchLinea(idx: number, patch: Partial<Linea>) {
    setEditLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function guardarAvance() {
    if (!selected) return;
    if (avanceForm.hhTrabajadas <= 0) { setSaveErr("Ingrese las horas trabajadas"); return; }
    setSaving(true); setSaveErr("");
    try {
      const res = await fetch(`/api/ordenes/${selected._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registroDiario: {
            fecha:            avanceForm.fecha,
            tecnico:          user?.nombre ?? "Técnico",
            usuarioId:        user?.id,
            hhTrabajadas:     avanceForm.hhTrabajadas,
            tareasEjecutadas: avanceForm.tareasEjecutadas,
            observaciones:    avanceForm.observaciones,
          },
          cambio: `Avance del día ${avanceForm.fecha} registrado por ${user?.nombre ?? "Técnico"} — ${avanceForm.hhTrabajadas}HH`,
          usuarioId: user?.id ?? "system",
          nombreUsuario: user?.nombre ?? "Sistema",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      setSelected(data.ot);
      setOrdenes(prev => prev.map(o => o._id === data.ot._id ? data.ot : o));
      setShowAvance(false);
      setAvanceForm({ fecha: new Date().toISOString().split("T")[0], hhTrabajadas: 0, tareasEjecutadas: [], observaciones: "" });
      setAvanceTareaInput("");
    } catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  async function saveEdit() {
    if (!selected) return;
    const cambios = diffLineas(selected.lineas, editLineas);
    setSaving(true); setSaveErr("");
    try {
      const res = await fetch(`/api/ordenes/${selected._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineas: editLineas,
          cambios,
          otJdeNumero: editOtJdeNumero.trim() || null,
          usuarioId: user?.id ?? "sistema",
          nombreUsuario: user?.nombre ?? "Sistema",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      setSelected(data.ot);
      setOrdenes((prev) => prev.map((o) => (o._id === data.ot._id ? data.ot : o)));
      setEditMode(false);
    } catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  async function cambiarEstado(nuevoEstado: EstadoOT, descripcion: string) {
    if (!selected) return;
    setSaving(true); setSaveErr("");
    try {
      const res = await fetch(`/api/ordenes/${selected._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: nuevoEstado, datosSupervision: supForm,
          cambio: descripcion, usuarioId: user?.id ?? "sistema", nombreUsuario: user?.nombre ?? "Sistema",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      setSelected(data.ot);
      setOrdenes((prev) => prev.map((o) => (o._id === data.ot._id ? data.ot : o)));
    } catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  // ─── Lista ───────────────────────────────────────────────────────────────────

  if (!selected) {
    return (
      <div style={S.page}>
        <AppHeader backHref="/ordenes" />
        <div style={S.wrap}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h1 style={{ fontSize: 19, fontWeight: 800, color: "#0f2847", marginBottom: 2 }}>Órdenes de Trabajo</h1>
              <p style={{ fontSize: 12, color: "#94a3b8" }}>Borradores · Revisión · Concluidas</p>
            </div>
            {/* Toggle lista / tablero */}
            <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 9, overflow: "hidden", background: "white" }}>
              {(["lista", "tablero"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  style={{
                    padding: "8px 18px", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: viewMode === m ? "#0f2847" : "white",
                    color: viewMode === m ? "white" : "#64748b",
                  }}
                >
                  {m === "lista" ? "☰ Lista" : "⊞ Tablero"}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros (solo en lista) */}
          {viewMode === "lista" && (
            <div style={{ ...S.card, marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={S.label}>Buscar</label>
                  <input value={filtroBuscar} onChange={(e) => setFiltroBuscar(e.target.value)} placeholder="# OT, técnico, TAG…" style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Estado</label>
                  <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={S.select}>
                    <option value="">Todos</option>
                    {COLS_TABLERO.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Área</label>
                  <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} style={S.select}>
                    <option value="">Todas</option>
                    {areas.map((a) => <option key={a.codigo} value={a.codigo}>{a.codigo} — {a.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 12, color: "#64748b" }}>
              {loading ? "Cargando…" : `${ordenesFiltradas.length} orden(es)`}
            </p>
            <button onClick={loadOrdenes} style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 12 }}>↻ Actualizar</button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 14 }}>Cargando…</div>
          ) : viewMode === "lista" ? (
            /* ── Vista Lista ── */
            ordenesFiltradas.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "40px 20px" }}>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>No hay órdenes con esos filtros.</p>
              </div>
            ) : (
              ordenesFiltradas.map((ot) => {
                const color = ESTADO_COLOR[ot.estado] ?? "#64748b";
                return (
                  <div
                    key={ot._id}
                    onClick={() => setSelected(ot)}
                    style={{ ...S.card, borderLeft: `4px solid ${color}`, cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.09)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontWeight: 800, fontSize: 15, color: "#0f2847" }}>{ot.otJdeNumero ? `OT ${ot.otJdeNumero}` : `#${ot.numeroOT}`}</span>
                          <span style={S.badge(color)}>{ESTADO_LABEL[ot.estado]}</span>
                          {ot.lineas.map((l, i) => <span key={i} style={S.badge(TIPO_COLOR[l.tipoOT] ?? "#64748b")}>{l.tipoOT}</span>)}
                        </div>
                        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>
                          {new Date(ot.fecha).toLocaleDateString("es-BO")} · {ot.turno} · {areaNombre(ot.areaCodigo)}
                        </p>
                        <p style={{ fontSize: 12, color: "#475569" }}>{ot.tecnicos.map((t) => t.nombreCompleto).join(", ")}</p>
                        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{ot.lineas.map((l) => l.tag).join(" · ")}</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{ot.lineas.length} equipo(s)</span>
                        <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }}>Ver →</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* ── Vista Tablero ── */
            <div style={{ overflowX: "auto", paddingBottom: 12 }}>
              <div style={{ display: "flex", gap: 12, minWidth: 900 }}>
                {COLS_TABLERO.map((col) => {
                  const colOTs = ordenes.filter((o) => o.estado === col.key);
                  return (
                    <div key={col.key} style={{ flex: "0 0 200px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {/* Cabecera columna */}
                      <div style={{
                        background: col.color + "15", borderRadius: 8, padding: "8px 12px",
                        border: `1px solid ${col.color}30`,
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: col.color }}>{col.label}</span>
                        <span style={{
                          background: col.color, color: "white", borderRadius: "50%",
                          width: 20, height: 20, display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: 11, fontWeight: 800,
                        }}>{colOTs.length}</span>
                      </div>

                      {colOTs.length === 0 && (
                        <div style={{ padding: "16px 8px", textAlign: "center", color: "#cbd5e1", fontSize: 12, borderRadius: 8, border: "1px dashed #e2e8f0", background: "white" }}>
                          Vacío
                        </div>
                      )}

                      {colOTs.map((ot) => (
                        <div
                          key={ot._id}
                          style={{ background: "white", borderRadius: 10, border: `1px solid ${col.color}30`, padding: "10px 12px", borderTop: `3px solid ${col.color}` }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontWeight: 800, fontSize: 13, color: "#0f2847" }}>{ot.otJdeNumero ? `OT ${ot.otJdeNumero}` : `#${ot.numeroOT}`}</span>
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(ot.fecha).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit" })}</span>
                          </div>
                          {/* Badge origen: plan vs reactiva */}
                          <div style={{ display: "flex", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
                            {ot.origenPlan ? (
                              <span style={{ fontSize: 9, fontWeight: 700, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.04em" }}>
                                📋 PLAN · JDE {ot.otJdeNumero}
                              </span>
                            ) : (
                              <span style={{ fontSize: 9, fontWeight: 700, background: "#fee2e2", color: "#dc2626", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.04em" }}>
                                ⚡ REACTIVA
                              </span>
                            )}
                            {ot.lineas.map((l, i) => (
                              <span key={i} style={{ fontSize: 9, fontWeight: 700, background: (TIPO_COLOR[l.tipoOT] ?? "#64748b") + "20", color: TIPO_COLOR[l.tipoOT] ?? "#64748b", borderRadius: 4, padding: "1px 5px" }}>
                                {l.tipoOT}
                              </span>
                            ))}
                          </div>
                          <p style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>{areaNombre(ot.areaCodigo)}</p>
                          <p style={{ fontSize: 11, color: "#475569", marginBottom: 3, lineHeight: 1.3 }}>
                            {ot.tecnicos.map((t) => t.nombreCompleto.split(" ")[0]).join(", ")}
                          </p>
                          <p style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8 }}>
                            {ot.lineas.map((l) => l.tag).join(", ")}
                          </p>

                          {/* Acciones rápidas */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <button
                              onClick={() => setSelected(ot)}
                              style={{ width: "100%", background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 6, padding: "5px 0", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                            >
                              Ver detalle →
                            </button>
                            {ot.estado === "pendiente_revision" && (
                              <>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const res = await fetch(`/api/ordenes/${ot._id}`, {
                                      method: "PATCH", headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ estado: "revisado", cambio: "OT aprobada por " + (user?.nombre ?? "supervisor"), usuarioId: user?.id ?? "sistema", nombreUsuario: user?.nombre ?? "Supervisor" }),
                                    });
                                    const data = await res.json();
                                    if (res.ok) setOrdenes((prev) => prev.map((o) => o._id === data.ot._id ? data.ot : o));
                                  }}
                                  style={{ width: "100%", background: "#dcfce7", color: "#15803d", border: "none", borderRadius: 6, padding: "5px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                >
                                  ✓ Aprobar
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const res = await fetch(`/api/ordenes/${ot._id}`, {
                                      method: "PATCH", headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ estado: "solicitar_correccion", cambio: "Supervisor solicitó corrección", usuarioId: user?.id ?? "sistema", nombreUsuario: user?.nombre ?? "Supervisor" }),
                                    });
                                    const data = await res.json();
                                    if (res.ok) setOrdenes((prev) => prev.map((o) => o._id === data.ot._id ? data.ot : o));
                                  }}
                                  style={{ width: "100%", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "5px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                >
                                  ✗ Corrección
                                </button>
                              </>
                            )}
                            {ot.estado === "revisado" && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const res = await fetch(`/api/ordenes/${ot._id}`, {
                                    method: "PATCH", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ estado: "concluido", cambio: "OT concluida y cerrada", usuarioId: user?.id ?? "sistema", nombreUsuario: user?.nombre ?? "Supervisor" }),
                                  });
                                  const data = await res.json();
                                  if (res.ok) setOrdenes((prev) => prev.map((o) => o._id === data.ot._id ? data.ot : o));
                                }}
                                style={{ width: "100%", background: "#dcfce7", color: "#15803d", border: "none", borderRadius: 6, padding: "5px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                              >
                                ✓ Concluir
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Detalle ─────────────────────────────────────────────────────────────────

  const ot = selected;
  const estadoColor = ESTADO_COLOR[ot.estado] ?? "#64748b";
  const isConcluido = ot.estado === "concluido";

  // Técnico edita en borrador/corrección; supervisor/admin en cualquier estado activo
  const enEstadoTecnico = ot.estado === "borrador" || ot.estado === "solicitar_correccion";
  const canEdit = !isConcluido && (esAdmin || (esTecnico && enEstadoTecnico) || (esSup && !esTecnico));

  // Solo técnico (o admin) puede enviar a revisión desde borrador/corrección
  const canSendToReview = enEstadoTecnico && (esTecnico || esAdmin);

  // Formulario de supervisión: solo supervisores/admins, cuando la OT está en pendiente_revision
  const showSupForm = esSup && ot.estado === "pendiente_revision";

  // Botones de aprobar/rechazar: supervisores/admins en pendiente_revision
  const canRevisar = esSup && ot.estado === "pendiente_revision";

  // Botón concluir: supervisores/admins en revisado
  const canConcluir = esSup && ot.estado === "revisado";

  const showSupReadonly = !showSupForm && !isConcluido && !!(ot.datosSupervision?.comentariosSupervisor || ot.datosSupervision?.clasificacionRCM || ot.datosSupervision?.codigoModoFallaISO);
  const hasReactivas = ot.lineas.some((l) => l.tipoOT === "CMP" || l.tipoOT === "CMR");

  return (
    <div style={S.page}>
      <AppHeader backHref="/ordenes" />
      <div style={S.wrap}>

        {/* Cabecera */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setSelected(null)} style={{ ...S.btnGhost, padding: "7px 14px" }}>← Lista</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f2847" }}>
                {ot.otJdeNumero ? `OT ${ot.otJdeNumero}` : `OT #${ot.numeroOT}`}
              </h1>
              <span style={S.badge(estadoColor)}>{ESTADO_LABEL[ot.estado]}</span>
              {ot.origenPlan ? (
                <span style={{ ...S.badge("#1d4ed8"), fontSize: 11 }}>
                  📋 Plan Semanal{ot.otJdeDia ? ` · ${ot.otJdeDia}` : ""}
                </span>
              ) : (
                <span style={{ ...S.badge("#dc2626"), fontSize: 11 }}>⚡ Reactiva</span>
              )}
              {editMode && <span style={{ ...S.badge("#f59e0b"), fontSize: 11 }}>✏ Modo edición</span>}
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(ot.fecha).toLocaleDateString("es-BO")} · {ot.turno}</p>
          </div>
          {canEdit && !editMode && (
            <button onClick={enterEditMode} style={{ ...S.btnAmber, padding: "8px 16px", fontSize: 13 }}>
              ✏ Editar OT
            </button>
          )}
          {editMode && (
            <button onClick={() => setEditMode(false)} style={{ ...S.btnGhost, padding: "8px 16px", fontSize: 13 }}>
              Cancelar edición
            </button>
          )}
        </div>

        {/* Encabezado OT */}
        <div style={S.card}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2847", marginBottom: 12 }}>Encabezado</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
            <div>
              <span style={S.label}>Área</span>
              <p style={{ fontSize: 14, color: "#1e293b" }}>{ot.areaCodigo} — {areaNombre(ot.areaCodigo)}</p>
            </div>
            <div>
              <span style={S.label}>Turno</span>
              <p style={{ fontSize: 14, color: "#1e293b" }}>{ot.turno}</p>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={S.label}>Técnico(s)</span>
              <p style={{ fontSize: 14, color: "#1e293b" }}>{ot.tecnicos.map((t) => t.nombreCompleto).join(", ")}</p>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={S.label}>N° OT JDE / OPEPLANT</span>
              {editMode ? (
                <input
                  type="text"
                  value={editOtJdeNumero}
                  onChange={e => setEditOtJdeNumero(e.target.value)}
                  placeholder="ej. 892867"
                  style={{ marginTop: 4, padding: "6px 10px", border: "1px solid #fcd34d", borderRadius: 6, fontSize: 14, fontFamily: "monospace", width: 180, background: "#fffbeb" }}
                />
              ) : (
                <p style={{ fontSize: 14, color: ot.otJdeNumero ? "#1e293b" : "#94a3b8", fontFamily: ot.otJdeNumero ? "monospace" : "inherit", fontWeight: ot.otJdeNumero ? 700 : 400 }}>
                  {ot.otJdeNumero ?? "Sin vincular"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Equipos — modo lectura */}
        {!editMode && (
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2847", marginBottom: 12 }}>
              Equipos intervenidos ({ot.lineas.length})
            </div>
            {ot.lineas.map((l, i) => (
              <div key={i} style={{ borderLeft: `3px solid ${TIPO_COLOR[l.tipoOT] ?? "#e2e8f0"}`, paddingLeft: 12, marginBottom: i < ot.lineas.length - 1 ? 14 : 0, paddingBottom: i < ot.lineas.length - 1 ? 14 : 0, borderBottom: i < ot.lineas.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{l.tag}</span>
                  <span style={S.badge(TIPO_COLOR[l.tipoOT] ?? "#64748b")}>{l.tipoOT}</span>
                </div>
                <p style={{ fontSize: 12, color: "#64748b", marginBottom: 3 }}>{l.descripcionEquipo}</p>
                {l.sintoma && <p style={{ fontSize: 12, color: "#475569" }}>Síntoma: {l.sintoma}</p>}
                {l.causaProbable && <p style={{ fontSize: 12, color: "#475569" }}>Causa: {l.causaProbable}</p>}
                {l.resolucionAplicada && <p style={{ fontSize: 12, color: "#475569" }}>Resolución: {l.resolucionAplicada}</p>}
                {l.descripcionTrabajo && <p style={{ fontSize: 12, color: "#475569" }}>{l.descripcionTrabajo}</p>}
                {l.tareasEjecutadas && l.tareasEjecutadas.length > 0 && (
                  <ul style={{ margin: "4px 0", paddingLeft: 16 }}>{l.tareasEjecutadas.map((t, ti) => <li key={ti} style={{ fontSize: 12, color: "#64748b" }}>{t}</li>)}</ul>
                )}
                {(l.tiempoEstimadoHrs || l.tiempoRealHrs) && (
                  <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
                    {l.tiempoEstimadoHrs && <span style={{ fontSize: 12, color: "#94a3b8" }}>Est: {l.tiempoEstimadoHrs}h</span>}
                    {l.tiempoRealHrs && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>Real: {l.tiempoRealHrs}h</span>}
                  </div>
                )}
                {l.observaciones && <p style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", marginTop: 2 }}>{l.observaciones}</p>}

                {l.inspeccion && (["PMP", "PMT", "PTJ"].includes(l.tipoOT)) && (
                  <div style={{ marginTop: 8, background: "#f0fdff", border: "1px solid #a5f3fc", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: "#0891b2", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                      Inspección: {l.inspeccion.checklistNombre}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {l.inspeccion.items.map((it, ii) => (
                        <div key={ii} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
                          <span style={{ color: it.ok ? "#0891b2" : "#94a3b8", fontWeight: 800, flexShrink: 0 }}>{it.ok ? "✓" : "○"}</span>
                          <span style={{ color: it.ok ? "#0f172a" : "#64748b", textDecoration: it.ok ? "none" : "none", flex: 1 }}>
                            {it.descripcion}
                            {it.obs && <span style={{ color: "#94a3b8", fontStyle: "italic" }}> — {it.obs}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Equipos — modo edición con trazabilidad */}
        {editMode && (
          <div style={{ ...S.card, border: "2px solid #f59e0b", background: "#fffbeb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e" }}>✏ Edición con Trazabilidad</div>
                <p style={{ fontSize: 11, color: "#b45309", marginTop: 2 }}>Cada cambio queda registrado en el historial con fecha y autor.</p>
              </div>
            </div>
            {editLineas.map((l, i) => {
              const hasChecklist = ["PMP", "PMT", "PTJ"].includes(l.tipoOT);
              const isCorrectivo = ["CMP", "CMR"].includes(l.tipoOT);
              const insp = l.inspeccion ?? (hasChecklist ? { checklistId: "", checklistNombre: "Checklist supervisión", items: [] } : null);
              return (
                <div key={i} style={{ borderLeft: `3px solid ${TIPO_COLOR[l.tipoOT] ?? "#e2e8f0"}`, paddingLeft: 12, marginBottom: i < editLineas.length - 1 ? 20 : 0, paddingBottom: i < editLineas.length - 1 ? 20 : 0, borderBottom: i < editLineas.length - 1 ? "1px solid #fde68a" : "none" }}>
                  <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{l.tag}</span>
                    <span style={S.badge(TIPO_COLOR[l.tipoOT] ?? "#64748b")}>{l.tipoOT}</span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{l.descripcionEquipo}</span>
                  </div>

                  {/* Tiempo real */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ ...S.label, marginBottom: 3 }}>Tiempo real (h)</label>
                    <input
                      type="number" min="0" step="0.5"
                      value={l.tiempoRealHrs ?? ""}
                      onChange={(e) => patchLinea(i, { tiempoRealHrs: e.target.value ? Number(e.target.value) : undefined })}
                      style={S.inputSm}
                    />
                    {ot.lineas[i].tiempoRealHrs !== undefined && (
                      <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Orig: {ot.lineas[i].tiempoRealHrs}h</p>
                    )}
                  </div>

                  {/* Síntoma / Causa / Resolución — CMP y CMR (correctivos) */}
                  {isCorrectivo && (
                    <>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ ...S.label, marginBottom: 3 }}>Síntoma</label>
                        <textarea value={l.sintoma ?? ""} onChange={(e) => patchLinea(i, { sintoma: e.target.value })} style={S.textareaSm} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ ...S.label, marginBottom: 3 }}>Causa probable</label>
                        <textarea value={l.causaProbable ?? ""} onChange={(e) => patchLinea(i, { causaProbable: e.target.value })} style={S.textareaSm} />
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ ...S.label, marginBottom: 3 }}>Resolución aplicada</label>
                        <textarea value={l.resolucionAplicada ?? ""} onChange={(e) => patchLinea(i, { resolucionAplicada: e.target.value })} style={S.textareaSm} />
                      </div>
                    </>
                  )}

                  {/* Checklist — CMP, PMP, PTJ */}
                  {hasChecklist && insp && (
                    <div style={{ marginBottom: 12, background: "#f0fdff", border: "1px solid #a5f3fc", borderRadius: 10, padding: "12px 14px" }}>
                      <label style={{ ...S.label, marginBottom: 8, color: "#0891b2" }}>
                        Checklist — {insp.checklistNombre || "sin nombre"}
                      </label>

                      {/* Ítems existentes */}
                      {insp.items.length === 0 && (
                        <p style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", marginBottom: 8 }}>
                          Sin ítems aún. Agregue uno abajo.
                        </p>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                        {insp.items.map((it, ii) => (
                          <div key={ii} style={{ background: "white", borderRadius: 8, border: "1px solid #e0f7fa", padding: "8px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                              <input
                                type="checkbox"
                                checked={it.ok}
                                onChange={() => toggleItemChecklist(i, ii)}
                                style={{ width: 15, height: 15, accentColor: "#0891b2", cursor: "pointer", flexShrink: 0 }}
                              />
                              <span style={{ flex: 1, fontSize: 13, color: it.ok ? "#0891b2" : "#1e293b", fontWeight: it.ok ? 600 : 400, textDecoration: it.ok ? "line-through" : "none" }}>
                                {ii + 1}. {it.descripcion}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeItemChecklist(i, ii)}
                                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, flexShrink: 0 }}
                              >✕</button>
                            </div>
                            <input
                              type="text"
                              value={it.obs}
                              onChange={(e) => editObsChecklist(i, ii, e.target.value)}
                              placeholder="Comentario del supervisor (opcional)"
                              style={{ ...S.input, fontSize: 12, padding: "5px 9px", background: "#f8fafc" }}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Agregar ítem nuevo */}
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={itemCheckInputs[i] ?? ""}
                          onChange={(e) => setItemCheckInputs((ts) => ts.map((t, ii) => (ii === i ? e.target.value : t)))}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItemChecklist(i); } }}
                          placeholder="Nuevo ítem del checklist…"
                          style={{ ...S.input, fontSize: 12, padding: "6px 10px" }}
                        />
                        <button
                          type="button"
                          onClick={() => addItemChecklist(i)}
                          style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap" as const, borderColor: "#a5f3fc", color: "#0891b2" }}
                        >+ Ítem</button>
                      </div>
                    </div>
                  )}

                  {/* Tareas — PMP, PMT, PTJ */}
                  {hasChecklist && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ ...S.label, marginBottom: 6 }}>Tareas</label>
                      {(l.tareasEjecutadas ?? []).map((t, ti) => (
                        <div key={ti} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{ flex: 1, fontSize: 13, color: "#1e293b", background: "#f8fafc", borderRadius: 6, padding: "5px 9px" }}>{t}</span>
                          <button type="button" onClick={() => removeTareaLinea(i, ti)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14 }}>✕</button>
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <input
                          value={tareaInputs[i] ?? ""}
                          onChange={(e) => setTareaInputs((ts) => ts.map((t, ii) => (ii === i ? e.target.value : t)))}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTareaLinea(i); } }}
                          placeholder="Nueva tarea…"
                          style={{ ...S.input, fontSize: 13, padding: "6px 10px" }}
                        />
                        <button type="button" onClick={() => addTareaLinea(i)} style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap" as const }}>+ Tarea</button>
                      </div>
                    </div>
                  )}

                  {/* Observaciones — siempre */}
                  <div>
                    <label style={{ ...S.label, marginBottom: 3 }}>Observaciones</label>
                    <textarea
                      value={l.observaciones ?? ""}
                      onChange={(e) => patchLinea(i, { observaciones: e.target.value })}
                      placeholder="Observación adicional (opcional)"
                      style={{ ...S.textareaSm, minHeight: 40 }}
                    />
                  </div>
                </div>
              );
            })}
            {saveErr && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>⚠ {saveErr}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setEditMode(false)} style={{ ...S.btnGhost, padding: "8px 14px", fontSize: 13 }}>Cancelar</button>
              <button onClick={saveEdit} disabled={saving} style={{ ...S.btnAmber, padding: "8px 18px", fontSize: 13, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Guardando…" : "Guardar cambios con trazabilidad"}
              </button>
            </div>
          </div>
        )}

        {/* Supervisión editable */}
        {showSupForm && (
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2847", marginBottom: 14 }}>Datos de Supervisión</div>

            {/* CMP / CMR — correctivos: RCM + Código Modo de Falla */}
            {hasReactivas && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Tipo de Actividad (RCM)</label>
                  <select value={supForm.clasificacionRCM} onChange={(e) => patchSup({ clasificacionRCM: e.target.value })} style={S.select}>
                    <option value="">— Seleccionar —</option>
                    {CLASIFICACIONES_RCM.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Código Modo de Falla (ISO 14224)</label>
                  <input
                    value={supForm.codigoModoFallaISO}
                    onChange={(e) => patchSup({ codigoModoFallaISO: e.target.value })}
                    placeholder="Ej: EL-MOT-FASE-01"
                    style={S.input}
                  />
                </div>
              </>
            )}

            {/* PMP / PMT / PTJ — preventivos: Genera OT de Hallazgo */}
            {!hasReactivas && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>¿Genera OT de Hallazgo?</label>
                  <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                    {([true, false] as const).map((val) => (
                      <label key={String(val)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "#374151" }}>
                        <input
                          type="radio"
                          name="generaOtHallazgo"
                          checked={supForm.generaOtHallazgo === val}
                          onChange={() => patchSup({ generaOtHallazgo: val })}
                          style={{ accentColor: "#2563eb" }}
                        />
                        {val ? "Sí" : "No"}
                      </label>
                    ))}
                  </div>
                </div>
                {supForm.generaOtHallazgo && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={S.label}>Nueva OT Generada</label>
                    <input
                      value={supForm.otGenerada}
                      onChange={(e) => patchSup({ otGenerada: e.target.value })}
                      placeholder="Número de OT generada"
                      style={S.input}
                    />
                  </div>
                )}
              </>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={supForm.requierePlanificacion} onChange={(e) => patchSup({ requierePlanificacion: e.target.checked })} style={{ width: 16, height: 16, accentColor: "#2563eb" }} />
                <span style={{ fontSize: 13, color: "#374151" }}>Requiere planificación</span>
              </label>
            </div>
            <div>
              <label style={S.label}>Comentarios del supervisor</label>
              <textarea value={supForm.comentariosSupervisor} onChange={(e) => patchSup({ comentariosSupervisor: e.target.value })} placeholder="Comentarios adicionales" style={{ ...S.textarea, minHeight: 56 }} />
            </div>
          </div>
        )}

        {/* Supervisión solo lectura */}
        {showSupReadonly && (
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2847", marginBottom: 12 }}>Datos de Supervisión</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ot.datosSupervision.clasificacionRCM && (
                <div><span style={S.label}>Tipo de Actividad (RCM)</span><p style={{ fontSize: 13 }}>{ot.datosSupervision.clasificacionRCM}</p></div>
              )}
              {ot.datosSupervision.codigoModoFallaISO && (
                <div><span style={S.label}>Código Modo de Falla</span><p style={{ fontSize: 13 }}>{ot.datosSupervision.codigoModoFallaISO}</p></div>
              )}
              {ot.datosSupervision.comentariosSupervisor && (
                <div><span style={S.label}>Comentarios del Supervisor</span><p style={{ fontSize: 13, lineHeight: 1.6 }}>{ot.datosSupervision.comentariosSupervisor}</p></div>
              )}
            </div>
          </div>
        )}

        {/* Acciones de estado */}
        {!isConcluido && !editMode && (canSendToReview || canRevisar || canConcluir) && (
          <div style={{ ...S.card, background: "#f8fafc" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2847", marginBottom: 10 }}>Acciones</div>
            {saveErr && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 10 }}>⚠ {saveErr}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {canSendToReview && (
                <button onClick={() => cambiarEstado("pendiente_revision", "OT enviada a revisión por " + (user?.nombre ?? "técnico"))} disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Guardando…" : "Enviar a revisión ↑"}
                </button>
              )}
              {canRevisar && (
                <>
                  <button onClick={() => cambiarEstado("solicitar_correccion", "Supervisor solicitó corrección")} disabled={saving} style={{ ...S.btnRed, opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Guardando…" : "Solicitar corrección"}
                  </button>
                  <button onClick={() => cambiarEstado("revisado", "OT aprobada por " + (user?.nombre ?? "supervisor"))} disabled={saving} style={{ ...S.btnGreen, opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Guardando…" : "Aprobar OT ✓"}
                  </button>
                </>
              )}
              {canConcluir && (
                <button onClick={() => cambiarEstado("concluido", "OT concluida y cerrada")} disabled={saving} style={{ ...S.btnGreen, opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Guardando…" : "Concluir OT ✓"}
                </button>
              )}
            </div>
          </div>
        )}

        {(isConcluido || (esSup && ot.estado === "revisado")) && (
          <div style={{ ...S.card, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 13, color: "#15803d", fontWeight: 600, margin: 0 }}>
              {isConcluido ? "OT concluida — solo lectura." : "OT revisada — lista para concluir."}
            </p>
            <button
              onClick={() => generarInformeOT(ot)}
              style={{ background: "#0d2847", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              Descargar Informe PDF
            </button>
          </div>
        )}

        {/* ── Avances Diarios (OTs multi-día del plan) ── */}
        {ot.origenPlan && (
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2847" }}>
                  Avances diarios
                  {(ot.registrosDiarios?.length ?? 0) > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "2px 7px" }}>
                      {ot.registrosDiarios!.length} día{ot.registrosDiarios!.length !== 1 ? "s" : ""} · {ot.registrosDiarios!.reduce((s, r) => s + r.hhTrabajadas, 0)}HH acumuladas
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Registro de trabajo por día para esta OT del plan</p>
              </div>
              {!isConcluido && (esTecnico || esAdmin) && !showAvance && (
                <button
                  onClick={() => setShowAvance(true)}
                  style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  + Agregar avance del día
                </button>
              )}
            </div>

            {/* Formulario de nuevo avance */}
            {showAvance && (
              <div style={{ background: "#eff6ff", border: "2px solid #bfdbfe", borderRadius: 10, padding: "14px", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#1d4ed8", marginBottom: 12 }}>Avance del día</div>
                <div style={{ display: "grid", gridTemplateColumns: "160px 120px", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={S.label}>Fecha</label>
                    <input type="date" value={avanceForm.fecha}
                      onChange={e => setAvanceForm(f => ({ ...f, fecha: e.target.value }))}
                      style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>HH trabajadas</label>
                    <input type="number" min="0" step="0.5" value={avanceForm.hhTrabajadas || ""}
                      onChange={e => setAvanceForm(f => ({ ...f, hhTrabajadas: Number(e.target.value) }))}
                      style={S.input} />
                  </div>
                </div>

                {/* Tareas del día */}
                <div style={{ marginBottom: 10 }}>
                  <label style={S.label}>Tareas ejecutadas hoy</label>
                  {avanceForm.tareasEjecutadas.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ flex: 1, fontSize: 13, background: "white", borderRadius: 6, padding: "5px 9px", border: "1px solid #e2e8f0" }}>{t}</span>
                      <button type="button"
                        onClick={() => setAvanceForm(f => ({ ...f, tareasEjecutadas: f.tareasEjecutadas.filter((_, j) => j !== i) }))}
                        style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={avanceTareaInput}
                      onChange={e => setAvanceTareaInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && avanceTareaInput.trim()) {
                          e.preventDefault();
                          setAvanceForm(f => ({ ...f, tareasEjecutadas: [...f.tareasEjecutadas, avanceTareaInput.trim()] }));
                          setAvanceTareaInput("");
                        }
                      }}
                      placeholder="Describir tarea y presionar Enter…"
                      style={{ ...S.input, fontSize: 13 }} />
                    <button type="button"
                      onClick={() => { if (avanceTareaInput.trim()) { setAvanceForm(f => ({ ...f, tareasEjecutadas: [...f.tareasEjecutadas, avanceTareaInput.trim()] })); setAvanceTareaInput(""); } }}
                      style={{ ...S.btnGhost, padding: "8px 14px", fontSize: 13, whiteSpace: "nowrap" as const }}>+ Tarea</button>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Observaciones</label>
                  <textarea value={avanceForm.observaciones}
                    onChange={e => setAvanceForm(f => ({ ...f, observaciones: e.target.value }))}
                    placeholder="Estado del trabajo, materiales usados, pendientes…"
                    style={{ ...S.textarea, minHeight: 52 }} />
                </div>

                {saveErr && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>⚠ {saveErr}</p>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => { setShowAvance(false); setSaveErr(""); }} style={{ ...S.btnGhost, padding: "8px 14px", fontSize: 13 }}>Cancelar</button>
                  <button onClick={guardarAvance} disabled={saving} style={{ ...S.btnGreen, padding: "8px 18px", fontSize: 13, opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Guardando…" : "Guardar avance"}
                  </button>
                </div>
              </div>
            )}

            {/* Lista de avances existentes */}
            {(ot.registrosDiarios?.length ?? 0) === 0 && !showAvance ? (
              <p style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>Sin avances registrados aún. El técnico debe agregar el trabajo de cada día.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(ot.registrosDiarios ?? []).map((r, i) => (
                  <div key={r._id ?? i} style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", padding: "12px 14px", borderLeft: "3px solid #2563eb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: "#0f2847" }}>
                          {new Date(r.fecha).toLocaleDateString("es-BO", { weekday: "short", day: "2-digit", month: "short" })}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "2px 8px" }}>{r.hhTrabajadas}HH</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{r.tecnico}</span>
                    </div>
                    {r.tareasEjecutadas.length > 0 && (
                      <ul style={{ margin: "4px 0 6px 0", paddingLeft: 16 }}>
                        {r.tareasEjecutadas.map((t, ti) => (
                          <li key={ti} style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{t}</li>
                        ))}
                      </ul>
                    )}
                    {r.observaciones && (
                      <p style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>{r.observaciones}</p>
                    )}
                  </div>
                ))}
                {/* Totales */}
                {(ot.registrosDiarios?.length ?? 0) > 1 && (
                  <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 24 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#0369a1" }}>Total días</span>
                      <p style={{ fontSize: 16, fontWeight: 800, color: "#0369a1" }}>{ot.registrosDiarios!.length}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#0369a1" }}>HH acumuladas</span>
                      <p style={{ fontSize: 16, fontWeight: 800, color: "#0369a1" }}>{ot.registrosDiarios!.reduce((s, r) => s + r.hhTrabajadas, 0)}HH</p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#0369a1" }}>Técnicos</span>
                      <p style={{ fontSize: 12, color: "#0369a1" }}>{[...new Set(ot.registrosDiarios!.map(r => r.tecnico))].join(", ")}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Historial */}
        {ot.historialCambios.length > 0 && (
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2847", marginBottom: 12 }}>Historial de cambios</div>
            {[...ot.historialCambios].reverse().map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingBottom: i < ot.historialCambios.length - 1 ? 10 : 0, marginBottom: i < ot.historialCambios.length - 1 ? 10 : 0, borderBottom: i < ot.historialCambios.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb", marginTop: 5, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, color: "#1e293b", fontWeight: 500, lineHeight: 1.4 }}>{c.cambio}</p>
                  <p style={{ fontSize: 11, color: "#94a3b8" }}>{c.nombreUsuario} · {new Date(c.fechaHora).toLocaleString("es-BO")}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
