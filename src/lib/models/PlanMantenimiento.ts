import mongoose, { Schema, Document } from "mongoose";
import { IPlanMantenimiento } from "@/types";

export interface PlanMantenimientoDocument extends Omit<IPlanMantenimiento, "_id">, Document {}

const TareaPlanSchema = new Schema(
  {
    tag: { type: String, required: true, trim: true, uppercase: true },
    descripcionTarea: { type: String, required: true, trim: true },
    horasEstimadas: { type: Number, required: true, min: 0 },
    diaPreferido: { type: String, trim: true },
    herramientas: [{ type: String, trim: true }],
    repuestos: [{ type: String, trim: true }],
    procedimiento: { type: String, trim: true },
  },
  { _id: false }
);

const PlanMantenimientoSchema = new Schema<PlanMantenimientoDocument>(
  {
    codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    descripcion: { type: String, required: true, trim: true },
    frecuencia: {
      type: String,
      required: true,
      enum: ["Semanal", "Quincenal", "Mensual", "Trimestral", "Anual"],
    },
    disciplina: { type: String, required: true, enum: ["MEC", "ELEC", "INST", "GENERAL"] },
    tareas: [TareaPlanSchema],
    activo: { type: Boolean, default: true },
    creadoPor: { type: String, ref: "Usuario", required: true },
  },
  { timestamps: true }
);

PlanMantenimientoSchema.index({ disciplina: 1, activo: 1 });
PlanMantenimientoSchema.index({ "tareas.tag": 1 });

export const PlanMantenimiento =
  mongoose.models.PlanMantenimiento ||
  mongoose.model<PlanMantenimientoDocument>("PlanMantenimiento", PlanMantenimientoSchema);
