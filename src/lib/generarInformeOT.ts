import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ── Tipos mínimos necesarios ──────────────────────────────────────────────────
interface LineaOT {
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
}

interface DatosSupervision {
  codigoModoFallaISO?: string;
  clasificacionRCM?: string;
  criticidadEquipo?: string;
  leccionAprendida?: string;
  comentariosSupervisor?: string;
  revisadoPor?: string;
  revisadoEn?: string;
}

interface TecnicoRef { nombreCompleto: string }

interface CambioHistorial {
  fechaHora: string;
  nombreUsuario: string;
  cambio: string;
}

interface OTData {
  numeroOT?: string;
  otJdeNumero?: string;
  fecha: string;
  turno: string;
  areaCodigo: string;
  estado: string;
  tecnicos: TecnicoRef[];
  lineas: LineaOT[];
  datosSupervision?: DatosSupervision;
  historialCambios?: CambioHistorial[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TIPO_OT_LABEL: Record<string, string> = {
  CMP: "Correctivo Mayor Programado",
  CMR: "Correctivo Menor Rutinario",
  PMP: "Preventivo Mayor Programado",
  PMT: "Preventivo Menor/Tarea",
  PTJ: "Predictivo",
};

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  pendiente_revision: "Pendiente revisión",
  solicitar_correccion: "En corrección",
  revisado: "Revisado",
  concluido: "Concluido",
};

function fmt(d?: string | Date) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtHrs(n?: number) {
  if (n == null) return "—";
  return `${n} h`;
}

// ── Paleta de colores SYNC MSC ────────────────────────────────────────────────
const AZUL   = [13, 40, 71]   as [number, number, number]; // #0d2847
const AZUL2  = [37, 99, 235]  as [number, number, number]; // #2563eb
const GRIS   = [100, 116, 139] as [number, number, number];
const BLANCO = [255, 255, 255] as [number, number, number];
const CELDA  = [239, 246, 255] as [number, number, number]; // #eff6ff

// ── Generador principal ───────────────────────────────────────────────────────
export function generarInformeOT(ot: OTData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();   // 210
  const ancho = PW - 30; // márgenes 15 mm c/lado

  let y = 15;

  // ── Encabezado ────────────────────────────────────────────────────────────
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, PW, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLANCO);
  doc.text("SYNC MSC", 15, 11);

  doc.setFont("helvetica", "normal");
  doc.text("Sistema de Gestión de Mantenimiento", 15, 17);
  const numOT = ot.otJdeNumero ?? ot.numeroOT ?? "—";
  doc.text(`Informe de Cierre — OT #${numOT}`, 15, 23);

  // Estado badge (esquina derecha)
  doc.setFillColor(...AZUL2);
  doc.roundedRect(PW - 55, 8, 40, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLANCO);
  doc.text(ESTADO_LABEL[ot.estado] ?? ot.estado, PW - 35, 15.5, { align: "center" });

  y = 36;

  // ── Sección 1: Datos Generales ────────────────────────────────────────────
  seccionTitulo(doc, "1. DATOS GENERALES", y, PW);
  y += 8;

