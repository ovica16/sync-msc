import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface AdjuntoItem {
  tipo: "foto" | "documento";
  nombre: string;
  dataUrl: string;
  comentario: string;
  comentariosExtra: string[];
}

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
  adjuntos?: AdjuntoItem[];
}

interface DatosSupervision {
  requierePlanificacion?: boolean;
  comentariosSupervisor?: string;
  revisadoPor?: string;
  revisadoEn?: string;
  codigoModoFallaISO?: string;
  clasificacionRCM?: string;
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

// ── Paleta — header más claro ──────────────────────────────────────────────────
const NAVY    = [13, 47, 94]     as [number, number, number]; // barras de sección
const AZUL    = [37, 99, 235]    as [number, number, number]; // acento
const HDR_BG  = [235, 242, 255]  as [number, number, number]; // fondo header claro (azul-50)
const HDR_TOP = [59, 100, 165]   as [number, number, number]; // franja superior header
const GRIS    = [107, 114, 128]  as [number, number, number];
const GRIS_L  = [241, 245, 249]  as [number, number, number];
const BLANCO  = [255, 255, 255]  as [number, number, number];
const NEGRO   = [17, 24, 39]     as [number, number, number];
const VERDE   = [22, 163, 74]    as [number, number, number];
const ROJO    = [220, 38, 38]    as [number, number, number];

// ── Labels ────────────────────────────────────────────────────────────────────
const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  pendiente_revision: "Pendiente revisión",
  solicitar_correccion: "En corrección",
  revisado: "Revisado",
  concluido: "Concluido",
};

