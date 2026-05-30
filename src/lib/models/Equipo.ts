import mongoose, { Schema, Document } from "mongoose";
import { IEquipo } from "@/types";

export interface EquipoDocument extends Omit<IEquipo, "_id">, Document {}

const EquipoSchema = new Schema<EquipoDocument>(
  {
    tag:               { type: String, required: true, unique: true, trim: true, uppercase: true },
    descripcion:       { type: String, required: true, trim: true },
    descripcion2:      { type: String, trim: true },
    descripcion3:      { type: String, trim: true },
    nivel:             { type: Number, required: true, min: 1, max: 8 },
    parentTag:         { type: String, trim: true, uppercase: true },
    nivelPath:         [{ type: String, trim: true }],
    tipoEquipo:        { type: String, required: true, trim: true, default: "." },
    descripcionTipo:   { type: String, trim: true },
    subtipo:           { type: String, trim: true },
    descripcionSubtipo:{ type: String, trim: true },
    categoriaISO:      { type: String, trim: true, default: null },
    criticidad:        { type: String, enum: ["A", "B", "C"] },
    centroCosto:       { type: String, trim: true },
    areaCodigo:        { type: String, required: true, trim: true },
    descripcionArea:   { type: String, trim: true },
    fabricante:        { type: String, trim: true },
    modelo:            { type: String, trim: true },
    serie:             { type: String, trim: true },
    fechaInstalacion:  { type: Date },
    vidaUtilEstimadaAnos: { type: Number, min: 0 },
    activo:            { type: Boolean, default: true },
  },
  { timestamps: true }
);

EquipoSchema.index({ tag: "text", descripcion: "text" });
EquipoSchema.index({ areaCodigo: 1, nivel: 1, activo: 1 });
EquipoSchema.index({ parentTag: 1 });
EquipoSchema.index({ nivel: 1, tipoEquipo: 1 });

// Force schema recompilation in dev
if (process.env.NODE_ENV !== "production" && mongoose.models.Equipo) {
  delete (mongoose.models as Record<string, unknown>).Equipo;
}

export const Equipo =
  mongoose.models.Equipo ||
  mongoose.model<EquipoDocument>("Equipo", EquipoSchema);
