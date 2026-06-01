"use client";

import { useState, useEffect, useCallback } from "react";
import AppHeader from "@/components/AppHeader";
import { useUser } from "@/context/AuthContext";


// ─── Helpers de semana ISO ────────────────────────────────────────────────────

function isoWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getMondayOfWeek(anio: number, semana: number): Date {
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (semana - 1) * 7);
  return monday;
}

function isoDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type OTPlan = {
  numeroOT: string;
  tag: string;
  descripcion: string;
  grupo: string; // "Diurno" | "Nocturno"
  dia: string;
  esGuardia?: boolean;
};

type Programa = {
  _id: string;
  disciplina: string;
  areaCodigo: string;
  otsProgramadas: OTPlan[];
};

type Linea = {
  tag: string;
  tipoOT: string;
  sintoma?: string;
  resolucionAplicada?: string;
  tiempoRealHrs?: number;
  descripcionEquipo?: string;
};

type OTReactiva = {
  _id: string;
  numeroOT: string;
  fecha: string;
  turno: string;
  areaCodigo: string;
  otJdeNumero?: string;
  tecnicos: { nombreCompleto: string }[];
  lineas: Linea[];
  estado: string;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] as const;
const DIAS_FULL: Record<string, string> = {
  Lu: "Lunes", Ma: "Martes", Mi: "Miércoles",
  Ju: "Jueves", Vi: "Viernes", Sa: "Sábado", Do: "Domingo",
};

