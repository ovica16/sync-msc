import mongoose, { Schema, Document } from "mongoose";
import { IOrdenTrabajo } from "@/types";
import { siguienteNumeroOT } from "./Contador";

export interface OrdenTrabajoDocument extends Omit<IOrdenTrabajo, "_id">, Document {}

const AdjuntoSchema = new Schema(
  {
    tipo: { type: String, enum: ["foto", "pdf", "excel", "otro"], required: true },
    url: { type: String, required: true },
    nombre: { type: String, required: true, trim: true },
    subidoEn: { type: Date, default: Date.now },
  },
  { _id: false }
);

const LineaOTSchema = new Schema(
  {
    tag: { type: String, required: true, trim: true, uppercase: true },
    descripcionEquipo: { type: String, required: true, trim: true },
    tipoOT: {
      type: String,
      required: true,
      enum: ["CMP", "CMR", "PMP", "PMT", "PTJ"],
    },
    // Correctivos (CMP, CMR)
    sintoma: { type: String, trim: true },
    causaProbable: { type: String, trim: true },
    resolucionAplicada: { type: String, trim: true },
    tiempoEstimadoHrs: { type: Number, min: 0 },
    tiempoRealHrs: { type: Number, min: 0 },
    // Preventivos/Predictivos (PMP, PMT, PTJ)
    descripcionTrabajo: { type: String, trim: true },
    tareasEjecutadas: [{ type: String, trim: true }],

    adjuntos: [AdjuntoSchema],
    observaciones: { type: String, trim: true },
  },
  { _id: false }
);

const DatosSupervisionSchema = new Schema(
  {
    codigoModoFallaISO: { type: String, trim: true },
    clasificacionRCM: { type: String, trim: true },
    criticidadEquipo: { type: String, trim: true },
    leccionAprendida: { type: String, trim: true },
    requierePlanificacion: { type: Boolean },
    otRelacionada: { type: String, trim: true },
    comentariosSupervisor: { type: String, trim: true },
    revisadoPor: { type: String, ref: "Usuario" },
    revisadoEn: { type: Date },
  },
  { _id: false }
);

const RegistroDiarioSchema = new Schema(
  {
    fecha:             { type: Date, required: true },
    tecnico:           { type: String, required: true, trim: true },
    usuarioId:         { type: String, trim: true },
    hhTrabajadas:      { type: Number, required: true, min: 0 },
    tareasEjecutadas:  [{ type: String, trim: true }],
    observaciones:     { type: String, trim: true },
  },
  { _id: true }
);

const CambioHistorialSchema = new Schema(
  {
    fechaHora: { type: Date, default: Date.now },
    usuarioId: { type: String, ref: "Usuario", required: true },
    nombreUsuario: { type: String, required: true, trim: true },
    cambio: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const TecnicoRefSchema = new Schema(
  {
    usuarioId: { type: String, ref: "Usuario" },
    nombreCompleto: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const OrdenTrabajoSchema = new Schema<OrdenTrabajoDocument>(
  {
    numeroOT: { type: String, unique: true, trim: true },
    fecha: { type: Date, required: true },
    turno: {
      type: String,
      required: true,
      enum: ["Diurno", "Nocturno", "Parada de Planta", "Planta", "Otro"],
    },
    areaCodigo: { type: String, required: true, trim: true },
    tecnicos: { type: [TecnicoRefSchema], required: true, validate: [(v: unknown[]) => v.length >= 1, "Se requiere al menos un técnico"] },
    lineas: { type: [LineaOTSchema], required: true, validate: [(v: unknown[]) => v.length >= 1, "Se requiere al menos una línea de trabajo"] },
    estado: {
      type: String,
      required: true,
      enum: ["borrador", "pendiente_revision", "solicitar_correccion", "revisado", "concluido"],
      default: "borrador",
    },
    datosSupervision: { type: DatosSupervisionSchema, default: () => ({}) },
    historialCambios:  { type: [CambioHistorialSchema], default: [] },
    registrosDiarios:  { type: [RegistroDiarioSchema], default: [] },
    // Enlace al plan semanal
    origenPlan:            { type: Boolean, default: false },
    programacionSemanalId: { type: String, trim: true },
    otJdeNumero:           { type: String, trim: true },
    otJdeDia:              { type: String, trim: true },
  },
  { timestamps: true }
);

// Auto-generar numeroOT secuencial al crear
OrdenTrabajoSchema.pre("save", async function () {
  if (this.isNew && !this.numeroOT) {
    this.numeroOT = await siguienteNumeroOT();
  }
});

// Dashboard del supervisor: filtrar por área + estado + fecha
OrdenTrabajoSchema.index({ areaCodigo: 1, estado: 1, fecha: -1 });
// Consulta por técnico
OrdenTrabajoSchema.index({ "tecnicos.usuarioId": 1, fecha: -1 });
// Consulta por TAG desde historial de equipo
OrdenTrabajoSchema.index({ "lineas.tag": 1, fecha: -1 });
// Enlace al plan semanal
OrdenTrabajoSchema.index({ programacionSemanalId: 1, otJdeNumero: 1 });
OrdenTrabajoSchema.index({ origenPlan: 1, estado: 1 });

export const OrdenTrabajo =
  mongoose.models.OrdenTrabajo ||
  mongoose.model<OrdenTrabajoDocument>("OrdenTrabajo", OrdenTrabajoSchema);
