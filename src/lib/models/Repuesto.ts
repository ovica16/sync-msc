import mongoose, { Schema, Document } from "mongoose";
import { IRepuesto } from "@/types";

export interface RepuestoDocument extends Omit<IRepuesto, "_id">, Document {}

const RepuestoSchema = new Schema<RepuestoDocument>(
  {
    codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    descripcion: { type: String, required: true, trim: true },
    tipo: { type: String, required: true, enum: ["Eléctrico", "Mecánico", "Instrumentación", "General"] },
    stockMinimo: { type: Number, required: true, min: 0 },
    stockActual: { type: Number, required: true, min: 0, default: 0 },
    ubicacion: { type: String, required: true, trim: true },
    precio: { type: Number, min: 0 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

RepuestoSchema.index({ tipo: 1, activo: 1 });
// Alerta cuando stockActual < stockMinimo — consulta frecuente
RepuestoSchema.index({ stockActual: 1, stockMinimo: 1, activo: 1 });

export const Repuesto =
  mongoose.models.Repuesto ||
  mongoose.model<RepuestoDocument>("Repuesto", RepuestoSchema);
