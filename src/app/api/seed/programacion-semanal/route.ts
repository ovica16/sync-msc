import { connectDB } from "@/lib/db";
import { ProgramacionSemanal } from "@/lib/models/ProgramacionSemanal";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { DiaSemana, GrupoTrabajo, IOTProgramada } from "@/types";

if (process.env.NODE_ENV === "production") {
  // Fail fast in module scope so the route never registers in prod
}

const DISCIPLINA_MAP: Record<string, string> = {
  "PSInst2026.xlsx": "INST",
  "PSElt2026..xlsx": "ELEC",
  "PSCon2026.xlsx":  "GENERAL",
};

const ORDEN_DIAS: DiaSemana[] = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function normalizarDia(d: string): DiaSemana | null {
  const map: Record<string, DiaSemana> = {
    Lu: "Lu", Ma: "Ma", Mi: "Mi", Ju: "Ju", Vi: "Vi", Sa: "Sa", Do: "Do",
    Lunes: "Lu", Martes: "Ma", "Miércoles": "Mi", "Miercoles": "Mi",
    Jueves: "Ju", Viernes: "Vi", Sábado: "Sa", Sabado: "Sa", Domingo: "Do",
  };
  return map[d.trim()] ?? null;
}

/**
 * Decodifica el campo "Dias" del Excel:
 *   "Lu a Do"  → todos los días de lunes a domingo
 *   "Lu a Vi"  → lunes, martes, miércoles, jueves, viernes
 *   "Lu y Ju"  → lunes y jueves
 *   "Lu y Ma"  → lunes y martes
 *   "Lu"       → solo lunes
 *   "Lu Ma Vi" → lunes, martes, viernes (palabras sueltas)
 */
function parsearDias(diasStr: string): DiaSemana[] {
  const s = diasStr.trim();
  if (!s) return [];

  // Patrón rango: "X a Y"
  const rangoMatch = s.match(/^(.+?)\s+a\s+(.+)$/i);
  if (rangoMatch) {
    const desde = normalizarDia(rangoMatch[1]);
    const hasta = normalizarDia(rangoMatch[2]);
    if (desde && hasta) {
      const iDesde = ORDEN_DIAS.indexOf(desde);
      const iHasta = ORDEN_DIAS.indexOf(hasta);
      if (iDesde !== -1 && iHasta !== -1 && iHasta >= iDesde) {
        return ORDEN_DIAS.slice(iDesde, iHasta + 1);
      }
    }
  }

  // Patrón lista con "y": "X y Y [y Z]"
  if (s.toLowerCase().includes(" y ")) {
    const partes = s.split(/\s+y\s+/i);
    return partes.map(p => normalizarDia(p)).filter((d): d is DiaSemana => d !== null);
  }

  // Palabras sueltas separadas por espacios o comas
  const tokens = s.split(/[\s,]+/);
  return tokens.map(t => normalizarDia(t)).filter((d): d is DiaSemana => d !== null);
}

