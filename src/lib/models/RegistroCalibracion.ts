import mongoose, { Schema, Document } from "mongoose";
import { IRegistroCalibracion } from "@/types";

export interface RegistroCalibracionDocument extends Omit<IRegistroCalibracion, "_id">, Document {}

const PuntoCalibracionSchema = new Schema(
  {
    lecturaPatron: { type: Number, required: true },
    lecturaAntesInstrumento: { type: Number },
    lecturaInstrumento: { type: Number, required: true },
    error: { type: Number, required: true },
    tolerancia: { type: Number, required: true },
    aprueba: { type: Boolean, required: true },
    incertidumbre: { type: Number },           // U expandida (k=2, 95%)
    incertidumbrePatron: { type: Number },     // u del patrón declarada
  },
  { _id: false }
);

const RegistroCalibracionSchema = new Schema<RegistroCalibracionDocument>(
  {
    numeroCertificado: { type: String, unique: true, trim: true },
    tag: { type: String, required: true, trim: true, uppercase: true },
    descripcionInstrumento: { type: String, required: true, trim: true },
    tipoVariable: { type: String, required: true, trim: true },
    patronId: { type: String, ref: "Patron" },          // compat legado
    patronCodigo: { type: String, trim: true },          // compat legado
    patronIds: [{ type: String, ref: "Patron" }],        // multi-patrón
    patronCodigos: [{ type: String, trim: true }],       // multi-patrón
    tecnicoId: { type: String, ref: "Usuario", required: true },
    tecnicoNombre: { type: String, required: true, trim: true },
    supervisorId: { type: String, ref: "Usuario" },
    supervisorNombre: { type: String, trim: true },
    fecha: { type: Date, required: true },
    temperatura: { type: Number },
    humedad: { type: Number },
    turno: { type: String, trim: true },
    unidad: { type: String, trim: true },
    puntos: { type: [PuntoCalibracionSchema], required: true, validate: [(v: unknown[]) => v.length >= 1, "Se requiere al menos un punto"] },
    puntosAntes: { type: [PuntoCalibracionSchema], default: [] },
    resultadoGeneral: { type: String, required: true, enum: ["APROBADO", "RECHAZADO", "AJUSTADO"] },
    observaciones: { type: String, trim: true },
    pdfUrl: { type: String },
    stickerImpreso: { type: Boolean, default: false },
    otAsociada: { type: String, trim: true },
    areaCodigo: { type: String, required: true, default: "3320" },
  },
  { timestamps: true }
);

RegistroCalibracionSchema.index({ tag: 1, fecha: -1 });
RegistroCalibracionSchema.index({ areaCodigo: 1, fecha: -1 });

// Force re-register in dev so schema changes are picked up without manual cache clearing
if (process.env.NODE_ENV !== "production" && mongoose.models.RegistroCalibracion) {
  delete (mongoose.models as Record<string, unknown>).RegistroCalibracion;
}

export const RegistroCalibracion =
  (mongoose.models.RegistroCalibracion as mongoose.Model<RegistroCalibracionDocument>) ||
  mongoose.model<RegistroCalibracionDocument>("RegistroCalibracion", RegistroCalibracionSchema);