const ESTADO_COLOR: Record<string, [number, number, number]> = {
  concluido:            VERDE,
  revisado:             AZUL,
  pendiente_revision:   [217, 119, 6],
  solicitar_correccion: ROJO,
  borrador:             GRIS,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(d?: string | Date) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtHrs(n?: number) {
  if (n == null || n === 0) return "—";
  return `${n} h`;
}

function seccion(doc: jsPDF, texto: string, y: number, PW: number): void {
  doc.setFillColor(...NAVY);
  doc.rect(15, y, 2.5, 11, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text(texto.toUpperCase(), 20, y + 7.5);
  const textW = doc.getTextWidth(texto.toUpperCase());
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(21 + textW, y + 7, PW - 15, y + 7);
}

function estadoBadge(doc: jsPDF, estado: string, x: number, y: number) {
  const label = ESTADO_LABEL[estado] ?? estado;
  const color = ESTADO_COLOR[estado] ?? GRIS;
  const w = doc.getTextWidth(label) + 8;
  doc.setFillColor(...color);
  doc.roundedRect(x - w / 2, y - 4, w, 7, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...BLANCO);
  doc.text(label, x, y + 0.5, { align: "center" });
}

// ── Generador principal ───────────────────────────────────────────────────────
export function generarInformeOT(ot: OTData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  let y = 15;

  const numOT = ot.otJdeNumero ?? ot.numeroOT ?? "—";
  const tecnicos = ot.tecnicos.map(t => t.nombreCompleto).join(", ") || "—";
  const correctivos = ot.lineas.filter(l => ["CMP", "CMR"].includes(l.tipoOT));
  const preventivos = ot.lineas.filter(l => !["CMP", "CMR"].includes(l.tipoOT));
  const tieneCorrectivos = correctivos.length > 0;

  // Nombre del supervisor: usar historial (nombreUsuario) antes que revisadoPor (que guarda ID)
  const entradaRevision = (ot.historialCambios ?? [])
    .slice().reverse()
    .find(c => /revisado|aprobad|concluid/i.test(c.cambio));
  const sup = entradaRevision?.nombreUsuario ?? ot.datosSupervision?.revisadoPor ?? "—";
  const fechaRevision = ot.datosSupervision?.revisadoEn
    ? fmt(ot.datosSupervision.revisadoEn)
    : entradaRevision?.fechaHora ? fmt(entradaRevision.fechaHora) : "—";

  // Adjuntos de todas las líneas
  const todosAdjuntos = ot.lineas.flatMap(l =>
    (l.adjuntos ?? []).map(a => ({ ...a, tag: l.tag }))
  );
  const fotos = todosAdjuntos.filter(a => a.tipo === "foto");
  const documentos = todosAdjuntos.filter(a => a.tipo === "documento");

  // ── Encabezado — fondo claro ─────────────────────────────────────────────────
  // Franja superior fina
  doc.setFillColor(...HDR_TOP);
  doc.rect(0, 0, PW, 5, "F");

  // Fondo claro principal
  doc.setFillColor(...HDR_BG);
  doc.rect(0, 5, PW, 24, "F");

  // Línea de acento azul en la parte inferior del header
  doc.setFillColor(...AZUL);
  doc.rect(0, 29, PW, 1.5, "F");

  // Texto encabezado — izquierda
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text("SYNC MSC", 15, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...HDR_TOP);
  doc.text("Sistema de Gestión de Mantenimiento", 15, 20);
  doc.text("Informe de Cierre de Orden de Trabajo", 15, 25.5);

  // OT number destacado — derecha
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(`OT ${numOT}`, PW - 15, 15, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...HDR_TOP);
  doc.text(fmt(ot.fecha), PW - 15, 21, { align: "right" });

  // Estado badge
  estadoBadge(doc, ot.estado, PW - 30, 27);

  y = 38;

  // ── 1. DATOS GENERALES ──────────────────────────────────────────────────────
  seccion(doc, "1. Datos Generales", y, PW);
  y += 14;

  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15 },
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 } },
    columnStyles: {
      0: { fontStyle: "bold", textColor: GRIS, cellWidth: 42 },
      1: { textColor: NEGRO },
      2: { fontStyle: "bold", textColor: GRIS, cellWidth: 42 },
      3: { textColor: NEGRO },
    },
    body: [
      ["N° OT OPEPLANT", numOT, "Fecha", fmt(ot.fecha)],
      ["Turno", ot.turno, "Área", ot.areaCodigo],
      ["Técnico(s)", tecnicos || "—", "Revisado por", sup],
      ["Estado", ESTADO_LABEL[ot.estado] ?? ot.estado, "Fecha revisión", fechaRevision],
    ],
    didParseCell: (data) => {
      if (data.row.index % 2 === 0 && data.section === "body") {
        data.cell.styles.fillColor = GRIS_L;
      }
    },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── 2. EQUIPOS INTERVENIDOS ─────────────────────────────────────────────────
  y = checkPage(doc, y, 35);
  seccion(doc, "2. Equipos Intervenidos", y, PW);
  y += 14;

  if (correctivos.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...AZUL);
    doc.text("Trabajos Correctivos (CMP / CMR)", 15, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: 15, right: 15 },
      head: [["TAG / Equipo", "Tipo", "Síntoma", "Causa Probable", "Resolución Aplicada", "HH Est.", "HH Real"]],
      body: correctivos.map(l => [
        `${l.tag}\n${l.descripcionEquipo}`,
        l.tipoOT,
        l.sintoma ?? "—",
        l.causaProbable ?? "—",
        l.resolucionAplicada ?? "—",
        fmtHrs(l.tiempoEstimadoHrs),
        fmtHrs(l.tiempoRealHrs),
      ]),
      headStyles: { fillColor: NAVY, textColor: BLANCO, fontSize: 7, fontStyle: "bold", cellPadding: 2.5 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2.5, textColor: NEGRO },
      alternateRowStyles: { fillColor: GRIS_L },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: "bold" },
        1: { cellWidth: 14, halign: "center" },
        2: { cellWidth: 28 },
        3: { cellWidth: 28 },
        4: { cellWidth: 38 },
        5: { cellWidth: 13, halign: "center" },
        6: { cellWidth: 13, halign: "center" },
      },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  if (preventivos.length > 0) {
    y = checkPage(doc, y, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...AZUL);
    doc.text("Trabajos Preventivos / Predictivos", 15, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: 15, right: 15 },
      head: [["TAG / Equipo", "Tipo", "Descripción del Trabajo", "Tareas Ejecutadas", "HH Real"]],
      body: preventivos.map(l => [
        `${l.tag}\n${l.descripcionEquipo}`,
        l.tipoOT,
        l.descripcionTrabajo ?? "—",
        (l.tareasEjecutadas ?? []).join("\n") || "—",
        fmtHrs(l.tiempoRealHrs),
      ]),
      headStyles: { fillColor: NAVY, textColor: BLANCO, fontSize: 7, fontStyle: "bold", cellPadding: 2.5 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2.5, textColor: NEGRO },
      alternateRowStyles: { fillColor: GRIS_L },
      columnStyles: {
        0: { cellWidth: 32, fontStyle: "bold" },
        1: { cellWidth: 14, halign: "center" },
        2: { cellWidth: 50 },
        3: { cellWidth: 50 },
        4: { cellWidth: 18, halign: "center" },
      },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  // ── 3. SUPERVISIÓN (solo si hay correctivos y datos) ────────────────────────
  const ds = ot.datosSupervision ?? {};
  const comentarios = (ds.comentariosSupervisor ?? "").split("\n").filter(Boolean);
  const hayDatosSupervision = tieneCorrectivos && (ds.requierePlanificacion || comentarios.length > 0);

  if (hayDatosSupervision) {
    y = checkPage(doc, y, 40);
    seccion(doc, "3. Supervisión", y, PW);
    y += 14;

    const supRows: [string, string][] = [];
    supRows.push(["Requiere WR", ds.requierePlanificacion ? "Sí" : "No"]);
    if (comentarios.length > 0) {
      comentarios.forEach((c, i) => {
        supRows.push([i === 0 ? "Comentarios del Supervisor" : "", c]);
      });
    }

    autoTable(doc, {
      startY: y,
      margin: { left: 15, right: 15 },
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
      columnStyles: {
        0: { fontStyle: "bold", textColor: GRIS, cellWidth: 55 },
        1: { textColor: NEGRO },
      },
      body: supRows,
      didParseCell: (data) => {
        if (data.row.index % 2 === 0 && data.section === "body") {
          data.cell.styles.fillColor = GRIS_L;
        }
      },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── 4. RESUMEN HORAS-HOMBRE ─────────────────────────────────────────────────
  y = checkPage(doc, y, 45);
  let secNum = hayDatosSupervision ? 4 : 3;
  seccion(doc, `${secNum}. Resumen de Horas-Hombre`, y, PW);
  y += 14;

  const totalEst  = ot.lineas.reduce((s, l) => s + (l.tiempoEstimadoHrs ?? 0), 0);
  const totalReal = ot.lineas.reduce((s, l) => s + (l.tiempoRealHrs ?? 0), 0);
  const diff      = Math.round((totalReal - totalEst) * 10) / 10;
  const pct       = totalEst > 0 ? Math.round((totalReal / totalEst) * 100) : 0;

  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 80 },
    head: [["Concepto", "Valor"]],
    body: [
      ["HH Estimadas (total)", totalEst > 0 ? `${totalEst} h` : "—"],
      ["HH Reales (total)", totalReal > 0 ? `${totalReal} h` : "—"],
      ["Diferencia", totalEst > 0 ? `${diff >= 0 ? "+" : ""}${diff} h` : "—"],
      ["Eficiencia (Est. vs Real)", totalEst > 0 ? `${pct}%` : "—"],
    ],
    headStyles: { fillColor: NAVY, textColor: BLANCO, fontSize: 8, fontStyle: "bold", cellPadding: 3 },
    bodyStyles: { fontSize: 9, cellPadding: 3, textColor: NEGRO },
    alternateRowStyles: { fillColor: GRIS_L },
    columnStyles: {
      0: { fontStyle: "bold", textColor: GRIS, cellWidth: 70 },
      1: { halign: "right", fontStyle: "bold", textColor: AZUL },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const val = String(data.cell.raw ?? "");
        if (val.startsWith("+")) data.cell.styles.textColor = VERDE;
        else if (val.startsWith("-")) data.cell.styles.textColor = ROJO;
      }
    },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ── 5. EVIDENCIAS (fotos y documentos) ─────────────────────────────────────
  if (todosAdjuntos.length > 0) {
    secNum = hayDatosSupervision ? 5 : 4;
    y = checkPage(doc, y, 30);
    seccion(doc, `${secNum}. Evidencias Fotográficas y Documentos`, y, PW);
    y += 14;

    // ── Fotos ──────────────────────────────────────────────────────────────
    if (fotos.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...AZUL);
      doc.text("Fotos / Imágenes", 15, y);
      y += 5;

      const IMG_W = 52;
      const IMG_H = 40;
      const GAP   = 6;
      const COLS  = 3;
      const COL_W = IMG_W + GAP;

      for (let i = 0; i < fotos.length; i++) {
        const col = i % COLS;
        const xImg = 15 + col * COL_W;

        if (col === 0 && i > 0) y += IMG_H + 22;
        y = checkPage(doc, y, IMG_H + 22);

        const adj = fotos[i];

        // Imagen
        try {
          const ext = adj.dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(adj.dataUrl, ext, xImg, y, IMG_W, IMG_H);
        } catch {
          // Si falla la imagen, dibujar placeholder
          doc.setFillColor(...GRIS_L);
          doc.rect(xImg, y, IMG_W, IMG_H, "F");
          doc.setFontSize(7);
          doc.setTextColor(...GRIS);
          doc.text("[imagen no disponible]", xImg + IMG_W / 2, y + IMG_H / 2, { align: "center" });
        }

        // Nombre del archivo + TAG
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(...NAVY);
        doc.text(`TAG: ${adj.tag}`, xImg, y + IMG_H + 3.5);

        // Comentario principal
        const comentarioTexto = adj.comentario || "Sin comentario";
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(...NEGRO);
        const lineasComentario = doc.splitTextToSize(comentarioTexto, IMG_W);
        doc.text(lineasComentario.slice(0, 2), xImg, y + IMG_H + 7);

        // Comentarios extra
        if (adj.comentariosExtra?.length > 0) {
          doc.setTextColor(...GRIS);
          adj.comentariosExtra.slice(0, 2).forEach((ce, ci) => {
            const lineasExtra = doc.splitTextToSize(`• ${ce}`, IMG_W);
            doc.text(lineasExtra[0], xImg, y + IMG_H + 11 + ci * 4);
          });
        }
      }

      // Avanzar y después del último bloque de fotos
      const lastCol = (fotos.length - 1) % COLS;
      if (lastCol >= 0) y += IMG_H + 22;
      y += 4;
    }

    // ── Documentos ─────────────────────────────────────────────────────────
    if (documentos.length > 0) {
      y = checkPage(doc, y, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...AZUL);
      doc.text("Documentos adjuntos", 15, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        margin: { left: 15, right: 15 },
        head: [["TAG", "Archivo", "Comentario"]],
        body: documentos.map(d => [
          d.tag,
          d.nombre,
          [d.comentario, ...(d.comentariosExtra ?? [])].filter(Boolean).join(" · ") || "—",
        ]),
        headStyles: { fillColor: NAVY, textColor: BLANCO, fontSize: 7, fontStyle: "bold", cellPadding: 2.5 },
        bodyStyles: { fontSize: 7.5, cellPadding: 2.5, textColor: NEGRO },
        alternateRowStyles: { fillColor: GRIS_L },
        columnStyles: {
          0: { cellWidth: 25, fontStyle: "bold" },
          1: { cellWidth: 55 },
          2: {},
        },
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }
  }

  // ── Firma / sello ─────────────────────────────────────────────────────────
  y = checkPage(doc, y, 28);
  const midX = PW / 2;

  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.3);
  doc.line(30, y + 16, midX - 8, y + 16);
  doc.line(midX + 8, y + 16, PW - 30, y + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRIS);
  doc.text("Técnico Responsable", (30 + midX - 8) / 2, y + 20, { align: "center" });
  doc.text("Supervisor / Revisor", (midX + 8 + PW - 30) / 2, y + 20, { align: "center" });

  if (tecnicos !== "—") {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NEGRO);
    doc.text(tecnicos.split(",")[0].trim(), (30 + midX - 8) / 2, y + 25, { align: "center" });
  }
  if (sup !== "—") {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NEGRO);
    doc.text(sup, (midX + 8 + PW - 30) / 2, y + 25, { align: "center" });
  }

  // ── Pie de página ──────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const PH = doc.internal.pageSize.getHeight();
    doc.setFillColor(...NAVY);
    doc.rect(0, PH - 10, PW, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...BLANCO);
    doc.text(`SYNC MSC · Informe de Cierre OT ${numOT} · Generado ${new Date().toLocaleDateString("es-BO")}`, 15, PH - 3.5);
    doc.text(`Pág. ${i} / ${totalPages}`, PW - 15, PH - 3.5, { align: "right" });
  }

  doc.save(`Informe_OT_${numOT}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Verificar salto de página ──────────────────────────────────────────────────
function checkPage(doc: jsPDF, y: number, espacio: number): number {
  const PH = doc.internal.pageSize.getHeight();
  if (y + espacio > PH - 18) { doc.addPage(); return 20; }
  return y;
}
