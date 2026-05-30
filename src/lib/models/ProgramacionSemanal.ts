import mongoose, { Schema, Document } from "mongoose";
import { IProgramacionSemanal } from "@/types";

export interface ProgramacionSemanalDocument
  extends Omit<IProgramacionSemanal, "_id">,
    Document {}

const AsistenciaDiaSchema = new Schema(
  {
    dia: { type: String, required: true, enum: ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] },
    estado: {
      type: String,
      enum: ["D", "N", "T", "V", "CS", "BM", "LG", "FI", "DO", "IF", ""],
      default: "",
    },
  },
  { _id: false }
);

const PersonalSemanalSchema = new Schema(
  {
    usuarioId: { type: String, ref: "Usuario" },
    nombre: { type: String, required: true, trim: true },
    grupo: {
      type: String,
      required: true,
      enum: ["G1", "G2", "G3", "G4", "Diurno", "Nocturno"],
    },
    esContratista: { type: Boolean, default: false },
    asistencia: [AsistenciaDiaSchema],
  },
  { _id: false }
);

const OTProgramadaSchema = new Schema(
  {
    numeroOT: { type: String, required: true, trim: true },
    tipoOT: { type: String, required: true, trim: true },
    tipoTrabajo: { type: String, required: true, trim: true },
    prioridad: { type: String, trim: true },
    descripcion: { type: String, required: true, trim: true },
    tag: { type: String, required: true, trim: true, uppercase: true },
    descripcionEquipo: { type: String, trim: true, default: "" },
    personas: { type: Number, default: 1, min: 0 },
    hrsTrabajo: { type: Number, default: 0, min: 0 },
    hhTotal: { type: Number, default: 0, min: 0 },
    personalAsignado: [{ type: String, trim: true }],
    grupo: {
      type: String,
      required: true,
      enum: ["G1", "G2", "G3", "G4", "Diurno", "Nocturno"],
    },
    dia: {
      type: String,
      required: true,
      enum: ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"],
    },
    estado: {
      type: String,
      enum: [
        "no_iniciada", "en_proceso", "en_revision",
        "completada", "pendiente", "atrasada", "bloqueada", "cancelada",
      ],
      default: "no_iniciada",
    },
    observaciones:    { type: String, trim: true },
    // Referencia a la OT interna una vez que el técnico la registra
    ordenTrabajoId:   { type: String, trim: true },
    ordenTrabajoNum:  { type: String, trim: true },
    // Pasar al turno noche
    pasarNoche:       { type: Boolean, default: false },
    pasarNocheMotivo: { type: String, trim: true },
    pasarNocheNota:   { type: String, trim: true },
    pasarNochePor:    { type: String, trim: true },
    pasarNocheAt:     { type: Date },
    // OT de Guardia (OPEPLANT) — corre toda la semana, no se cierra por turno
    esGuardia:        { type: Boolean, default: false },
    bitacora: [{
      _id: false,
      fecha:       { type: Date, required: true },
      turno:       { type: String, enum: ["Diurno", "Nocturno", "Parada de Planta"] },
      supervisor:  { type: String, trim: true },
      nota:        { type: String, trim: true, required: true },
      hhAtendidas: { type: Number, default: 0 },
    }],
  },
  { _id: false }
);

const ResumenDiaSchema = new Schema(
  {
    dia: { type: String, required: true, enum: ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] },
    fecha: { type: Date, required: true },
    hhDisponibles: { type: Number, default: 0 },
    hhProgramadas: { type: Number, default: 0 },
    utilizacion: { type: Number, default: 0 },
  },
  { _id: false }
);

const ProgramacionSemanalSchema = new Schema<ProgramacionSemanalDocument>(
  {
    semana: { type: Number, required: true, min: 1, max: 53 },
    anio: { type: Number, required: true },
    disciplina: {
      type: String,
      required: true,
      enum: ["INST", "MEC", "ELEC", "GENERAL"],
    },
    areaCodigo: { type: String },
    fechaInicio: { type: Date, required: true },
    fechaFin: { type: Date, required: true },
    hhDisponiblesSemana: { type: Number, default: 0 },
    hhProgramadasSemana: { type: Number, default: 0 },
    hhReactivoSemana: { type: Number, default: 0 },
    personal: [PersonalSemanalSchema],
    otsProgramadas: [OTProgramadaSchema],
    resumenDias: [ResumenDiaSchema],
    estado: {
      type: String,
      enum: ["borrador", "publicado", "cerrado"],
      default: "borrador",
    },
    subidoPor: { type: String, ref: "Usuario", required: true },
  },
  { timestamps: true }
);

// Una programación por semana+año+disciplina
ProgramacionSemanalSchema.index({ anio: 1, semana: 1, disciplina: 1 }, { unique: true });
ProgramacionSemanalSchema.index({ disciplina: 1, anio: 1, semana: -1 });
ProgramacionSemanalSchema.index({ "otsProgramadas.tag": 1 });

export const ProgramacionSemanal =
  mongoose.models.ProgramacionSemanal ||
  mongoose.model<ProgramacionSemanalDocument>(
    "ProgramacionSemanal",
    ProgramacionSemanalSchema
  );