  const tecnicos = ot.tecnicos.map(t => t.nombreCompleto).join(", ");
  // Nombre del supervisor: buscar en historial la entrada de aprobación
  const entradaRevision = (ot.historialCambios ?? [])
    .slice()
    .reverse()
    .find(c => c.cambio.toLowerCase().includes("aprobada") || c.cambio.toLowerCase().includes("revisado") || c.cambio.toLowerCase().includes("concluida"));
  const sup = entradaRevision?.nombreUsuario ?? "—";
  const fechaRevision = ot.datosSupervision?.revisadoEn
    ? fmt(ot.datosSupervision.revisadoEn)
    : entradaRevision?.fechaHora
      ? fmt(entradaRevision.fechaHora)
      : "—";

  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15 },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: GRIS, cellWidth: 45 },
      1: { textColor: [30, 41, 59] },
      2: { fontStyle: "bold", textColor: GRIS, cellWidth: 45 },
      3: { textColor: [30, 41, 59] },
    },
    body: [
      ["N° Orden de Trabajo", `OT-${numOT}`, "Fecha", fmt(ot.fecha)],
      ["Turno", ot.turno, "Área", ot.areaCodigo],
      ["Técnico(s)", tecnicos, "Revisado por", sup],
      ["Estado", ESTADO_LABEL[ot.estado] ?? ot.estado, "Fecha revisión", fechaRevision],
    ],
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Sección 2: Equipos Intervenidos ───────────────────────────────────────
  seccionTitulo(doc, "2. EQUIPOS INTERVENIDOS", y, PW);
  y += 8;

  const correctivos = ot.lineas.filter(l => ["CMP", "CMR"].includes(l.tipoOT));
  const preventivos = ot.lineas.filter(l => !["CMP", "CMR"].includes(l.tipoOT));

  if (correctivos.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...AZUL2);
    doc.text("Trabajos Correctivos", 15, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: 15, right: 15 },
      head: [["TAG / Equipo", "Tipo OT", "Síntoma (Modo ISO)", "Causa Probable (MSC)", "Resolución Aplicada", "HH Est.", "HH Real"]],
      body: correctivos.map(l => [
        `${l.tag}\n${l.descripcionEquipo}`,
        TIPO_OT_LABEL[l.tipoOT] ?? l.tipoOT,
        l.sintoma ?? "—",
        l.causaProbable ?? "—",
        l.resolucionAplicada ?? "—",
        fmtHrs(l.tiempoEstimadoHrs),
        fmtHrs(l.tiempoRealHrs),
      ]),
      headStyles: { fillColor: AZUL, textColor: BLANCO, fontSize: 7.5, fontStyle: "bold", cellPadding: 3 },
      bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: CELDA },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 28 },
        2: { cellWidth: 28 },
        3: { cellWidth: 28 },
        4: { cellWidth: 38 },
        5: { cellWidth: 12, halign: "center" },
        6: { cellWidth: 12, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.column.index === 0 && data.section === "body") {
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  if (preventivos.length > 0) {
    verificarSaltoPage(doc, y, 30);
    y = verificarSaltoPageY(doc, y, 30);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...AZUL2);
    doc.text("Trabajos Preventivos / Predictivos", 15, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: 15, right: 15 },
      head: [["TAG / Equipo", "Tipo OT", "Descripción del Trabajo", "Tareas Ejecutadas", "HH Est.", "HH Real"]],
      body: preventivos.map(l => [
        `${l.tag}\n${l.descripcionEquipo}`,
        TIPO_OT_LABEL[l.tipoOT] ?? l.tipoOT,
        l.descripcionTrabajo ?? "—",
        (l.tareasEjecutadas ?? []).join("\n") || "—",
        fmtHrs(l.tiempoEstimadoHrs),
        fmtHrs(l.tiempoRealHrs),
      ]),
      headStyles: { fillColor: AZUL, textColor: BLANCO, fontSize: 7.5, fontStyle: "bold", cellPadding: 3 },
      bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: CELDA },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 25 },
        2: { cellWidth: 40 },
        3: { cellWidth: 40 },
        5: { cellWidth: 12, halign: "center" },
        6: { cellWidth: 12, halign: "center" },
      },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  // ── Sección 3: Análisis de Falla ISO 14224 ────────────────────────────────
  y = verificarSaltoPageY(doc, y, 50);
  seccionTitulo(doc, "3. ANÁLISIS DE FALLA — ISO 14224", y, PW);
  y += 8;

  const ds = ot.datosSupervision ?? {};
  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15 },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: GRIS, cellWidth: 55 },
      1: { textColor: [30, 41, 59] },
    },
    body: [
      ["Modo de Falla ISO 14224", ds.codigoModoFallaISO ?? "—"],
      ["Clasificación RCM", ds.clasificacionRCM ?? "—"],
      ["Criticidad del Equipo", ds.criticidadEquipo ?? "—"],
      ["¿Requiere planificación?", ds.comentariosSupervisor ? "Ver comentarios" : "—"],
      ["Lección Aprendida", ds.leccionAprendida ?? "—"],
      ["Comentarios del Supervisor", ds.comentariosSupervisor ?? "—"],
    ],
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Sección 4: Resumen de HH ──────────────────────────────────────────────
  y = verificarSaltoPageY(doc, y, 50);
  seccionTitulo(doc, "4. RESUMEN DE HORAS-HOMBRE", y, PW);
  y += 8;

  const totalEst  = ot.lineas.reduce((s, l) => s + (l.tiempoEstimadoHrs ?? 0), 0);
  const totalReal = ot.lineas.reduce((s, l) => s + (l.tiempoRealHrs ?? 0), 0);
  const diff      = totalReal - totalEst;
  const pct       = totalEst > 0 ? Math.round((totalReal / totalEst) * 100) : 0;

  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15 },
    head: [["Concepto", "Valor"]],
    body: [
      ["HH Estimadas (total)", `${totalEst} h`],
      ["HH Reales (total)", `${totalReal} h`],
      ["Diferencia", `${diff >= 0 ? "+" : ""}${diff} h`],
      ["Eficiencia (Est. vs Real)", `${pct}%`],
    ],
    headStyles: { fillColor: AZUL, textColor: BLANCO, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: CELDA },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 }, 1: { halign: "center" } },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Pie de página en cada hoja ────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const PH = doc.internal.pageSize.getHeight();
    doc.setFillColor(245, 247, 250);
    doc.rect(0, PH - 12, PW, 12, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRIS);
    doc.text(`SYNC MSC — Informe de Cierre OT #${numOT} — Generado ${new Date().toLocaleDateString("es-CL")}`, 15, PH - 5);
    doc.text(`Página ${i} / ${totalPages}`, PW - 15, PH - 5, { align: "right" });
  }

  // ── Descargar ─────────────────────────────────────────────────────────────
  doc.save(`Informe_OT_${ot.numeroOT ?? "SN"}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Utilidades internas ───────────────────────────────────────────────────────
function seccionTitulo(doc: jsPDF, texto: string, y: number, PW: number) {
  doc.setFillColor(...AZUL2);
  doc.rect(15, y, PW - 30, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLANCO);
  doc.text(texto, 18, y + 5);
}

function verificarSaltoPage(doc: jsPDF, y: number, espacio: number) {
  const PH = doc.internal.pageSize.getHeight();
  if (y + espacio > PH - 20) doc.addPage();
}

function verificarSaltoPageY(doc: jsPDF, y: number, espacio: number): number {
  const PH = doc.internal.pageSize.getHeight();
  if (y + espacio > PH - 20) { doc.addPage(); return 20; }
  return y;
}
