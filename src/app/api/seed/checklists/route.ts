import { connectDB } from "@/lib/db";
import ChecklistMantto from "@/lib/models/ChecklistMantto";

// ── Ítems base por sección (ISO 14224 Inspección Rutinaria — TPM Sensitivo) ──

const MECANICO_BASE = [
  "Vista: Fugas de aceite, grasa, agua o pulpa",
  "Vista: Correas, cadenas o acoples desgastados o rotos",
  "Vista: Pernos o tornillos flojos",
  "Vista: Guardas de seguridad instaladas y en buen estado",
  "Vista: Nivel de aceite en mirilla (si aplica)",
  "Oído: Ruido a golpeteo (rodamiento dañado)",
  "Oído: Chirrido (falta lubricación)",
  "Oído: Rozamiento metálico (desalineación)",
  "Olfato: Olor a grasa quemada o sobrecalentamiento",
  "Tacto indirecto: Temperatura anormal (dorso de mano cerca, sin contacto)",
  "Tacto indirecto: Vibración excesiva (apoyar base de palma en estructura)",
];

const ELECTRICO_ITEMS = [
  "Vista: Cableado suelto o conexiones calientes (color café o decolorado)",
  "Vista: Aislamiento dañado o pelado",
  "Vista: Polvo o suciedad dentro de tableros o cajas de conexión",
  "Vista: Luces piloto o indicadores en tablero funcionando",
  "Vista: Fusibles soplados o térmicos disparados",
  "Oído: Zumbido anormal en contactores o transformadores",
  "Olfato: Olor a quemado (aislante o plástico)",
  "Tacto indirecto: Temperatura en bornes o conexiones (dorso de mano)",
  "Medición: Amperaje en pantalla o panel (registrar valor si visible)",
];

const INSTRUMENTACION_ITEMS = [
  "Vista: Indicadores locales de presión, temperatura y nivel legibles y en rango",
  "Vista: Válvulas en posición correcta (abierto/cerrado según proceso)",
  "Vista: Fugas en conexiones de instrumentos (tubing, fittings, sellos)",
  "Vista: Pantallas de transmisores sin errores ni alarmas activas",
  "Vista: Tubos capilares o líneas de impulso sin daño físico",
  "Oído: Escape de aire en válvulas neumáticas (actuadores, posicionadores)",
  "Olfato: Olor a gas o solvente en área del instrumento (si aplica)",
  "Tacto indirecto: Vibración excesiva en líneas o soportes de instrumentos",
];

// ── Ítems específicos por área de proceso ──

const AREA_ITEMS: Record<string, string[]> = {
  chancado: [
    "Vista: Pasadores o camisas del chancador — desgaste visible",
    "Vista: Correas transportadoras centradas y sin daño en bordes",
    "Vista: Tolva de alimentación sin atoros ni acumulación excesiva",
    "Vista: Imán o separador metálico operativo (luz piloto verde)",
    "Oído: Golpeteo irregular en la cámara de chancado",
  ],
  molienda: [
    "Vista: Revestimientos (liner) — espesor y fisuras visibles",
    "Vista: Trommel (zaranda de descarga) sin roturas ni deformaciones",
    "Vista: Cilindro del molino sin fisuras o golpes visibles",
    "Oído: Ruido de bolas — patrón irregular o exceso de impacto",
    "Tacto indirecto: Vibración excesiva en chumaceras o sellos",
  ],
  flotacion: [
    "Vista: Celdas de flotación — nivel de espuma estable y uniforme",
    "Vista: Válvulas de aire de celdas en posición correcta",
    "Vista: Tuberías de relave sin obstrucción ni fugas",
    "Oído: Mecanismo de agitación (rotor-estator) sin ruido anormal",
  ],
  filtros: [
    "Vista: Telas filtrantes sin roturas ni taponamientos visibles",
    "Vista: Sistema de descarga de torta funcionando sin atoros",
    "Vista: Fugas en placas, marcos o sellos de cierre",
    "Medición: Presión de soplado — registrar valor y comparar con límite",
  ],
  aguas: [
    "Vista: Bombas de agua — prensa de empaquetadura sin fuga excesiva",
    "Vista: Nivel de estanques o espesadores dentro de rango operacional",
    "Vista: Tuberías sin fugas visibles ni corrosión avanzada",
    "Vista: Sistema de dosificación de floculante operativo",
  ],
  general: [],
};