const ESTADO_COLOR: Record<string, string> = {
  borrador: "#64748b", pendiente_revision: "#d97706",
  solicitar_correccion: "#dc2626", revisado: "#2563eb", concluido: "#16a34a",
};
const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador", pendiente_revision: "Pend. revisión",
  solicitar_correccion: "Corrección", revisado: "Revisado", concluido: "Concluido",
};
const TIPO_COLOR: Record<string, string> = {
  CMP: "#dc2626", CMR: "#d97706", PMP: "#2563eb", PMT: "#0891b2", PTJ: "#7c3aed",
};

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S = {
  badge: (color: string) => ({
    display: "inline-block" as const,
    background: color + "18", color,
    border: `1px solid ${color}40`,
    borderRadius: 5, padding: "2px 8px",
    fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" as const,
  }),
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TurneroPage() {
  const { user } = useUser();
  const hoy = new Date();

  const [semana, setSemana] = useState(isoWeekNumber(hoy));
  const [anio, setAnio]     = useState(hoy.getFullYear());
  const [programas, setProgramas]       = useState<Programa[]>([]);
  const [otsReactivas, setOtsReactivas] = useState<OTReactiva[]>([]);
  const [loading, setLoading]           = useState(false);

  // Fechas de la semana
  const lunes = getMondayOfWeek(anio, semana);
  const domingo = new Date(lunes); domingo.setUTCDate(lunes.getUTCDate() + 6);

  // Mapa día abrev → fecha
  const fechasDias = DIAS_SEMANA.reduce<Record<string, Date>>((acc, d, i) => {
    const f = new Date(lunes); f.setUTCDate(lunes.getUTCDate() + i);
    acc[d] = f; return acc;
  }, {});

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Cargar programación semanal — filtrada por áreas del usuario
      const userAreas: string[] = user?.areas ?? [];
      const progData = await fetch(
        `/api/programacion-semanal?semana=${semana}&anio=${anio}&limit=20`
      ).then(r => r.json()).catch(() => []);
      const todosProgs: Programa[] = Array.isArray(progData) ? progData : [];
      // Si el usuario tiene áreas asignadas, filtrar solo sus áreas
      const progs = userAreas.length > 0
        ? todosProgs.filter(p => p.areaCodigo && userAreas.includes(p.areaCodigo))
        : todosProgs;
      setProgramas(progs);

      // 2. Extraer números OPEPLANT únicos de esta semana
      const opeplants = new Set<string>();
      for (const prog of progs) {
        for (const ot of prog.otsProgramadas) {
          if (ot.esGuardia || ot.tag === "OPEPLANT") {
            opeplants.add(ot.numeroOT);
          }
        }
      }

      if (opeplants.size === 0) { setOtsReactivas([]); return; }

      // 3. Para cada OPEPLANT, buscar OTs reactivas vinculadas en el rango de la semana
      const promesas = Array.from(opeplants).map(num =>
        fetch(
          `/api/ordenes?otJdeNumero=${num}&fechaDesde=${isoDateStr(lunes)}&fechaHasta=${isoDateStr(domingo)}&limit=200`
        ).then(r => r.json()).catch(() => [])
      );
      const resultados = await Promise.all(promesas);
      const todas: OTReactiva[] = resultados.flat().filter(Boolean);
      // Filtrar por áreas del usuario si están definidas
      const filtradas = userAreas.length > 0
        ? todas.filter(ot => !ot.areaCodigo || userAreas.includes(ot.areaCodigo))
        : todas;
      setOtsReactivas(filtradas);
    } finally {
      setLoading(false);
    }
  }, [semana, anio, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargar(); }, [cargar]);

  function navSemana(dir: -1 | 1) {
    const n = semana + dir;
    if (n < 1)       { setSemana(52); setAnio(a => a - 1); }
    else if (n > 52) { setSemana(1);  setAnio(a => a + 1); }
    else setSemana(n);
  }

  // ── Áreas únicas presentes en los programas cargados ─────────────────────────
  type AreaInfo = { areaCodigo: string; disciplina: string };
  const areasUnicas: AreaInfo[] = [];
  const areasSeen = new Set<string>();
  for (const prog of programas) {
    const key = prog.areaCodigo || prog.disciplina;
    if (!areasSeen.has(key)) {
      areasSeen.add(key);
      areasUnicas.push({ areaCodigo: prog.areaCodigo, disciplina: prog.disciplina });
    }
  }

  // ── Identificar OPEPLANT del plan por área y grupo ────────────────────────────
  type OpeplantInfo = { numeroOT: string; grupo: string; disciplina: string; dia: string; areaCodigo: string };
  const opeplantEntradas: OpeplantInfo[] = [];
  for (const prog of programas) {
    for (const ot of prog.otsProgramadas) {
      if (ot.esGuardia || ot.tag === "OPEPLANT") {
        opeplantEntradas.push({
          numeroOT: ot.numeroOT,
          grupo: ot.grupo,
          disciplina: prog.disciplina,
          dia: ot.dia,
          areaCodigo: prog.areaCodigo,
        });
      }
    }
  }

  const grupos = ["Diurno", "Nocturno"] as const;

  // OTs reactivas filtradas por área y turno
  function otsDeAreaGrupo(areaCodigo: string, grupo: string): OTReactiva[] {
    return otsReactivas.filter(ot =>
      ot.turno === grupo && (!ot.areaCodigo || ot.areaCodigo === areaCodigo)
    );
  }

  function otsPorAreaDia(areaCodigo: string, grupo: string, diaAbrev: string): OTReactiva[] {
    const fechaStr = isoDateStr(fechasDias[diaAbrev]);
    return otsDeAreaGrupo(areaCodigo, grupo).filter(ot => ot.fecha.startsWith(fechaStr));
  }

  // KPIs globales
  const totalOTs = otsReactivas.length;
  const totalHH  = otsReactivas.reduce((s, ot) =>
    s + ot.lineas.reduce((a, l) => a + (l.tiempoRealHrs ?? 0), 0), 0);
  const diasConOTs = new Set(otsReactivas.map(ot => ot.fecha.slice(0, 10))).size;

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <AppHeader backHref="/ordenes" />

      {/* Header */}
      <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f2847" }}>Bitácora Turnero</h1>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>OTs reactivas vinculadas a OPEPLANT — acumulado semanal</p>
          </div>
          <div style={{ flex: 1 }} />
          {/* Navegador semana */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => navSemana(-1)}
              style={{ width: 32, height: 32, border: "1px solid #e2e8f0", borderRadius: 8, background: "white", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#0f2847", display: "flex", alignItems: "center", justifyContent: "center" }}
            >‹</button>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f2847", background: "#f8fafc", borderRadius: 8, padding: "5px 14px", border: "1px solid #e2e8f0" }}>
              Sem {semana} · {anio}
              <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8", marginLeft: 8 }}>
                {lunes.toLocaleDateString("es-BO", { day: "2-digit", month: "short", timeZone: "UTC" })} – {domingo.toLocaleDateString("es-BO", { day: "2-digit", month: "short", timeZone: "UTC" })}
              </span>
            </div>
            <button
              onClick={() => navSemana(1)}
              style={{ width: 32, height: 32, border: "1px solid #e2e8f0", borderRadius: 8, background: "white", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#0f2847", display: "flex", alignItems: "center", justifyContent: "center" }}
            >›</button>
          </div>
          <button onClick={cargar} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "white", cursor: "pointer", fontSize: 13, color: "#64748b", padding: "6px 12px" }}>
            ↻ Actualizar
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px" }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { val: totalOTs,      label: "OTs reactivas registradas", color: "#2563eb" },
            { val: Math.round(totalHH * 10) / 10, label: "HH atendidas total", color: "#d97706" },
            { val: diasConOTs,    label: "Días con actividad",        color: "#16a34a" },
          ].map(k => (
            <div key={k.label} style={{ background: "white", borderRadius: 12, padding: "14px 16px", textAlign: "center", border: `3px solid ${k.color}20`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.val}</p>
              <p style={{ fontSize: 11, color: "#64748b" }}>{k.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>Cargando…</div>
        ) : opeplantEntradas.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, background: "white", borderRadius: 14, color: "#94a3b8" }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🔄</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#0f2847" }}>Sin OPEPLANT esta semana</p>
            <p style={{ fontSize: 13 }}>Verifica que el programa semanal esté cargado</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {areasUnicas.map(area => {
              const opepDeArea = opeplantEntradas.filter(e => e.areaCodigo === area.areaCodigo);
              if (opepDeArea.length === 0) return null;
              const otsArea = otsReactivas.filter(ot => !ot.areaCodigo || ot.areaCodigo === area.areaCodigo);
              const hhArea = otsArea.reduce((s, ot) => s + ot.lineas.reduce((a, l) => a + (l.tiempoRealHrs ?? 0), 0), 0);

              return (
                <div key={area.areaCodigo}>
                  {/* Encabezado de área */}
                  {areasUnicas.length > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 0" }}>
                      <div style={{ height: 2, flex: 1, background: "#e2e8f0" }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f2847", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 20, padding: "4px 14px" }}>
                        {area.disciplina} · Área {area.areaCodigo}
                      </span>
                      <span style={{ fontSize: 11, color: "#d97706", fontWeight: 700 }}>
                        {otsArea.length} OTs · {Math.round(hhArea * 10) / 10}HH semana
                      </span>
                      <div style={{ height: 2, flex: 1, background: "#e2e8f0" }} />
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {grupos.map(grupo => {
                    const otsGrupo = otsDeAreaGrupo(area.areaCodigo, grupo);
                    const hhGrupo  = otsGrupo.reduce((s, ot) => s + ot.lineas.reduce((a, l) => a + (l.tiempoRealHrs ?? 0), 0), 0);
                    const opepGrupo = opepDeArea.filter(e => e.grupo === grupo);
                    if (opepGrupo.length === 0) return null;

                    const opepNums = [...new Set(opepGrupo.map(e => e.numeroOT))].join(", ");

                    return (
                      <div key={grupo} style={{ background: "white", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
                        {/* Cabecera grupo */}
                        <div style={{
                          background: grupo === "Nocturno" ? "#0f2847" : "#fef3c7",
                          color: grupo === "Nocturno" ? "#e2e8f0" : "#92400e",
                          padding: "12px 18px",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}>
                          <div>
                            <span style={{ fontWeight: 800, fontSize: 15 }}>
                              {grupo === "Nocturno" ? "🌙" : "☀️"} Turno {grupo}
                            </span>
                            <span style={{ fontSize: 11, marginLeft: 12, opacity: 0.7 }}>
                              OPEPLANT {opepNums} · {area.disciplina}
                            </span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>
                            {otsGrupo.length} OT{otsGrupo.length !== 1 ? "s" : ""} · {Math.round(hhGrupo * 10) / 10}HH
                          </span>
                        </div>

                        {/* Días de la semana */}
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {DIAS_SEMANA.map((dia, idx) => {
                            const otsDelDia = otsPorAreaDia(area.areaCodigo, grupo, dia);
                            const fecha = fechasDias[dia];
                            const hhDia = otsDelDia.reduce((s, ot) => s + ot.lineas.reduce((a, l) => a + (l.tiempoRealHrs ?? 0), 0), 0);

                      return (
                        <div key={dia} style={{ borderTop: idx > 0 ? "1px solid #f1f5f9" : undefined }}>
                          {/* Subencabezado día */}
                          <div style={{ background: "#f8fafc", padding: "8px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                              {DIAS_FULL[dia]} {fecha.toLocaleDateString("es-BO", { day: "2-digit", month: "short", timeZone: "UTC" })}
                            </span>
                            {otsDelDia.length > 0 ? (
                              <span style={{ fontSize: 11, color: "#d97706", fontWeight: 700 }}>
                                {otsDelDia.length} OT{otsDelDia.length !== 1 ? "s" : ""} · {Math.round(hhDia * 10) / 10}HH
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: "#cbd5e1", fontStyle: "italic" }}>Sin actividad</span>
                            )}
                          </div>

                          {/* Lista de OTs reactivas del día */}
                          {otsDelDia.length > 0 && (
                            <div style={{ padding: "8px 18px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                              {otsDelDia.map(ot => {
                                const estadoColor = ESTADO_COLOR[ot.estado] ?? "#64748b";
                                const hhOT = ot.lineas.reduce((s, l) => s + (l.tiempoRealHrs ?? 0), 0);
                                return (
                                  <div key={ot._id} style={{ background: "#fafafa", borderRadius: 10, border: "1px solid #e2e8f0", padding: "10px 14px", borderLeft: "3px solid #d97706" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                      <span style={{ fontWeight: 800, fontSize: 13, fontFamily: "monospace", color: "#0f2847" }}>{ot.otJdeNumero ? `OT ${ot.otJdeNumero}` : `#${ot.numeroOT}`}</span>
                                      <span style={S.badge(estadoColor)}>{ESTADO_LABEL[ot.estado] ?? ot.estado}</span>
                                      {ot.lineas.map((l, i) => (
                                        <span key={i} style={S.badge(TIPO_COLOR[l.tipoOT] ?? "#64748b")}>{l.tipoOT}</span>
                                      ))}
                                      {hhOT > 0 && (
                                        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#d97706" }}>{Math.round(hhOT * 10) / 10}HH</span>
                                      )}
                                    </div>
                                    <p style={{ fontSize: 12, color: "#475569", marginBottom: 3 }}>
                                      {ot.tecnicos.map(t => t.nombreCompleto).join(" · ")}
                                    </p>
                                    {ot.lineas.map((l, i) => (
                                      <div key={i} style={{ marginTop: 3 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", fontFamily: "monospace" }}>{l.tag}</span>
                                        {l.descripcionEquipo && <span style={{ fontSize: 11, color: "#64748b", marginLeft: 6 }}>{l.descripcionEquipo}</span>}
                                        {l.sintoma && <p style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic", marginTop: 1 }}>{l.sintoma}</p>}
                                        {l.resolucionAplicada && <p style={{ fontSize: 11, color: "#16a34a", marginTop: 1 }}>✓ {l.resolucionAplicada}</p>}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                        {/* Footer del grupo */}
                        <div style={{ background: "#f1f5f9", padding: "10px 18px", display: "flex", justifyContent: "flex-end", gap: 24 }}>
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            Total semana: <strong>{otsGrupo.length} OT{otsGrupo.length !== 1 ? "s" : ""}</strong>
                          </span>
                          <span style={{ fontSize: 12, color: "#d97706", fontWeight: 700 }}>
                            {Math.round(hhGrupo * 10) / 10} HH acumuladas
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Nota informativa */}
        {!loading && otsReactivas.length === 0 && opeplantEntradas.length > 0 && (
          <div style={{ marginTop: 16, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "14px 18px" }}>
            <p style={{ fontSize: 13, color: "#92400e", fontWeight: 600 }}>Sin OTs reactivas registradas esta semana</p>
            <p style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>
              Para vincular una OT reactiva a la OPEPLANT, al registrar la OT coloca el número{" "}
              <strong>{[...new Set(opeplantEntradas.map(e => e.numeroOT))].join(" / ")}</strong>{" "}
              en el campo "N° OT OPEPLANT".
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