function getMondayOfWeek(anio: number, semana: number): Date {
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (semana - 1) * 7);
  return monday;
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const archivo    = searchParams.get("archivo") ?? "PSInst2026.xlsx";
  const soloSemana = searchParams.get("semana") ? Number(searchParams.get("semana")) : null;
  const dryRun     = searchParams.get("dry") === "1";
  const anio       = Number(searchParams.get("anio") ?? "2026");

  const filePath = path.join(process.cwd(), archivo);
  if (!fs.existsSync(filePath)) {
    return Response.json({ ok: false, error: `Archivo no encontrado: ${filePath}` }, { status: 404 });
  }

  const disciplina = DISCIPLINA_MAP[archivo] ?? "GENERAL";

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Programa"];
  if (!ws) {
    return Response.json({ ok: false, error: 'Hoja "Programa" no encontrada', sheets: wb.SheetNames }, { status: 404 });
  }

  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // --- Parsear filas ---
  // Índices de columnas (base 0):
  // 0=idx, 1=Control, 2=NoOT, 3=TipoOT, 4=TipoTrabajo, 5=Prioridad,
  // 6=JobDesc, 7=Equipo, 8=DescEq, 9=Personas, 10=HrTrabajo, 11=HHEstimado,
  // 12=FechaInicio, 13=FechaFinal, 14=Dias, 15=Semana, 16=Solicitante, 17=Observaciones
  const C = { noOT: 2, tipoOT: 3, tipoTrabajo: 4, prioridad: 5, desc: 6, tag: 7, descEq: 8, personas: 9, hrsTrabajo: 10, hh: 11, fIni: 12, fFin: 13, dias: 14, semana: 15, obs: 17 };

  type SemanaBucket = { semana: number; anio: number; fechaInicio: Date; fechaFin: Date; ots: IOTProgramada[] };
  const semanas = new Map<number, SemanaBucket>();

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    const noOT = row[C.noOT];
    if (!noOT || typeof noOT !== "number") continue;

    const semanaNum = Number(row[C.semana]);
    if (!semanaNum || semanaNum < 1) continue;
    if (soloSemana !== null && semanaNum !== soloSemana) continue;

    const diasStr = String(row[C.dias] ?? "").trim();
    const diasParsed = parsearDias(diasStr);

    if (diasParsed.length === 0) continue;

    if (!semanas.has(semanaNum)) {
      // Siempre usar ISO: lunes a domingo de esa semana
      const lunes   = getMondayOfWeek(anio, semanaNum);
      const domingo = new Date(lunes);
      domingo.setUTCDate(lunes.getUTCDate() + 6);
      semanas.set(semanaNum, { semana: semanaNum, anio, fechaInicio: lunes, fechaFin: domingo, ots: [] });
    }

    const bucket = semanas.get(semanaNum)!;

    const personas   = Number(row[C.personas]) || 1;
    const hrsTrabajo = Number(row[C.hrsTrabajo]) || 0;
    const hhEstimado = Number(row[C.hh]) || personas * hrsTrabajo;
    const tipoOT     = String(row[C.tipoOT] ?? "P").trim().toUpperCase();
    const prioridad  = String(row[C.prioridad] ?? "").trim() || undefined;
    const obs        = String(row[C.obs] ?? "").trim() || undefined;

    // Determinar grupo por índice del día actual
    const grupoDefault: GrupoTrabajo = "Diurno";

    // Expandir multi-día
    for (const dia of diasParsed) {
      if (!ORDEN_DIAS.includes(dia)) continue;

      const hhPorDia = diasParsed.length > 1 ? Math.round(hhEstimado / diasParsed.length) : hhEstimado;

      bucket.ots.push({
        numeroOT: String(noOT),
        tipoOT,
        tipoTrabajo: String(row[C.tipoTrabajo] ?? "").trim(),
        prioridad,
        descripcion: String(row[C.desc] ?? "").trim() || `OT ${noOT}`,
        tag: String(row[C.tag] ?? "").trim().toUpperCase(),
        descripcionEquipo: String(row[C.descEq] ?? "").trim(),
        personas,
        hrsTrabajo,
        hhTotal: hhPorDia,
        personalAsignado: [],
        grupo: grupoDefault,
        dia,
        estado: "no_iniciada",
        observaciones: obs,
      });
    }
  }

  if (semanas.size === 0) {
    return Response.json({ ok: false, error: "No se encontraron OTs válidas", noOTSemana: soloSemana });
  }

  if (dryRun) {
    const preview: Record<number, { semana: number; otCount: number; fechaInicio: string }> = {};
    for (const [k, v] of semanas) {
      preview[k] = { semana: v.semana, otCount: v.ots.length, fechaInicio: v.fechaInicio.toISOString() };
    }
    return Response.json({ ok: true, dry: true, semanas: preview, totalOTs: [...semanas.values()].reduce((s, b) => s + b.ots.length, 0) });
  }

  await connectDB();

  const results: { semana: number; ots: number; accion: string }[] = [];
  const errors: { semana: number; error: string }[] = [];

  for (const bucket of semanas.values()) {
    try {
      const existing = await ProgramacionSemanal.findOne({ semana: bucket.semana, anio: bucket.anio, disciplina });

      if (existing) {
        // Actualizar: reemplazar otsProgramadas
        await ProgramacionSemanal.updateOne(
          { _id: existing._id },
          { $set: { otsProgramadas: bucket.ots } }
        );
        results.push({ semana: bucket.semana, ots: bucket.ots.length, accion: "actualizado" });
      } else {
        await ProgramacionSemanal.create({
          semana: bucket.semana,
          anio: bucket.anio,
          disciplina,
          fechaInicio: bucket.fechaInicio,
          fechaFin: bucket.fechaFin,
          personal: [],
          otsProgramadas: bucket.ots,
          resumenDias: [],
          hhDisponiblesSemana: 0,
          hhProgramadasSemana: bucket.ots.reduce((s, o) => s + o.hhTotal, 0),
          hhReactivoSemana: bucket.ots.filter((o) => o.tipoOT === "C").reduce((s, o) => s + o.hhTotal, 0),
          estado: "publicado",
          subidoPor: "seed-excel",
        });
        results.push({ semana: bucket.semana, ots: bucket.ots.length, accion: "creado" });
      }
    } catch (err) {
      errors.push({ semana: bucket.semana, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return Response.json({
    ok: errors.length === 0,
    disciplina,
    resultados: results,
    errores: errors,
    totalSemanas: semanas.size,
    totalOTs: [...semanas.values()].reduce((s, b) => s + b.ots.length, 0),
  });
}