type Sentido = "Visual" | "Auditivo" | "Tactil" | "Olfativo" | "Instrumental";

const PREFIX_MAP: { prefix: RegExp; sentido: Sentido }[] = [
  { prefix: /^Vista[^:]*:/i,        sentido: "Visual" },
  { prefix: /^Oído[^:]*:/i,         sentido: "Auditivo" },
  { prefix: /^Tacto[^:]*:/i,        sentido: "Tactil" },
  { prefix: /^Olfato[^:]*:/i,       sentido: "Olfativo" },
  { prefix: /^Medición[^:]*:/i,     sentido: "Instrumental" },
  { prefix: /^Función[^:]*:/i,      sentido: "Instrumental" },
];

function parseItem(raw: string): { descripcion: string; sentido: Sentido } {
  for (const { prefix, sentido } of PREFIX_MAP) {
    if (prefix.test(raw)) {
      return { descripcion: raw.replace(prefix, "").trim(), sentido };
    }
  }
  return { descripcion: raw.trim(), sentido: "Visual" };
}

function buildItems(base: string[], extra: string[]): { descripcion: string; orden: number; sentido: Sentido }[] {
  return [...base, ...extra].map((raw, i) => ({ ...parseItem(raw), orden: i + 1 }));
}

// ── Plantillas a sembrar ──

type PlantillaInput = {
  nombre: string;
  disciplina: "Mecanico" | "Electrico" | "Instrumentacion";
  nivelTag: number | null;
  areaProceso: string;
  categoriaISO?: string | null;
  items: { descripcion: string; orden: number; sentido: Sentido }[];
};

