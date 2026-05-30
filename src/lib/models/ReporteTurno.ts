import mongoose, { Schema, Document } from "mongoose";
import { IReporteTurno } from "@/types";

export interface ReporteTurnoDocument extends Omit<IReporteTurno, "_id">, Document {}

const RecomendacionSchema = new Schema(
  {
    prioridad: { type: String, required: true, enum: ["URGENTE", "PLANIFICAR", "SEGUIMIENTO", "SEGURIDAD"] },
    area: { type: String, trim: true },
    tag: { type: String, trim: true },
    descripcion: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// OTs del plan semanal guardadas inline (sin ID MongoDB real)
const OTPlanDataSchema = new Schema(
  {
    otId:        { type: String, required: true },  // "plan-ELEC-893944"
    numeroOT:    { type: String, required: true },
    tag:         { type: String },
    disciplina:  { type: String },
    grupo:       { type: String },
    tipoOT:      { type: String },
    descripcion: { type: String },
    tecnicos:    [{ type: String }],
    hhTotal:     { type: Number },
    estado:      { type: String },
    heredada:    { type: Boolean, default: false },
    pasarNocheMotivo: { type: String },
    pasarNochePor:    { type: String },
  },
  { _id: false }
);

const NotaOTSchema = new Schema(
  {
    otId: { type: String, required: true },
    nota: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const ResumenSchema = new Schema(
  {
    totalOTs: { type: Number, default: 0 },
    concluidas: { type: Number, default: 0 },
    pendientes: { type: Number, default: 0 },
    inconclusas: { type: Number, default: 0 },
    hhTotales: { type: Number, default: 0 },
    hhCorrectivo: { type: Number, default: 0 },
    hhPreventivo: { type: Number, default: 0 },
  },
  { _id: false }
);

const ReporteTurnoSchema = new Schema<ReporteTurnoDocument>(
  {
    turno: { type: String, required: true, enum: ["Diurno", "Nocturno", "Parada de Planta", "Otro"] },
    fecha: { type: Date, required: true },
    supervisorId: { type: String, ref: "Usuario", required: true },
    supervisorNombre: { type: String, required: true, trim: true },
    otIds: [{ type: String }],
    otsCriticas: [{ type: String }],
    otsPendientesSiguienteTurno: [{ type: String }],
    notasOTs: [NotaOTSchema],
    otsPlanData: [OTPlanDataSchema],   // OTs del plan semanal (datos completos)
    resumenEjecutivo: { type: ResumenSchema, default: () => ({}) },
    recomendaciones: [RecomendacionSchema],
    comentariosAreas: { type: Map, of: String, default: () => ({}) }, // área → comentario
    adjuntos: [{ tipo: String, url: String, nombre: String, subidoEn: Date }],
    estado: { type: String, required: true, enum: ["borrador", "enviado"], default: "borrador" },
    pdfUrl: { type: String },
  },
  { timestamps: true }
);

ReporteTurnoSchema.index({ turno: 1, fecha: -1 });
ReporteTurnoSchema.index({ supervisorId: 1, fecha: -1 });

export const ReporteTurno =
  mongoose.models.ReporteTurno ||
  mongoose.model<ReporteTurnoDocument>("ReporteTurno", ReporteTurnoSchema);
