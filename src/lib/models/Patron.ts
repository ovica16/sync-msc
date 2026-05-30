import mongoose, { Schema, Document } from "mongoose";
import { IPatron } from "@/types";

export interface PatronDocument extends Omit<IPatron, "_id">, Document {}

const PatronSchema = new Schema<PatronDocument>(
  {
    codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    descripcion: { type: String, required: true, trim: true },
    tipo: { type: String, required: true, trim: true }, // Presión, Temperatura, Flujo, Nivel, Multifunción
    marca: { type: String, required: true, trim: true },
    modelo: { type: String, required: true, trim: true },
    numeroSerie: { type: String, required: true, trim: true },
    fechaUltimaCalibracion: { type: Date, required: true },
    fechaVencimiento: { type: Date, required: true },
    frecuenciaCalibracion: { type: String, required: true, trim: true }, // "6 meses", "1 año", etc.
    rangoMin: { type: Number },
    rangoMax: { type: Number },
    precision: { type: String, trim: true },
    ubicacion: { type: String, trim: true },
    responsable: { type: String, trim: true },
    certificadoUrl: { type: String },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Alertas de vencimiento: consultas frecuentes por fecha
PatronSchema.index({ fechaVencimiento: 1, activo: 1 });

export const Patron =
  mongoose.models.Patron ||
  mongoose.model<PatronDocument>("Patron", PatronSchema);