function plantillas(): PlantillaInput[] {
  const areas = ["chancado", "molienda", "flotacion", "filtros", "aguas", "general"] as const;

  const mec: PlantillaInput[] = areas.map(ap => ({
    nombre: ap === "general"
      ? "Mecánico — General (ISO 14224)"
      : `Mecánico — ${ap.charAt(0).toUpperCase() + ap.slice(1)} (ISO 14224)`,
    disciplina: "Mecanico",
    nivelTag: 5,
    areaProceso: ap,
    items: buildItems(MECANICO_BASE, AREA_ITEMS[ap]),
  }));

  const elec: PlantillaInput[] = areas.map(ap => ({
    nombre: ap === "general"
      ? "Eléctrico — General (ISO 14224)"
      : `Eléctrico — ${ap.charAt(0).toUpperCase() + ap.slice(1)} (ISO 14224)`,
    disciplina: "Electrico",
    nivelTag: 5,
    areaProceso: ap,
    items: buildItems([...MECANICO_BASE, ...ELECTRICO_ITEMS], AREA_ITEMS[ap]),
  }));

  const instN5: PlantillaInput[] = [{
    nombre: "Instrumentación Nivel 5 (ISO 14224)",
    disciplina: "Instrumentacion",
    nivelTag: 5,
    areaProceso: "general",
    items: buildItems(INSTRUMENTACION_ITEMS, []),
  }];

  const instN7: PlantillaInput[] = [{
    nombre: "Instrumentación Nivel 7 — Sensor/Transmisor (ISO 14224)",
    disciplina: "Instrumentacion",
    nivelTag: 7,
    areaProceso: "general",
    items: buildItems([
      ...INSTRUMENTACION_ITEMS,
      "Vista: Placa de identificación legible y coincide con TAG del sistema",
      "Vista: Cableado de señal (4-20 mA / HART) sin daño ni empalmes improvisados",
      "Vista: Sello de proceso en buen estado (sin fuga al proceso)",
      "Función: Señal de proceso coincide con valor de referencia local (±5%)",
    ], []),
  }];

  // ── Plantillas específicas para equipos combinados (mecánico + motor) ────────

  const AGITADOR_ITEMS = [
    // Mecánico — agitador
    "Vista: Fugas en sello mecánico del eje del agitador (pulpa o agua)",
    "Vista: Estado del rotor-estator — desgaste visible o corrosión",
    "Vista: Pernos de fijación del agitador al estanque o celda",
    "Vista: Guardas y protecciones del eje instaladas",
    "Oído: Ruido a golpeteo o vibración en el eje del agitador",
    "Oído: Chirrido en rodamiento superior o inferior",
    "Tacto indirecto: Temperatura anormal en carcasa del reductor",
    "Tacto indirecto: Vibración excesiva en estructura de soporte",
    // Eléctrico — motor acoplado
    "Vista (motor): Fugas de aceite o grasa en el motor eléctrico",
    "Vista (motor): Cableado de alimentación sin daño ni empalmes",
    "Vista (motor): Caja de bornes cerrada y sin humedad",
    "Oído (motor): Sonido irregular del motor (zumbido o golpeteo)",
    "Olfato (motor): Olor a quemado en motor o bobinado",
    "Tacto indirecto (motor): Temperatura anormal en carcasa del motor",
    "Medición: Amperaje en panel o variador (registrar valor si visible)",
  ];

  const MOTOBOMBA_ITEMS = [
    // Mecánico — bomba
    "Vista: Fugas en prensa de empaquetadura o sello mecánico",
    "Vista: Corrosión o erosión en carcasa de la bomba",
    "Vista: Pernos de fijación bomba-base sin holgura",
    "Vista: Guardas del acople instaladas",
    "Oído: Cavitación (ruido a grava girando dentro de la bomba)",
    "Oído: Ruido a golpeteo en rodamientos",
    "Tacto indirecto: Temperatura anormal en rodamientos",
    "Tacto indirecto: Vibración excesiva en carcasa",
    // Eléctrico — motor acoplado
    "Vista (motor): Cableado y caja de bornes sin daño ni humedad",
    "Oído (motor): Sonido irregular del motor",
    "Olfato (motor): Olor a quemado en motor o bobinado",
    "Tacto indirecto (motor): Temperatura anormal en carcasa del motor",
    "Medición: Amperaje en panel (registrar valor si visible)",
  ];

  const combinados: PlantillaInput[] = [
    {
      nombre: "Motor-Agitador — Flotación (ISO 14224)",
      disciplina: "Mecanico",
      nivelTag: 5,
      areaProceso: "flotacion",
      items: buildItems(AGITADOR_ITEMS, []),
    },
    {
      nombre: "Motobomba — General (ISO 14224)",
      disciplina: "Mecanico",
      nivelTag: 5,
      areaProceso: "general",
      items: buildItems(MOTOBOMBA_ITEMS, []),
    },
  ];

  // Asociar categoriaISO a las plantillas combinadas
  const combinadosConCat = combinados.map((p, i) => ({
    ...p,
    categoriaISO: i === 0 ? "AGITADORES" : "MOTOBOMBAS",
  }));

  return [...mec, ...elec, ...instN5, ...instN7, ...combinadosConCat];
}

export async function POST() {
  await connectDB();

  const docs = plantillas().map(p => ({ ...p, areaCodigo: "*", activo: true }));

  // Upsert por nombre: actualiza plantillas base sin borrar checklists custom
  const ops = docs.map(d => ({
    updateOne: {
      filter: { nombre: d.nombre },
      update: { $set: d },
      upsert: true,
    },
  }));
  const result = await ChecklistMantto.bulkWrite(ops, { ordered: false });

  return Response.json({
    ok: true,
    total: docs.length,
    inserted: result.upsertedCount,
    modified: result.modifiedCount,
    resumen: docs.map(d => `${d.disciplina} / ${d.areaProceso} (N${d.nivelTag ?? "?"}) — ${d.items.length} ítems`),
  });
}
